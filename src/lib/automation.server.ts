import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { slugify } from "./catalog";

const AI_EVERY_MS = 20 * 3600 * 1000;

async function writeNewsPost(context: string) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw Object.assign(new Error("AI key missing"), { statusCode: 401 });
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system:
      "You write short, upbeat news posts for Kalee Nation, a Kenyan events company (club hosting, pre-weddings, weddings, corporate events, marketing & branding). Use only the facts given. Never invent prices, artists or dates. Reply with JSON only: {\"title\": string, \"excerpt\": string (max 160 chars), \"body\": string (2-3 short paragraphs)}.",
    prompt: `Write one news post that builds excitement for what's coming up. Facts:\n${context}`,
    providerOptions: {
      openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] },
    },
  });
  const text = await result.text;
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error("AI returned no post");
  const parsed = JSON.parse(json) as { title: string; excerpt: string; body: string };
  if (!parsed.title || !parsed.body) throw new Error("AI post incomplete");
  return parsed;
}

/** Drafts upcoming-event posts and one AI news post; everything waits for super admin approval. */
export async function runAutomation(opts: { force?: boolean } = {}) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const now = new Date();
  const { data: locked } = await db
    .from("automation_state")
    .update({ locked_until: new Date(now.getTime() + 5 * 60_000).toISOString() })
    .eq("id", 1)
    .or(`locked_until.is.null,locked_until.lt.${now.toISOString()}`)
    .select()
    .maybeSingle();
  if (!locked) return { skipped: "already running", eventPosts: 0, aiPost: false };

  let eventPosts = 0;
  let aiPost = false;
  let aiError: string | null = null;
  try {
    const { data: events } = await db
      .from("events")
      .select("id, title, date, venue, city, lineup, description, program_id, programs(name)")
      .eq("published", true)
      .gt("date", now.toISOString())
      .order("date")
      .limit(10);
    const ids = (events ?? []).map((e) => e.id);
    const { data: existing } = ids.length ? await db.from("posts").select("event_id").in("event_id", ids) : { data: [] };
    const covered = new Set((existing ?? []).map((p) => p.event_id));
    for (const e of events ?? []) {
      if (covered.has(e.id)) continue;
      const when = new Date(e.date).toLocaleDateString("en-KE", { dateStyle: "long", timeZone: "Africa/Nairobi" });
      const { error } = await db.from("posts").insert({
        slug: `${slugify(e.title)}-${e.id.slice(0, 6)}`,
        title: `Coming up: ${e.title}`,
        excerpt: `${e.venue}, ${e.city} · ${when}. Tickets on Kalee Nation.`,
        body: `${e.description || e.title} happens at ${e.venue}, ${e.city} on ${when}.${e.lineup?.length ? ` Featuring ${e.lineup.join(", ")}.` : ""} Get your tickets on the event page.`,
        kind: "event",
        event_id: e.id,
        program_id: e.program_id,
        status: "pending",
        source: "auto",
      });
      if (!error) eventPosts++;
    }

    const last = locked.last_ai_post_at ? +new Date(locked.last_ai_post_at) : 0;
    const due = opts.force || now.getTime() - last > AI_EVERY_MS;
    if (due && (!locked.paused_reason || opts.force) && (events ?? []).length) {
      const facts = (events ?? [])
        .slice(0, 5)
        .map((e: any) => `- ${e.title} (${e.programs?.name ?? ""}) at ${e.venue}, ${e.city} on ${new Date(e.date).toDateString()}. Lineup: ${(e.lineup ?? []).join(", ") || "TBA"}`)
        .join("\n");
      try {
        const post = await writeNewsPost(facts);
        await db.from("posts").insert({
          slug: `${slugify(post.title)}-${Date.now().toString(36)}`,
          title: post.title,
          excerpt: post.excerpt ?? "",
          body: post.body,
          kind: "news",
          status: "pending",
          source: "ai",
        });
        aiPost = true;
        await db.from("automation_state").update({ last_ai_post_at: now.toISOString(), paused_reason: null }).eq("id", 1);
      } catch (err: any) {
        const code = err?.statusCode ?? err?.status;
        aiError = err?.message ?? "AI writing failed";
        if (code === 402 || code === 403) {
          await db.from("automation_state").update({ paused_reason: `AI paused (${code}): ${aiError}` }).eq("id", 1);
        }
        console.error("auto news failed", code, aiError);
      }
    }
  } finally {
    await db.from("automation_state").update({ locked_until: null }).eq("id", 1);
  }
  return { skipped: null, eventPosts, aiPost, aiError };
}
