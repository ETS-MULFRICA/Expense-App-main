import { logActivity, logActivityAsync } from './activity-loggers';
// Import Express types and HTTP server creation
import type { Express, Request, Response } from "express";
import cors from "cors";
import { corsOptions } from "./cors-config";
import { createServer, type Server } from "http";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
// Import database storage layer
import { storage } from "./storage";
import { pool } from "./db";
// Import authentication setup
import { setupAuth } from "./auth";
// Import Zod validation schemas for data validation
import { 
  insertExpenseSchema, legacyInsertExpenseSchema, 
  insertIncomeSchema, insertBudgetSchema, insertBudgetAllocationSchema,
  insertExpenseCategorySchema, insertExpenseSubcategorySchema,
  insertIncomeCategorySchema, insertIncomeSubcategorySchema,
  insertReportSchema, updateReportActionSchema
} from "@shared/schema";
import { z } from "zod";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
// duplicate import removed

/**
 * Authentication Middleware
 * Checks if user is logged in before allowing access to protected routes
 * Returns 401 Unauthorized if user is not authenticated
 */
const requireAuth = async (req: Request, res: Response, next: Function) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.sendStatus(401);
  }
  try {
    const userId = req.user.id;
    try {
      // Prefer status-aware auth if the column exists
      const result = await pool.query('SELECT id, status FROM users WHERE id = $1', [userId]);
      if (result.rowCount === 0) {
        req.logout?.(() => {});
        return res.sendStatus(401);
      }
      const status = result.rows[0].status as string | undefined;
      if (status === 'suspended') return res.status(403).json({ message: 'Account suspended' });
      if (status === 'deleted') return res.status(403).json({ message: 'Account deleted' });
    } catch (e: any) {
      // If the status column doesn't exist yet, skip the status check (compat mode)
      if (e?.code !== '42703') {
        throw e;
      }
    }
    return next();
  } catch (_err) {
    return res.status(503).json({ message: 'Authentication unavailable: database error' });
  }
};

/**
 * Admin Authorization Middleware
 * Checks if user is authenticated AND has admin role
 * Returns 401 if not authenticated, 403 if not admin
 */
const requireAdmin = async (req: Request, res: Response, next: Function) => {
  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }
  
  const userRole = await storage.getUserRole(req.user!.id);
  if (userRole !== 'admin') {
    return res.status(403).json({ message: "Access denied" });
  }
  
  next();
};

