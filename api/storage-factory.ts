import { MemStorage } from "./storage";
import { IStorage } from "./storage";

// Configuration for storage backend
export const USE_SUPABASE = process.env.USE_SUPABASE === 'true';

/**
 * Storage Factory
 * Creates the appropriate storage implementation based on configuration
 */
export async function createStorage(): Promise<IStorage> {
  if (USE_SUPABASE) {
    console.log('⚠️  Supabase storage not fully implemented yet');
    console.log('🧠 Falling back to in-memory storage backend');
  } else {
    console.log('🧠 Using in-memory storage backend');
  }
  
  console.log('⚠️  Data will not persist between server restarts');
  return new MemStorage();
}
