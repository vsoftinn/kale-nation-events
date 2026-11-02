import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getEvent } from "@/lib/public.functions";
import { imageFor } from "@/lib/catalog";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { Ticket } from "@/components/Ticket";
import { activePhase, ksh, MAX_TICKETS_PER_ORDER, orderTotal, statusLabel, tierStatus } from "@/lib/pricing";

const eventQuery = (id: string) => queryOptions({ queryKey: ["event", id], queryFn: () => getEvent({ data: { id } }), staleTime: 15_000 });

export const Route = createFileRoute("/events/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(eventQuery(params.id)),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.event.title} Tickets — Kalee Nation` : "Event — Kalee Nation" },
      { name: "description", content: loaderData ? `${loaderData.event.venue}, ${loaderData.event.city}. Buy tickets online on Kalee Nation.` : "Event tickets on Kalee Nation." },
      { property: "og:title", content: loaderData?.event.title ?? "Kalee Nation event" },
      { property: "og:description", content: loaderData?.program.tagline ?? "Tickets on Kalee Nation." },
    ],
  }),
  component: EventPage,
  errorComponent: ({ error }) => <p className="p-24 text-center">{String((error as Error)?.message ?? error)}</p>,
  notFoundComponent: () => (
    <div className="p-24 text-center"><h1 className="text-5xl">Event not found</h1><Link to="/events" className="text-primary">See all events</Link></div>
  ),
});

function EventPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(eventQuery(id));
  const { event: ev, program } = data;
  const [bought, setBought] = useState<{ tier: string; price: number; codes: string[]; total: number; holder: string } | null>(null);
  const [holder, setHolder] = useState("");
  const [cart, setCart] = useState<{ tierId: string; qty: number } | null>(null);
  const cartTier = cart ? ev.tiers.find((t) => t.id === cart.tierId) : undefined;
  const cartPhase = cartTier ? activePhase(cartTier) : null;
  const order = cartTier && cartPhase ? orderTotal(cartPhase.price, cart!.qty, cartTier.quantity - cartTier.sold) : null;

  return (
    <div>
      <SiteHeader />
      <section className="relative flex min-h-[60vh] items-end overflow-hidden">
        <img src={imageFor(program.imageKey)} alt={ev.title} width={1024} height={768} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-fade" />
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-12">
          <Link to="/programs/$slug" params={{ slug: program.slug }} className="text-sm text-muted-foreground hover:text-foreground">← {program.name}</Link>
          <h1 className="mt-2 text-7xl sm:text-8xl animate-rise">{ev.title}</h1>
          <p className="text-lg">{new Date(ev.date).toLocaleString("en-KE", { dateStyle: "full", timeStyle: "short", timeZone: "Africa/Nairobi" })}</p>
          <p className="text-muted-foreground">{ev.venue}, {ev.city}</p>
        </div>
      </section>
      <div className="bead-strip h-2" />

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[1fr_1.2fr]">
        <div>
          {ev.description && <p className="text-lg text-muted-foreground">{ev.description}</p>}
          {ev.lineup.length > 0 && (
            <>
              <p className="mt-8 text-xs uppercase tracking-widest text-muted-foreground">Lineup</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ev.lineup.map((a) => <span key={a} className="rounded-full border border-border px-3 py-1 text-sm">{a}</span>)}
              </div>
            </>
          )}
          <p className="mt-8 text-xs uppercase tracking-widest">Presented by {program.owner} · ticketed by Kalee Nation</p>
        </div>
        <div className="space-y-3">
          <h2 className="text-4xl">Tickets</h2>
          {ev.tiers.map((t) => {
            const s = tierStatus(t);
            const ph = activePhase(t);
            return (
              <div key={t.id} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5">
                <div>
                  <p className="font-display text-3xl">{t.name}</p>
                  <p className="text-sm text-muted-foreground">{ph?.label ?? "Not yet on sale"}</p>
                  <p className="text-xs text-muted-foreground">Sales close {new Date(t.salesEndAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })} · {Math.max(0, t.quantity - t.sold)} left</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-3xl text-primary">{ph ? ksh(ph.price) : "—"}</p>
                  <button
                    disabled={s !== "on-sale"}
                    onClick={() => { setBought(null); setCart({ tierId: t.id, qty: 1 }); }}
                    className="mt-1 rounded-md bg-bolt px-4 py-2 text-sm font-bold uppercase text-primary-foreground disabled:cursor-not-allowed disabled:bg-none disabled:bg-muted disabled:text-muted-foreground"
                  >
                    {s === "on-sale" ? (cart?.tierId === t.id ? "Selected" : "Buy") : statusLabel[s]}
                  </button>
                </div>
              </div>
            );
          })}
          {!ev.tiers.length && <p className="text-muted-foreground">Tickets coming soon.</p>}
          {cartTier && cartPhase && order && (
            <div className="animate-rise rounded-xl border border-primary/60 bg-card p-5 shadow-glow">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Your order</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
                <p className="font-display text-2xl">{cartTier.name} × {order.qty}</p>
                <div className="flex items-center gap-2">
                  <button aria-label="Fewer tickets" onClick={() => setCart({ ...cart!, qty: order.qty - 1 })} disabled={order.qty <= 1} className="h-9 w-9 rounded-md border border-border text-xl disabled:opacity-40">−</button>
                  <span className="w-8 text-center text-xl font-bold">{order.qty}</span>
                  <button aria-label="More tickets" onClick={() => setCart({ ...cart!, qty: order.qty + 1 })} disabled={order.qty >= Math.min(MAX_TICKETS_PER_ORDER, cartTier.quantity - cartTier.sold)} className="h-9 w-9 rounded-md border border-border text-xl disabled:opacity-40">+</button>
                </div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{ksh(cartPhase.price)} each · max {MAX_TICKETS_PER_ORDER} per order</p>
              <label className="mt-4 block text-xs uppercase tracking-widest text-muted-foreground">
                Name of person paying
                <input value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={60} placeholder="e.g. Wanjiku Kamau"
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-base normal-case tracking-normal text-foreground" />
              </label>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <p className="text-lg">Total <span className="font-display text-3xl text-primary">{ksh(order.total)}</span></p>
                <button
                  disabled={holder.trim().length < 2}
                  onClick={() => {
                    setBought({ tier: cartTier.name, price: cartPhase.price, total: order.total, holder: holder.trim(), codes: Array.from({ length: order.qty }, () => `KN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`) });
                    setCart(null);
                  }}
                  className="rounded-md bg-aurora px-5 py-3 font-bold uppercase text-primary-foreground disabled:opacity-40"
                >Proceed to pay</button>
              </div>
            </div>
          )}
        </div>
        {bought && (
          <div className="animate-rise space-y-8 lg:col-span-2">
            <p className="text-center text-sm uppercase tracking-widest text-primary">⚡ Payment of {ksh(bought.total)} received (demo) — here {bought.codes.length > 1 ? `are your ${bought.codes.length} tickets` : "is your ticket"}</p>
            {bought.codes.map((code) => (
              <Ticket key={code} program={program} event={ev} tierName={bought.tier} price={bought.price} holder="Guest Attendee" code={code} />
            ))}
          </div>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