// Permission check helper
async function userHasPermission(userId: number, permissionName: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
     FROM user_roles ur
     JOIN role_permissions rp ON rp.role_id = ur.role_id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE ur.user_id = $1 AND p.name = $2
     LIMIT 1`,
    [userId, permissionName]
  );
  if ((result.rowCount ?? 0) > 0) return true;
  // Fallback: grant if legacy role is admin
  try {
    const role = await storage.getUserRole(userId);
    if (role === 'admin') return true;
  } catch {}
  return false;
}

function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated() || !req.user) return res.sendStatus(401);
    try {
      const ok = await userHasPermission(req.user.id, permission);
      if (!ok) return res.status(403).json({ message: 'Forbidden' });
      next();
    } catch (e) {
      console.error('Permission check failed', e);
      return res.status(500).json({ message: 'Permission check error' });
    }
  };
}

/**
 * Main Route Registration Function
 * Sets up all API endpoints for the expense management system
 * Returns HTTP server instance for external configuration
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // ESM __dirname shim
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // Simple in-memory cache for admin dashboard to reduce load on repeated views
  let dashboardCache: { data: any; ts: number } | null = null;

  // --- Announcements ---
  // Public (authenticated) list of published announcements (latest first)
  app.get('/api/announcements', requireAuth, async (req, res) => {
    try {
      const rawLimit = Array.isArray((req.query as any).limit) ? (req.query as any).limit[0] : (req.query as any).limit;
      let limit = parseInt(rawLimit ?? '20');
      if (!Number.isFinite(limit) || limit <= 0) limit = 20;
      if (limit > 500) limit = 500;
      const r = await pool.query(
        `SELECT a.id, a.title, a.message, a.created_at, u.name as author_name
         FROM announcements a
         LEFT JOIN users u ON u.id = a.created_by
         WHERE a.published = TRUE
         ORDER BY a.created_at DESC
         LIMIT $1`,
        [limit]
      );
      res.json(r.rows);
    } catch (e) {
      console.error('Fetch announcements failed', e);
      res.status(500).json({ message: 'Failed to fetch announcements' });
    }
  });

  // Admin: verify email providers and SMTP connectivity (no caching, no email sent)
  app.get('/api/admin/email/verify', requireAuth, requirePermission('admin.access'), async (req, res) => {
    try {
      // No cache
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const SMTP_HOST = process.env.SMTP_HOST;
      const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
      const SMTP_USER = process.env.SMTP_USER;
      const SMTP_PASS = process.env.SMTP_PASS;
      const SMTP_FROM = process.env.SMTP_FROM;
      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

      let from = SMTP_FROM;
      try {
        if (!from) {
          const s = await pool.query('SELECT email_from FROM app_settings WHERE id = 1');
          from = s.rows[0]?.email_from || undefined;
        }
      } catch {}
      if (!from && SMTP_USER && /@/.test(SMTP_USER)) from = `Expense App <${SMTP_USER}>`;

      // @ts-ignore
      const nodemailer: any = await import('nodemailer');
      const providers: any = {
        smtp: {
          configured: !!(SMTP_HOST && SMTP_USER && SMTP_PASS),
          host: SMTP_HOST || null,
          port: SMTP_PORT || null,
          from: from || null,
          missing: [!SMTP_HOST ? 'SMTP_HOST' : null, !SMTP_USER ? 'SMTP_USER' : null, !SMTP_PASS ? 'SMTP_PASS' : null].filter(Boolean)
        },
        resend: { configured: !!RESEND_API_KEY, missing: !RESEND_API_KEY ? ['RESEND_API_KEY'] : [] },
        sendgrid: { configured: !!SENDGRID_API_KEY, missing: !SENDGRID_API_KEY ? ['SENDGRID_API_KEY'] : [] },
      };
      if (providers.smtp.configured) {
        const transporter = nodemailer.createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } } as any);
        try { providers.smtp.verified = !!(await transporter.verify()); } catch (e: any) { providers.smtp.verified = false; providers.smtp.error = e?.message || String(e); }
      }
      return res.json({ ok: true, providers });
    } catch (e: any) {
      return res.status(500).json({ ok: false, message: e?.message || 'Verification failed' });
    }
  });

  // Unread count for current user
  app.get('/api/announcements/unread-count', requireAuth, async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM announcements a
         WHERE a.published = TRUE
           AND NOT EXISTS (
             SELECT 1 FROM announcement_reads ar
             WHERE ar.user_id = $1 AND ar.announcement_id = a.id
           )`,
        [req.user!.id]
      );
      res.json({ count: r.rows[0]?.count ?? 0 });
    } catch (e) {
      console.error('Unread count failed', e);
      res.status(500).json({ message: 'Failed to fetch unread count' });
    }
  });

  // Mark all as read for current user
  app.post('/api/announcements/mark-read', requireAuth, async (req, res) => {
    try {
      // Insert reads for any published announcement not yet read
      await pool.query(
        `INSERT INTO announcement_reads (user_id, announcement_id)
         SELECT $1, a.id
         FROM announcements a
         WHERE a.published = TRUE
           AND NOT EXISTS (
             SELECT 1 FROM announcement_reads ar
             WHERE ar.user_id = $1 AND ar.announcement_id = a.id
           )`,
        [req.user!.id]
      );
      res.status(204).send();
    } catch (e) {
      console.error('Mark read failed', e);
      res.status(500).json({ message: 'Failed to mark announcements as read' });
    }
  });

  // Admin: full history
  app.get('/api/admin/announcements', requireAuth, requirePermission('admin.access'), async (_req, res) => {
    try {
      const r = await pool.query(
        `SELECT a.id, a.title, a.message, a.published, a.created_at, u.name as author_name
         FROM announcements a
         LEFT JOIN users u ON u.id = a.created_by
         ORDER BY a.created_at DESC`
      );
      res.json(r.rows);
    } catch (e) {
      console.error('Fetch admin announcements failed', e);
      res.status(500).json({ message: 'Failed to fetch announcements' });
    }
  });

  // Admin: create announcement
  app.post('/api/admin/announcements', requireAuth, requirePermission('admin.access'), async (req, res) => {
    try {
      const { title, message, published } = req.body || {};
      if (!title || !message) return res.status(400).json({ message: 'title and message required' });
      const r = await pool.query(
        `INSERT INTO announcements (title, message, created_by, published)
         VALUES ($1, $2, $3, COALESCE($4, TRUE)) RETURNING *`,
        [title, message, req.user!.id, published]
      );
      res.status(201).json(r.rows[0]);
    } catch (e) {
      console.error('Create announcement failed', e);
      res.status(500).json({ message: 'Failed to create announcement' });
    }
  });

  // Admin: delete announcement
  app.delete('/api/admin/announcements/:id', requireAuth, requirePermission('admin.access'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await pool.query('DELETE FROM announcements WHERE id = $1', [id]);
      res.status(204).send();
    } catch (e) {
      console.error('Delete announcement failed', e);
      res.status(500).json({ message: 'Failed to delete announcement' });
    }
  });
  // Lightweight capabilities endpoint: current user's permissions and app default currency
  app.get('/api/capabilities', requireAuth, async (req, res) => {
    try {
      const permissions = await storage.getUserPermissions(req.user!.id).catch(() => [] as string[]);
      let appDefaultCurrency: string | undefined;
      try {
        const r = await pool.query('SELECT default_currency FROM app_settings WHERE id = 1');
        appDefaultCurrency = r.rows[0]?.default_currency;
      } catch {}
      res.json({ permissions, appDefaultCurrency });
    } catch (e) {
      console.error('Capabilities fetch failed', e);
      res.status(500).json({ message: 'Failed to fetch capabilities' });
    }
  });

  // Public app settings (read-only): expose branding and minimal safe fields
  // Used by all clients (including non-admin) to render global branding consistently
  app.get('/api/settings', async (_req, res) => {
    try {
      const r = await pool.query(
        'SELECT site_name, logo_data_url FROM app_settings WHERE id = 1'
      );
      // Prevent caching so changes reflect immediately across all clients
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.json(r.rows[0] || {});
    } catch (e) {
      console.error('Public settings fetch failed', e);
      res.status(500).json({ message: 'Failed to fetch settings' });
    }
  });

  // --- Backups (Admin) ---
  // Admin: seed default categories for users (idempotent)
  app.post('/api/admin/seed-categories', requireAuth, requirePermission('admin.access'), async (req, res) => {
    try {
      const { userId, username } = req.body || {};
      let users: any[];

      if (userId != null || (username && String(username).trim())) {
        let target: any = null;
        if (username && String(username).trim()) {
          // Case-insensitive username lookup
          const u = String(username).trim();
          const r = await pool.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1', [u]);
          target = r.rows[0] || null;
        } else if (userId != null) {
          const idNum = Number(userId);
          if (Number.isFinite(idNum)) {
            target = await storage.getUser(idNum);
          }
        }
        if (!target) return res.status(404).json({ message: 'User not found' });
        users = [target];
      } else {
        users = await storage.getAllUsers();
      }

      const details: Array<{ id: number; username: string; processed: boolean; error?: string }>= [];
      let processed = 0;
      for (const u of users) {
        try {
          await storage.createDefaultCategories(u.id);
          processed++;
          details.push({ id: u.id, username: u.username, processed: true });
        } catch (e: any) {
          console.warn('Seeding categories failed for user', u?.id, e);
          details.push({ id: u.id, username: u.username, processed: false, error: e?.message || String(e) });
        }
      }
      try { await logActivity({ userId: req.user!.id, actionType: 'UPDATE', resourceType: 'SETTINGS', description: `Admin seeded categories for ${processed} user(s)`, ipAddress: req.ip, userAgent: req.get('User-Agent') }); } catch {}
      res.json({ ok: true, processed, details });
    } catch (e) {
      console.error('Seed categories error', e);
      res.status(500).json({ message: 'Failed to seed categories' });
    }
  });

  app.post('/api/admin/backup', requireAuth, requirePermission('admin.access'), async (req, res) => {
    try {
      // Parse DB connection from env (supports DATABASE_URL)
      const parseDbUrl = (url?: string) => {
        if (!url) return null;
        try {
          const u = new URL(url);
          if (u.protocol !== 'postgres:' && u.protocol !== 'postgresql:') return null;
          return {
            host: u.hostname,
            port: u.port || '5432',
            user: decodeURIComponent(u.username),
            password: decodeURIComponent(u.password),
            database: u.pathname.replace(/^\//, ''),
          };
        } catch {
          return null;
        }
      };
      const fromUrl = parseDbUrl(process.env.DATABASE_URL);
      const DB_HOST = fromUrl?.host || process.env.DB_HOST;
      const DB_PORT = fromUrl?.port || process.env.DB_PORT || '5432';
      const DB_USER = fromUrl?.user || process.env.DB_USER;
      const DB_PASSWORD = fromUrl?.password || process.env.DB_PASSWORD;
      const DB_NAME = fromUrl?.database || process.env.DB_NAME;
      if (!DB_HOST || !DB_USER || !DB_NAME) {
        return res.status(400).json({ message: 'Database backup not configured. Set DATABASE_URL or DB_HOST, DB_USER, DB_NAME (and DB_PASSWORD if required).'});
      }

      const backupsDir = path.resolve(__dirname, '../backups');
      if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const file = path.join(backupsDir, `backup-${ts}.sql`);
      // Use pg_dump; require PG env vars to be set
      const args = [
        `--host=${DB_HOST}`,
        `--port=${DB_PORT}`,
        `--username=${DB_USER}`,
        `--no-owner`,
        `${DB_NAME}`
      ];
      const env = { ...process.env } as any;
      // If password set, use PGPASSWORD for pg_dump
      if (DB_PASSWORD) env.PGPASSWORD = DB_PASSWORD;
      const pgDumpBin = process.env.PG_DUMP_PATH || 'pg_dump';
      const proc = spawn(pgDumpBin, args, { env });
      let responded = false;
      const w = fs.createWriteStream(file);
      const fail = (msg: string, err?: any) => {
        if (responded) return; responded = true;
        try { w.destroy(); } catch {}
        console.error(msg, err || '');
        res.status(500).json({ ok: false, message: msg, error: typeof err === 'string' ? err : (err?.message || String(err || '')) });
      };
      w.on('error', (e) => fail('Backup failed writing file', e));
      proc.on('error', (e) => fail('Backup failed to start. Ensure pg_dump is installed (or set PG_DUMP_PATH).', e));
      proc.stdout.pipe(w);
      let stderr = '';
      proc.stderr.on('data', d => stderr += d.toString());
      proc.on('close', async (code) => {
        if (responded) return;
        if (code === 0) {
          try { await logActivity({ userId: req.user!.id, actionType: 'VIEW', resourceType: 'REPORT', description: `Admin triggered backup ${path.basename(file)}`, ipAddress: req.ip, userAgent: req.get('User-Agent') }); } catch {}
          responded = true;
          return res.json({ ok: true, file: path.basename(file) });
        } else {
          console.error('pg_dump failed', stderr);
          return fail('Backup failed. Ensure pg_dump is installed and available in PATH or set PG_DUMP_PATH. Also verify DB env vars/DATABASE_URL.', stderr.trim());
        }
      });
    } catch (e) {
      console.error('Backup error', e);
      res.status(500).json({ message: 'Backup failed' });
    }
  });

  app.get('/api/admin/backups', requireAuth, requirePermission('admin.access'), async (_req, res) => {
    try {
      const backupsDir = path.resolve(__dirname, '../backups');
      if (!fs.existsSync(backupsDir)) return res.json([]);
      const files = fs.readdirSync(backupsDir)
        .filter(f => f.endsWith('.sql'))
        .map(f => {
          const full = path.join(backupsDir, f);
          const stat = fs.statSync(full);
          return { file: f, size: stat.size, createdAt: stat.mtime.toISOString() };
        })
        .sort((a, b) => a.file < b.file ? 1 : -1);
      res.json(files);
    } catch (e) {
      res.status(500).json({ message: 'Failed to list backups' });
    }
  });

  app.get('/api/admin/backups/:file', requireAuth, requirePermission('admin.access'), async (req, res) => {
    try {
      const backupsDir = path.resolve(__dirname, '../backups');
      const filePath = path.join(backupsDir, path.basename(req.params.file));
      if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Not found' });
      res.setHeader('Content-Type', 'application/sql');
      res.setHeader('Content-Disposition', `attachment; filename=${path.basename(filePath)}`);
      fs.createReadStream(filePath).pipe(res);
    } catch (e) {
      res.status(500).json({ message: 'Failed to download backup' });
    }
  });

  // Restore from a backup file (DANGEROUS). Requires confirm=true in body.
  app.post('/api/admin/restore', requireAuth, requirePermission('admin.access'), async (req, res) => {
    try {
      const { file, confirm } = req.body || {};
      if (!confirm) return res.status(400).json({ message: 'Confirmation required' });
      if (!file || typeof file !== 'string') return res.status(400).json({ message: 'file is required' });
      const backupsDir = path.resolve(__dirname, '../backups');
      const filePath = path.join(backupsDir, path.basename(file));
      if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Backup not found' });
      // Safety: in production, require explicit ENABLE_RESTORE=yes
      if (process.env.NODE_ENV === 'production' && process.env.ENABLE_RESTORE !== 'yes') {
        return res.status(403).json({ message: 'Restore disabled in production (set ENABLE_RESTORE=yes to allow)' });
      }
      // Parse DB connection from env (supports DATABASE_URL)
      const parseDbUrl = (url?: string) => {
        if (!url) return null;
        try {
          const u = new URL(url);
          if (u.protocol !== 'postgres:' && u.protocol !== 'postgresql:') return null;
          return {
            host: u.hostname,
            port: u.port || '5432',
            user: decodeURIComponent(u.username),
            password: decodeURIComponent(u.password),
            database: u.pathname.replace(/^\//, ''),
          };
        } catch {
          return null;
        }
      };
      const fromUrl = parseDbUrl(process.env.DATABASE_URL);
      const DB_HOST = fromUrl?.host || process.env.DB_HOST || 'localhost';
      const DB_PORT = fromUrl?.port || process.env.DB_PORT || '5432';
      const DB_USER = fromUrl?.user || process.env.DB_USER || '';
      const DB_PASSWORD = fromUrl?.password || process.env.DB_PASSWORD;
      const DB_NAME = fromUrl?.database || process.env.DB_NAME || '';
      const args = [
        `--host=${DB_HOST}`,
        `--port=${DB_PORT}`,
        `--username=${DB_USER}`,
        `${DB_NAME}`
      ];
      const env = { ...process.env } as any;
      if (DB_PASSWORD) env.PGPASSWORD = DB_PASSWORD;
      const psqlBin = process.env.PSQL_PATH || 'psql';
      const proc = spawn(psqlBin, args, { env });
      let responded = false;
      const fail = (msg: string, err?: any) => {
        if (responded) return; responded = true;
        console.error(msg, err || '');
        res.status(500).json({ ok: false, message: msg, error: typeof err === 'string' ? err : (err?.message || String(err || '')) });
      };
      proc.on('error', (e) => fail('Restore failed to start. Ensure psql is installed (or set PSQL_PATH).', e));
      const r = fs.createReadStream(filePath);
      r.on('error', (e) => fail('Restore failed reading backup file', e));
      r.pipe(proc.stdin);
      let stderr = '';
      let stdout = '';
      proc.stderr.on('data', d => stderr += d.toString());
      proc.stdout.on('data', d => stdout += d.toString());
      proc.on('close', async (code) => {
        if (responded) return;
        if (code === 0) {
          try { await logActivity({ userId: req.user!.id, actionType: 'UPDATE', resourceType: 'REPORT', description: `Admin restored DB from ${path.basename(filePath)}`, ipAddress: req.ip, userAgent: req.get('User-Agent') }); } catch {}
          responded = true;
          return res.json({ ok: true, message: 'Restore completed' });
        }
        console.error('psql restore failed', stderr);
        fail('Restore failed. Ensure psql is installed and in PATH or set PSQL_PATH. Also verify DB env vars/DATABASE_URL.', stderr.trim());
      });
    } catch (e) {
      console.error('Restore error', e);
      res.status(500).json({ message: 'Restore failed' });
    }
  });

  // Admin: send direct email to users
  app.post('/api/admin/email', requireAuth, requirePermission('admin.access'), async (req, res) => {
    try {
      const { toUserId, toEmail, subject, html, text } = req.body || {};
      const mode = String((req.body?.mode || 'auto')).toLowerCase(); // 'auto' | 'real' | 'preview'
      const providerReq = String((req.body?.provider || 'auto')).toLowerCase(); // 'auto'|'smtp'|'resend'|'sendgrid'
      if (!subject || (!html && !text)) return res.status(400).json({ message: 'subject and html or text are required' });
      let recipient = String(toEmail || '').trim();
      if (!recipient && toUserId) {
        const r = await pool.query('SELECT email FROM users WHERE id = $1', [toUserId]);
        recipient = r.rows[0]?.email || '';
      }
      if (!recipient) return res.status(400).json({ message: 'Recipient email not provided' });

      const SMTP_HOST = process.env.SMTP_HOST;
      const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
      const SMTP_USER = process.env.SMTP_USER;
      const SMTP_PASS = process.env.SMTP_PASS;
      const SMTP_FROM = process.env.SMTP_FROM;
      let from = SMTP_FROM;
      try {
        if (!from) {
          const s = await pool.query('SELECT email_from FROM app_settings WHERE id = 1');
          from = s.rows[0]?.email_from || undefined;
        }
      } catch {}
      // Fallback From: if SMTP creds exist but no explicit From provided, use SMTP_USER
      if (!from && SMTP_USER && /@/.test(SMTP_USER)) {
        from = `Expense App <${SMTP_USER}>`;
      }

      // Providers env
      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

      // @ts-ignore - nodemailer types may not be resolvable in this setup; we treat it as any
      const nodemailer: any = await import('nodemailer');
      let usedEthereal = false;
      let providerUsed: 'smtp'|'resend'|'sendgrid'|'ethereal'|null = null;

  const sendViaSMTP = async () => {
        const transporter = nodemailer.createTransport({
          host: SMTP_HOST,
          port: SMTP_PORT,
          secure: SMTP_PORT === 465,
          auth: { user: SMTP_USER, pass: SMTP_PASS }
        } as any);
        const info = await transporter.sendMail({ from, to: recipient, subject, html, text });
        const out: any = { ok: true, id: info?.messageId || null, provider: 'smtp', mode: 'real' };
        return out;
  };

  const splitFrom = (fromStr: string | undefined) => {
        if (!fromStr) return { email: '', name: '' };
        const m = fromStr.match(/^(.*)<([^>]+)>$/);
        if (m) return { name: m[1].trim().replace(/^"|"$/g,''), email: m[2].trim() };
        return { name: '', email: fromStr.trim() };
  };

  const sendViaResend = async () => {
        const { email: fromEmail, name } = splitFrom(from);
        const payload: any = { from: fromEmail || from, to: recipient, subject };
        if (html) payload.html = html; else payload.text = text;
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) {
          const err = await resp.text();
          throw new Error(`Resend error ${resp.status}: ${err}`);
        }
        const j: any = await resp.json();
        return { ok: true, id: j?.id || null, provider: 'resend', mode: 'real' };
  };

  const sendViaSendGrid = async () => {
        const { email: fromEmail, name } = splitFrom(from);
        const contentType = html ? 'text/html' : 'text/plain';
        const contentVal = html || text || '';
        const payload: any = {
          personalizations: [{ to: [{ email: recipient }] }],
          from: fromEmail ? { email: fromEmail, name: name || undefined } : { email: from as string },
          subject,
          content: [{ type: contentType, value: contentVal }]
        };
        const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) {
          const err = await resp.text();
          throw new Error(`SendGrid error ${resp.status}: ${err}`);
        }
        // SendGrid returns 202 with no body
        return { ok: true, id: null, provider: 'sendgrid', mode: 'real' };
  };

      let result: any = null;
      const hasSmtp = !!(SMTP_HOST && SMTP_USER && SMTP_PASS && from);
      const hasResend = !!RESEND_API_KEY;
      const hasSendGrid = !!SENDGRID_API_KEY;

      if (mode === 'preview') {
        const testAccount = await nodemailer.createTestAccount();
        const transporter = nodemailer.createTransport({ host: 'smtp.ethereal.email', port: 587, secure: false, auth: { user: testAccount.user, pass: testAccount.pass } } as any);
        if (!from) from = `Expense App <${testAccount.user}>`;
        const info = await transporter.sendMail({ from, to: recipient, subject, html, text });
        result = { ok: true, id: info?.messageId || null, provider: 'ethereal', mode: 'preview', previewUrl: nodemailer.getTestMessageUrl(info) || null };
      } else {
        // real or auto
        const provider = providerReq;
        if (provider === 'smtp') {
          if (!hasSmtp) return res.status(400).json({ message: 'SMTP not configured for real delivery.' });
          result = await sendViaSMTP();
        } else if (provider === 'resend') {
          if (!hasResend) return res.status(400).json({ message: 'RESEND_API_KEY not configured.' });
          result = await sendViaResend();
        } else if (provider === 'sendgrid') {
          if (!hasSendGrid) return res.status(400).json({ message: 'SENDGRID_API_KEY not configured.' });
          result = await sendViaSendGrid();
        } else {
          // auto priority: SMTP → Resend → SendGrid → (fallback preview in dev)
          if (hasSmtp) result = await sendViaSMTP();
          else if (hasResend) result = await sendViaResend();
          else if (hasSendGrid) result = await sendViaSendGrid();
          else if (process.env.NODE_ENV !== 'production') {
            const testAccount = await nodemailer.createTestAccount();
            const transporter = nodemailer.createTransport({ host: 'smtp.ethereal.email', port: 587, secure: false, auth: { user: testAccount.user, pass: testAccount.pass } } as any);
            if (!from) from = `Expense App <${testAccount.user}>`;
            const info = await transporter.sendMail({ from, to: recipient, subject, html, text });
            result = { ok: true, id: info?.messageId || null, provider: 'ethereal', mode: 'preview', previewUrl: nodemailer.getTestMessageUrl(info) || null };
          } else {
            return res.status(400).json({ message: 'Email not configured for real delivery. Set SMTP_* envs or RESEND_API_KEY or SENDGRID_API_KEY.' });
          }
        }
      }

      try { await logActivity({ userId: req.user!.id, actionType: 'CREATE', resourceType: 'EMAIL', description: `Sent email to ${recipient}: ${subject}` , ipAddress: req.ip, userAgent: req.get('User-Agent') }); } catch {}
      return res.json(result);
    } catch (e: any) {
      console.error('Email send failed', e);
      res.status(500).json({ message: 'Failed to send email', error: e?.message });
    }
  });

  // Login attempts list (Admin)
  app.get('/api/admin/login-attempts', requireAuth, requirePermission('admin.access'), async (req, res) => {
    try {
      const rawLimit = Array.isArray((req.query as any).limit) ? (req.query as any).limit[0] : (req.query as any).limit;
    const rawOffset = Array.isArray((req.query as any).offset) ? (req.query as any).offset[0] : (req.query as any).offset;
      let limit = parseInt(rawLimit ?? '50');
    let offset = parseInt(rawOffset ?? '0');
      if (!Number.isFinite(limit) || limit <= 0) limit = 50;
      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
      if (limit > 500) limit = 500;
    if (!Number.isFinite(offset) || offset < 0) offset = 0;
    const r = await pool.query('SELECT * FROM login_attempts ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
      res.json(r.rows);
    } catch (e) {
      res.status(500).json({ message: 'Failed to load login attempts' });
    }
  });

  // Activity Log: list with filters (admin only)
  app.get('/api/admin/activity-log', requireAuth, requirePermission('admin.access'), async (req, res) => {
    try {
      const qs = req.query as any;
      const params: any[] = [];
      const where: string[] = [];
      if (qs.userId) { params.push(parseInt(String(qs.userId))); where.push(`al.user_id = $${params.length}`); }
      if (qs.actionType) { params.push(String(qs.actionType)); where.push(`al.action_type = $${params.length}`); }
      if (qs.from) { params.push(new Date(String(qs.from))); where.push(`al.created_at >= $${params.length}`); }
      if (qs.to) { params.push(new Date(String(qs.to))); where.push(`al.created_at <= $${params.length}`); }
      let limit = parseInt(qs.limit ?? '100');
      let offset = parseInt(qs.offset ?? '0');
      if (!Number.isFinite(limit) || limit <= 0) limit = 100; if (limit > 1000) limit = 1000;
      if (!Number.isFinite(offset) || offset < 0) offset = 0;
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      params.push(limit); params.push(offset);
      const q = await pool.query(
        `SELECT al.*, u.name AS user_name
         FROM activity_log al
         LEFT JOIN users u ON u.id = al.user_id
         ${whereSql}
         ORDER BY al.created_at DESC
         LIMIT $${params.length-1} OFFSET $${params.length}`,
        params
      );
      res.json(q.rows);
    } catch (e) {
      console.error('Activity log list failed', e);
      res.status(500).json({ message: 'Failed to load activity log' });
    }
  });

  // Activity Log: export CSV (admin only)
  app.get('/api/admin/activity-log/export', requireAuth, requirePermission('admin.access'), async (req, res) => {
    try {
      const qs = req.query as any;
      const params: any[] = [];
      const where: string[] = [];
      if (qs.userId) { params.push(parseInt(String(qs.userId))); where.push(`al.user_id = $${params.length}`); }
      if (qs.actionType) { params.push(String(qs.actionType)); where.push(`al.action_type = $${params.length}`); }
      if (qs.from) { params.push(new Date(String(qs.from))); where.push(`al.created_at >= $${params.length}`); }
      if (qs.to) { params.push(new Date(String(qs.to))); where.push(`al.created_at <= $${params.length}`); }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const q = await pool.query(
        `SELECT al.*, u.name AS user_name
         FROM activity_log al
         LEFT JOIN users u ON u.id = al.user_id
         ${whereSql}
         ORDER BY al.created_at DESC`,
        params
      );
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=activity-log-${Date.now()}.csv`);
      // CSV header
      res.write('timestamp,user_id,user_name,action_type,resource_type,resource_id,ip_address,user_agent,description\n');
      for (const r of q.rows) {
        const line = [
          new Date(r.created_at).toISOString(),
          r.user_id,
          (r.user_name||'').replace(/,/g,' '),
          r.action_type,
          r.resource_type,
          r.resource_id ?? '',
          r.ip_address ?? '',
          (r.user_agent||'').replace(/,/g,' '),
          (r.description||'').replace(/\n/g,' ').replace(/,/g,' ')
        ].join(',');
        res.write(line + '\n');
      }
      res.end();
    } catch (e) {
      console.error('Activity log export failed', e);
      res.status(500).json({ message: 'Failed to export activity log' });
    }
  });
  // --- Roles & Permissions admin API ---
  app.get('/api/admin/roles', requireAuth, requirePermission('admin.access'), async (_req, res) => {
    const roles = await pool.query('SELECT * FROM roles ORDER BY created_at DESC');
    res.json(roles.rows);
  });

  app.get('/api/admin/permissions', requireAuth, requirePermission('admin.access'), async (_req, res) => {
    const perms = await pool.query('SELECT * FROM permissions ORDER BY created_at DESC');
    res.json(perms.rows);
  });

  app.post('/api/admin/roles', requireAuth, requirePermission('admin.access'), async (req, res) => {
    const { name, description } = req.body || {};
    if (!name || typeof name !== 'string') return res.status(400).json({ message: 'Name is required' });
    try {
      const result = await pool.query('INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING *', [name.trim(), description || null]);
      res.status(201).json(result.rows[0]);
    } catch (e: any) {
      if (e.code === '23505') return res.status(409).json({ message: 'Role already exists' });
      console.error('Create role error', e);
      res.status(500).json({ message: 'Failed to create role' });
    }
  });

  app.post('/api/admin/roles/:roleId/permissions', requireAuth, requirePermission('admin.access'), async (req, res) => {
    const roleId = parseInt(req.params.roleId);
    const { permissionIds } = req.body || {};
    if (!Array.isArray(permissionIds)) return res.status(400).json({ message: 'permissionIds must be an array' });
    try {
      for (const pid of permissionIds) {
        await pool.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [roleId, pid]);
      }
      res.status(204).send();
    } catch (e) {
      console.error('Assign permissions error', e);
      res.status(500).json({ message: 'Failed to assign permissions' });
    }
  });

  app.delete('/api/admin/roles/:roleId/permissions/:permissionId', requireAuth, requirePermission('admin.access'), async (req, res) => {
    const roleId = parseInt(req.params.roleId);
    const permissionId = parseInt(req.params.permissionId);
    await pool.query('DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2', [roleId, permissionId]);
    res.status(204).send();
  });

  app.post('/api/admin/users/:userId/roles', requireAuth, requirePermission('user.manage'), async (req, res) => {
    const userId = parseInt(req.params.userId);
    const { roleId } = req.body || {};
    if (!roleId) return res.status(400).json({ message: 'roleId required' });
    await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, roleId]);
    res.status(204).send();
  });

  app.delete('/api/admin/users/:userId/roles/:roleId', requireAuth, requirePermission('user.manage'), async (req, res) => {
    const userId = parseInt(req.params.userId);
    const roleId = parseInt(req.params.roleId);
    await pool.query('DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2', [userId, roleId]);
    res.status(204).send();
  });

  // --- Admin CRUD for Expenses ---
  // Update any expense
  app.patch('/api/admin/expenses/:id', requireAuth, requirePermission('admin.access'), requirePermission('expense.write'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getExpenseById(id);
      if (!existing) return res.status(404).json({ message: 'Expense not found' });
      const data = req.body || {};
      // Build update payload keeping existing defaults
      const updatePayload = {
        userId: existing.user_id || existing.userId,
        amount: data.amount ?? existing.amount,
        description: data.description ?? existing.description,
        date: data.date ? new Date(data.date) : existing.date,
        categoryId: data.categoryId ?? existing.category_id ?? existing.categoryId,
        subcategoryId: data.subcategoryId ?? existing.subcategory_id ?? existing.subcategoryId,
        merchant: data.merchant ?? existing.merchant,
        notes: data.notes ?? existing.notes,
      };
      const updated = await storage.updateExpense(id, updatePayload as any);
      try { await logActivity({ userId: req.user!.id, actionType: 'UPDATE', resourceType: 'EXPENSE', resourceId: id, description: `Admin updated expense ${id}`, ipAddress: req.ip, userAgent: req.get('User-Agent') }); } catch {}
      res.json(updated);
    } catch (e) {
      console.error('Admin update expense error', e);
      res.status(500).json({ message: 'Failed to update expense' });
    }
  });

  // Delete any expense
  app.delete('/api/admin/expenses/:id', requireAuth, requirePermission('admin.access'), requirePermission('expense.write'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getExpenseById(id);
      if (!existing) return res.status(404).json({ message: 'Expense not found' });
      await storage.deleteExpense(id);
      try { await logActivity({ userId: req.user!.id, actionType: 'DELETE', resourceType: 'EXPENSE', resourceId: id, description: `Admin deleted expense ${id}`, ipAddress: req.ip, userAgent: req.get('User-Agent') }); } catch {}
      res.status(204).send();
    } catch (e) {
      console.error('Admin delete expense error', e);
      res.status(500).json({ message: 'Failed to delete expense' });
    }
  });

  // --- Admin CRUD for Incomes ---
  app.patch('/api/admin/incomes/:id', requireAuth, requirePermission('admin.access'), requirePermission('income.write'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getIncomeById(id);
      if (!existing) return res.status(404).json({ message: 'Income not found' });
      const data = req.body || {};
      const updatePayload = {
        userId: existing.userId,
        amount: data.amount ?? existing.amount,
        description: data.description ?? existing.description,
        date: data.date ? new Date(data.date) : existing.date,
        categoryId: data.categoryId ?? existing.categoryId,
        subcategoryId: data.subcategoryId ?? existing.subcategoryId,
        source: data.source ?? existing.source,
        notes: data.notes ?? existing.notes,
      };
      const updated = await storage.updateIncome(id, updatePayload as any);
      try { await logActivity({ userId: req.user!.id, actionType: 'UPDATE', resourceType: 'INCOME', resourceId: id, description: `Admin updated income ${id}`, ipAddress: req.ip, userAgent: req.get('User-Agent') }); } catch {}
      res.json(updated);
    } catch (e) {
      console.error('Admin update income error', e);
      res.status(500).json({ message: 'Failed to update income' });
    }
  });

  app.delete('/api/admin/incomes/:id', requireAuth, requirePermission('admin.access'), requirePermission('income.write'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getIncomeById(id);
      if (!existing) return res.status(404).json({ message: 'Income not found' });
      await storage.deleteIncome(id);
      try { await logActivity({ userId: req.user!.id, actionType: 'DELETE', resourceType: 'INCOME', resourceId: id, description: `Admin deleted income ${id}`, ipAddress: req.ip, userAgent: req.get('User-Agent') }); } catch {}
      res.status(204).send();
    } catch (e) {
      console.error('Admin delete income error', e);
      res.status(500).json({ message: 'Failed to delete income' });
    }
  });

  // --- Admin CRUD for Budgets ---
  app.post('/api/admin/users/:userId/budgets', requireAuth, requirePermission('admin.access'), requirePermission('budget.write'), async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const target = await storage.getUser(userId);
      if (!target) return res.status(404).json({ message: 'User not found' });
      const data = req.body || {};
      const toCreate = {
        userId,
        name: data.name,
        period: data.period || 'monthly',
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        amount: data.amount,
        notes: data.notes || null,
      };
      const created = await storage.createBudget(toCreate as any);
      try { await logActivity({ userId: req.user!.id, actionType: 'CREATE', resourceType: 'BUDGET', resourceId: created.id, description: `Admin created budget for user ${userId}`, ipAddress: req.ip, userAgent: req.get('User-Agent') }); } catch {}
      res.status(201).json(created);
    } catch (e) {
      console.error('Admin create budget error', e);
      res.status(500).json({ message: 'Failed to create budget' });
    }
  });

  app.patch('/api/admin/budgets/:id', requireAuth, requirePermission('admin.access'), requirePermission('budget.write'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getBudgetById(id);
      if (!existing) return res.status(404).json({ message: 'Budget not found' });
      const data = req.body || {};
      const payload = {
        name: data.name ?? existing.name,
        period: data.period ?? existing.period,
        startDate: data.startDate ? new Date(data.startDate) : existing.startDate,
        endDate: data.endDate ? new Date(data.endDate) : existing.endDate,
        amount: data.amount ?? existing.amount,
        notes: data.notes ?? existing.notes,
      };
      const updated = await storage.updateBudget(id, payload as any);
      try { await logActivity({ userId: req.user!.id, actionType: 'UPDATE', resourceType: 'BUDGET', resourceId: id, description: `Admin updated budget ${id}` , ipAddress: req.ip, userAgent: req.get('User-Agent') }); } catch {}
      res.json(updated);
    } catch (e) {
      console.error('Admin update budget error', e);
      res.status(500).json({ message: 'Failed to update budget' });
    }
  });

  app.delete('/api/admin/budgets/:id', requireAuth, requirePermission('admin.access'), requirePermission('budget.write'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getBudgetById(id);
      if (!existing) return res.status(404).json({ message: 'Budget not found' });
      await storage.deleteBudget(id);
      try { await logActivity({ userId: req.user!.id, actionType: 'DELETE', resourceType: 'BUDGET', resourceId: id, description: `Admin deleted budget ${id}`, ipAddress: req.ip, userAgent: req.get('User-Agent') }); } catch {}
      res.status(204).send();
    } catch (e) {
      console.error('Admin delete budget error', e);
      res.status(500).json({ message: 'Failed to delete budget' });
    }
  });

  // --- System Settings (Admin) ---
  app.get('/api/admin/settings', requireAuth, requirePermission('admin.access'), async (_req, res) => {
    try {
      const r = await pool.query('SELECT * FROM app_settings WHERE id = 1');
      res.json(r.rows[0] || {});
    } catch (e) {
      console.error('Fetch settings error', e);
      res.status(500).json({ message: 'Failed to load settings' });
    }
  });

  app.patch('/api/admin/settings', requireAuth, requirePermission('admin.access'), async (req, res) => {
    try {
      const {
        siteName, logoDataUrl, defaultCurrency, language, emailFrom, emailTemplates,
        timezone, dateFormat, primaryColor, themeMode, faviconDataUrl,
        features, security
      } = req.body || {};
      const r = await pool.query(
        `UPDATE app_settings SET 
           site_name = COALESCE($1, site_name),
           logo_data_url = COALESCE($2, logo_data_url),
           default_currency = COALESCE($3, default_currency),
           language = COALESCE($4, language),
           email_from = COALESCE($5, email_from),
           email_templates = COALESCE($6, email_templates),
           timezone = COALESCE($7, timezone),
           date_format = COALESCE($8, date_format),
           primary_color = COALESCE($9, primary_color),
           theme_mode = COALESCE($10, theme_mode),
           favicon_data_url = COALESCE($11, favicon_data_url),
           features = COALESCE($12, features),
           security = COALESCE($13, security),
           updated_at = NOW()
         WHERE id = 1
         RETURNING *`,
        [
          siteName, logoDataUrl, defaultCurrency, language, emailFrom, emailTemplates || null,
          timezone, dateFormat, primaryColor, themeMode, faviconDataUrl, features || null, security || null
        ]
      );
      try { await logActivity({ userId: (req.user as any).id, actionType: 'UPDATE', resourceType: 'SETTINGS', description: 'Admin updated system settings', ipAddress: req.ip, userAgent: req.get('User-Agent') }); } catch {}
      res.json(r.rows[0]);
    } catch (e) {
      console.error('Update settings error', e);
      res.status(500).json({ message: 'Failed to update settings' });
    }
  });
  // -------------------------------------------------------------------------
// Income Deletion Route
// -------------------------------------------------------------------------
app.delete("/api/incomes/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    console.log("[DEBUG] DELETE /api/incomes/:id called with id:", id);
    const income = await storage.getIncomeById(id);
    const userRole = await storage.getUserRole(req.user!.id);
    if (!income) {
      console.log("[DEBUG] Income not found for id:", id);
      return res.status(404).json({ message: "Income not found" });
    }
    // Allow admins to delete any income, otherwise only allow users to delete their own
    if (income.userId !== req.user!.id && userRole !== 'admin') {
      console.log("[DEBUG] User does not have permission to delete income. userId:", req.user!.id, "income.userId:", income.userId, "userRole:", userRole);
      return res.status(403).json({ message: "You don't have permission to delete this income" });
    }
    await storage.deleteIncome(id);
    console.log("[DEBUG] Called storage.deleteIncome for id:", id);
    
    // Log activity for income deletion
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'DELETE',
        resourceType: 'INCOME',
        resourceId: id,
        description: `Deleted income: ${income.description} - ${income.amount.toLocaleString()} FCFA`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          amount: income.amount,
          description: income.description,
          category: income.categoryName,
          source: income.source,
          date: income.date,
          deletedByAdmin: userRole === 'admin' && income.userId !== req.user!.id
        }
      });
      console.log('[DEBUG] Activity logged for income deletion');
    } catch (logError) {
      console.error('Failed to log activity for income deletion:', logError);
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting income:", error);
    res.status(500).json({ message: "Failed to delete income" });
  }
});

// -------------------------------------------------------------------------
// User Income Category Routes
// -------------------------------------------------------------------------
// Create a user-specific income category
app.post("/api/user-income-categories", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { name } = req.body;
      if (!name || typeof name !== "string" || name.trim() === "") {
        return res.status(400).json({ message: "Category name is required" });
      }
      // Prevent duplicate for this user
      const exists = await pool.query('SELECT 1 FROM user_income_categories WHERE user_id = $1 AND LOWER(name) = LOWER($2)', [userId, name]);
      if ((exists?.rowCount || 0) > 0) {
        return res.status(409).json({ message: "Category already exists" });
      }
      const result = await pool.query(
        'INSERT INTO user_income_categories (user_id, name) VALUES ($1, $2) RETURNING *',
        [userId, name]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating user income category:", error);
      res.status(500).json({ message: "Failed to create user income category" });
    }
  });

  // Delete a user-specific income category
  app.delete("/api/user-income-categories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user!.id;
      // Ensure the category belongs to the user
      const cat = await pool.query('SELECT * FROM user_income_categories WHERE id = $1 AND user_id = $2', [id, userId]);
      if (cat.rowCount === 0) {
        return res.status(404).json({ message: "Category not found" });
      }
      await pool.query('DELETE FROM user_income_categories WHERE id = $1', [id]);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user income category:", error);
      res.status(500).json({ message: "Failed to delete user income category" });
    }
  });
  // Set up CORS before any routes or auth
  app.use(cors(corsOptions));
  // Authentication routes are set up in index.ts after body parser middleware

  // -------------------------------------------------------------------------
  // Expense Category Management Routes
  // -------------------------------------------------------------------------
  
  /**
   * GET /api/expense-categories
   * Retrieves all expense categories for the authenticated user
   * Used for populating dropdowns and category lists
   */
  app.get("/api/expense-categories", requireAuth, async (req, res) => {
    try {
      const systemNames = ['Food','Transport','Utilities','Health','Entertainment'];
      // Ensure global system categories exist only once (avoid duplicate unique errors)
      const sysCount = await pool.query('SELECT COUNT(*)::int AS c FROM expense_categories WHERE is_system = true');
      if ((sysCount.rows[0]?.c ?? 0) === 0) {
        const defaultCategories = [
          { name: 'Food', description: 'Groceries, restaurants, snacks' },
          { name: 'Transport', description: 'Bus, taxi, fuel, car maintenance' },
          { name: 'Utilities', description: 'Electricity, water, internet' },
          { name: 'Health', description: 'Medical, pharmacy, insurance' },
          { name: 'Entertainment', description: 'Movies, events, subscriptions' }
        ];
        for (const cat of defaultCategories) {
          try {
            await pool.query(
              'INSERT INTO expense_categories (user_id, name, description, is_system) VALUES ($1, $2, $3, TRUE)',
              [req.user!.id, cat.name, cat.description]
            );
          } catch (e: any) {
            // If another request created them concurrently, ignore unique violation
            if (e?.code !== '23505') throw e;
          }
        }
      }
      // Fetch allowed system categories and all user-created categories for this user
      let categoriesResult = await pool.query(
        `SELECT * FROM expense_categories 
         WHERE (is_system = TRUE AND LOWER(name) = ANY($2))
            OR user_id = $1`,
        [req.user!.id, systemNames.map(n => n.toLowerCase())]
      );
      // If none visible for this user, seed user defaults once (idempotent) and refetch
      if ((categoriesResult.rowCount ?? 0) === 0) {
        try {
          await storage.createDefaultCategories(req.user!.id);
          categoriesResult = await pool.query(
            'SELECT * FROM expense_categories WHERE is_system = true OR user_id = $1',
            [req.user!.id]
          );
        } catch (e) {
          console.warn('Fallback seeding failed for user', req.user!.id, e);
        }
      }
      console.log("[DEBUG] /api/expense-categories for userId:", req.user!.id, "count:", categoriesResult.rowCount);
      res.json(categoriesResult.rows);
    } catch (error) {
      console.error("Error fetching expense categories:", error);
      res.status(500).json({ message: "Failed to fetch expense categories" });
    }
  });
  
  /**
   * POST /api/expense-categories
   * Creates a new expense category for the authenticated user
   * Validates input data using Zod schema before creation
   */
  app.post("/api/expense-categories", requireAuth, async (req, res) => {
    try {
      const categoryData = insertExpenseCategorySchema.parse(req.body);
      const result = await pool.query(
        'INSERT INTO expense_categories (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
        [req.user!.id, categoryData.name, categoryData.description]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error creating expense category:", error);
        res.status(500).json({ message: "Failed to create expense category" });
      }
    }
  });

  // Create a private (user-defined) expense category quickly from input
  app.post("/api/user-expense-categories", requireAuth, async (req, res) => {
    try {
      const name = (req.body?.name || "").trim();
      const description = (req.body?.description || null);
      if (!name) {
        return res.status(400).json({ message: "Category name is required" });
      }
      // Prevent duplicates for this user (case-insensitive)
      const dup = await pool.query(
        'SELECT 1 FROM expense_categories WHERE user_id = $1 AND LOWER(name) = LOWER($2)',
        [req.user!.id, name]
      );
      if (dup.rowCount && dup.rowCount > 0) {
        return res.status(409).json({ message: "Category already exists" });
      }
      const result = await pool.query(
        'INSERT INTO expense_categories (user_id, name, description, is_system) VALUES ($1, $2, $3, false) RETURNING *',
        [req.user!.id, name, description]
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating user expense category:", error);
      return res.status(500).json({ message: "Failed to create user expense category" });
    }
  });
  
  /**
   * PATCH /api/expense-categories/:id
   * Updates an existing expense category
   * Verifies user owns the category before allowing updates
   */
  app.patch("/api/expense-categories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.getExpenseCategoryById(id);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      if (category.userId !== req.user!.id) {
        if (!category.is_system) {
          return res.status(403).json({ message: "You don't have permission to update this category" });
        }
      }
      
      const categoryData = insertExpenseCategorySchema.parse(req.body);
      const updatedCategory = await storage.updateExpenseCategory(id, categoryData);
      
      res.json(updatedCategory);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error updating expense category:", error);
        res.status(500).json({ message: "Failed to update expense category" });
      }
    }
  });
  
  /**
   * DELETE /api/expense-categories/:id
   * Deletes an expense category owned by the authenticated user
   * Verifies ownership before deletion
   */
  app.delete("/api/expense-categories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.getExpenseCategoryById(id);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      if (category.userId !== req.user!.id) {
        if (!category.is_system) {
          return res.status(403).json({ message: "You don't have permission to delete this category" });
        }
      }
      
      await storage.deleteExpenseCategory(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting expense category:", error);
      res.status(500).json({ message: "Failed to delete expense category", error: (error as Error).message });
    }
  });
  
  // -------------------------------------------------------------------------
  // Expense Subcategory Routes
  // -------------------------------------------------------------------------
  app.get("/api/expense-categories/:categoryId/subcategories", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const category = await storage.getExpenseCategoryById(categoryId);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      if (category.userId !== req.user!.id) {
        if (!category.is_system) {
          return res.status(403).json({ message: "You don't have permission to access this category" });
        }
      }
      
      const subcategories = await storage.getExpenseSubcategories(categoryId);
      res.json(subcategories);
    } catch (error) {
      console.error("Error fetching expense subcategories:", error);
      res.status(500).json({ message: "Failed to fetch expense subcategories" });
    }
  });
  
  app.post("/api/expense-subcategories", requireAuth, async (req, res) => {
    try {
      const subcategoryData = insertExpenseSubcategorySchema.parse(req.body);
      
      // Verify the category belongs to the user
      const category = await storage.getExpenseCategoryById(subcategoryData.categoryId);
      if (!category || category.userId !== req.user!.id) {
        if (!category || (!category.is_system && category.userId !== req.user!.id)) {
          return res.status(403).json({ message: "Invalid category" });
        }
      }
      
      const subcategory = await storage.createExpenseSubcategory(req.user!.id, subcategoryData);
      res.status(201).json(subcategory);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error creating expense subcategory:", error);
        res.status(500).json({ message: "Failed to create expense subcategory" });
      }
    }
  });
  
  app.patch("/api/expense-subcategories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const subcategory = await storage.getExpenseSubcategoryById(id);
      
      if (!subcategory) {
        return res.status(404).json({ message: "Subcategory not found" });
      }
      
      if (subcategory.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to update this subcategory" });
      }
      
      const subcategoryData = insertExpenseSubcategorySchema.parse(req.body);
      
      // Verify the category belongs to the user
      const category = await storage.getExpenseCategoryById(subcategoryData.categoryId);
      if (!category || category.userId !== req.user!.id) {
        if (!category || (!category.is_system && category.userId !== req.user!.id)) {
          return res.status(403).json({ message: "Invalid category" });
        }
      }
      
      const updatedSubcategory = await storage.updateExpenseSubcategory(id, subcategoryData);
      
      res.json(updatedSubcategory);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error updating expense subcategory:", error);
        res.status(500).json({ message: "Failed to update expense subcategory" });
      }
    }
  });
  
  app.delete("/api/expense-subcategories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const subcategory = await storage.getExpenseSubcategoryById(id);
      
      if (!subcategory) {
        return res.status(404).json({ message: "Subcategory not found" });
      }
      
      if (subcategory.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to delete this subcategory" });
      }
      
      await storage.deleteExpenseSubcategory(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting expense subcategory:", error);
      res.status(500).json({ message: "Failed to delete expense subcategory", error: (error as Error).message });
    }
  });
  
  // -------------------------------------------------------------------------
  // Income Category Routes
  // -------------------------------------------------------------------------
  app.get("/api/income-categories", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      // Fetch combined system + user categories
      let userCategoriesResult = await pool.query(
        'SELECT * FROM income_categories WHERE user_id = $1 ORDER BY name', [userId]
      );
      // If nothing visible, seed user defaults idempotently and refetch
      if ((userCategoriesResult.rowCount ?? 0) === 0) {
        try {
          await storage.createDefaultCategories(userId);
          userCategoriesResult = await pool.query('SELECT * FROM income_categories WHERE user_id = $1 ORDER BY name', [userId]);
        } catch (e) {
          console.warn('Fallback income seeding failed for user', userId, e);
        }
      }
      const result = userCategoriesResult.rows.map(row => ({ id: row.id, name: row.name, isDefault: !!row.is_system }));
      res.json(result);
    } catch (error) {
      console.error("Error fetching income categories:", error);
      res.status(500).json({ message: "Failed to fetch income categories" });
    }
  });
  
  // Disable POST /api/income-categories to prevent user-created categories
  // Enable POST /api/income-categories to allow user-created categories
  app.post("/api/income-categories", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { name, description = "" } = req.body;
      if (!name || typeof name !== "string" || name.trim() === "") {
        return res.status(400).json({ message: "Category name is required" });
      }
      // Prevent duplicate category names for this user
      const exists = await pool.query('SELECT 1 FROM income_categories WHERE user_id = $1 AND LOWER(name) = LOWER($2)', [userId, name]);
      if ((exists?.rowCount || 0) > 0) {
        return res.status(409).json({ message: "Category already exists" });
      }
      const result = await pool.query(
        'INSERT INTO income_categories (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
        [userId, name, description]
      );
      const row = result.rows[0];
      const newCategory = {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        description: row.description,
        isSystem: row.is_system,
        createdAt: row.created_at
      };
      res.status(201).json(newCategory);
    } catch (error) {
      console.error("Error creating income category:", error);
      res.status(500).json({ message: "Failed to create income category" });
    }
  });
  
  app.patch("/api/income-categories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.getIncomeCategoryById(id);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      if (category.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to update this category" });
      }
      
      const categoryData = insertIncomeCategorySchema.parse(req.body);
      const updatedCategory = await storage.updateIncomeCategory(id, categoryData);
      
      res.json(updatedCategory);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error updating income category:", error);
        res.status(500).json({ message: "Failed to update income category" });
      }
    }
  });
  
  app.delete("/api/income-categories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.getIncomeCategoryById(id);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      if (category.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to delete this category" });
      }
      
      await storage.deleteIncomeCategory(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting income category:", error);
      res.status(500).json({ message: "Failed to delete income category", error: (error as Error).message });
    }
  });
  
  // -------------------------------------------------------------------------
  // Income Subcategory Routes
  // -------------------------------------------------------------------------
  app.get("/api/income-categories/:categoryId/subcategories", requireAuth, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const category = await storage.getIncomeCategoryById(categoryId);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      if (category.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to access this category" });
      }
      
      const subcategories = await storage.getIncomeSubcategories(categoryId);
      res.json(subcategories);
    } catch (error) {
      console.error("Error fetching income subcategories:", error);
      res.status(500).json({ message: "Failed to fetch income subcategories" });
    }
  });
  
  app.post("/api/income-subcategories", requireAuth, async (req, res) => {
    try {
      const subcategoryData = insertIncomeSubcategorySchema.parse(req.body);
      
      // Verify the category belongs to the user
      const category = await storage.getIncomeCategoryById(subcategoryData.categoryId);
      if (!category || category.userId !== req.user!.id) {
        return res.status(403).json({ message: "Invalid category" });
      }
      
      const subcategory = await storage.createIncomeSubcategory(req.user!.id, subcategoryData);
      res.status(201).json(subcategory);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error creating income subcategory:", error);
        res.status(500).json({ message: "Failed to create income subcategory" });
      }
    }
  });
  
  app.patch("/api/income-subcategories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const subcategory = await storage.getIncomeSubcategoryById(id);
      
      if (!subcategory) {
        return res.status(404).json({ message: "Subcategory not found" });
      }
      
      if (subcategory.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to update this subcategory" });
      }
      
      const subcategoryData = insertIncomeSubcategorySchema.parse(req.body);
      
      // Verify the category belongs to the user
      const category = await storage.getIncomeCategoryById(subcategoryData.categoryId);
      if (!category || category.userId !== req.user!.id) {
        return res.status(403).json({ message: "Invalid category" });
      }
      
      const updatedSubcategory = await storage.updateIncomeSubcategory(id, subcategoryData);
      
      res.json(updatedSubcategory);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error("Error updating income subcategory:", error);
        res.status(500).json({ message: "Failed to update income subcategory" });
      }
    }
  });
  
  app.delete("/api/income-subcategories/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const subcategory = await storage.getIncomeSubcategoryById(id);
      
      if (!subcategory) {
        return res.status(404).json({ message: "Subcategory not found" });
      }
      
      if (subcategory.userId !== req.user!.id) {
        return res.status(403).json({ message: "You don't have permission to delete this subcategory" });
      }
      
      await storage.deleteIncomeSubcategory(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting income subcategory:", error);
      res.status(500).json({ message: "Failed to delete income subcategory", error: (error as Error).message });
    }
  });
  
  // -------------------------------------------------------------------------
// Expense Routes
// -------------------------------------------------------------------------
app.get("/api/expenses", requireAuth, async (req, res) => {
  try {
    const rows = await storage.getExpensesByUserId(req.user!.id);
    // storage now returns category_name and subcategory_name via joins, avoid N+1
    const mapped = rows.map((e: any) => ({
      ...e,
      categoryName: e.categoryName || e.category_name || 'Unknown',
      subcategoryName: e.subcategoryName || e.subcategory_name || null,
    }));
    console.log("[DEBUG] /api/expenses for userId:", req.user!.id, "count:", mapped.length);
    res.json(mapped);
  } catch (error) {
    console.error("Error fetching expenses:", error);
    res.status(500).json({ message: "Failed to fetch expenses" });
  }
});

// --- Moderation & Reports ---
// Create a report on a target (expense/income/budget)
app.post('/api/reports', requireAuth, async (req, res) => {
  try {
    const data = insertReportSchema.parse(req.body || {});
    // Basic existence check for targets
    if (data.targetType === 'expense') {
      const r = await pool.query('SELECT 1 FROM expenses WHERE id = $1 AND user_id = $2', [data.targetId, req.user!.id]);
      if (r.rowCount === 0) return res.status(404).json({ message: 'Expense not found' });
    } else if (data.targetType === 'income') {
      const r = await pool.query('SELECT 1 FROM incomes WHERE id = $1 AND user_id = $2', [data.targetId, req.user!.id]);
      if (r.rowCount === 0) return res.status(404).json({ message: 'Income not found' });
    } else if (data.targetType === 'budget') {
      const r = await pool.query('SELECT 1 FROM budgets WHERE id = $1 AND user_id = $2', [data.targetId, req.user!.id]);
      if (r.rowCount === 0) return res.status(404).json({ message: 'Budget not found' });
    }
    const ins = await pool.query(
      'INSERT INTO reports (reporter_user_id, target_type, target_id, reason) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user!.id, data.targetType, data.targetId, data.reason]
    );
    try { await logActivity({ userId: req.user!.id, actionType: 'CREATE', resourceType: 'REPORT', resourceId: ins.rows[0].id, description: `Reported ${data.targetType} #${data.targetId}`, ipAddress: req.ip, userAgent: req.get('User-Agent') }); } catch {}
    res.status(201).json(ins.rows[0]);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ message: 'Invalid report', errors: e.errors });
    console.error('Create report error', e);
    res.status(500).json({ message: 'Failed to create report' });
  }
});

