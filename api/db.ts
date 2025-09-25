import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
dotenv.config();
import path, { dirname } from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);



export const config = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
};

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function getClient() {
  const client = await pool.connect();
  return client;
}

export async function runMigrationScript() {
    const client = await getClient();
    try {
      const filePath = path.resolve(__dirname, '../database/schema.sql');
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      await client.query(sqlContent);
      console.log(`SQL file '${filePath}' executed successfully.`);
    } catch (err) {
        console.error('Error executing SQL file:', err);
    } finally {
        client.release();
    }
}