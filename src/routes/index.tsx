import { createFileRoute, Link } from "@tanstack/react-router";
import heroImg from "@/assets/hero.jpg";
import { usePrograms } from "@/lib/store";
import { SiteHeader } from "@/components/SiteHeader";
import { RunnerBolt } from "@/components/Loader";
import { activePhase, ksh } from "@/lib/pricing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kalee Nation — Events, Tickets & Brand Marketing in Kenya" },
      { name: "description", content: "Club hosting, pre-weddings, weddings, corporate events and marketing. Buy tickets for Kutit Culture, SimbaFest and more." },
      { property: "og:title", content: "Kalee Nation — Events & Ticketing" },
      { property: "og:description", content: "Kenya's home for culture festivals, club nights and unforgettable events." },
    ],
    links: [{ rel: "preload", as: "image", href: heroImg, fetchpriority: "high" }],
  }),
  component: Index,
});

const services = [
  ["Club Hosting", "Kalee Nights tours with top DJs and MCs across the Rift and Nairobi."],
  ["Pre-Weddings", "Ruracio, koito & engagement parties produced with culture and class."],
  ["Weddings", "Full-day planning, décor, sound, MCs and entertainment."],
  ["Corporate Events", "Launches, team nights and brand activations that land."],
  ["Marketing & Branding", "We push your program to our audience and sell your tickets online."],
];

function Index() {
  const programs = usePrograms();
  return (
    <div>
      <SiteHeader />
      <section className="relative flex min-h-[92vh] items-end overflow-hidden">
        <img src={heroImg} alt="Kutit Culture crowd at night" width={1920} height={1088} fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-fade" />
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-20">
          <RunnerBolt className="mb-4 h-16 w-20 text-foreground animate-rise" />
          <h1 className="animate-rise text-6xl leading-[0.9] sm:text-8xl md:text-9xl">
            Run with <span className="text-bolt">the nation.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground animate-rise" style={{ animationDelay: ".15s" }}>
            Club hosting · Pre-weddings · Weddings · Corporate events · Marketing & branding. One home for Kenya's boldest programs.
          </p>
          <div className="mt-8 flex gap-3 animate-rise" style={{ animationDelay: ".3s" }}>
            <a href="#programs" className="rounded-md bg-bolt px-6 py-3 font-bold uppercase tracking-wider text-primary-foreground shadow-glow">Get Tickets</a>
            <Link to="/admin" className="rounded-md border border-border px-6 py-3 font-bold uppercase tracking-wider hover:bg-secondary">List your program</Link>
          </div>
        </div>
      </section>

      <div className="bead-strip h-2" />
      <div className="overflow-hidden border-b border-border bg-card py-4">
        <div className="flex w-max animate-marquee gap-12 font-display text-3xl text-muted-foreground">
          {Array.from({ length: 2 }).flatMap((_, k) =>
            ["KUTIT CULTURE", "SIMBAFEST", "KALEE NIGHTS", "WEDDINGS", "CORPORATE", "BRANDING"].map((t) => (
              <span key={k + t}>⚡ {t}</span>
            )),
          )}
        </div>
      </div>

      <section id="programs" className="mx-auto max-w-7xl px-4 py-24">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-primary">Programs</p>
        <h2 className="mt-2 text-5xl sm:text-6xl">Independent programs. One platform.</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {programs.map((p) => {
            const ev = p.events[0];
            const from = ev ? Math.min(...ev.tiers.map((t) => activePhase(t)?.price ?? Infinity)) : Infinity;
            return (
              <Link key={p.slug} to="/programs/$slug" params={{ slug: p.slug }} className="group relative overflow-hidden rounded-xl border border-border bg-card">
                <img src={p.image} alt={p.name} loading="lazy" decoding="async" width={1024} height={768} className="aspect-[4/3] w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-fade" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">by {p.owner}</p>
                  <h3 className="text-4xl">{p.name}</h3>
                  {ev && <p className="text-sm">{new Date(ev.date).toDateString()} · {ev.city}{isFinite(from) && <> · from <span className="text-primary">{ksh(from)}</span></>}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section id="services" className="border-t border-border bg-card py-24">
        <div className="mx-auto max-w-7xl px-4">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-accent">What we do</p>
          <h2 className="mt-2 text-5xl sm:text-6xl">From the club to the altar.</h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
            {services.map(([t, d], i) => (
              <div key={t} className="bg-background p-6 transition-colors hover:bg-secondary">
                <p className="font-display text-5xl text-primary/40">0{i + 1}</p>
                <h3 className="mt-4 text-2xl">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-10 text-center text-sm text-muted-foreground">
        © 2026 Kalee Nation · Eldoret & Nairobi, Kenya
      </footer>
    </div>
  );
}
