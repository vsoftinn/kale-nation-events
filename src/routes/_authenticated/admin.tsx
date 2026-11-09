/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mapPost, mapProgram, PROGRAM_SELECT, imageFor, slugify, type EventItem, type Program } from "@/lib/catalog";
import { activePhase, ksh, statusLabel, tierStatus, type TicketTier } from "@/lib/pricing";
import { createAdmin, removeAdmin, runAutomationNow } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Portal — Kalee Nation" },
      { name: "description", content: "Manage programs, events, tickets and news." },
      { property: "og:title", content: "Kalee Nation Admin" },
      { property: "og:description", content: "Admins only." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Admin,
});

const inp = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm";
const btn = "rounded-md bg-bolt px-4 py-2 text-sm font-bold uppercase text-primary-foreground disabled:opacity-50";
const toLocal = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocal = (v: string) => new Date(v).toISOString();

function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const id = u.user!.id;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", id);
      const { data: pa } = await supabase.from("program_admins").select("program_id").eq("user_id", id);
      return {
        id, email: u.user!.email ?? "",
        superadmin: !!roles?.some((r) => r.role === "superadmin"),
        programIds: (pa ?? []).map((p) => p.program_id),
      };
    },
  });
}

function Admin() {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"sales" | "events" | "news" | "admins" | "applications" | "programs">("sales");

  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  if (!me.data) return <p className="p-24 text-center text-muted-foreground">Loading…</p>;
  const isSuper = me.data.superadmin;
  if (!isSuper && !me.data.programIds.length)
    return <div className="p-24 text-center"><p>Your account has no program yet. Ask the super admin.</p><button onClick={signOut} className="mt-4 underline">Sign out</button></div>;

  const tabs = isSuper ? (["sales", "events", "news", "admins", "applications", "programs"] as const) : (["sales", "events"] as const);
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="font-display text-3xl tracking-widest">KALEE NATION · {isSuper ? "SUPER ADMIN" : "ADMIN"}</p>
            <p className="text-xs text-muted-foreground">{me.data.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 text-sm font-semibold capitalize ${tab === t ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{t}</button>
            ))}
            <button onClick={signOut} className="rounded-md border border-border px-3 py-1.5 text-sm">Sign out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-10">
        {tab === "sales" && <SalesTab isSuper={isSuper} />}
        {tab === "events" && <EventsTab isSuper={isSuper} programIds={me.data.programIds} />}
        {tab === "news" && isSuper && <NewsTab />}
        {tab === "admins" && isSuper && <AdminsTab />}
        {tab === "applications" && isSuper && <ApplicationsTab />}
        {tab === "programs" && isSuper && <ProgramsTab />}
      </main>
    </div>
  );
}

function useAdminPrograms() {
  return useQuery({
    queryKey: ["admin-programs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("programs").select(PROGRAM_SELECT).order("created_at");
      if (error) throw error;
      return (data ?? []).map(mapProgram);
    },
  });
}

function useWrite() {
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p;
    setError(error?.message ?? "");
    qc.invalidateQueries({ queryKey: ["admin-programs"] });
    qc.invalidateQueries({ queryKey: ["programs"] });
    qc.invalidateQueries();
    return !error;
  };
  return { run, error, setError };
}

function EventsTab({ isSuper, programIds }: { isSuper: boolean; programIds: string[] }) {
  const { data: all } = useAdminPrograms();
  const programs = (all ?? []).filter((p) => isSuper || programIds.includes(p.id));
  const [sel, setSel] = useState<string | null>(null);
  const program = programs.find((p) => p.id === sel) ?? programs[0];
  const { run, error } = useWrite();
  if (!program) return <p className="text-muted-foreground">No programs.</p>;

  const tiers = program.events.flatMap((e) => e.tiers);
  const sold = tiers.reduce((s, t) => s + t.sold, 0);
  const revenue = tiers.reduce((s, t) => s + t.sold * (activePhase(t)?.price ?? 0), 0);


  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-2">
        {programs.map((p) => (
          <button key={p.id} onClick={() => setSel(p.id)} className={`block w-full rounded-md px-3 py-2 text-left font-semibold ${p.id === program.id ? "bg-bolt text-primary-foreground" : "bg-card hover:bg-secondary"}`}>
            {p.name}<span className="block text-xs font-normal opacity-70">{p.owner}</span>
          </button>
        ))}
      </aside>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-6xl">{program.name}</h1>
        </div>
        <NewEventForm programs={programs} defaultProgramId={program.id} isSuper={isSuper} onCreated={(pid) => setSel(pid)} />
        {error && <p className="text-destructive">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-3">
          {[["Tickets sold", sold.toLocaleString()], ["Est. revenue", ksh(revenue)], ["Events", String(program.events.length)]].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{k}</p>
              <p className="font-display text-4xl text-primary">{v}</p>
            </div>
          ))}
        </div>
        {program.events.map((ev) => <EventEditor key={ev.id + ev.title + ev.date + (ev.imageUrl ?? "")} ev={ev} run={run} fallback={imageFor(program.imageKey, program.imageUrl)} />)}
      </div>
    </div>
  );
}