// Admin: list open reports
app.get('/api/admin/reports', requireAuth, requirePermission('moderation.manage'), async (req, res) => {
  try {
    const qs = req.query as any;
    const allowedStatuses = ['open','escalated','resolved','dismissed'];
    let statuses: string[];
    if (qs.status) {
      statuses = String(qs.status).split(',').map((s: string) => s.trim()).filter((s: string) => allowedStatuses.includes(s));
    } else {
      statuses = ['open','escalated'];
    }
    if (statuses.length === 0) statuses = ['open','escalated'];
    const targetType = qs.targetType && ['expense','income','budget'].includes(String(qs.targetType)) ? String(qs.targetType) : null;
    let limit = parseInt(qs.limit ?? '50');
    let offset = parseInt(qs.offset ?? '0');
    if (!Number.isFinite(limit) || limit <= 0) limit = 50;
    if (limit > 200) limit = 200;
    if (!Number.isFinite(offset) || offset < 0) offset = 0;

    const params: any[] = [];
    const whereParts: string[] = [];
    // statuses as ANY($1)
    params.push(statuses);
    whereParts.push(`rep.status = ANY($${params.length})`);
    if (targetType) {
      params.push(targetType);
      whereParts.push(`rep.target_type = $${params.length}`);
    }
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    params.push(limit);
    params.push(offset);
    const r = await pool.query(
      `SELECT rep.*, u.name AS reporter_name
       FROM reports rep
       LEFT JOIN users u ON u.id = rep.reporter_user_id
       ${whereSql}
       ORDER BY rep.created_at DESC
       LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    );
    res.json(r.rows);
  } catch (e) {
    console.error('List reports failed', e);
    res.status(500).json({ message: 'Failed to list reports' });
  }
});

// Admin: take action on a report
app.post('/api/admin/reports/:id/action', requireAuth, requirePermission('moderation.manage'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = updateReportActionSchema.parse(req.body || {});
    const r0 = await pool.query('SELECT * FROM reports WHERE id = $1', [id]);
    const rep = r0.rows[0];
    if (!rep) return res.status(404).json({ message: 'Report not found' });
    let newStatus = rep.status;
  if (data.action === 'dismiss') newStatus = 'dismissed';
    if (data.action === 'resolve') newStatus = 'resolved';
    if (data.action === 'escalate') newStatus = 'escalated';
    if (data.action === 'hide') {
      // Hide the target
      if (rep.target_type === 'expense') await pool.query('UPDATE expenses SET is_hidden = TRUE WHERE id = $1', [rep.target_id]);
      if (rep.target_type === 'income') await pool.query('UPDATE incomes SET is_hidden = TRUE WHERE id = $1', [rep.target_id]);
      // For budget, we won't hide but mark resolved; could extend later
      newStatus = 'resolved';
    }
    if (data.action === 'warn') newStatus = 'resolved';
    await pool.query(
      `UPDATE reports SET status = $1, resolution_note = COALESCE($2, resolution_note), resolved_by = $3, updated_at = NOW() WHERE id = $4`,
      [newStatus, data.note || null, req.user!.id, id]
    );
    try { await logActivity({ userId: req.user!.id, actionType: 'UPDATE', resourceType: 'REPORT', resourceId: id, description: `Report ${id} ${data.action}`, ipAddress: req.ip, userAgent: req.get('User-Agent') }); } catch {}
    res.status(204).send();
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ message: 'Invalid action', errors: e.errors });
    console.error('Action on report failed', e);
    res.status(500).json({ message: 'Failed to update report' });
  }
});

app.post("/api/expenses", requireAuth, async (req, res) => {
  try {
    // Ensure date is properly parsed, especially if it came as an ISO string
    const data = req.body;
    if (data.date && typeof data.date === 'string') {
      data.date = new Date(data.date);
    }
    
    // Check if we're using legacy or new schema
    let expense;
    
    if ('category' in data) {
      // Legacy mode (string category)
      const expenseData = legacyInsertExpenseSchema.parse(data);
      expense = await storage.createLegacyExpense({
        ...expenseData,
        userId: req.user!.id
      });
    } else {
      // New mode (category ID)
      const expenseData = insertExpenseSchema.parse(data);

    // Only check that the category exists
    const categoryResult = await pool.query('SELECT * FROM expense_categories WHERE id = $1', [expenseData.categoryId]);
    const category = categoryResult.rows[0];
    if (!category) {
      return res.status(403).json({ message: "Invalid category" });
    }
      
      expense = await storage.createExpense({
        ...expenseData,
        userId: req.user!.id
      });
    }
    
    // Log activity for expense creation
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'CREATE',
        resourceType: 'EXPENSE',
        resourceId: expense.id,
        description: `Created expense: ${expense.description} - ${expense.amount.toLocaleString()} FCFA`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          amount: expense.amount,
          description: expense.description,
          category: expense.category_name,
          merchant: expense.merchant,
          date: expense.date
        }
      });
      console.log('[DEBUG] Activity logged for expense creation');
    } catch (logError) {
      console.error('Failed to log activity for expense creation:', logError);
    }
    
    res.status(201).json(expense);
  } catch (error) {
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      res.status(400).json({ message: validationError.message });
    } else {
      console.error("Error creating expense:", error);
      res.status(500).json({ message: "Failed to create expense" });
    }
  }
});

app.get("/api/expenses/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const expense = await storage.getExpenseById(id);
    
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }
    
    if (expense.userId !== req.user!.id) {
      return res.status(403).json({ message: "You don't have permission to access this expense" });
    }
    
    res.json(expense);
  } catch (error) {
    console.error("Error fetching expense:", error);
    res.status(500).json({ message: "Failed to fetch expense" });
  }
});

app.patch("/api/expenses/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const expense = await storage.getExpenseById(id);

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    const userRole = await storage.getUserRole(req.user!.id);
    if (expense.user_id !== req.user!.id && userRole !== "admin") {
      return res.status(403).json({ message: "You don't have permission to update this expense" });
    }

    // Map frontend category IDs (1–5) to real database IDs (11–15)
    const categoryMap: Record<number, number> = {
      1: 11, // Food
      2: 12, // Transport
      3: 13, // Utilities
      4: 14, // Health
      5: 15  // Entertainment
    };

    let { categoryId, categoryName, amount, description, date, merchant, notes } = req.body;

    // Convert categoryId if necessary
    if (categoryId && categoryMap[categoryId]) {
      categoryId = categoryMap[categoryId];
    }

    // Ensure date is parsed properly
    if (date && typeof date === "string") {
      date = new Date(date);
    }

    // Update the expense in the database
    const result = await pool.query(
      `UPDATE expenses 
       SET amount = $1, description = $2, date = $3, merchant = $4, notes = $5, category_id = $6, category_name = $7, updated_at = NOW() 
       WHERE id = $8 RETURNING *`,
      [amount, description, date, merchant, notes, categoryId, categoryName, id]
    );

    const updatedExpense = result.rows[0];

    // Log activity for expense update
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'UPDATE',
        resourceType: 'EXPENSE',
        resourceId: updatedExpense.id,
        description: `Updated expense: ${description} - ${amount.toLocaleString()} FCFA`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          amount: amount,
          description: description,
          category: categoryName,
          merchant: merchant,
          date: date,
          previousAmount: expense.amount,
          previousDescription: expense.description
        }
      });
      console.log('[DEBUG] Activity logged for expense update');
    } catch (logError) {
      console.error('Failed to log activity for expense update:', logError);
    }

    res.json(updatedExpense);
  } catch (error) {
    console.error("Error updating expense:", error);
    res.status(500).json({ message: "Failed to update expense" });
  }
});

app.delete("/api/expenses/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const expense = await storage.getExpenseById(id);
    const userRole = await storage.getUserRole(req.user!.id);
    
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }
    console.log({expense,userRole,reqUserId:req.user!.id});
    
    // Allow admins to delete any expense, otherwise only allow users to delete their own
    if (expense.user_id !== req.user!.id && userRole !== 'admin') {
      return res.status(403).json({ message: "You don't have permission to delete this expense" });
    }
    
    await storage.deleteExpense(id);
    
    // Log activity for expense deletion
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'DELETE',
        resourceType: 'EXPENSE',
        resourceId: id,
        description: `Deleted expense: ${expense.description} - ${expense.amount.toLocaleString()} FCFA`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          amount: expense.amount,
          description: expense.description,
          category: expense.category_name,
          merchant: expense.merchant,
          date: expense.date
        }
      });
      console.log('[DEBUG] Activity logged for expense deletion');
    } catch (logError) {
      console.error('Failed to log activity for expense deletion:', logError);
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting expense:", error);
    res.status(500).json({ message: "Failed to delete expense" });
  }
});
  
// -------------------------------------------------------------------------
// Income Routes
// -------------------------------------------------------------------------
app.get("/api/incomes", requireAuth, async (req, res) => {
  try {
    const incomes = await storage.getIncomesByUserId(req.user!.id);
    // storage returns categoryName and subcategoryName already; avoid N+1
    console.log("[DEBUG] /api/incomes for userId:", req.user!.id, "count:", incomes.length);
    res.json(incomes);
  } catch (error) {
    console.error("Error fetching incomes:", error);
    res.status(500).json({ message: "Failed to fetch incomes" });
  }
});

app.post("/api/incomes", requireAuth, async (req, res) => {
console.log('[DEBUG] POST /api/incomes received body:', req.body);

try {
  const data = req.body;
  const userId = req.user!.id;

  // Ensure date is a Date object
  if (data.date && typeof data.date === 'string') {
    data.date = new Date(data.date);
  }

  let categoryName = data.categoryName?.trim();
  if (!categoryName) {
    return res.status(400).json({ message: "Please provide a category name." });
  }

  // Define system categories (IDs are placeholders; real IDs should exist in DB)
  const systemCategories = [
    { name: 'Wages' },
    { name: 'Deals' },
    { name: 'Other' }
  ];

  // Check if category exists in DB for this user
  let categoryCheck = await pool.query(
    'SELECT id, name FROM income_categories WHERE user_id = $1 AND name = $2',
    [userId, categoryName]
  );

  let finalCategoryId: number;
  let finalCategoryName: string;

  if (categoryCheck.rows.length > 0) {
    // Category exists
    finalCategoryId = categoryCheck.rows[0].id;
    finalCategoryName = categoryCheck.rows[0].name;
  } else {
    // If not, insert new category (system or custom)
    const isSystem = systemCategories.some(
      cat => cat.name.toLowerCase() === categoryName.toLowerCase()
    );

    const newCat = await pool.query(
      'INSERT INTO income_categories (user_id, name, description, is_system) VALUES ($1, $2, $3, $4) RETURNING id, name',
      [userId, categoryName, isSystem ? `System category: ${categoryName}` : null, isSystem]
    );

    finalCategoryId = newCat.rows[0].id;
    finalCategoryName = newCat.rows[0].name;
  }

  // Insert the income
  const result = await pool.query(
    `INSERT INTO incomes
     (user_id, amount, description, date, category_id, category_name, source, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      userId,
      data.amount,
      data.description,
      data.date,
      finalCategoryId,
      finalCategoryName,
      data.source,
      data.notes
    ]
  );

  const newIncome = result.rows[0];
  console.log('[DEBUG] Inserted income result:', newIncome);

  // Log activity for income creation
  try {
    await logActivity({
      userId: userId,
      actionType: 'CREATE',
      resourceType: 'INCOME',
      resourceId: newIncome.id,
      description: `Added income: ${data.description} - ${data.amount.toLocaleString()} FCFA`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        amount: data.amount,
        description: data.description,
        category: finalCategoryName,
        source: data.source,
        date: data.date
      }
    });
    console.log('[DEBUG] Activity logged for income creation');
  } catch (logError) {
    console.error('Failed to log activity for income creation:', logError);
    // Don't fail the request if logging fails
  }

  res.status(201).json(newIncome);

} catch (error) {
  if (error instanceof ZodError) {
    const validationError = fromZodError(error);
    res.status(400).json({ message: validationError.message });
  } else {
    console.error("Error creating income:", error);
    res.status(500).json({ message: "Failed to create income" });
  }
}
});

