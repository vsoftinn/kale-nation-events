import { useSyncExternalStore } from "react";
import type { TicketTier } from "./pricing";
import kutitImg from "@/assets/kutit.jpg";
import simbaImg from "@/assets/simbafest.jpg";
import heroImg from "@/assets/hero.jpg";

export type EventItem = {
  id: string;
  title: string;
  date: string;
  venue: string;
  city: string;
  lineup: string[];
  tiers: TicketTier[];
};
export type Program = {
  slug: string;
  name: string;
  owner: string;
  tagline: string;
  color: "primary" | "bead";
  image: string;
  events: EventItem[];
};

const seed: Program[] = [
  {
    slug: "kutit-culture",
    name: "Kutit Culture",
    owner: "Kalenjin Music Platform",
    tagline: "Beats, beads & heritage — the Kalenjin culture festival.",
    color: "bead",
    image: kutitImg,
    events: [
      {
        id: "kutit-2026-nbi",
        title: "Kutit Culture Festival 2026",
        date: "2026-12-12T12:00:00+03:00",
        venue: "Carnivore Grounds",
        city: "Nairobi",
        lineup: ["Vicky Brilliance", "Zona Lastborn", "MC Brobox", "DJ Sutai"],
        tiers: [
          {
            id: "reg",
            name: "Regular",
            phases: [
              { label: "Early Bird", price: 1000, startsAt: "2026-10-01T00:00:00+03:00" },
              { label: "Advance", price: 1500, startsAt: "2026-11-15T00:00:00+03:00" },
              { label: "Gate", price: 2000, startsAt: "2026-12-12T00:00:00+03:00" },
            ],
            salesEndAt: "2026-12-12T18:00:00+03:00",
            quantity: 5000,
            sold: 3120,
          },
          {
            id: "vip",
            name: "VIP",
            phases: [
              { label: "Early Bird", price: 3500, startsAt: "2026-10-01T00:00:00+03:00" },
              { label: "Advance", price: 5000, startsAt: "2026-11-15T00:00:00+03:00" },
            ],
            salesEndAt: "2026-12-11T23:59:00+03:00",
            quantity: 600,
            sold: 412,
          },
        ],
      },
    ],
  },
  {
    slug: "simbafest",
    name: "SimbaFest",
    owner: "Simba Collective",
    tagline: "Roar louder. Kenya's biggest outdoor music experience.",
    color: "primary",
    image: simbaImg,
    events: [
      {
        id: "simba-eldoret",
        title: "SimbaFest Eldoret",
        date: "2026-11-28T15:00:00+03:00",
        venue: "Eldoret Sports Club",
        city: "Eldoret",
        lineup: ["DJ Festone", "Sweetstar", "Kipsang", "MC Dinnez"],
        tiers: [
          {
            id: "ga",
            name: "General",
            phases: [
              { label: "Phase 1", price: 800, startsAt: "2026-10-10T00:00:00+03:00" },
              { label: "Phase 2", price: 1200, startsAt: "2026-11-10T00:00:00+03:00" },
            ],
            salesEndAt: "2026-11-28T20:00:00+03:00",
            quantity: 8000,
            sold: 5210,
          },
          {
            id: "couple",
            name: "Couple",
            phases: [{ label: "Standard", price: 2000, startsAt: "2026-10-10T00:00:00+03:00" }],
            salesEndAt: "2026-11-27T23:59:00+03:00",
            quantity: 400,
            sold: 400,
          },
        ],
      },
    ],
  },
  {
    slug: "kalee-nights",
    name: "Kalee Nights",
    owner: "Kalee Nation",
    tagline: "Club hosting tours — Eldoret, Nakuru, Nairobi.",
    color: "primary",
    image: heroImg,
    events: [
      {
        id: "kalee-embassy",
        title: "Kalee Nation Experience",
        date: "2026-11-07T18:00:00+03:00",
        venue: "The Embassy Bistro",
        city: "Eldoret",
        lineup: ["DJ Sutai", "Brobox", "Vicky Brilliance"],
        tiers: [
          {
            id: "entry",
            name: "Entry",
            phases: [{ label: "Standard", price: 650, startsAt: "2026-10-01T00:00:00+03:00" }],
            salesEndAt: "2026-11-07T22:00:00+03:00",
            quantity: 1200,
            sold: 380,
          },
        ],
      },
    ],
  },
];

const KEY = "kalee-programs-v1";
let state: Program[] = seed;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw);
  } catch {}
}

export function setPrograms(next: Program[]) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  listeners.forEach((l) => l());
}

export function updateProgram(slug: string, fn: (p: Program) => Program) {
  setPrograms(state.map((p) => (p.slug === slug ? fn(p) : p)));
}

export function resetPrograms() { setPrograms(seed); }

export function usePrograms(): Program[] {
  return useSyncExternalStore(
    (cb) => { load(); listeners.add(cb); cb(); return () => listeners.delete(cb); },
    () => state,
    () => seed,
  );
}

export const seedPrograms = seed;
