import { createServerClient } from "@supabase/ssr";
import {
  getRequestHeaders,
  setResponseHeaders,
} from "@tanstack/react-start/server";
import type { CookieOptions } from "@supabase/ssr";

/**
 * Server-side Supabase client for TanStack Start.
 *
 * Usage:
 *   const { supabase, flushCookies } = createClient()
 *   const { data: { user } } = await supabase.auth.getUser()
 *   flushCookies()
 *
 * flushCookies() must be called after every auth operation to ensure
 * cookies are written to the response. In serverless environments the
 * response may be sent immediately after the handler returns, so we
 * cannot rely on setTimeout.
 */
export function createClient() {
  const headers = getRequestHeaders();
  const cookie = headers.get("cookie") ?? "";

  const cookiePairs = parseCookieString(cookie);

  const pendingCookies: {
    name: string;
    value: string;
    options: CookieOptions;
  }[] = [];
  const pendingCacheHeaders: Record<string, string> = {};

  const supabase = createServerClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "",
    process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "",
    {
      cookies: {
        getAll() {
          return cookiePairs;
        },
        setAll(cookiesToSet, cacheHeaders) {
          pendingCookies.push(...cookiesToSet);
          Object.assign(pendingCacheHeaders, cacheHeaders);
        },
      },
    },
  );

  function flushCookies() {
    if (pendingCookies.length > 0) {
      const setCookieValues = pendingCookies.map(
        ({ name, value, options }) => serializeCookie(name, value, options),
      );
      setResponseHeaders({ "set-cookie": setCookieValues } as any);
      if (Object.keys(pendingCacheHeaders).length > 0) {
        setResponseHeaders(pendingCacheHeaders as any);
      }
      pendingCookies.length = 0;
      Object.keys(pendingCacheHeaders).forEach((k) => delete pendingCacheHeaders[k]);
    }
  }

  return { supabase, flushCookies };
}

function parseCookieString(cookie: string) {
  const pairs: { name: string; value: string }[] = [];
  if (!cookie) return pairs;
  for (const part of cookie.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const name = part.substring(0, idx).trim();
    const value = decodeURIComponent(part.substring(idx + 1).trim());
    if (name) pairs.push({ name, value });
  }
  return pairs;
}

function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions,
): string {
  let c = `${name}=${encodeURIComponent(value)}`;
  if (options.path) c += `; Path=${options.path}`;
  if (options.maxAge !== undefined) c += `; Max-Age=${options.maxAge}`;
  if (options.expires) c += `; Expires=${options.expires.toUTCString()}`;
  if (options.httpOnly) c += "; HttpOnly";
  if (options.secure) c += "; Secure";
  if (options.sameSite) c += `; SameSite=${options.sameSite}`;
  if (options.domain) c += `; Domain=${options.domain}`;
  return c;
}
