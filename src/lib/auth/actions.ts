import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { createClient } from "../supabase/server";
import { db } from "../../../lib/db";
import { profiles } from "../../../lib/db/schema";
import { eq, sql } from "drizzle-orm";

function getSiteUrl() {
  const headers = getRequestHeaders();
  const host = headers.get("host") ?? "localhost:3000";
  const protocol =
    host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https";
  const runtime = process.env.SITE_URL || process.env.VITE_SITE_URL;
  return runtime || `${protocol}://${host}`;
}

// ── Social sign in (redirect-based OAuth) ──

export const signInWithProvider = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ provider: z.enum(["google"]) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabase, flushCookies } = createClient();
    const siteUrl = getSiteUrl();
    const { data: authData, error } = await supabase.auth.signInWithOAuth({
      provider: data.provider,
      options: {
        redirectTo: `${siteUrl}/auth/callback`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    flushCookies();
    if (error) throw new Error(error.message);
    return { url: authData.url };
  });

// ── Sign out ──

export const signout = createServerFn({ method: "POST" }).handler(async () => {
  const { supabase, flushCookies } = createClient();
  await supabase.auth.signOut();
  flushCookies();
  return { ok: true };
});

// ── Auth middleware for server functions ──

export type AuthUser = { id: string; name: string; email: string };

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const { supabase, flushCookies } = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  flushCookies();
  if (!user) throw new Error("Unauthorized");

  const [profile] = await db
    .select({ name: profiles.name })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  return next({
    context: {
      user: {
        id: user.id,
        name:
          profile?.name ??
          user.user_metadata?.name ??
          user.user_metadata?.full_name ??
          "",
        email: user.email ?? "",
      } satisfies AuthUser,
    },
  });
});

// ── Delete Account ──

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.user.id;

    // Safely delete profile and auth records in a transaction
    await db.transaction(async (tx) => {
      // 1. Delete profiles (cascades to sets, card_metadata, folders, classes, study sessions, etc.)
      await tx.delete(profiles).where(eq(profiles.id, userId));

      // 2. Delete from Supabase auth.users
      await tx.execute(sql`delete from auth.users where id = ${userId}`);
    });

    // 3. Clear session
    const { supabase, flushCookies } = createClient();
    await supabase.auth.signOut();
    flushCookies();

    return { ok: true };
  });

// ── Get current session user ──

export const getSession = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      const { supabase, flushCookies } = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      flushCookies();
      if (!user) return null;

      const [profile] = await db
        .select({ name: profiles.name })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1);

      return {
        id: user.id,
        name:
          profile?.name ??
          user.user_metadata?.name ??
          user.user_metadata?.full_name ??
          "",
        email: user.email ?? "",
      };
    } catch {
      return null;
    }
  },
);

// ── Check which OAuth providers are enabled on Supabase ──

export const getAvailableProviders = createServerFn({ method: "GET" }).handler(
  async () => {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const anonKey =
      process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
    let googleEnabled = false;

    if (url && anonKey) {
      try {
        const response = await fetch(`${url}/auth/v1/settings`, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
        });
        if (response.ok) {
          const settings = await response.json();
          googleEnabled = !!settings?.external?.google;
        }
      } catch (err) {
        console.error("Error fetching Supabase settings:", err);
      }
    }

    // Override via env var if explicitly set
    if (process.env.SUPABASE_GOOGLE_ENABLED !== undefined) {
      googleEnabled = process.env.SUPABASE_GOOGLE_ENABLED === "true";
    } else if (process.env.VITE_SUPABASE_GOOGLE_ENABLED !== undefined) {
      googleEnabled = process.env.VITE_SUPABASE_GOOGLE_ENABLED === "true";
    }

    return {
      google: googleEnabled,
    };
  },
);
