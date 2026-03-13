import { createClient } from '@supabase/supabase-js';

/**
 * Admin / service-role Supabase client.
 * Bypasses RLS — use ONLY in server-side code (API routes, Server Actions).
 * Never import this in client components.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'Add it to your .env.local file. ' +
      'Find it in Supabase Dashboard → Project Settings → API → service_role key.'
    );
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
