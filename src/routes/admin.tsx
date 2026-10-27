import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { resetPrograms, updateProgram, usePrograms, type EventItem } from "@/lib/store";
import { SiteHeader } from "@/components/SiteHeader";
import { activePhase, ksh, tierStatus, type TicketTier } from "@/lib/pricing";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Owner Portal — Kalee Nation" },
      { name: "description", content: "Program owners manage events, ticket prices, scheduled price changes and expiry." },
      { property: "og:title", content: "Kalee Nation Owner Portal" },
      { property: "og:description", content: "Run your program independently on Kalee Nation." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Admin,
});

const toLocal = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocal = (v: string) => new Date(v).toISOString();
const input = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm";

function Admin() {
  const programs = usePrograms();
  const [slug, setSlug] = useState(programs[0]?.slug ?? "kutit-culture");
  const program = programs.find((p) => p.slug === slug)!;

  const patchTier = (evId: string, tierId: string, fn: (t: TicketTier) => TicketTier) =>
    updateProgram(slug, (p) => ({
      ...p,
      events: p.events.map((e) => (e.id !== evId ? e : { ...e, tiers: e.tiers.map((t) => (t.id === tierId ? fn(t) : t)) })),
    }));
  const patchEvent = (evId: string, fn: (e: EventItem) => EventItem) =>
    updateProgram(slug, (p) => ({ ...p, events: p.events.map((e) => (e.id === evId ? fn(e) : e)) }));

  const addEvent = () =>
    updateProgram(slug, (p) => ({
      ...p,
      events: [...p.events, {
        id: `ev-${Date.now()}`, title: `New ${p.name} Event`, date: new Date(Date.now() + 30 * 864e5).toISOString(),
        venue: "TBA", city: "Nairobi", lineup: [],
        tiers: [{ id: `t-${Date.now()}`, name: "Regular", phases: [{ label: "Early Bird", price: 1000, startsAt: new Date().toISOString() }], salesEndAt: new Date(Date.now() + 29 * 864e5).toISOString(), quantity: 500, sold: 0 }],
      }],
    }));

  const revenue = program.events.flatMap((e) => e.tiers).reduce((s, t) => s + t.sold * (activePhase(t)?.price ?? 0), 0);
  const sold = program.events.flatMap((e) => e.tiers).reduce((s, t) => s + t.sold, 0);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-24 pt-24 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Signed in as Super Admin (demo)</p>
          {programs.map((p) => (
            <button key={p.slug} onClick={() => setSlug(p.slug)}
              className={`block w-full rounded-md px-3 py-2 text-left font-semibold ${p.slug === slug ? "bg-bolt text-primary-foreground" : "bg-card hover:bg-secondary"}`}>
              {p.name}
              <span className="block text-xs font-normal opacity-70">{p.owner}</span>
            </button>
          ))}
          <button onClick={resetPrograms} className="mt-4 text-xs text-muted-foreground underline">Reset demo data</button>
        </aside>

        <main className="space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-6xl">{program.name}</h1>
              <p className="text-muted-foreground">Independent dashboard · only this program's owner sees this</p>
            </div>
            <button onClick={addEvent} className="rounded-md bg-bolt px-4 py-2 font-bold uppercase text-primary-foreground">+ Post event</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[["Tickets sold", sold.toLocaleString()], ["Est. revenue", ksh(revenue)], ["Events", String(program.events.length)]].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-border bg-card p-5">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{k}</p>
                <p className="font-display text-4xl text-primary">{v}</p>
              </div>
            ))}
          </div>

          {program.events.map((ev) => (
            <div key={ev.id} className="space-y-4 rounded-xl border border-border bg-card p-6">
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="sm:col-span-2 text-xs text-muted-foreground">Title<input className={input} value={ev.title} onChange={(e) => patchEvent(ev.id, (x) => ({ ...x, title: e.target.value }))} /></label>
                <label className="text-xs text-muted-foreground">Date<input type="datetime-local" className={input} value={toLocal(ev.date)} onChange={(e) => patchEvent(ev.id, (x) => ({ ...x, date: fromLocal(e.target.value) }))} /></label>
                <label className="text-xs text-muted-foreground">Venue<input className={input} value={ev.venue} onChange={(e) => patchEvent(ev.id, (x) => ({ ...x, venue: e.target.value }))} /></label>
              </div>

              {ev.tiers.map((t) => {
                const s = tierStatus(t);
                return (
                  <div key={t.id} className="rounded-lg border border-border bg-background p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <input className={`${input} max-w-[160px] font-semibold`} value={t.name} onChange={(e) => patchTier(ev.id, t.id, (x) => ({ ...x, name: e.target.value }))} />
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs uppercase">{s}</span>
                      <span className="text-sm text-muted-foreground">Now: <b className="text-primary">{ksh(activePhase(t)?.price ?? 0)}</b></span>
                      <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">Expires
                        <input type="datetime-local" className={input} value={toLocal(t.salesEndAt)} onChange={(e) => patchTier(ev.id, t.id, (x) => ({ ...x, salesEndAt: fromLocal(e.target.value) }))} />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">Qty
                        <input type="number" className={`${input} w-24`} value={t.quantity} onChange={(e) => patchTier(ev.id, t.id, (x) => ({ ...x, quantity: +e.target.value }))} />
                      </label>
                    </div>
                    <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">⚡ Automatic price schedule</p>
                    <div className="mt-2 space-y-2">
                      {t.phases.map((ph, i) => (
                        <div key={i} className="grid grid-cols-[1fr_120px_1fr_auto] items-center gap-2">
                          <input className={input} value={ph.label} onChange={(e) => patchTier(ev.id, t.id, (x) => ({ ...x, phases: x.phases.map((p, j) => (j === i ? { ...p, label: e.target.value } : p)) }))} />
                          <input type="number" className={input} value={ph.price} onChange={(e) => patchTier(ev.id, t.id, (x) => ({ ...x, phases: x.phases.map((p, j) => (j === i ? { ...p, price: +e.target.value } : p)) }))} />
                          <input type="datetime-local" className={input} value={toLocal(ph.startsAt)} onChange={(e) => patchTier(ev.id, t.id, (x) => ({ ...x, phases: x.phases.map((p, j) => (j === i ? { ...p, startsAt: fromLocal(e.target.value) } : p)) }))} />
                          <button className="px-2 text-destructive" onClick={() => patchTier(ev.id, t.id, (x) => ({ ...x, phases: x.phases.filter((_, j) => j !== i) }))}>✕</button>
                        </div>
                      ))}
                      <button className="text-sm font-semibold text-primary" onClick={() => patchTier(ev.id, t.id, (x) => ({ ...x, phases: [...x.phases, { label: "New phase", price: (x.phases.at(-1)?.price ?? 1000) + 500, startsAt: new Date(Date.now() + 7 * 864e5).toISOString() }] }))}>+ Add price change</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </main>
      </div>
    </div>
  );
}