type Run = (p: PromiseLike<{ error: { message: string } | null }>) => Promise<boolean>;

/** Upload an event/program photo; empty = use the default Kalee Nation image. */
function ImagePicker({ value, onChange, fallback }: { value: string | null; onChange: (url: string | null) => void; fallback: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function pick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setErr("Choose an image file");
    if (file.size > 8 * 1024 * 1024) return setErr("Image must be under 8 MB");
    setBusy(true); setErr("");
    const path = `${crypto.randomUUID()}.${(file.name.split(".").pop() || "jpg").toLowerCase()}`;
    const up = await supabase.storage.from("event-images").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    if (up.error) { setErr(up.error.message); setBusy(false); return; }
    const signed = await supabase.storage.from("event-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    setBusy(false);
    if (signed.error || !signed.data) return setErr(signed.error?.message ?? "Upload failed");
    onChange(signed.data.signedUrl);
  }
  return (
    <div className="flex items-center gap-3">
      <img src={value || fallback} alt="" className="h-16 w-24 rounded-md border border-border object-cover" />
      <div className="text-xs">
        <label className="cursor-pointer font-semibold text-primary underline">
          {busy ? "Uploading…" : value ? "Change photo" : "Upload event photo"}
          <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        <p className="text-muted-foreground">{value ? <button type="button" className="underline" onClick={() => onChange(null)}>Use default image</button> : "No photo? The default image is used."}</p>
        {err && <p className="text-destructive">{err}</p>}
      </div>
    </div>
  );
}

function NewEventForm({ programs, defaultProgramId, isSuper, onCreated }: { programs: Program[]; defaultProgramId: string; isSuper: boolean; onCreated: (programId: string) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [programText, setProgramText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true); setMsg("");
    try {
      // Program: pick an existing one by name, or type a new one (super admin).
      const typed = programText.trim();
      let programId = programs.find((p) => p.name.toLowerCase() === typed.toLowerCase())?.id ?? (typed ? "" : defaultProgramId);
      if (!programId) {
        if (!isSuper) throw new Error("Choose one of your programs from the list.");
        const { data: np, error } = await supabase.from("programs").insert({ name: typed, slug: `${slugify(typed)}-${Date.now().toString(36).slice(-4)}`, owner: String(f.get("owner") ?? ""), image_url: image }).select("id").single();
        if (error || !np) throw new Error(error?.message ?? "Could not create program");
        programId = np.id;
      }
      const date = new Date(String(f.get("date")));
      if (isNaN(+date)) throw new Error("Pick the event date and time.");
      const { data: ev, error } = await supabase.from("events").insert({
        program_id: programId, title: String(f.get("title")).trim(), date: date.toISOString(),
        venue: String(f.get("venue")).trim() || "TBA", city: String(f.get("city")).trim() || "Nairobi",
        description: String(f.get("description")), image_url: image, published: f.get("publish") === "on",
      }).select("id").single();
      if (error || !ev) throw new Error(error?.message ?? "Could not create event");
      const { data: t, error: te } = await supabase.from("ticket_tiers").insert({ event_id: ev.id, name: "Regular", quantity: Math.max(1, +String(f.get("qty")) || 500), sales_end_at: date.toISOString() }).select("id").single();
      if (te || !t) throw new Error(te?.message ?? "Could not add ticket");
      const pe = await supabase.from("price_phases").insert({ tier_id: t.id, label: "Regular", price: Math.max(0, Math.round(+String(f.get("price")) || 0)), starts_at: new Date().toISOString() });
      if (pe.error) throw new Error(pe.error.message);
      form.reset(); setImage(null); setProgramText(""); setOpen(false);
      setMsg("Event created. Add more ticket types and price changes below.");
      qc.invalidateQueries(); onCreated(programId);
    } catch (x) { setMsg((x as Error).message); }
    setBusy(false);
  }
  if (!open) return <div><button onClick={() => setOpen(true)} className={btn}>+ Post event</button>{msg && <p className="mt-2 text-sm">{msg}</p>}</div>;
  const names = programs.map((p) => p.name);
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border border-primary/40 bg-card p-6 sm:grid-cols-4">
      <h2 className="text-3xl sm:col-span-4">New event</h2>
      <label className="text-xs text-muted-foreground sm:col-span-2">Program — pick from the list or type a new name
        <input list="kn-programs" value={programText} onChange={(e) => setProgramText(e.target.value)} placeholder={programs.find((p) => p.id === defaultProgramId)?.name} className={inp} maxLength={80} />
        <datalist id="kn-programs">{names.map((n) => <option key={n} value={n} />)}</datalist>
      </label>
      {isSuper && programText.trim() && !names.some((n) => n.toLowerCase() === programText.trim().toLowerCase()) && (
        <label className="text-xs text-muted-foreground sm:col-span-2">New program owner<input name="owner" className={inp} maxLength={120} /></label>
      )}
      <label className="text-xs text-muted-foreground sm:col-span-4">Event title<input name="title" required maxLength={140} className={inp} /></label>
      <label className="text-xs text-muted-foreground">Date & time<input name="date" type="datetime-local" required className={inp} /></label>
      <label className="text-xs text-muted-foreground">City<input name="city" placeholder="Nairobi" className={inp} maxLength={60} /></label>
      <label className="text-xs text-muted-foreground sm:col-span-2">Venue<input name="venue" placeholder="TBA" className={inp} maxLength={120} /></label>
      <label className="text-xs text-muted-foreground">Ticket price (KSh)<input name="price" type="number" min={0} defaultValue={1000} className={inp} /></label>
      <label className="text-xs text-muted-foreground">Tickets available<input name="qty" type="number" min={1} defaultValue={500} className={inp} /></label>
      <label className="text-xs text-muted-foreground sm:col-span-4">Description<textarea name="description" rows={3} className={inp} /></label>
      <div className="sm:col-span-4"><ImagePicker value={image} onChange={setImage} fallback={imageFor("hero")} /></div>
      <label className="flex items-center gap-2 text-sm sm:col-span-4"><input type="checkbox" name="publish" defaultChecked /> Show on the website straight away</label>
      <div className="flex gap-2 sm:col-span-4">
        <button disabled={busy} className={btn}>{busy ? "Saving…" : "Create event"}</button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button>
      </div>
      {msg && <p className="text-sm text-destructive sm:col-span-4">{msg}</p>}
    </form>
  );
}

