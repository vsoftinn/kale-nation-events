import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { mapEvent, mapPost, mapProgram, PROGRAM_SELECT } from "./catalog";

function publicDb() {
  // Server runtime values first; fall back to the values baked in at build time
  // so a deployment (e.g. Vercel) that only has VITE_* still serves public data.
  const url = process.env["SUPABASE_URL"] || import.meta.env["VITE_SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] || import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Missing Supabase URL or publishable key");
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
