import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { mapEvent, mapPost, mapProgram, PROGRAM_SELECT } from "./catalog";

function publicDb() {
  // Server runtime values first; fall back to the values baked in at build time
  // so a deployment (e.g. Vercel) that only has VITE_* still serves public data.
  const url = (process.env["SUPABASE_URL"] || import.meta.env["VITE_SUPABASE_URL"] || "").trim();
  const key = (process.env["SUPABASE_PUBLISHABLE_KEY"] || import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || "").trim();
  const missing = [!url && "SUPABASE_URL / VITE_SUPABASE_URL", !key && "SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_PUBLISHABLE_KEY"].filter(Boolean);
  if (missing.length) {
    const msg = `Backend settings missing: ${missing.join(", ")}. Add them in your host's environment variables (all environments) and redeploy without build cache.`;
    console.error(`[config] ${msg}`);
    throw new Error(msg);
  }
  if (!/^https:\/\//.test(url)) throw new Error(`[config] SUPABASE_URL must start with https:// (got "${url.slice(0, 20)}…")`);
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const getPrograms = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicDb().from("programs").select(PROGRAM_SELECT).order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapProgram);
});

export const getProgram = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const { data: row } = await publicDb().from("programs").select(PROGRAM_SELECT).eq("slug", data.slug).maybeSingle();
    if (!row) throw notFound();
    return mapProgram(row);
  });

export const getEvent = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.id)) throw notFound();
    const { data: row } = await publicDb()
      .from("events")
      .select("*, ticket_tiers(*, price_phases(*)), programs(*)")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw notFound();
    const program = mapProgram({ ...(row as any).programs, events: [] });
    return { event: mapEvent(row), program };
  });

export const getPosts = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicDb()
    .from("posts")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapPost);
});

export const getPost = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const { data: row } = await publicDb().from("posts").select("*").eq("slug", data.slug).eq("status", "published").maybeSingle();
    if (!row) throw notFound();
    return mapPost(row);
  });
