import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

export const supabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!supabaseConfigured) {
  console.warn('Supabase URL or anon key not set. Data will fall back to localStorage.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Check if Supabase is reachable and the database tables exist.
 * Returns { ok, error } — used on startup to detect sync issues.
 */
export async function checkSupabaseHealth(): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseConfigured) return { ok: false, error: 'Supabase not configured' };
  try {
    const { error } = await supabase.from('settings').select('key').limit(1);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}