app.patch("/api/incomes/:id", requireAuth, async (req, res) => {
try {
  const id = parseInt(req.params.id);
  const income = await storage.getIncomeById(id);

  if (!income) return res.status(404).json({ message: "Income not found" });
  if (income.userId !== req.user!.id) return res.status(403).json({ message: "You don't have permission" });

  const data = req.body;
  if (data.date && typeof data.date === "string") data.date = new Date(data.date);

  const incomeData = insertIncomeSchema.parse(data);
  const userId = req.user!.id;

  const categoryName = req.body.categoryName?.trim();
  if (!categoryName) return res.status(400).json({ message: "Category name required" });

  // Check if category exists for this user
  let categoryCheck = await pool.query(
    'SELECT id, name FROM income_categories WHERE user_id = $1 AND name = $2',
    [userId, categoryName]
  );

  let finalCategoryId: number;
  let finalCategoryName: string;

  if (categoryCheck.rows.length > 0) {
    finalCategoryId = categoryCheck.rows[0].id;
    finalCategoryName = categoryCheck.rows[0].name;
  } else {
    // Insert new category
    const newCat = await pool.query(
      'INSERT INTO income_categories (user_id, name, description, is_system) VALUES ($1, $2, $3, false) RETURNING id, name',
      [userId, categoryName, null]
    );
    finalCategoryId = newCat.rows[0].id;
    finalCategoryName = newCat.rows[0].name;
  }

  // Optional: verify subcategory
  if (incomeData.subcategoryId) {
    const subcategory = await storage.getIncomeSubcategoryById(incomeData.subcategoryId);
    if (!subcategory || subcategory.categoryId !== finalCategoryId) {
      return res.status(403).json({ message: "Invalid subcategory" });
    }
  }

  // Update income
  const result = await pool.query(
    `UPDATE incomes
     SET amount=$1, description=$2, date=$3, category_id=$4, category_name=$5, subcategory_id=$6, source=$7, notes=$8
     WHERE id=$9 AND user_id=$10
     RETURNING *`,
    [
      incomeData.amount,
      incomeData.description,
      incomeData.date,
      finalCategoryId,
      finalCategoryName,
      incomeData.subcategoryId,
      incomeData.source,
      incomeData.notes,
      id,
      userId
    ]
  );

  if (result.rows.length === 0) return res.status(404).json({ message: "Income not found" });

  const updatedIncome = result.rows[0];

  // Log activity for income update
  try {
    await logActivity({
      userId: userId,
      actionType: 'UPDATE',
      resourceType: 'INCOME',
      resourceId: updatedIncome.id,
      description: `Updated income: ${incomeData.description} - ${incomeData.amount.toLocaleString()} FCFA`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        amount: incomeData.amount,
        description: incomeData.description,
        category: finalCategoryName,
        source: incomeData.source,
        date: incomeData.date,
        previousAmount: income.amount,
        previousDescription: income.description
      }
    });
    console.log('[DEBUG] Activity logged for income update');
  } catch (logError) {
    console.error('Failed to log activity for income update:', logError);
    // Don't fail the request if logging fails
  }

  res.json(updatedIncome);
} catch (error) {
  console.error("Error updating income:", error);
  res.status(500).json({ message: "Failed to update income" });
}
});


  // Budget Routes
