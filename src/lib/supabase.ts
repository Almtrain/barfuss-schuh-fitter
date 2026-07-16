import { createClient } from "@supabase/supabase-js";
import { getEnv, getRequiredEnv } from "./env";

export function hasSupabaseServerConfig() {
  return Boolean(
    getEnv("NEXT_PUBLIC_SUPABASE_URL") && getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
}

export function createSupabaseServerClient() {
  return createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export const storageBucket =
  process.env.SUPABASE_STORAGE_BUCKET || "fit-photos";
