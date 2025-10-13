import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { pool } from "./db";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

declare global {
  namespace Express {
    interface User extends SelectUser {}
    interface Request {
      user?: User;
    }
  }
  
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}
 // For debugging in console

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  if (!process.env.SESSION_SECRET) {
    console.warn("No SESSION_SECRET env var set, using a default value");
  }

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "ExpenseTrack-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const client = await pool.connect();
      try {
        const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        console.log("Authenticating user:",{ user, username });
        if (!user) {
          // No user found: record failed attempt (IP/UA filled in /api/login handler too)
          try { await client.query('INSERT INTO login_attempts (username, user_id, success, ip_address, user_agent) VALUES ($1, NULL, FALSE, $2, $3)', [username, (global as any).__lastReqIp || null, (global as any).__lastReqUA || null]); } catch {}
          return done(null, false);
        }
        // Block suspended or deleted users (if status column exists)
        try {
          if (user.status === 'suspended') { try { await client.query('INSERT INTO login_attempts (username, user_id, success, ip_address, user_agent) VALUES ($1, $2, FALSE, $3, $4)', [username, user.id, (global as any).__lastReqIp || null, (global as any).__lastReqUA || null]); } catch {} ; return done(null, false); }
          if (user.status === 'deleted') { try { await client.query('INSERT INTO login_attempts (username, user_id, success, ip_address, user_agent) VALUES ($1, $2, FALSE, $3, $4)', [username, user.id, (global as any).__lastReqIp || null, (global as any).__lastReqUA || null]); } catch {} ; return done(null, false); }
        } catch {}

        let ok = false;
        // If stored password has our scrypt format (hash.salt), verify
        if (typeof user.password === 'string' && user.password.includes('.')) {
          ok = await comparePasswords(password, user.password);
        } else {
          // Backward-compatible: treat stored as plaintext
          ok = password === user.password;
          if (ok) {
            // Upgrade to hashed password silently
            const newHash = await hashPassword(password);
            try {
              await client.query('UPDATE users SET password = $1 WHERE id = $2', [newHash, user.id]);
              user.password = newHash;
            } catch (e) {
              console.warn('Failed to upgrade password hash for user', user.id, e);
            }
          }
        }
        console.log("Password check result:", ok);
  if (!ok) { try { await client.query('INSERT INTO login_attempts (username, user_id, success, ip_address, user_agent) VALUES ($1, $2, FALSE, $3, $4)', [username, user.id, (global as any).__lastReqIp || null, (global as any).__lastReqUA || null]); } catch {} ; return done(null, false); }
  try { await client.query('INSERT INTO login_attempts (username, user_id, success, ip_address, user_agent) VALUES ($1, $2, TRUE, $3, $4)', [username, user.id, (global as any).__lastReqIp || null, (global as any).__lastReqUA || null]); } catch {}
        return done(null, user);
      } catch (err) {
        return done(err);
      } finally {
        // Release the client back to the pool
        client.release();
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM users WHERE id = $1', [id]);
      const user = result.rows[0];
      done(null, user);
    } catch (err) {
      done(err);
    } finally {
      // Release the client back to the pool
      client.release();
    }
  });

  app.post("/api/register", async (req, res, next) => {
  console.log("[DEBUG] /api/register headers:", req.headers);
  console.log("[DEBUG] /api/register body:", req.body);
  console.log("Register endpoint hit with data:", req.body);
  const client = await pool.connect();
  try {
    // Validate input
    const userData = insertUserSchema.parse(req.body);
    const { username, password, name, email } = userData;
    console.log("Validated user data:", userData);
    // Check for existing user
    const existingUserResult = await client.query('SELECT * FROM users WHERE username = $1', [username]);
    if (existingUserResult.rows.length > 0) {
      return res.status(400).json({ message: "Username already exists" });
    }
    console.log("No existing user found, proceeding to create user",password);

    // Hash password and insert user
    const hashedPassword = await hashPassword(password);
    console.log(hashedPassword);
    console.log("Inserting user into database:", { username, name, email });
    const insertResult = await client.query(
      'INSERT INTO users (username, password, name, email, role, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, name, email, role, status',
      [username, hashedPassword, name, email, 'user', 'active']
    );
    const user = insertResult.rows[0];
    console.log("Created new user:", user);

    // Log the user in
    req.login(user, (err) => {
      if (err) return next(err);
      
      // ADD THIS: Include role in response (new users default to 'user')
      const { password, ...userWithoutPassword } = user;
      res.status(201).json({
        ...userWithoutPassword,
        role: 'user',
        status: 'active'
      });
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      res.status(400).json({ message: validationError.message });
    } else {
      next(error);
    }
  } finally {
    // Release the client back to the pool
    client.release();
  }
});

  app.post("/api/login", (req, res, next) => {
  console.log("[DEBUG] /api/login headers:", req.headers);
  console.log("[DEBUG] /api/login body:", req.body);
  // expose IP/UA for LocalStrategy logging
  ;(global as any).__lastReqIp = req.ip;
  ;(global as any).__lastReqUA = req.get('User-Agent') || null;
  passport.authenticate("local", (err: any, user: any, info: any) => {
    if (err) return next(err);
    if (!user) {
      // Log failed attempt with IP and UA if we can associate a user
      (async () => {
        try {
          const username = (req.body && (req.body.username || req.body.email || req.body.user)) || '';
          await pool.query('INSERT INTO login_attempts (username, user_id, success, ip_address, user_agent) VALUES ($1, NULL, FALSE, $2, $3)', [username, req.ip, req.get('User-Agent') || null]);
        } catch {}
      })();
      return res.status(401).json({ message: "Invalid username or password" });
    }
    req.login(user, (err) => {
      if (err) return next(err);
      // Don't return password in response
      const { password, ...userWithoutPassword } = user;
      
      // ADD THIS: Get user role and include it in response
      Promise.all([
        storage.getUserRole(user.id),
        storage.getUserPermissions(user.id).catch(() => [] as string[]),
        pool.query('SELECT default_currency FROM app_settings WHERE id = 1').then(r => r.rows[0]?.default_currency).catch(() => undefined)
      ]).then(([role, permissions, appDefaultCurrency]) => {
        // Successful login activity log
        (async () => {
          try {
            const { logActivity } = await import('./activity-loggers');
            await logActivity({ userId: user.id, actionType: 'LOGIN', resourceType: 'USER', description: `User ${user.username} logged in`, ipAddress: req.ip, userAgent: req.get('User-Agent') });
          } catch {}
        })();
  return res.json({
          ...userWithoutPassword,
          role: role,
          status: user.status,
          permissions,
          appDefaultCurrency
        });
      }).catch(error => {
        console.error("Error getting user role/permissions:", error);
        return res.json({
          ...userWithoutPassword,
          role: 'user',
          status: user.status || 'active',
          permissions: [],
          appDefaultCurrency: undefined
        });
      });
    });
  })(req, res, next);
});

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", async (req, res) => {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  
  // ADD THIS: Get user role
  const userRole = await storage.getUserRole(req.user.id);
  const permissions = await storage.getUserPermissions(req.user.id).catch(() => [] as string[]);
  let appDefaultCurrency: string | undefined;
  try {
    const r = await pool.query('SELECT default_currency FROM app_settings WHERE id = 1');
    appDefaultCurrency = r.rows[0]?.default_currency;
  } catch {}
  
  // Don't return password in response
  const { password, ...userWithoutPassword } = req.user;
  res.json({
    ...userWithoutPassword,
    role: userRole,
    permissions,
    appDefaultCurrency
  });
});
}