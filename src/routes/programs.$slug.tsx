import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { seedPrograms, usePrograms } from "@/lib/store";
import { SiteHeader } from "@/components/SiteHeader";
import { Ticket } from "@/components/Ticket";
import { activePhase, ksh, nextPhase, tierStatus } from "@/lib/pricing";

export const Route = createFileRoute("/programs/$slug")({
  loader: ({ params }) => {
    const p = seedPrograms.find((x) => x.slug === params.slug);
    if (!p) throw notFound();
    return { name: p.name, tagline: p.tagline };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Program"} Tickets — Kalee Nation` },
      { name: "description", content: loaderData?.tagline ?? "Event tickets on Kalee Nation." },
      { property: "og:title", content: `${loaderData?.name ?? "Program"} — Kalee Nation` },
      { property: "og:description", content: loaderData?.tagline ?? "" },
    ],
  }),
  component: ProgramPage,
});

const statusLabel = { "on-sale": "On sale", upcoming: "Coming soon", "sold-out": "Sold out", expired: "Expired" };

function ProgramPage() {
  const { slug } = Route.useParams();
  const program = usePrograms().find((p) => p.slug === slug);
  const [bought, setBought] = useState<{ eventId: string; tier: string; price: number; code: string } | null>(null);
  if (!program) return null;

  return (
    <div>
      <SiteHeader />
      <section className="relative flex min-h-[60vh] items-end overflow-hidden">
        <img src={program.image} alt={program.name} width={1024} height={768} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-fade" />
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-12">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← All programs</Link>
          <h1 className="mt-2 text-7xl sm:text-8xl animate-rise">{program.name}</h1>
          <p className="max-w-xl text-lg text-muted-foreground">{program.tagline}</p>
          <p className="mt-2 text-xs uppercase tracking-widest">Owned by {program.owner} · ticketed by Kalee Nation</p>
        </div>
      </section>
      <div className="bead-strip h-2" />

      <section className="mx-auto max-w-7xl space-y-16 px-4 py-16">
        {program.events.map((ev) => (
          <div key={ev.id} className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <h2 className="text-5xl">{ev.title}</h2>
              <p className="mt-2 text-lg">{new Date(ev.date).toLocaleString("en-KE", { dateStyle: "full", timeStyle: "short" })}</p>
              <p className="text-muted-foreground">{ev.venue}, {ev.city}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {ev.lineup.map((a) => <span key={a} className="rounded-full border border-border px-3 py-1 text-sm">{a}</span>)}
              </div>
            </div>
            <div className="space-y-3">
              {ev.tiers.map((t) => {
                const s = tierStatus(t);
                const ph = activePhase(t);
                const nx = nextPhase(t);
                return (
                  <div key={t.id} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5">
                    <div>
                      <p className="font-display text-3xl">{t.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {ph?.label ?? "Not yet on sale"}{nx && <> · rises to {ksh(nx.price)} on {new Date(nx.startsAt).toLocaleDateString("en-KE")}</>}
                      </p>
                      <p className="text-xs text-muted-foreground">Sales close {new Date(t.salesEndAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })} · {t.quantity - t.sold} left</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-3xl text-primary">{ph ? ksh(ph.price) : "—"}</p>
                      <button
                        disabled={s !== "on-sale"}
                        onClick={() => setBought({ eventId: ev.id, tier: t.name, price: ph!.price, code: `KN-${Math.random().toString(36).slice(2, 8).toUpperCase()}` })}
                        className="mt-1 rounded-md bg-bolt px-4 py-2 text-sm font-bold uppercase text-primary-foreground disabled:cursor-not-allowed disabled:bg-none disabled:bg-muted disabled:text-muted-foreground"
                      >
                        {s === "on-sale" ? "Buy" : statusLabel[s]}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {bought?.eventId === ev.id && (
              <div className="animate-rise lg:col-span-2">
                <p className="mb-4 text-center text-sm uppercase tracking-widest text-primary">⚡ Payment received (demo) — here's your ticket</p>
                <Ticket program={program} event={ev} tierName={bought.tier} price={bought.price} holder="Guest Attendee" code={bought.code} />
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