function EventEditor({ ev, run, fallback }: { ev: EventItem; run: Run; fallback: string }) {
  const blank = { title: ev.title, date: toLocal(ev.date), city: ev.city, venue: ev.venue, lineup: ev.lineup.join(", "), description: ev.description, image: ev.imageUrl };
  const [d, setD] = useState(blank);
  const [saved, setSaved] = useState("");
  const dirty = JSON.stringify(d) !== JSON.stringify(blank);
  const upd = (patch: any) => run(supabase.from("events").update(patch).eq("id", ev.id));
  const set = (k: keyof typeof d) => (e: { target: { value: string } }) => { setSaved(""); setD({ ...d, [k]: e.target.value }); };
  async function save() {
    if (!d.title.trim() || !d.date) return setSaved("Title and date are required.");
    const ok = await upd({
      title: d.title.trim(), date: fromLocal(d.date), city: d.city, venue: d.venue, description: d.description, image_url: d.image,
      lineup: d.lineup.split(",").map((s) => s.trim()).filter(Boolean),
    });
    setSaved(ok ? (ev.published ? "✓ Updated on the live event page" : "✓ Saved (event is still a draft)") : "");
  }
  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-2 py-0.5 text-xs uppercase ${ev.published ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{ev.published ? "Live" : "Draft"}</span>
          {ev.published && <Link to="/events/$id" params={{ id: ev.id }} target="_blank" className="text-xs underline">View live page ↗</Link>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => upd({ published: !ev.published })} className="rounded-md border border-border px-3 py-1 text-sm">{ev.published ? "Unpublish" : "Publish"}</button>
          <button onClick={() => confirm("Delete this event and its tickets?") && run(supabase.from("events").delete().eq("id", ev.id))} className="rounded-md border border-destructive px-3 py-1 text-sm text-destructive">Delete</button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="text-xs text-muted-foreground sm:col-span-2">Title<input className={inp} value={d.title} onChange={set("title")} maxLength={140} /></label>
        <label className="text-xs text-muted-foreground">Date<input type="datetime-local" className={inp} value={d.date} onChange={set("date")} /></label>
        <label className="text-xs text-muted-foreground">City<input className={inp} value={d.city} onChange={set("city")} /></label>
        <label className="text-xs text-muted-foreground sm:col-span-2">Venue<input className={inp} value={d.venue} onChange={set("venue")} /></label>
        <label className="text-xs text-muted-foreground sm:col-span-2">Lineup (comma separated)<input className={inp} value={d.lineup} onChange={set("lineup")} /></label>
        <label className="text-xs text-muted-foreground sm:col-span-4">Description<textarea rows={2} className={inp} value={d.description} onChange={set("description")} /></label>
        <div className="sm:col-span-4"><ImagePicker value={d.image} onChange={(image) => { setSaved(""); setD({ ...d, image }); }} fallback={fallback} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={!dirty} className={btn}>{ev.published ? "Update live event" : "Save changes"}</button>
        {dirty && <button onClick={() => setD(blank)} className="text-sm underline">Discard</button>}
        {saved && <span className="text-sm text-primary">{saved}</span>}
      </div>
      {ev.tiers.map((t) => <TierEditor key={t.id} t={t} run={run} />)}
      <button className="text-sm font-semibold text-primary" onClick={async () => {
        const { data: t } = await supabase.from("ticket_tiers").insert({ event_id: ev.id, name: "New ticket", quantity: 100, sales_end_at: ev.date }).select().single();
        if (t) await run(supabase.from("price_phases").insert({ tier_id: t.id, label: "Standard", price: 1000, starts_at: new Date().toISOString() }));
      }}>+ Add ticket type</button>
    </div>
  );
}

