import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url =
    (typeof window !== "undefined"
      ? (window as any).env?.VITE_SUPABASE_URL
      : null) ||
    import.meta.env.VITE_SUPABASE_URL ||
    (typeof process !== "undefined"
      ? process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
      : null) ||
    "";

  const anonKey =
    (typeof window !== "undefined"
      ? (window as any).env?.VITE_SUPABASE_ANON_KEY
      : null) ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    (typeof process !== "undefined"
      ? process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
      : null) ||
    "";

  return createBrowserClient(url, anonKey);
}
