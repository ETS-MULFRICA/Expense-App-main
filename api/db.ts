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
      const filePath = path.resolve(__dirname, '../database/schema.sql');
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      await client.query(sqlContent);
      await dbAdmin(client);
      console.log(`SQL file '${filePath}' executed successfully.`);
    } catch (err) {
        console.error('Error executing SQL file:', err);
    } finally {
        client.release();
    }
}