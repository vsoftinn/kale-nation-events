import type { TicketTier } from "./pricing";
import kutitImg from "@/assets/kutit.jpg";
import simbaImg from "@/assets/simbafest.jpg";
import heroImg from "@/assets/hero.jpg";

export type EventItem = {
  id: string;
  programId: string;
  title: string;
  description: string;
  date: string;
  venue: string;
  city: string;
  lineup: string[];
  published: boolean;
  tiers: TicketTier[];
};
export type Program = {
  id: string;
  slug: string;
  name: string;
  owner: string;
  tagline: string;
  imageKey: string;
  events: EventItem[];
};
export type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  kind: string;
  eventId: string | null;
  status: string;
  source: string;
  createdAt: string;
  publishedAt: string | null;
};

const images: Record<string, string> = { kutit: kutitImg, simba: simbaImg, hero: heroImg };
export const imageKeys = Object.keys(images);
export const imageFor = (key: string) => images[key] ?? heroImg;

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapTier(t: any): TicketTier {
  return {
    id: t.id,
    name: t.name,
    quantity: t.quantity,
    sold: t.sold,
    salesEndAt: t.sales_end_at,
    closed: t.closed,
    phases: (t.price_phases ?? [])
      .map((p: any) => ({ id: p.id, label: p.label, price: p.price, startsAt: p.starts_at }))
      .sort((a: any, b: any) => +new Date(a.startsAt) - +new Date(b.startsAt)),
  };
}
export function mapEvent(e: any): EventItem {
  return {
    id: e.id,
    programId: e.program_id,
    title: e.title,
    description: e.description ?? "",
    date: e.date,
    venue: e.venue,
    city: e.city,
    lineup: e.lineup ?? [],
    published: e.published,
    tiers: (e.ticket_tiers ?? []).map(mapTier).sort((a: TicketTier, b: TicketTier) => a.name.localeCompare(b.name)),
  };
}
export function mapProgram(p: any): Program {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    owner: p.owner,
    tagline: p.tagline,
    imageKey: p.image_key,
    events: (p.events ?? []).map(mapEvent).sort((a: EventItem, b: EventItem) => +new Date(a.date) - +new Date(b.date)),
  };
}
export function mapPost(p: any): Post {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    body: p.body,
    kind: p.kind,
    eventId: p.event_id,
    status: p.status,
    source: p.source,
    createdAt: p.created_at,
    publishedAt: p.published_at,
  };
}

export const PROGRAM_SELECT = "*, events(*, ticket_tiers(*, price_phases(*)))";

export const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
