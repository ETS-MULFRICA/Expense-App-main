import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Missing Supabase environment variables. Supabase features disabled.');
}

// Create Supabase client with service role key for server-side operations
export const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Test connection function
export async function testSupabaseConnection() {
  try {
    if (!supabase) {
      console.log('❌ Supabase client not configured');
      return false;
    }
    
    const { data, error } = await supabase.from('users').select('count').single();
    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
      return false;
    }
    console.log('✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection error:', error);
    return false;
  }
}
