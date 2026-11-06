import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { orderStatus, startCheckout } from "@/lib/checkout.functions";
import { getEvent } from "@/lib/public.functions";
import { imageFor } from "@/lib/catalog";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { Ticket } from "@/components/Ticket";
import {
  activePhase,
  allTicketsSold,
  ksh,
  MAX_TICKETS_PER_ORDER,
  orderTotal,
  statusLabel,
  tierStatus,
} from "@/lib/pricing";

const eventQuery = (id: string) =>
  queryOptions({
    queryKey: ["event", id],
    queryFn: () => getEvent({ data: { id } }),
    staleTime: 15_000,
  });

type PaymentState = {
  orderId?: string;
  state: "idle" | "sending" | "waiting" | "failed";
  msg?: string;
};

type PurchasedOrder = {
  tier: string;
  price: number;
  codes: string[];
  total: number;
  holder: string;
};

export const Route = createFileRoute("/events/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(eventQuery(params.id)),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.event.title} Tickets — Kalee Nation`
          : "Event — Kalee Nation",
      },
      {
        name: "description",
        content: loaderData
          ? `${loaderData.event.venue}, ${loaderData.event.city}. Buy tickets online on Kalee Nation.`
          : "Event tickets on Kalee Nation.",
      },
      { property: "og:title", content: loaderData?.event.title ?? "Kalee Nation event" },
      {
        property: "og:description",
        content: loaderData?.program.tagline ?? "Tickets on Kalee Nation.",
      },
    ],
  }),
  component: EventPage,
  errorComponent: ({ error }) => (
    <p className="p-24 text-center">{String((error as Error)?.message ?? error)}</p>
  ),
  notFoundComponent: () => (
    <div className="p-24 text-center">
      <h1 className="text-5xl">Event not found</h1>
      <Link to="/events" className="text-primary">
        See all events
      </Link>
    </div>
  ),
});