function TierEditor({ t, run }: { t: TicketTier; run: Run }) {
  const s = tierStatus(t);
  const upd = (patch: any) => run(supabase.from("ticket_tiers").update(patch).eq("id", t.id));
  const updPh = (id: string, patch: any) => run(supabase.from("price_phases").update(patch).eq("id", id));
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input className={`${inp} max-w-[160px] font-semibold`} defaultValue={t.name} onBlur={(e) => upd({ name: e.target.value })} />
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs uppercase">{statusLabel[s]}</span>
        <span className="text-sm text-muted-foreground">Now: <b className="text-primary">{ksh(activePhase(t)?.price ?? 0)}</b> · {t.sold}/{t.quantity} sold</span>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">Expires
          <input type="datetime-local" className={inp} defaultValue={toLocal(t.salesEndAt)} onBlur={(e) => e.target.value && upd({ sales_end_at: fromLocal(e.target.value) })} />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">Qty
          <input type="number" min={0} className={`${inp} w-24`} defaultValue={t.quantity} onBlur={(e) => upd({ quantity: Math.max(0, +e.target.value) })} />
        </label>
        <button onClick={() => upd({ closed: !t.closed })} className={`rounded-md px-3 py-1 text-xs font-bold uppercase ${t.closed ? "bg-primary text-primary-foreground" : "border border-destructive text-destructive"}`}>{t.closed ? "Reopen sales" : "Close sales"}</button>
        <button onClick={() => confirm("Delete this ticket type?") && run(supabase.from("ticket_tiers").delete().eq("id", t.id))} className="px-2 text-destructive">✕</button>
      </div>
      <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">⚡ Automatic price schedule</p>
      <div className="mt-2 space-y-2">
        {t.phases.map((ph) => (
          <div key={ph.id} className="grid grid-cols-[1fr_120px_1fr_auto] items-center gap-2">
            <input className={inp} defaultValue={ph.label} onBlur={(e) => updPh(ph.id!, { label: e.target.value })} />
            <input type="number" min={0} className={inp} defaultValue={ph.price} onBlur={(e) => updPh(ph.id!, { price: Math.max(0, Math.round(+e.target.value)) })} />
            <input type="datetime-local" className={inp} defaultValue={toLocal(ph.startsAt)} onBlur={(e) => e.target.value && updPh(ph.id!, { starts_at: fromLocal(e.target.value) })} />
            <button className="px-2 text-destructive" onClick={() => run(supabase.from("price_phases").delete().eq("id", ph.id!))}>✕</button>
          </div>
        ))}
        <button className="text-sm font-semibold text-primary" onClick={() => run(supabase.from("price_phases").insert({
          tier_id: t.id, label: "New phase", price: (t.phases.at(-1)?.price ?? 1000) + 500, starts_at: new Date(Date.now() + 7 * 864e5).toISOString(),
        }))}>+ Add price change</button>
      </div>
    </div>
  );
}

