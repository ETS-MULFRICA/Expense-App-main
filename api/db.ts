import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
dotenv.config();
import path, { dirname } from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { hashPassword } from './password';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);



export const config = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
};

export const pool = new Pool(config);

export async function getClient() {
  const client = await pool.connect();
  return client;
}
async function dbAdmin(client: PoolClient) {
   // Validate input
      
        const { username, password, name, email } = { username: 'admin', password: 'password', name: 'Admin', email: 'admin@example.com' };
    
        // Check for existing user
        const existingUserResult = await client.query('SELECT * FROM users WHERE username = $1', [username]);
        if (existingUserResult.rows.length > 0) {
          return;
        }
        console.log("No existing user found, proceeding to create user",password);
  
  
        // Hash password and insert user
        const hashedPassword = await hashPassword(password);
        console.log(hashedPassword);
        console.log("Inserting user into database:", { username, name, email });
        const insertResult = await client.query(
          'INSERT INTO users (username, password, name, email, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, name, email, role',
          [username, hashedPassword, name, email, 'admin']
        );
        const user = insertResult.rows[0];
        console.log("Created new user:", user);
  
        
}

export async function runMigrationScript() {
  const client = await getClient();
  try {
    // 1) Apply base schema
    const basePath = path.resolve(__dirname, '../database/schema.sql');
    const baseSql = fs.readFileSync(basePath, 'utf8');
    await client.query(baseSql);
    console.log(`Base schema '${basePath}' executed successfully.`);

    // 2) Apply all migrations (if any) in lexicographic order
    const migrationsDir = path.resolve(__dirname, '../database/migrations');
  if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();
      for (const f of files) {
        const full = path.join(migrationsDir, f);
        const sql = fs.readFileSync(full, 'utf8');
        try {
          await client.query(sql);
          console.log(`Migration '${f}' executed successfully.`);
        } catch (e) {
          console.warn(`Migration '${f}' failed or already applied:`, (e as any)?.message || e);
      // Ensure the connection is not left in an aborted transaction state
      try { await client.query('ROLLBACK'); } catch {}
        }
      }
    }

    await dbAdmin(client);
  } catch (err) {
    console.error('Error executing SQL migrations:', err);
  } finally {
    client.release();
  }
}