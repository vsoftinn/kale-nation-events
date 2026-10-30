/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mapPost, mapProgram, PROGRAM_SELECT, imageKeys, slugify, type EventItem, type Program } from "@/lib/catalog";
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
  const [tab, setTab] = useState<"events" | "news" | "admins" | "applications" | "programs">("events");

  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  if (!me.data) return <p className="p-24 text-center text-muted-foreground">Loading…</p>;
  const isSuper = me.data.superadmin;
  if (!isSuper && !me.data.programIds.length)
    return <div className="p-24 text-center"><p>Your account has no program yet. Ask the super admin.</p><button onClick={signOut} className="mt-4 underline">Sign out</button></div>;

  const tabs = isSuper ? (["events", "news", "admins", "applications", "programs"] as const) : (["events"] as const);
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
  };
  return { run, error };
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

  const addEvent = async () => {
    const date = new Date(Date.now() + 30 * 864e5);
    const { data: ev, error } = await supabase.from("events").insert({ program_id: program.id, title: `New ${program.name} event`, date: date.toISOString(), published: false }).select().single();
    if (error || !ev) return run(Promise.resolve({ error }));
    const { data: t } = await supabase.from("ticket_tiers").insert({ event_id: ev.id, name: "Regular", quantity: 500, sales_end_at: date.toISOString() }).select().single();
    await run(supabase.from("price_phases").insert({ tier_id: t!.id, label: "Early Bird", price: 1000, starts_at: new Date().toISOString() }));
  };

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
          <button onClick={addEvent} className={btn}>+ Post event</button>
        </div>
        {error && <p className="text-destructive">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-3">
          {[["Tickets sold", sold.toLocaleString()], ["Est. revenue", ksh(revenue)], ["Events", String(program.events.length)]].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{k}</p>
              <p className="font-display text-4xl text-primary">{v}</p>
            </div>
          ))}
        </div>
        {program.events.map((ev) => <EventEditor key={ev.id} ev={ev} run={run} />)}
      </div>
    </div>
  );
}

type Run = (p: PromiseLike<{ error: { message: string } | null }>) => Promise<void>;

function EventEditor({ ev, run }: { ev: EventItem; run: Run }) {
  const upd = (patch: any) => run(supabase.from("events").update(patch).eq("id", ev.id));
  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs uppercase ${ev.published ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{ev.published ? "Live" : "Draft"}</span>
        <div className="flex gap-2">
          <button onClick={() => upd({ published: !ev.published })} className="rounded-md border border-border px-3 py-1 text-sm">{ev.published ? "Unpublish" : "Publish"}</button>
          <button onClick={() => confirm("Delete this event and its tickets?") && run(supabase.from("events").delete().eq("id", ev.id))} className="rounded-md border border-destructive px-3 py-1 text-sm text-destructive">Delete</button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="text-xs text-muted-foreground sm:col-span-2">Title<input className={inp} defaultValue={ev.title} onBlur={(e) => e.target.value !== ev.title && upd({ title: e.target.value })} /></label>
        <label className="text-xs text-muted-foreground">Date<input type="datetime-local" className={inp} defaultValue={toLocal(ev.date)} onBlur={(e) => e.target.value && upd({ date: fromLocal(e.target.value) })} /></label>
        <label className="text-xs text-muted-foreground">City<input className={inp} defaultValue={ev.city} onBlur={(e) => upd({ city: e.target.value })} /></label>
        <label className="text-xs text-muted-foreground sm:col-span-2">Venue<input className={inp} defaultValue={ev.venue} onBlur={(e) => upd({ venue: e.target.value })} /></label>
        <label className="text-xs text-muted-foreground sm:col-span-2">Lineup (comma separated)<input className={inp} defaultValue={ev.lineup.join(", ")} onBlur={(e) => upd({ lineup: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></label>
        <label className="text-xs text-muted-foreground sm:col-span-4">Description<textarea rows={2} className={inp} defaultValue={ev.description} onBlur={(e) => upd({ description: e.target.value })} /></label>
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
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const name = String(f.get("name")).trim();
    await run(supabase.from("programs").insert({ name, slug: slugify(name), owner: String(f.get("owner")), tagline: String(f.get("tagline")), image_key: String(f.get("image")) }));
    form.reset();
  }
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card p-6">
        <h1 className="text-5xl">Add program</h1>
        <input name="name" placeholder="Program name" className={inp} required maxLength={80} />
        <input name="owner" placeholder="Owner / organizer" className={inp} maxLength={120} />
        <input name="tagline" placeholder="Tagline" className={inp} maxLength={200} />
        <select name="image" className={inp}>{imageKeys.map((k) => <option key={k}>{k}</option>)}</select>
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
