import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && key);
export const supabase = createClient(url ?? "http://localhost", key ?? "missing", {
  auth: { persistSession: true, autoRefreshToken: true },
});

let ready: Promise<void> | null = null;

/** Reuses an existing session, otherwise signs in anonymously. Resolves once a session exists. */
export function ensureSession(): Promise<void> {
  if (!supabaseConfigured) return Promise.reject(new Error("Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)."));
  if (!ready) {
    ready = (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) return;
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
    })();
    ready.catch(() => { ready = null; });
  }
  return ready;
}

export async function accessToken(): Promise<string | undefined> {
  await ensureSession();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}