function NewsTab() {
  const qc = useQueryClient();
  const runFn = useServerFn(runAutomationNow);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const posts = useQuery({
    queryKey: ["admin-posts"],
    queryFn: async () => (await supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(100)).data?.map(mapPost) ?? [],
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-posts"] }); qc.invalidateQueries({ queryKey: ["posts"] }); };
  const setStatus = async (id: string, status: string) => {
    await supabase.from("posts").update({ status, published_at: status === "published" ? new Date().toISOString() : null }).eq("id", id);
    refresh();
  };
  async function runNow() {
    setBusy(true); setMsg("");
    try {
      const r = await runFn();
      setMsg(r.skipped ? `Skipped: ${r.skipped}` : `Drafted ${r.eventPosts} event post(s)${r.aiPost ? " and 1 AI news post" : ""}.${r.aiError ? ` AI: ${r.aiError}` : ""}`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); }
    setBusy(false); refresh();
  }
  async function addPost(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const title = String(f.get("title")).trim();
    if (!title) return;
    await supabase.from("posts").insert({ title, slug: `${slugify(title)}-${Date.now().toString(36)}`, excerpt: String(f.get("excerpt")), body: String(f.get("body")), kind: "news", status: "published", source: "manual", published_at: new Date().toISOString() });
    e.currentTarget.reset(); refresh();
  }
  const pending = (posts.data ?? []).filter((p) => p.status === "pending");
  const others = (posts.data ?? []).filter((p) => p.status !== "pending");
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-6xl">News</h1>
          <p className="text-muted-foreground">Every day the autopilot drafts posts for upcoming events and one AI-written news story. Nothing goes live until you approve it.</p>
        </div>
        <button onClick={runNow} disabled={busy} className={btn}>{busy ? "Writing…" : "⚡ Run autopilot now"}</button>
      </div>
      {msg && <p className="rounded-md bg-secondary p-3 text-sm">{msg}</p>}
      <section>
        <h2 className="text-3xl">Waiting for approval ({pending.length})</h2>
        <div className="mt-4 space-y-3">
          {pending.map((p) => (
            <div key={p.id} className="rounded-xl border border-primary/40 bg-card p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{p.source === "ai" ? "AI written" : "Auto event post"} · {p.kind}</p>
              <h3 className="text-2xl">{p.title}</h3>
              <p className="text-sm text-muted-foreground">{p.excerpt}</p>
              <p className="mt-2 whitespace-pre-line text-sm">{p.body}</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setStatus(p.id, "published")} className={btn}>Approve & publish</button>
                <button onClick={() => setStatus(p.id, "rejected")} className="rounded-md border border-border px-4 py-2 text-sm">Reject</button>
              </div>
            </div>
          ))}
          {!pending.length && <p className="text-sm text-muted-foreground">Nothing waiting.</p>}
        </div>
      </section>
      <section className="grid gap-8 lg:grid-cols-2">
        <form onSubmit={addPost} className="space-y-3 rounded-xl border border-border bg-card p-5">
          <h2 className="text-3xl">Write a post</h2>
          <input name="title" placeholder="Title" className={inp} required maxLength={160} />
          <input name="excerpt" placeholder="Short summary" className={inp} maxLength={200} />
          <textarea name="body" rows={5} placeholder="Story" className={inp} />
          <button className={btn}>Publish</button>
        </form>
        <div className="space-y-2">
          <h2 className="text-3xl">All posts</h2>
          {others.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
              <span className="truncate">{p.title}</span>
              <span className="flex shrink-0 gap-2">
                <span className="rounded-full bg-secondary px-2 text-xs uppercase">{p.status}</span>
                {p.status === "published"
                  ? <button onClick={() => setStatus(p.id, "rejected")} className="text-xs underline">Unpublish</button>
                  : <button onClick={() => setStatus(p.id, "published")} className="text-xs underline">Publish</button>}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AdminsTab() {
  const qc = useQueryClient();
  const { data: programs } = useAdminPrograms();
  const createFn = useServerFn(createAdmin);
  const removeFn = useServerFn(removeAdmin);
  const [msg, setMsg] = useState("");
  const admins = useQuery({ queryKey: ["admins"], queryFn: async () => (await supabase.from("program_admins").select("*")).data ?? [] });
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      await createFn({ data: { email: String(f.get("email")).trim(), password: String(f.get("password")), programId: String(f.get("program")) } });
      setMsg("Login created. Share the email, password and the /auth link with the admin.");
      form.reset(); qc.invalidateQueries({ queryKey: ["admins"] });
    } catch (x) { setMsg(x instanceof Error ? x.message : "Failed"); }
  }
  const nameOf = (id: string) => programs?.find((p: Program) => p.id === id)?.name ?? "—";
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card p-6">
        <h1 className="text-5xl">Create admin login</h1>
        <p className="text-sm text-muted-foreground">The admin can only manage the program you choose.</p>
        <input name="email" type="email" placeholder="Admin email" className={inp} required />
        <input name="password" type="text" placeholder="Temporary password (8+ characters)" minLength={8} className={inp} required />
        <select name="program" className={inp} required>
          {(programs ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className={btn}>Create login</button>
        {msg && <p className="text-sm">{msg}</p>}
      </form>
      <div className="space-y-2">
        <h2 className="text-3xl">Admins</h2>
        {(admins.data ?? []).map((a) => (
          <div key={a.user_id + a.program_id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
            <span>{a.email} · <b>{nameOf(a.program_id)}</b></span>
            <button onClick={async () => { if (confirm(`Remove ${a.email}?`)) { await removeFn({ data: { userId: a.user_id } }); qc.invalidateQueries({ queryKey: ["admins"] }); } }} className="text-xs text-destructive underline">Remove</button>
          </div>
        ))}
        {!admins.data?.length && <p className="text-sm text-muted-foreground">No admins yet.</p>}
      </div>
    </div>
  );
}

function ApplicationsTab() {
  const qc = useQueryClient();
  const apps = useQuery({ queryKey: ["applications"], queryFn: async () => (await supabase.from("organizer_applications").select("*").order("created_at", { ascending: false })).data ?? [] });
  const set = async (id: string, status: string) => { await supabase.from("organizer_applications").update({ status }).eq("id", id); qc.invalidateQueries({ queryKey: ["applications"] }); };
  return (
    <div className="space-y-4">
      <h1 className="text-6xl">Organizer applications</h1>
      <p className="text-muted-foreground">Approve an organizer, add their program in the Programs tab, then create their login in Admins.</p>
      {(apps.data ?? []).map((a) => (
        <div key={a.id} className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-2xl">{a.name}{a.organization && ` · ${a.organization}`}</h3>
            <span className="rounded-full bg-secondary px-2 text-xs uppercase">{a.status}</span>
          </div>
          <p className="text-sm text-muted-foreground">{a.email} · {a.phone} · {a.event_type} · {new Date(a.created_at).toLocaleDateString()}</p>
          {a.message && <p className="mt-2 text-sm">{a.message}</p>}
          <div className="mt-3 flex gap-2">
            <button onClick={() => set(a.id, "approved")} className={btn}>Approve</button>
            <button onClick={() => set(a.id, "declined")} className="rounded-md border border-border px-4 py-2 text-sm">Decline</button>
          </div>
        </div>
      ))}
      {!apps.data?.length && <p className="text-sm text-muted-foreground">No applications yet.</p>}
    </div>
  );
}

function ProgramsTab() {
  const { data: programs } = useAdminPrograms();
  const { run, error } = useWrite();
  const [image, setImage] = useState<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const name = String(f.get("name")).trim();
    await run(supabase.from("programs").insert({ name, slug: slugify(name), owner: String(f.get("owner")), tagline: String(f.get("tagline")), image_key: "hero", image_url: image }));
    form.reset(); setImage(null);
  }
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card p-6">
        <h1 className="text-5xl">Add program</h1>
        <input name="name" placeholder="Program name" className={inp} required maxLength={80} />
        <input name="owner" placeholder="Owner / organizer" className={inp} maxLength={120} />
        <input name="tagline" placeholder="Tagline" className={inp} maxLength={200} />
        <ImagePicker value={image} onChange={setImage} fallback={imageFor("hero")} />
        <button className={btn}>Add program</button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
      <div className="space-y-2">
        <h2 className="text-3xl">Programs</h2>
        {(programs ?? []).map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
            <span><b>{p.name}</b> · {p.owner} · {p.events.length} events</span>
            <button onClick={() => confirm(`Delete ${p.name} and all its events?`) && run(supabase.from("programs").delete().eq("id", p.id))} className="text-xs text-destructive underline">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

type SaleRow = { event_id: string; event_title: string; program_name: string; event_date: string; tier_name: string; tickets_sold: number; funds: number; orders: number };

function SalesTab({ isSuper }: { isSuper: boolean }) {
  const q = useQuery({
    queryKey: ["sales-summary"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("admin_sales_summary");
      if (error) throw error;
      return (data ?? []) as SaleRow[];
    },
    refetchInterval: 30_000,
  });
  if (q.isLoading) return <p className="text-muted-foreground">Loading sales…</p>;
  if (q.error) return <p className="text-destructive">{(q.error as Error).message}</p>;
  const rows = q.data ?? [];
  const events = new Map<string, { title: string; program: string; date: string; sold: number; funds: number; orders: number; tiers: SaleRow[] }>();
  for (const r of rows) {
    const e = events.get(r.event_id) ?? { title: r.event_title, program: r.program_name, date: r.event_date, sold: 0, funds: 0, orders: 0, tiers: [] };
    e.sold += Number(r.tickets_sold); e.funds += Number(r.funds); e.orders += Number(r.orders); e.tiers.push(r);
    events.set(r.event_id, e);
  }
  const list = [...events.values()].sort((a, b) => b.funds - a.funds);
  const totSold = list.reduce((s, e) => s + e.sold, 0);
  const totFunds = list.reduce((s, e) => s + e.funds, 0);
  const max = Math.max(1, ...list.map((e) => e.funds));
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-5xl">Sales dashboard</h2>
        <p className="text-sm text-muted-foreground">{isSuper ? "All programs and events." : "Only events in your program."} Paid orders only · refreshes every 30s.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[["Tickets sold", totSold.toLocaleString()], ["Funds generated", ksh(totFunds)], ["Events with sales", String(list.length)]].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{l}</p>
            <p className="mt-1 font-display text-4xl text-primary">{v}</p>
          </div>
        ))}
      </div>
      {!list.length && <p className="text-muted-foreground">No paid tickets yet.</p>}
      <div className="space-y-4">
        {list.map((e) => (
          <div key={e.title + e.date} className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="font-display text-3xl">{e.title}</p>
                <p className="text-xs text-muted-foreground">{e.program} · {new Date(e.date).toLocaleDateString("en-KE", { dateStyle: "medium" })}</p>
              </div>
              <p className="text-right"><span className="font-display text-3xl text-primary">{ksh(e.funds)}</span><br /><span className="text-sm text-muted-foreground">{e.sold} tickets · {e.orders} orders</span></p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-bolt" style={{ width: `${(e.funds / max) * 100}%` }} /></div>
            <table className="mt-4 w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th>Ticket</th><th className="text-right">Sold</th><th className="text-right">Funds</th></tr></thead>
              <tbody>{e.tiers.map((t) => <tr key={t.tier_name} className="border-t border-border"><td className="py-1.5">{t.tier_name}</td><td className="text-right">{t.tickets_sold}</td><td className="text-right">{ksh(Number(t.funds))}</td></tr>)}</tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