app.get("/api/budgets", requireAuth, async (req, res) => {
  try {
    const budgets = await storage.getBudgetsByUserId(req.user!.id);
    
    // Add performance data to each budget
    const budgetsWithPerformance = await Promise.all(
      budgets.map(async (budget) => {
        const [performance, allocations] = await Promise.all([
          storage.getBudgetPerformance(budget.id),
          storage.getBudgetAllocations(budget.id)
        ]);

        // Collect unique category IDs from allocations
        const uniqueCategoryIds = Array.from(new Set((allocations || []).map(a => a.categoryId)));
        let categoryNames: string[] = [];
        if (uniqueCategoryIds.length > 0) {
          const namesResult = await pool.query(
            'SELECT id, name FROM expense_categories WHERE id = ANY($1::int[])',
            [uniqueCategoryIds]
          );
          const nameById = new Map<number, string>(namesResult.rows.map((r: any) => [r.id, r.name]));
          categoryNames = uniqueCategoryIds.map(id => nameById.get(id) || String(id));
        }

        return {
          ...budget,
          allocatedAmount: performance.allocated,
          spentAmount: performance.spent,
          remainingAmount: performance.remaining,
          categoryNames,
          categoryCount: categoryNames.length,
        };
      })
    );
    
    res.json(budgetsWithPerformance);
  } catch (error) {
    console.error("Error fetching budgets:", error);
    res.status(500).json({ message: "Failed to fetch budgets" });
  }
});

