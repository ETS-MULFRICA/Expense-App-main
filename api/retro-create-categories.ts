import { PostgresStorage } from './postgres-storage';
import { pool } from './db';
import session from 'express-session';

async function run() {
  const storage = new PostgresStorage(new session.MemoryStore());
  const users = await storage.getAllUsers();
  console.log('Found', users.length, 'users');
  for (const user of users) {
    try {
      await storage.createDefaultCategories(user.id);
      console.log('Default categories created for user', user.id);
    } catch (err) {
      console.error('Error creating categories for user', user.id, err);
    }
  }
  await pool.end();
  console.log('Done.');
}

run();
