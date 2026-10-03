import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env.js";

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseClient && env.SUPABASE_URL && env.SUPABASE_ANON_KEY && !env.SUPABASE_URL.includes("placeholder")) {
    supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabaseClient;
}

export async function isSupabaseConnected(): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from("users").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}