app.post("/api/budgets", requireAuth, async (req, res) => {
  try {
    // Ensure dates are properly parsed, especially if they came as ISO strings
    const data = req.body;
    if (data.startDate && typeof data.startDate === 'string') {
      data.startDate = new Date(data.startDate);
    }
    if (data.endDate && typeof data.endDate === 'string') {
      data.endDate = new Date(data.endDate);
    }
    
  // Extract optional allocations with amounts; ignore legacy categoryIds placeholders
  const incomingAllocations = Array.isArray(data.allocations) ? data.allocations : [];
  delete data.categoryIds; // deprecated: creating 0-amount placeholders violates DB constraint
    
    const budgetData = insertBudgetSchema.parse(data);
    const budget = await storage.createBudget({
      ...budgetData,
      userId: req.user!.id
    });
    
    // If allocations are provided with positive amounts, create them now
    if (incomingAllocations.length > 0) {
      const budgetId = budget.id;
      for (const a of incomingAllocations) {
        const categoryId = Number(a.categoryId);
        const amount = Number(a.amount);
        const subcategoryId = a.subcategoryId ? Number(a.subcategoryId) : null;
        if (!Number.isFinite(categoryId) || !Number.isFinite(amount) || amount <= 0) continue;
        const category = await storage.getExpenseCategoryById(categoryId);
        if (!category || category.userId !== req.user!.id) continue;
        await storage.createBudgetAllocation({ budgetId, categoryId, subcategoryId, amount });
      }
    }
    
    // Log activity for budget creation
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'CREATE',
        resourceType: 'BUDGET',
        resourceId: budget.id,
        description: `Created budget "${budget.name}" with total amount ${budget.amount} FCFA`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          name: budget.name,
          totalAmount: budget.amount,
          period: budget.period,
          startDate: budget.startDate,
          endDate: budget.endDate,
          categoryCount: incomingAllocations?.length || 0
        }
      });
      console.log('[DEBUG] Activity logged for budget creation');
    } catch (logError) {
      console.error('Failed to log activity for budget creation:', logError);
    }
    
    res.status(201).json(budget);
  } catch (error) {
    if ((error as any)?.code === '23514') {
      return res.status(400).json({ message: 'Allocation amount must be greater than zero' });
    } else if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      res.status(400).json({ message: validationError.message });
    } else {
      console.error("Error creating budget:", error);
      res.status(500).json({ message: "Failed to create budget" });
    }
  }
});

app.get("/api/budgets/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const budget = await storage.getBudgetById(id);
    
    if (!budget) {
      return res.status(404).json({ message: "Budget not found" });
    }
    
    if (budget.userId !== req.user!.id) {
      return res.status(403).json({ message: "You don't have permission to access this budget" });
    }
    
    // Get all budget allocations as well
    const allocations = await storage.getBudgetAllocations(id);
    
    // Get budget performance
    const performance = await storage.getBudgetPerformance(id);
    
    res.json({
      budget,
      allocations,
      performance
    });
  } catch (error) {
    console.error("Error fetching budget:", error);
    res.status(500).json({ message: "Failed to fetch budget" });
  }
});

app.patch("/api/budgets/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const budget = await storage.getBudgetById(id);
    
    if (!budget) {
      return res.status(404).json({ message: "Budget not found" });
    }
    
    if (budget.userId !== req.user!.id) {
      return res.status(403).json({ message: "You don't have permission to update this budget" });
    }
    
    // Ensure dates are properly parsed, especially if they came as ISO strings
    const data = req.body;
    if (data.startDate && typeof data.startDate === 'string') {
      data.startDate = new Date(data.startDate);
    }
    if (data.endDate && typeof data.endDate === 'string') {
      data.endDate = new Date(data.endDate);
    }
    
    const budgetData = insertBudgetSchema.parse(data);
    const updatedBudget = await storage.updateBudget(id, budgetData);
    
    // Log activity for budget update
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'UPDATE',
        resourceType: 'BUDGET',
        resourceId: updatedBudget.id,
        description: `Updated budget "${updatedBudget.name}" - Amount: ${budget.amount} → ${updatedBudget.amount} FCFA, Period: ${budget.period} → ${updatedBudget.period}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          name: updatedBudget.name,
          previousAmount: budget.amount,
          newAmount: updatedBudget.amount,
          previousPeriod: budget.period,
          newPeriod: updatedBudget.period,
          previousStartDate: budget.startDate,
          newStartDate: updatedBudget.startDate,
          previousEndDate: budget.endDate,
          newEndDate: updatedBudget.endDate
        }
      });
      console.log('[DEBUG] Activity logged for budget update');
    } catch (logError) {
      console.error('Failed to log activity for budget update:', logError);
    }
    
    res.json(updatedBudget);
  } catch (error) {
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      res.status(400).json({ message: validationError.message });
    } else {
      console.error("Error updating budget:", error);
      res.status(500).json({ message: "Failed to update budget" });
    }
  }
});

// PUT route for budget updates (same as PATCH)
app.put("/api/budgets/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const budget = await storage.getBudgetById(id);
    
    if (!budget) {
      return res.status(404).json({ message: "Budget not found" });
    }
    
    if (budget.userId !== req.user!.id) {
      return res.status(403).json({ message: "You don't have permission to update this budget" });
    }
    
    // Ensure dates are properly parsed, especially if they came as ISO strings
    const data = req.body;
    if (data.startDate && typeof data.startDate === 'string') {
      data.startDate = new Date(data.startDate);
    }
    if (data.endDate && typeof data.endDate === 'string') {
      data.endDate = new Date(data.endDate);
    }
    
    const budgetData = insertBudgetSchema.parse(data);
    const updatedBudget = await storage.updateBudget(id, budgetData);
    
    // Log activity for budget update (PUT)
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'UPDATE',
        resourceType: 'BUDGET',
        resourceId: updatedBudget.id,
        description: `Updated budget "${updatedBudget.name}" - Amount: ${budget.amount} → ${updatedBudget.amount} FCFA, Period: ${budget.period} → ${updatedBudget.period}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          name: updatedBudget.name,
          previousAmount: budget.amount,
          newAmount: updatedBudget.amount,
          previousPeriod: budget.period,
          newPeriod: updatedBudget.period
        }
      });
      console.log('[DEBUG] Activity logged for budget update (PUT)');
    } catch (logError) {
      console.error('Failed to log activity for budget update:', logError);
    }
    
    res.json(updatedBudget);
  } catch (error) {
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      res.status(400).json({ message: validationError.message });
    } else {
      console.error("Error updating budget:", error);
      res.status(500).json({ message: "Failed to update budget" });
    }
  }
});

app.delete("/api/budgets/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const budget = await storage.getBudgetById(id);
    
    if (!budget) {
      return res.status(404).json({ message: "Budget not found" });
    }
    
    if (budget.userId !== req.user!.id) {
      return res.status(403).json({ message: "You don't have permission to delete this budget" });
    }
    
    await storage.deleteBudget(id);
    
    // Log activity for budget deletion
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'DELETE',
        resourceType: 'BUDGET',
        resourceId: id,
        description: `Deleted budget "${budget.name}"`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          name: budget.name,
          totalAmount: budget.amount,
          period: budget.period
        }
      });
      console.log('[DEBUG] Activity logged for budget deletion');
    } catch (logError) {
      console.error('Failed to log activity for budget deletion:', logError);
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting budget:", error);
    res.status(500).json({ message: "Failed to delete budget" });
  }
});
  
  // -------------------------------------------------------------------------
// Budget Allocation Routes
// -------------------------------------------------------------------------
app.get("/api/budgets/:budgetId/allocations", requireAuth, async (req, res) => {
  try {
    const budgetId = parseInt(req.params.budgetId);
    const budget = await storage.getBudgetById(budgetId);
    
    if (!budget) {
      return res.status(404).json({ message: "Budget not found" });
    }
    
    if (budget.userId !== req.user!.id) {
      return res.status(403).json({ message: "You don't have permission to access this budget" });
    }
    
    const allocations = await storage.getBudgetAllocations(budgetId);
    res.json(allocations);
  } catch (error) {
    console.error("Error fetching budget allocations:", error);
    res.status(500).json({ message: "Failed to fetch budget allocations" });
  }
});

app.get("/api/budgets/:budgetId/performance", requireAuth, async (req, res) => {
  try {
    const budgetId = parseInt(req.params.budgetId);
    const budget = await storage.getBudgetById(budgetId);
    
    if (!budget) {
      return res.status(404).json({ message: "Budget not found" });
    }
    
    if (budget.userId !== req.user!.id) {
      return res.status(403).json({ message: "You don't have permission to access this budget" });
    }
    
    const performance = await storage.getBudgetPerformance(budgetId);
    res.json(performance);
  } catch (error) {
    console.error("Error fetching budget performance:", error);
    res.status(500).json({ message: "Failed to fetch budget performance" });
  }
});

// POST route for budget allocations (nested under budget)
app.post("/api/budgets/:budgetId/allocations", requireAuth, async (req, res) => {
  try {
    const budgetId = parseInt(req.params.budgetId);
    const allocationData = insertBudgetAllocationSchema.parse(req.body);
    
    // Verify the budget belongs to the user
    const budget = await storage.getBudgetById(budgetId);
    if (!budget || budget.userId !== req.user!.id) {
      return res.status(403).json({ message: "Invalid budget" });
    }

    // Ensure the budgetId matches
    const finalAllocationData = {
      ...allocationData,
      budgetId: budgetId
    };

    const allocation = await storage.createBudgetAllocation(finalAllocationData);

    // Log activity for budget allocation creation
    try {
      const category = await storage.getExpenseCategoryById(allocationData.categoryId);
      await logActivity({
        userId: req.user!.id,
        actionType: 'CREATE',
        resourceType: 'BUDGET_ALLOCATION',
        resourceId: allocation.id,
        description: `Added ${allocation.amount.toLocaleString()} FCFA allocation for "${category?.name || 'Unknown'}" to budget "${budget.name}"`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          budgetName: budget.name,
          categoryName: category?.name || 'Unknown',
          amount: allocation.amount,
          budgetId: budget.id,
          categoryId: allocationData.categoryId
        }
      });
      console.log('[DEBUG] Activity logged for budget allocation creation');
    } catch (logError) {
      console.error('Failed to log activity for budget allocation creation:', logError);
    }

    res.status(201).json(allocation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid data", errors: error.errors });
    } else {
      console.error("Error creating budget allocation:", error);
      res.status(500).json({ message: "Failed to create budget allocation" });
    }
  }
});

app.post("/api/budget-allocations", requireAuth, async (req, res) => {
  try {
    const allocationData = insertBudgetAllocationSchema.parse(req.body);
    
    // Verify the budget belongs to the user
    const budget = await storage.getBudgetById(allocationData.budgetId);
    if (!budget || budget.userId !== req.user!.id) {
      return res.status(403).json({ message: "Invalid budget" });
    }
    
    // Verify the category belongs to the user
    const category = await storage.getExpenseCategoryById(allocationData.categoryId);
    if (!category || category.userId !== req.user!.id) {
      return res.status(403).json({ message: "Invalid category" });
    }
    
    // If subcategory is provided, verify it belongs to the category
    if (allocationData.subcategoryId) {
      const subcategory = await storage.getExpenseSubcategoryById(allocationData.subcategoryId);
      if (!subcategory || subcategory.categoryId !== allocationData.categoryId) {
        return res.status(403).json({ message: "Invalid subcategory" });
      }
    }
    
    const allocation = await storage.createBudgetAllocation(allocationData);

    // Log activity for budget allocation creation
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'CREATE',
        resourceType: 'BUDGET_ALLOCATION',
        resourceId: allocation.id,
        description: `Added ${allocation.amount.toLocaleString()} FCFA allocation for "${category.name}" to budget "${budget.name}"`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { 
          budgetName: budget.name,
          categoryName: category.name,
          amount: allocation.amount,
          budgetId: budget.id,
          categoryId: category.id
        }
      });
      console.log('[DEBUG] Activity logged for budget allocation creation');
    } catch (logError) {
      console.error('Failed to log activity for budget allocation creation:', logError);
    }

    res.status(201).json(allocation);
  } catch (error) {
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      res.status(400).json({ message: validationError.message });
    } else {
      console.error("Error creating budget allocation:", error);
      res.status(500).json({ message: "Failed to create budget allocation" });
    }
  }
});

app.patch("/api/budget-allocations/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const allocationData = insertBudgetAllocationSchema.parse(req.body);
    
    // Verify the budget belongs to the user
    const budget = await storage.getBudgetById(allocationData.budgetId);
    if (!budget || budget.userId !== req.user!.id) {
      return res.status(403).json({ message: "Invalid budget" });
    }
    
    // Verify the category belongs to the user
    const category = await storage.getExpenseCategoryById(allocationData.categoryId);
    if (!category || (!category.isSystem && category.userId !== req.user!.id)) {
      return res.status(403).json({ message: "Invalid category" });
    }
    
    // If subcategory is provided, verify it belongs to the category
    if (allocationData.subcategoryId) {
      const subcategory = await storage.getExpenseSubcategoryById(allocationData.subcategoryId);
      if (!subcategory || subcategory.categoryId !== allocationData.categoryId) {
        return res.status(403).json({ message: "Invalid subcategory" });
      }
    }

    // Get the old allocation for logging
    const oldAllocation = await storage.getBudgetAllocations(allocationData.budgetId);
    const currentAllocation = oldAllocation.find(a => a.id === id);
    
    const updatedAllocation = await storage.updateBudgetAllocation(id, allocationData);

    // Log activity for budget allocation update
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'UPDATE',
        resourceType: 'BUDGET_ALLOCATION',
        resourceId: id,
        description: `Updated "${category.name}" allocation in budget "${budget.name}" from ${(currentAllocation?.amount || 0).toLocaleString()} to ${allocationData.amount.toLocaleString()} FCFA`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { 
          budgetName: budget.name,
          categoryName: category.name,
          oldAmount: currentAllocation?.amount || 0,
          newAmount: allocationData.amount,
          budgetId: budget.id,
          categoryId: category.id
        }
      });
      console.log('[DEBUG] Activity logged for budget allocation update');
    } catch (logError) {
      console.error('Failed to log activity for budget allocation update:', logError);
    }

    res.json(updatedAllocation);
  } catch (error) {
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      res.status(400).json({ message: validationError.message });
    } else {
      console.error("Error updating budget allocation:", error);
      res.status(500).json({ message: "Failed to update budget allocation" });
    }
  }
});

app.delete("/api/budget-allocations/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Get allocation details before deletion for logging
    const budgets = await storage.getBudgetsByUserId(req.user!.id);
    let allocationToDelete = null;
    let budgetName = '';
    let categoryName = '';
    
    for (const budget of budgets) {
      const allocations = await storage.getBudgetAllocations(budget.id);
      const allocation = allocations.find(a => a.id === id);
      if (allocation) {
        allocationToDelete = allocation;
        budgetName = budget.name;
        // ✅ SAFE: look up the category name by categoryId instead of reading allocation.categoryName
        if (allocation.categoryId) {
          const cat = await storage.getExpenseCategoryById(allocation.categoryId);
          categoryName = cat?.name ?? 'Unknown';
        } else {
          categoryName = 'Unknown';
        }
        break;
      }
    }
    
    await storage.deleteBudgetAllocation(id);
    
    // Log activity for budget allocation deletion
    if (allocationToDelete) {
      try {
        await logActivity({
          userId: req.user!.id,
          actionType: 'DELETE',
          resourceType: 'BUDGET_ALLOCATION',
          resourceId: id,
          description: `Removed ${allocationToDelete.amount.toLocaleString()} FCFA allocation for "${categoryName}" from budget "${budgetName}"`,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: { 
            budgetName: budgetName,
            categoryName: categoryName,
            amount: allocationToDelete.amount,
            budgetId: allocationToDelete.budgetId,
            categoryId: allocationToDelete.categoryId
          }
        });
        console.log('[DEBUG] Activity logged for budget allocation deletion');
      } catch (logError) {
        console.error('Failed to log activity for budget allocation deletion:', logError);
      }
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting budget allocation:", error);
    res.status(500).json({ message: "Failed to delete budget allocation" });
  }
});

  // -------------------------------------------------------------------------
