import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createStorage } from './storage-factory';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { username, password, name, email } = req.body;

    if (!username || !password || !name || !email) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const storage = await createStorage();
    
    // Check if user already exists
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Create new user
      const newUser = await storage.createUser({
        username,
        password, // Note: In production, hash this password
        name,
        email
      });

      // Create default categories for the new user
      if (typeof storage.createDefaultCategories === 'function') {
        await storage.createDefaultCategories(newUser.id);
      }

      // Return user without password
      const { password: _, ...userWithoutPassword } = newUser;
      res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
