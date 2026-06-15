import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Lazy singleton — only created when env vars are present
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _client;
}

// Named export for convenience (may be null if env vars not set)
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