// Reports and Analytics Routes
// -------------------------------------------------------------------------
app.get("/api/reports/monthly-expenses/:year", requireAuth, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const monthlyExpenses = await storage.getMonthlyExpenseTotals(req.user!.id, year);
    
    // Log activity for viewing monthly expense report
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'VIEW',
        resourceType: 'REPORT',
        description: `Viewed monthly expense report for ${year}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { 
          reportType: 'monthly-expenses',
          year: year,
          recordCount: monthlyExpenses.length
        }
      });
      console.log('[DEBUG] Activity logged for monthly expense report view');
    } catch (logError) {
      console.error('Failed to log monthly expense report activity:', logError);
    }
    
    res.json(monthlyExpenses);
  } catch (error) {
    console.error("Error fetching monthly expense report:", error);
    res.status(500).json({ message: "Failed to fetch monthly expense report" });
  }
});

app.get("/api/reports/category-expenses", requireAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Start date and end date are required" });
    }
    
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    
    const categoryExpenses = await storage.getCategoryExpenseTotals(req.user!.id, start, end);
    
    // Log activity for viewing category expense report
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'VIEW',
        resourceType: 'REPORT',
        description: `Viewed expense breakdown by category`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { 
          reportType: 'category-expenses',
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          categoriesCount: categoryExpenses.length
        }
      });
      console.log('[DEBUG] Activity logged for category expense report view');
    } catch (logError) {
      console.error('Failed to log category expense report activity:', logError);
    }
    
    res.json(categoryExpenses);
  } catch (error) {
    console.error("Error fetching category expense report:", error);
    res.status(500).json({ message: "Failed to fetch category expense report" });
  }
});

app.get("/api/reports/monthly-incomes/:year", requireAuth, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const monthlyIncomes = await storage.getMonthlyIncomeTotals(req.user!.id, year);
    
    // Log activity for viewing monthly income report
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'VIEW',
        resourceType: 'REPORT',
        description: `Viewed monthly income report for ${year}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { 
          reportType: 'monthly-incomes',
          year: year,
          recordCount: monthlyIncomes.length
        }
      });
      console.log('[DEBUG] Activity logged for monthly income report view');
    } catch (logError) {
      console.error('Failed to log monthly income report activity:', logError);
    }
    
    res.json(monthlyIncomes);
  } catch (error) {
    console.error("Error fetching monthly income report:", error);
    res.status(500).json({ message: "Failed to fetch monthly income report" });
  }
});

app.get("/api/reports/category-incomes", requireAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Start date and end date are required" });
    }
    
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    
    const categoryIncomes = await storage.getCategoryIncomeTotals(req.user!.id, start, end);
    
    // Log activity for viewing category income report
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'VIEW',
        resourceType: 'REPORT',
        description: `Viewed income breakdown by category`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { 
          reportType: 'category-incomes',
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          categoriesCount: categoryIncomes.length
        }
      });
      console.log('[DEBUG] Activity logged for category income report view');
    } catch (logError) {
      console.error('Failed to log category income report activity:', logError);
    }
    
    res.json(categoryIncomes);
  } catch (error) {
    console.error("Error fetching category income report:", error);
    res.status(500).json({ message: "Failed to fetch category income report" });
  }
});

app.get("/api/reports/budget-performance/:budgetId", requireAuth, async (req, res) => {
  try {
    const budgetId = parseInt(req.params.budgetId);
    
    // Verify the budget belongs to the user
    const budget = await storage.getBudgetById(budgetId);
    if (!budget || budget.userId !== req.user!.id) {
      return res.status(403).json({ message: "Invalid budget" });
    }
    
    const performance = await storage.getBudgetPerformance(budgetId);
    
    // Log activity for viewing budget performance report
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'VIEW',
        resourceType: 'REPORT',
        resourceId: budgetId,
        description: `Viewed budget performance report for "${budget.name}"`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { 
          reportType: 'budget-performance',
          budgetId: budgetId,
          budgetName: budget.name,
          performance: performance
        }
      });
      console.log('[DEBUG] Activity logged for budget performance report view');
    } catch (logError) {
      console.error('Failed to log budget performance report activity:', logError);
    }
    
    res.json(performance);
  } catch (error) {
    console.error("Error fetching budget performance:", error);
    res.status(500).json({ message: "Failed to fetch budget performance" });
  }
});
  
// -------------------------------------------------------------------------
// User settings routes
// -------------------------------------------------------------------------
app.patch("/api/user/settings", requireAuth, async (req, res) => {
  try {
    const { currency } = req.body;
    const oldCurrency = req.user!.currency;
    
    console.log(`[DEBUG] Currency update request:`, {
      userId: req.user!.id,
      username: req.user!.username,
      oldCurrency,
      newCurrency: currency,
      timestamp: new Date().toISOString()
    });
    
    const updatedUser = await storage.updateUserSettings(req.user!.id, { currency });
    
    console.log(`[DEBUG] Currency updated successfully:`, {
      userId: req.user!.id,
      updatedCurrency: updatedUser.currency,
      confirmed: updatedUser.currency === currency
    });
    
    // Log activity for updating user settings
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'UPDATE',
        resourceType: 'SETTINGS',
        description: `Updated currency from ${oldCurrency} to ${currency}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { 
          settingType: 'currency',
          oldValue: oldCurrency,
          newValue: currency
        }
      });
      console.log('[DEBUG] Activity logged for currency settings update');
    } catch (logError) {
      console.error('Failed to log user settings update activity:', logError);
    }
    
    const { password, ...userWithoutPassword } = updatedUser;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error("Error updating user settings:", error);
    res.status(500).json({ message: "Failed to update user settings" });
  }
});

// Update user profile information
app.patch("/api/user/profile", requireAuth, async (req, res) => {
  try {
    const { name, email } = req.body;
    const oldName = req.user!.name;
    const oldEmail = req.user!.email;
    
    // For now, we'll just log the activity without updating the database
    // In a real implementation, you would update the user in the database
    
    // Log activity for profile updates
    try {
      if (name && name !== oldName) {
        await logActivity({
          userId: req.user!.id,
          actionType: 'UPDATE',
          resourceType: 'SETTINGS',
          description: `Updated profile name to "${name}"`,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: { 
            settingType: 'profile-name',
            oldValue: oldName,
            newValue: name
          }
        });
        console.log('[DEBUG] Activity logged for profile name update');
      }
      
      if (email && email !== oldEmail) {
        await logActivity({
          userId: req.user!.id,
          actionType: 'UPDATE',
          resourceType: 'SETTINGS',
          description: `Updated profile email to "${email}"`,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: { 
            settingType: 'profile-email',
            oldValue: oldEmail,
            newValue: email
          }
        });
        console.log('[DEBUG] Activity logged for profile email update');
      }
    } catch (logError) {
      console.error('Failed to log profile update activity:', logError);
    }
    
    // Return success response
    res.json({ message: 'Profile updated successfully', name, email });
  } catch (error) {
    console.error("Error updating user profile:", error);
    res.status(500).json({ message: "Failed to update user profile" });
  }
});

// Update notification settings
app.patch("/api/user/notifications", requireAuth, async (req, res) => {
  try {
    const { emailNotifications, monthlyReport, budgetAlerts } = req.body;
    
    // Log activity for each notification setting change
    try {
      const settingChanges = [
        { key: 'emailNotifications', value: emailNotifications, label: 'Email' },
        { key: 'monthlyReport', value: monthlyReport, label: 'Monthly Report' },
        { key: 'budgetAlerts', value: budgetAlerts, label: 'Budget Alerts' }
      ];
      
      for (const setting of settingChanges) {
        if (setting.value !== undefined) {
          await logActivity({
            userId: req.user!.id,
            actionType: 'UPDATE',
            resourceType: 'SETTINGS',
            description: `${setting.value ? 'Enabled' : 'Disabled'} ${setting.label} notifications`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            metadata: { 
              settingType: `notification-${setting.key}`,
              newValue: setting.value,
              settingName: setting.label
            }
          });
          console.log(`[DEBUG] Activity logged for ${setting.label} notification setting`);
        }
      }
    } catch (logError) {
      console.error('Failed to log notification settings update activity:', logError);
    }
    
    res.json({ 
      message: 'Notification settings updated successfully',
      emailNotifications,
      monthlyReport,
      budgetAlerts
    });
  } catch (error) {
    console.error("Error updating notification settings:", error);
    res.status(500).json({ message: "Failed to update notification settings" });
  }
});

// Log account actions (like logout)
app.post("/api/user/account-action", requireAuth, async (req, res) => {
  try {
    const { action, metadata } = req.body;
    
    // Log the account action
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'UPDATE',
        resourceType: 'SETTINGS',
        description: `Performed account action: ${action}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { 
          actionType: action,
          ...metadata
        }
      });
      console.log('[DEBUG] Activity logged for account action');
    } catch (logError) {
      console.error('Failed to log account action activity:', logError);
    }
    
    res.json({ message: `Account action "${action}" logged successfully` });
  } catch (error) {
    console.error("Error logging account action:", error);
    res.status(500).json({ message: "Failed to log account action" });
  }
});
  
  // -------------------------------------------------------------------------
// Admin routes
// -------------------------------------------------------------------------
app.get("/api/admin/users", requireAuth, requirePermission('user.manage'), async (req, res) => {
  try {
    const users = await storage.getAllUsers();
    // Remove passwords from response
    const safeUsers = await Promise.all(users.map(async ({ password, ...user }) => ({
      ...user,
      role: await storage.getUserRole(user.id)
    })));
    
    // Log activity for admin viewing users
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'VIEW',
        resourceType: 'USER',
        description: `Admin viewed all users (${safeUsers.length} users)`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { 
          adminAction: 'view-users',
          userCount: safeUsers.length
        }
      });
      console.log('[DEBUG] Activity logged for admin viewing users');
    } catch (logError) {
      console.error('Failed to log admin view users activity:', logError);
    }
    
    res.json(safeUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// Create user (admin)
app.post("/api/admin/users", requireAuth, requirePermission('user.manage'), async (req, res) => {
  try {
    const { username, name, email, role = 'user' } = req.body;
    const tempPassword = req.body.password || Math.random().toString(36).slice(-10);
    if (!username || !name || !email) {
      return res.status(400).json({ message: "username, name, and email are required" });
    }
    // Check exists
    const existing = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existing.rowCount && existing.rowCount > 0) {
      return res.status(409).json({ message: "User with same username or email exists" });
    }
    // Hash password
    const { hashPassword } = await import('./password');
    const hashed = await hashPassword(tempPassword);
    const result = await pool.query(
      'INSERT INTO users (username, password, name, email, role, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, username, name, email, role, status, created_at',
      [username, hashed, name, email, role, 'active']
    );
    const user = result.rows[0];
    // Mirror role into RBAC user_roles for permission middleware
    try {
      const roleRes = await pool.query('SELECT id FROM roles WHERE name = $1', [role]);
      const roleId = roleRes.rows[0]?.id;
      if (roleId) {
        await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, roleId]);
      }
    } catch (e) {
      console.warn('Failed to sync user_roles for new user', e);
    }
    // Create default categories for the new user
    await storage.createDefaultCategories(user.id);
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'CREATE',
        resourceType: 'USER',
        resourceId: user.id,
        description: `Admin created user \"${username}\" (${email})`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { adminAction: 'create-user', role, tempPassword: true }
      });
    } catch {}
    res.status(201).json({ ...user, temporaryPassword: tempPassword });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Failed to create user' });
  }
});

// Suspend or activate user
app.patch('/api/admin/users/:id/status', requireAuth, requirePermission('user.manage'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { status } = req.body as { status: 'active'|'suspended'|'deleted' };
    if (!['active','suspended','deleted'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    if (userId === req.user!.id) {
      return res.status(400).json({ message: 'Cannot change your own status' });
    }
    const existing = await storage.getUser(userId);
    if (!existing) return res.status(404).json({ message: 'User not found' });
    await pool.query(
      `UPDATE users SET status = $1,
         suspended_at = CASE WHEN $1='suspended' THEN NOW() ELSE NULL END,
         deleted_at = CASE WHEN $1='deleted' THEN NOW() ELSE NULL END
       WHERE id = $2`,
      [status, userId]
    );
    try { await logActivity({ userId: req.user!.id, actionType: 'UPDATE', resourceType: 'USER', resourceId: userId, description: `Admin set status to ${status} for ${existing.username}`, ipAddress: req.ip, userAgent: req.get('User-Agent'), metadata: { adminAction: 'update-status', status } }); } catch {}
    res.json({ message: 'Status updated' });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ message: 'Failed to update user status' });
  }
});

// Reset user password (admin)
app.post('/api/admin/users/:id/reset-password', requireAuth, requirePermission('user.manage'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const newPassword = req.body.password || Math.random().toString(36).slice(-10);
    const { hashPassword } = await import('./password');
    const hashed = await hashPassword(newPassword);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, userId]);
    try { await logActivity({ userId: req.user!.id, actionType: 'UPDATE', resourceType: 'USER', resourceId: userId, description: `Admin reset password for ${user.username}`, ipAddress: req.ip, userAgent: req.get('User-Agent'), metadata: { adminAction: 'reset-password' } }); } catch {}
    res.json({ message: 'Password reset', temporaryPassword: newPassword });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

app.get("/api/admin/expenses", requireAuth, requirePermission('admin.access'), async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT e.*, u.name as user_name, ec.name AS category_name_join
      FROM expenses e
      LEFT JOIN users u ON u.id = e.user_id
      LEFT JOIN expense_categories ec ON ec.id = e.category_id
      ORDER BY e.created_at DESC
    `);
    const expenses = r.rows.map((row: any) => ({
      ...row,
      userName: row.user_name,
      categoryName: row.category_name || row.category_name_join || 'Uncategorized'
    }));
    
    // Log activity for admin viewing all expenses
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'VIEW',
        resourceType: 'REPORT',
        description: `Admin viewed all expenses (${expenses.length} expenses)`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { 
          adminAction: 'view-all-expenses',
          expenseCount: expenses.length
        }
      });
      console.log('[DEBUG] Activity logged for admin viewing all expenses');
    } catch (logError) {
      console.error('Failed to log admin view expenses activity:', logError);
    }
    
  res.json(expenses);
  } catch (error) {
    console.error("Error fetching all expenses:", error);
    res.status(500).json({ message: "Failed to fetch expenses" });
  }
});

app.get("/api/admin/incomes", requireAuth, requirePermission('admin.access'), async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT i.*, u.name as user_name, ic.name AS category_name_join
      FROM incomes i
      LEFT JOIN users u ON u.id = i.user_id
      LEFT JOIN income_categories ic ON ic.id = i.category_id
      ORDER BY i.created_at DESC
    `);
    const incomes = r.rows.map((row: any) => ({
      ...row,
      userName: row.user_name,
      categoryName: row.category_name || row.category_name_join || 'Uncategorized'
    }));
    
    // Log activity for admin viewing all incomes
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'VIEW',
        resourceType: 'REPORT',
        description: `Admin viewed all incomes (${incomes.length} incomes)`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { 
          adminAction: 'view-all-incomes',
          incomeCount: incomes.length
        }
      });
      console.log('[DEBUG] Activity logged for admin viewing all incomes');
    } catch (logError) {
      console.error('Failed to log admin view incomes activity:', logError);
    }
    
  res.json(incomes);
  } catch (error) {
    console.error("Error fetching all incomes:", error);
    res.status(500).json({ message: "Failed to fetch incomes" });
  }
});

