export type PricePhase = { id?: string; label: string; price: number; startsAt: string };
export type TicketTier = {
  id: string;
  name: string;
  phases: PricePhase[]; // price auto-rewrites at each phase start
  salesEndAt: string; // ticket expires after this
  quantity: number;
  sold: number;
  closed?: boolean; // manually closed/declined by an admin
};

/** The phase active at `now`, or null if sales haven't started. */
export function activePhase(tier: TicketTier, now: Date = new Date()): PricePhase | null {
  const sorted = [...tier.phases].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  let current: PricePhase | null = null;
  for (const p of sorted) if (+new Date(p.startsAt) <= +now) current = p;
  return current;
}

export function nextPhase(tier: TicketTier, now: Date = new Date()): PricePhase | null {
  return (
    [...tier.phases]
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
      .find((p) => +new Date(p.startsAt) > +now) ?? null
  );
}

export type TierStatus = "upcoming" | "on-sale" | "sold-out" | "expired" | "closed";
export function tierStatus(tier: TicketTier, now: Date = new Date()): TierStatus {
  if (tier.closed) return "closed";
  if (+now >= +new Date(tier.salesEndAt)) return "expired";
  if (tier.sold >= tier.quantity) return "sold-out";
  if (!activePhase(tier, now)) return "upcoming";
  return "on-sale";
}

export const statusLabel: Record<TierStatus, string> = {
  "on-sale": "On sale",
  upcoming: "Coming soon",
  "sold-out": "Sold out",
  expired: "Expired",
  closed: "Closed",
};

export const ksh = (n: number) => `KSh ${n.toLocaleString("en-KE")}`;