function EventPage() {
  const { id } = Route.useParams();
  const searchString = useLocation({ select: (location) => location.searchStr });
  const orderIdFromUrl = new URLSearchParams(searchString).get("orderId") ?? undefined;
  const { data } = useSuspenseQuery(eventQuery(id));
  const { event: ev, program } = data;
  const [bought, setBought] = useState<PurchasedOrder | null>(null);
  const [holder, setHolder] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [provider, setProvider] = useState<"mpesa" | "paystack">("mpesa");
  const [pay, setPay] = useState<PaymentState>({ state: "idle" });
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [cart, setCart] = useState<{ tierId: string; qty: number } | null>(null);
  const start = useServerFn(startCheckout);
  const check = useServerFn(orderStatus);

  useEffect(() => {
    if (orderIdFromUrl) setPay({ state: "waiting", orderId: orderIdFromUrl });
  }, [orderIdFromUrl]);

  useEffect(() => {
    if (pay.state !== "waiting" || !pay.orderId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    const tick = async () => {
      try {
        const order = await check({ data: { orderId: pay.orderId! } });
        if (!active) return;
        if (order.provider === "mpesa" || order.provider === "paystack") {
          setProvider(order.provider);
        }
        if (order.status === "paid") {
          setBought({
            tier: order.tierName,
            price: order.unitPrice,
            total: order.total,
            holder: order.holder,
            codes: order.codes,
          });
          setCart(null);
          setPay({ state: "idle" });
          window.history.replaceState(window.history.state, "", window.location.pathname);
          return;
        }
        if (order.status === "failed") {
          setPay({ state: "failed", msg: order.message ?? "Payment was not completed." });
          window.history.replaceState(window.history.state, "", window.location.pathname);
          return;
        }
        if (order.status === "refund_pending") {
          setPay({
            state: "failed",
            msg: "Your payment needs manual review. Please contact support and do not pay again.",
          });
          return;
        }
      } catch {
        if (!active) return;
      }

      if (Date.now() - startedAt >= 120_000) {
        setPay({
          state: "failed",
          ...(pay.orderId ? { orderId: pay.orderId } : {}),
          msg: "Payment confirmation is taking longer than usual. Do not retry; contact support with your order details.",
        });
        return;
      }
      timer = setTimeout(tick, 15_000);
    };
    timer = setTimeout(tick, 3_000);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [check, pay.orderId, pay.state]);

  const cartTier = cart ? ev.tiers.find((tier) => tier.id === cart.tierId) : undefined;
  const cartPhase = cartTier ? activePhase(cartTier) : null;
  const order =
    cartTier && cartPhase
      ? orderTotal(cartPhase.price, cart!.qty, cartTier.quantity - cartTier.sold)
      : null;

  async function beginCheckout() {
    if (!cartTier || !order || !holder.trim()) return;
    if (provider === "paystack" && !email.trim()) return;
    if (provider === "mpesa" && !phone.trim()) return;
    setPay({ state: "sending" });
    setCheckoutError(null);
    try {
      const result = await start({
        data: {
          tierId: cartTier.id,
          qty: order.qty,
          holder: holder.trim(),
          provider,
          ...(provider === "mpesa" ? { phone } : { email }),
        },
      });
      if (result.authorizationUrl) {
        window.location.assign(result.authorizationUrl);
        return;
      }
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}?orderId=${encodeURIComponent(result.orderId)}`,
      );
      setPay({
        state: "waiting",
        orderId: result.orderId,
        ...(result.pendingSetup ? { msg: result.message ?? undefined } : {}),
      });
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Could not start payment.");
      setPay({ state: "idle" });
    }
  }

  return (
    <div>
      <SiteHeader />
      <section className="relative flex min-h-[60vh] items-end overflow-hidden">
        <img
          src={imageFor(program.imageKey)}
          alt={ev.title}
          width={1024}
          height={768}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-fade" />
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-12">
          <Link
            to="/programs/$slug"
            params={{ slug: program.slug }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {program.name}
          </Link>
          <h1 className="mt-2 text-7xl sm:text-8xl animate-rise">{ev.title}</h1>
          <p className="text-lg">
            {new Date(ev.date).toLocaleString("en-KE", {
              dateStyle: "full",
              timeStyle: "short",
              timeZone: "Africa/Nairobi",
            })}
          </p>
          <p className="text-muted-foreground">
            {ev.venue}, {ev.city}
          </p>
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
                {ev.lineup.map((artist) => (
                  <span
                    key={artist}
                    className="rounded-full border border-border px-3 py-1 text-sm"
                  >
                    {artist}
                  </span>
                ))}
              </div>
            </>
          )}
          <p className="mt-8 text-xs uppercase tracking-widest">
            Presented by {program.owner} · ticketed by Kalee Nation
          </p>
        </div>
        <div className="space-y-3">
          <h2 className="text-4xl">Tickets</h2>
          {allTicketsSold(ev.tiers) && (
            <p
              role="status"
              className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 font-bold uppercase tracking-wider text-destructive"
            >
              All tickets are sold
            </p>
          )}
          {ev.tiers.map((tier) => {
            const status = tierStatus(tier);
            const phase = activePhase(tier);
            return (
              <div
                key={tier.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5"
              >
                <div>
                  <p className="font-display text-3xl">{tier.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {phase?.label ?? "Not yet on sale"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Sales close{" "}
                    {new Date(tier.salesEndAt).toLocaleString("en-KE", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Africa/Nairobi",
                    })}{" "}
                    · {Math.max(0, tier.quantity - tier.sold)} left
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-3xl text-primary">
                    {phase ? ksh(phase.price) : "—"}
                  </p>
                  <button
                    disabled={status !== "on-sale" || pay.state === "waiting"}
                    onClick={() => {
                      setBought(null);
                      setCheckoutError(null);
                      setCart({ tierId: tier.id, qty: 1 });
                    }}
                    className="mt-1 rounded-md bg-bolt px-4 py-2 text-sm font-bold uppercase text-primary-foreground disabled:cursor-not-allowed disabled:bg-none disabled:bg-muted disabled:text-muted-foreground"
                  >
                    {status === "on-sale"
                      ? cart?.tierId === tier.id
                        ? "Selected"
                        : "Buy"
                      : statusLabel[status]}
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
                <p className="font-display text-2xl">
                  {cartTier.name} × {order.qty}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    aria-label="Fewer tickets"
                    onClick={() => setCart({ tierId: cartTier.id, qty: order.qty - 1 })}
                    disabled={order.qty <= 1 || pay.state !== "idle"}
                    className="h-9 w-9 rounded-md border border-border text-xl disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-xl font-bold">{order.qty}</span>
                  <button
                    aria-label="More tickets"
                    onClick={() => setCart({ tierId: cartTier.id, qty: order.qty + 1 })}
                    disabled={
                      order.qty >=
                        Math.min(MAX_TICKETS_PER_ORDER, cartTier.quantity - cartTier.sold) ||
                      pay.state !== "idle"
                    }
                    className="h-9 w-9 rounded-md border border-border text-xl disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {ksh(cartPhase.price)} each · max {MAX_TICKETS_PER_ORDER} per order
              </p>
              <label className="mt-4 block text-xs uppercase tracking-widest text-muted-foreground">
                Name on ticket
                <input
                  value={holder}
                  onChange={(event) => setHolder(event.target.value)}
                  maxLength={60}
                  placeholder="e.g. Wanjiku Kamau"
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-base normal-case tracking-normal text-foreground"
                />
              </label>
              <fieldset className="mt-4">
                <legend className="text-xs uppercase tracking-widest text-muted-foreground">
                  Payment method
                </legend>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    aria-pressed={provider === "mpesa"}
                    onClick={() => setProvider("mpesa")}
                    disabled={pay.state !== "idle"}
                    className={`rounded-md border px-4 py-2 text-sm font-bold ${provider === "mpesa" ? "border-primary bg-primary/10" : "border-border"}`}
                  >
                    M-Pesa STK Push
                  </button>
                  <button
                    type="button"
                    aria-pressed={provider === "paystack"}
                    onClick={() => setProvider("paystack")}
                    disabled={pay.state !== "idle"}
                    className={`rounded-md border px-4 py-2 text-sm font-bold ${provider === "paystack" ? "border-primary bg-primary/10" : "border-border"}`}
                  >
                    Paystack
                  </button>
                </div>
              </fieldset>
              {provider === "mpesa" ? (
                <label className="mt-4 block text-xs uppercase tracking-widest text-muted-foreground">
                  Kenyan M-Pesa phone
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    maxLength={30}
                    placeholder="0712 345 678"
                    className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-base normal-case tracking-normal text-foreground"
                  />
                </label>
              ) : (
                <label className="mt-4 block text-xs uppercase tracking-widest text-muted-foreground">
                  Email for your Paystack receipt
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    maxLength={254}
                    placeholder="you@example.com"
                    className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-base normal-case tracking-normal text-foreground"
                  />
                </label>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <p className="text-lg">
                  Total{" "}
                  <span className="font-display text-3xl text-primary">{ksh(order.total)}</span>
                </p>
                <button
                  disabled={
                    pay.state !== "idle" ||
                    holder.trim().length < 2 ||
                    (provider === "paystack"
                      ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
                      : !/^(\+?254|0)?[71]\d{8}$/.test(phone.replace(/[\s()-]/g, "")))
                  }
                  onClick={beginCheckout}
                  className="rounded-md bg-aurora px-5 py-3 font-bold uppercase text-primary-foreground disabled:opacity-40"
                >
                  {pay.state === "sending"
                    ? "Starting payment…"
                    : pay.state === "waiting"
                      ? "Waiting…"
                      : provider === "mpesa"
                        ? "Send M-Pesa STK Push"
                        : "Pay securely with Paystack"}
                </button>
              </div>
              {pay.state === "waiting" && (
                <p role="status" className="mt-3 text-sm text-primary">
                  {pay.msg ??
                    (provider === "mpesa"
                      ? `Check your phone and enter your M-Pesa PIN to pay ${ksh(order.total)}.`
                      : "Waiting for Paystack to confirm your payment.")}
                </p>
              )}
              {checkoutError && (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {checkoutError}
                </p>
              )}
            </div>
          )}
          {pay.state === "failed" && pay.msg && (
            <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm">
              <p className="text-destructive">{pay.msg}</p>
              {pay.orderId && (
                <button
                  type="button"
                  onClick={() => {
                    if (pay.orderId) setPay({ state: "waiting", orderId: pay.orderId });
                  }}
                  className="mt-2 underline"
                >
                  Check payment again
                </button>
              )}
            </div>
          )}
        </div>
        {bought && (
          <div className="animate-rise space-y-8 lg:col-span-2">
            <p className="text-center text-sm uppercase tracking-widest text-primary">
              Payment of {ksh(bought.total)} received — here{" "}
              {bought.codes.length > 1
                ? `are your ${bought.codes.length} tickets`
                : "is your ticket"}
            </p>
            <div className="text-center">
              <a
                href={`https://wa.me/254700000000?text=${encodeURIComponent(`Your ${ev.title} ticket${bought.codes.length > 1 ? "s" : ""} are ready. Ticket code${bought.codes.length > 1 ? "s" : ""}: ${bought.codes.join(", ")}. Event: https://events.v-soft-innovations.com/events/${ev.id}`)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-md border border-border px-4 py-2 text-sm font-bold uppercase tracking-wider hover:bg-secondary"
              >
                Share ticket details on WhatsApp
              </a>
            </div>
            {bought.codes.map((code) => (
              <Ticket
                key={code}
                program={program}
                event={ev}
                tierName={bought.tier}
                price={bought.price}
                holder={bought.holder}
                code={code}
              />
            ))}
          </div>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
