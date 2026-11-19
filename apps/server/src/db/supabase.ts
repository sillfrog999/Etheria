import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../config/env.js';

let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(env: Env): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _supabaseAdmin;
}