app.get("/api/admin/budgets", requireAuth, requirePermission('admin.access'), async (req, res) => {
  try {
    // Collect all budgets from all users
    const users = await storage.getAllUsers();
    const allBudgets = [];
    
    for (const user of users) {
      const budgets = await storage.getBudgetsByUserId(user.id);
      // Add user information to each budget
      const augmentedBudgets = budgets.map(budget => ({
        ...budget,
        userName: user.name,
        userEmail: user.email
      }));
      allBudgets.push(...augmentedBudgets);
    }
    
    // Log activity for admin viewing all budgets
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'VIEW',
        resourceType: 'REPORT',
        description: `Admin viewed all budgets (${allBudgets.length} budgets from ${users.length} users)`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { 
          adminAction: 'view-all-budgets',
          budgetCount: allBudgets.length,
          userCount: users.length
        }
      });
      console.log('[DEBUG] Activity logged for admin viewing all budgets');
    } catch (logError) {
      console.error('Failed to log admin view budgets activity:', logError);
    }
    
    res.json(allBudgets);
  } catch (error) {
    console.error("Error fetching all budgets:", error);
    res.status(500).json({ message: "Failed to fetch budgets" });
  }
});


// Admin Dashboard Main Route
app.get("/api/admin/dashboard", requireAuth, requirePermission('admin.access'), async (req, res) => {
  try {
    // Serve cached response if within TTL (30s)
    const now = Date.now();
    if (dashboardCache && (now - dashboardCache.ts) < 30_000) {
      return res.json(dashboardCache.data);
    }
    // Get comprehensive dashboard stats
    const [
      usersStats,
      expensesStats,
      incomesStats,
      budgetsStats,
      recentActivity,
      topCategories,
  dailyActive,
  dailyActiveSeries,
  expenseTrends
    ] = await Promise.all([
      // Users statistics - REMOVE THE COLUMNS THAT DON'T EXIST
      pool.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as new_users_7d
        FROM users
      `),
      
      // Expenses statistics
      pool.query(`
        SELECT 
          COUNT(*) as total_expenses,
          COALESCE(SUM(amount), 0) as total_expenses_amount,
          COUNT(CASE WHEN date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as recent_expenses_30d
        FROM expenses
      `),
      
      // Incomes statistics
      pool.query(`
        SELECT 
          COUNT(*) as total_incomes,
          COALESCE(SUM(amount), 0) as total_incomes_amount,
          COUNT(CASE WHEN date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as recent_incomes_30d
        FROM incomes
      `),
      
      // Budgets statistics
      pool.query(`
        SELECT 
          COUNT(*) as total_budgets,
          COUNT(DISTINCT user_id) as users_with_budgets
        FROM budgets
      `),
      
      // Recent activity
      pool.query(`
        SELECT al.*, u.name as user_name
        FROM activity_log al
        JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT 10
      `),
      
      // Top categories
      pool.query(`
        SELECT ec.name, COUNT(e.id) as transaction_count, SUM(e.amount) as total_amount
        FROM expenses e
        JOIN expense_categories ec ON e.category_id = ec.id
        GROUP BY ec.name
        ORDER BY total_amount DESC
        LIMIT 5
      `),
      // Daily active users via union of logs and transactions
      pool.query(`
        SELECT COUNT(DISTINCT user_id) as dau FROM (
          SELECT user_id FROM activity_log WHERE created_at >= CURRENT_DATE
          UNION
          SELECT user_id FROM expenses WHERE date >= CURRENT_DATE
          UNION
          SELECT user_id FROM incomes WHERE date >= CURRENT_DATE
        ) t
      `)
      ,
      // Daily Active Users time-series for last 30 days
      pool.query(`
        WITH series AS (
          SELECT generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') AS day
        ),
        events AS (
          SELECT date_trunc('day', created_at)::date AS day, user_id
          FROM activity_log
          WHERE created_at >= CURRENT_DATE - INTERVAL '29 days'
          GROUP BY day, user_id
          UNION
          SELECT date_trunc('day', date)::date AS day, user_id
          FROM expenses
          WHERE date >= CURRENT_DATE - INTERVAL '29 days'
          GROUP BY day, user_id
          UNION
          SELECT date_trunc('day', date)::date AS day, user_id
          FROM incomes
          WHERE date >= CURRENT_DATE - INTERVAL '29 days'
          GROUP BY day, user_id
        ),
        agg AS (
          SELECT day, COUNT(DISTINCT user_id) AS dau
          FROM events
          GROUP BY day
        )
        SELECT s.day::date AS date, COALESCE(a.dau, 0)::int AS value
        FROM series s
        LEFT JOIN agg a ON a.day = s.day::date
        ORDER BY s.day
      `)
      ,
      // Expense trends (transactions and total amount) for last 30 days
      pool.query(`
        WITH series AS (
          SELECT generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') AS day
        ),
        e AS (
          SELECT date_trunc('day', date)::date AS day,
                 COUNT(*)::int AS transactions,
                 COALESCE(SUM(amount), 0)::bigint AS total_amount
          FROM expenses
          WHERE date >= CURRENT_DATE - INTERVAL '29 days'
          GROUP BY 1
        )
        SELECT s.day::date AS date,
               COALESCE(e.transactions, 0)::int AS transactions,
               COALESCE(e.total_amount, 0)::bigint AS total_amount
        FROM series s
        LEFT JOIN e ON e.day = s.day::date
        ORDER BY s.day
      `)
    ]);

    const dashboardData = {
      users: {
        total: parseInt(usersStats.rows[0].total_users),
        suspended: 0, // Set to 0 since column doesn't exist yet
        deleted: 0,   // Set to 0 since column doesn't exist yet
        newLast7Days: parseInt(usersStats.rows[0].new_users_7d),
        dailyActive: parseInt(dailyActive.rows[0]?.dau || 0)
      },
      expenses: {
        total: parseInt(expensesStats.rows[0].total_expenses),
        totalAmount: parseInt(expensesStats.rows[0].total_expenses_amount),
        recent30Days: parseInt(expensesStats.rows[0].recent_expenses_30d)
      },
      incomes: {
        total: parseInt(incomesStats.rows[0].total_incomes),
        totalAmount: parseInt(incomesStats.rows[0].total_incomes_amount),
        recent30Days: parseInt(incomesStats.rows[0].recent_incomes_30d)
      },
      budgets: {
        total: parseInt(budgetsStats.rows[0].total_budgets),
        usersWithBudgets: parseInt(budgetsStats.rows[0].users_with_budgets)
      },
      totalTransactions: parseInt(expensesStats.rows[0].total_expenses) + parseInt(incomesStats.rows[0].total_incomes),
      recentActivity: recentActivity.rows,
      topCategories: topCategories.rows,
      dailyActiveSeries: dailyActiveSeries.rows,
      expenseTrends: expenseTrends.rows
    };

  // Cache result
  dashboardCache = { data: dashboardData, ts: Date.now() };

  // Log activity for admin viewing dashboard
    try {
  logActivityAsync({
        userId: req.user!.id,
        actionType: 'VIEW',
        resourceType: 'DASHBOARD',
        description: `Admin viewed dashboard`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { 
          adminAction: 'view-dashboard',
          stats: dashboardData
        }
  });
      console.log('[DEBUG] Activity logged for admin viewing dashboard');
    } catch (logError) {
      console.error('Failed to log admin dashboard view activity:', logError);
    }

  res.json(dashboardData);
  } catch (error) {
    console.error("Error fetching admin dashboard:", error);
    res.status(500).json({ message: "Failed to fetch admin dashboard" });
  }
});

// Update user role endpoint for administrators

app.patch("/api/admin/users/:id/role", requireAuth, requirePermission('user.manage'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { role } = req.body;
    
    if (!role || !['admin', 'user'].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    
    // Get user info for logging
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const oldRole = await storage.getUserRole(userId);
    
    await storage.setUserRole(userId, role);
    // Sync RBAC mapping for core system roles (admin/user)
    try {
      const roleRow = await pool.query('SELECT id FROM roles WHERE name = $1', [role]);
      const newRoleId = roleRow.rows[0]?.id;
      if (newRoleId) {
        // Remove legacy system role mappings and add the new one
        await pool.query("DELETE FROM user_roles WHERE user_id = $1 AND role_id IN (SELECT id FROM roles WHERE name IN ('admin','user'))", [userId]);
        await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, newRoleId]);
      }
    } catch (e) {
      console.warn('Failed to sync user_roles on role update', e);
    }
    
    // Log activity for admin updating user role
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'UPDATE',
        resourceType: 'USER',
        resourceId: userId,
        description: `Admin updated user role for "${user.username}" from ${oldRole} to ${role}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { 
          adminAction: 'update-user-role',
          targetUserId: userId,
          targetUsername: user.username,
          oldRole: oldRole,
          newRole: role
        }
      });
      console.log('[DEBUG] Activity logged for admin updating user role');
    } catch (logError) {
      console.error('Failed to log admin update user role activity:', logError);
    }
    
    res.status(200).json({ message: "User role updated" });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({ message: "Failed to update user role" });
  }
});

// Delete user endpoint for administrators
app.delete("/api/admin/users/:id", requireAuth, requirePermission('user.manage'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Check if user exists
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Prevent deleting your own account
    if (userId === req.user!.id) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }
    
  // Soft-delete: mark as deleted and set deleted_at timestamp
  await pool.query(`UPDATE users SET status = 'deleted', deleted_at = NOW(), suspended_at = NULL WHERE id = $1`, [userId]);
    
    // Log activity for admin deleting user
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'DELETE',
        resourceType: 'USER',
        resourceId: userId,
        description: `Admin deleted user account "${user.username}" (${user.email})`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { 
          adminAction: 'delete-user',
          targetUserId: userId,
          targetUsername: user.username,
          targetEmail: user.email
        }
      });
      console.log('[DEBUG] Activity logged for admin deleting user');
    } catch (logError) {
      console.error('Failed to log admin delete user activity:', logError);
    }
    
  res.status(200).json({ message: "User soft-deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

// -------------------------------------------------------------------------
// Activity Log Routes
// -------------------------------------------------------------------------

// Create activity log entry (for client-side logging)
app.post("/api/activity-logs", requireAuth, async (req, res) => {
  try {
    const { actionType, resourceType, resourceId, description, metadata } = req.body;
    
    await logActivity({
      userId: req.user!.id,
      actionType,
      resourceType,
      resourceId,
      description,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata
    });
    
    res.status(201).json({ message: 'Activity logged successfully' });
  } catch (error) {
    console.error('Error creating activity log:', error);
    res.status(500).json({ message: 'Failed to create activity log' });
  }
});

app.get("/api/activity-logs", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100 per request
    const offset = (page - 1) * limit;
    
    // Search/filter parameters
    const searchQuery = req.query.search as string || '';
    const actionType = req.query.actionType as string || '';
    const resourceType = req.query.resourceType as string || '';
    const fromDate = req.query.fromDate as string || '';
    const toDate = req.query.toDate as string || '';
    
    // Debug logging
    console.log(`[DEBUG] Activity logs search - userId: ${userId}, searchQuery: "${searchQuery}", actionType: "${actionType}", resourceType: "${resourceType}"`);
    
    // Check if user is admin with user_id = 14
    const isAdmin = userId === 14;
    const targetUserId = isAdmin ? (req.query.userId ? parseInt(req.query.userId as string) : null) : userId;

    const { getUserActivityLogs, getUserActivityLogsCount, getAllUsersActivityLogs, getAllUsersActivityLogsCount } = await import('./activity-loggers');
    
    let logs, totalCount;
    
    const filterOptions = {
      searchQuery,
      actionType,
      resourceType,
      fromDate,
      toDate
    };
    
    if (isAdmin && !targetUserId) {
      // Admin viewing all users' activities
      [logs, totalCount] = await Promise.all([
        getAllUsersActivityLogs(limit, offset, filterOptions),
        getAllUsersActivityLogsCount(filterOptions)
      ]);
    } else {
      // Regular user viewing their own activities, or admin viewing specific user
      const userIdToQuery = targetUserId || userId;
      [logs, totalCount] = await Promise.all([
        getUserActivityLogs(userIdToQuery, limit, offset, filterOptions),
        getUserActivityLogsCount(userIdToQuery, filterOptions)
      ]);
    }

    // Log activity for viewing activity logs
    try {
  logActivityAsync({
        userId: req.user!.id,
        actionType: 'VIEW',
        resourceType: 'REPORT',
        description: `Viewed activity history (${logs.length} logs)`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { 
          page: page,
          limit: limit,
          searchQuery: searchQuery,
          actionType: actionType,
          resourceType: resourceType,
          logCount: logs.length,
          totalCount: totalCount,
          isAdmin: isAdmin
        }
  });
      console.log('[DEBUG] Activity logged for viewing activity history');
    } catch (logError) {
      console.error('Failed to log activity history view:', logError);
    }

    res.json({
      logs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      isAdmin,
      currentUserId: userId
    });
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    res.status(500).json({ message: "Failed to fetch activity logs" });
  }
});

// Delete a specific activity log entry
app.delete("/api/activity-logs/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    
    // Ensure the activity log belongs to the user
    const logCheck = await pool.query('SELECT id FROM activity_log WHERE id = $1 AND user_id = $2', [id, userId]);
    if (logCheck.rowCount === 0) {
      return res.status(404).json({ message: "Activity log not found" });
    }
    
    await pool.query('DELETE FROM activity_log WHERE id = $1 AND user_id = $2', [id, userId]);
    
    // Log activity for deleting activity log
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'DELETE',
        resourceType: 'SETTINGS',
        description: `Deleted activity log entry #${id}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { 
          deletedLogId: id
        }
      });
      console.log('[DEBUG] Activity logged for deleting activity log entry');
    } catch (logError) {
      console.error('Failed to log activity log deletion:', logError);
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting activity log:", error);
    res.status(500).json({ message: "Failed to delete activity log" });
  }
});

// Clear all activity logs for the current user
app.delete("/api/activity-logs", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const result = await pool.query('DELETE FROM activity_log WHERE user_id = $1', [userId]);
    
    // Log activity for clearing all activity logs
    try {
      await logActivity({
        userId: req.user!.id,
        actionType: 'DELETE',
        resourceType: 'SETTINGS',
        description: `Cleared all activity history (${result.rowCount} entries)`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { 
          clearedEntries: result.rowCount
        }
      });
      console.log('[DEBUG] Activity logged for clearing all activity history');
    } catch (logError) {
      console.error('Failed to log activity history clear:', logError);
    }
    
    res.json({ 
      message: "All activity history cleared successfully",
      deletedCount: result.rowCount 
    });
  } catch (error) {
    console.error("Error clearing activity logs:", error);
    res.status(500).json({ message: "Failed to clear activity history" });
  }
});

app.get("/api/expenses/total-this-month", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM expenses
       WHERE user_id = $1
         AND date >= date_trunc('month', CURRENT_DATE)
         AND date < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')`,
      [userId]
    );

    res.json({ total: Number(rows[0].total) });
  } catch (err) {
    console.error("Error fetching monthly total:", err);
    res.status(500).json({ error: "Failed to fetch total expenses" });
  }
});

  const httpServer = createServer(app);

  return httpServer;
}
