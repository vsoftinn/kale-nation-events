import { createFileRoute, Link } from "@tanstack/react-router";
import heroImg from "@/assets/hero.jpg";
import { usePrograms } from "@/lib/store";
import { SiteHeader } from "@/components/SiteHeader";
import { RunnerBolt } from "@/components/Loader";

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

const stats = [
  ["50K+", "Fans reached"],
  ["120+", "Events produced"],
  ["3", "Flagship programs"],
  ["24/7", "Online ticketing"],
];

const steps = [
  ["Discover", "Browse festivals, club nights and private events in one place."],
  ["Book", "Pick a ticket and pay in seconds — M-Pesa and card ready."],
  ["Arrive", "Show your watermarked QR ticket at the gate. Single scan entry."],
];

function Index() {
  const programs = usePrograms();
  return (
    <div className="overflow-x-hidden">
      <SiteHeader />
      <section className="relative flex min-h-[100vh] items-end overflow-hidden">
        <img src={heroImg} alt="Kutit Culture crowd at night" width={1920} height={1088} fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full scale-105 object-cover" />
        <div className="absolute inset-0 bg-fade" />
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-background/50 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.3em] text-primary backdrop-blur animate-rise">
            ⚡ Eldoret · Nairobi · Kenya
          </span>
          <RunnerBolt className="mt-6 mb-2 h-16 w-20 text-foreground animate-rise" />
          <h1 className="animate-rise text-7xl leading-[0.85] sm:text-8xl md:text-[10rem]">
            Run with <br /><span className="text-bolt">the nation.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground animate-rise" style={{ animationDelay: ".15s" }}>
            Club hosting · Pre-weddings · Weddings · Corporate events · Marketing & branding. One home for Kenya's boldest programs.
          </p>
          <div className="mt-10 flex flex-wrap gap-3 animate-rise" style={{ animationDelay: ".3s" }}>
            <a href="#programs" className="rounded-md bg-bolt px-8 py-4 font-bold uppercase tracking-wider text-primary-foreground shadow-glow transition-transform hover:-translate-y-0.5">Get Tickets</a>
            <a href="#contact" className="rounded-md border border-border bg-background/40 px-8 py-4 font-bold uppercase tracking-wider backdrop-blur hover:bg-secondary">Book Kalee Nation</a>
          </div>
        </div>
      </section>

      <div className="bead-strip h-2" />
      <div className="overflow-hidden border-b border-border bg-card py-5">
        <div className="flex w-max animate-marquee gap-12 font-display text-3xl text-muted-foreground">
          {Array.from({ length: 2 }).flatMap((_, k) =>
            ["KUTIT CULTURE", "SIMBAFEST", "KALEE NIGHTS", "WEDDINGS", "CORPORATE", "BRANDING"].map((t) => (
              <span key={k + t}><span className="text-primary">⚡</span> {t}</span>
            )),
          )}
        </div>
      </div>

      <section className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 py-16 md:grid-cols-4">
        {stats.map(([v, l]) => (
          <div key={l} className="p-6 text-center">
            <p className="font-display text-6xl text-bolt">{v}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">{l}</p>
          </div>
        ))}
      </section>

      <section id="programs" className="mx-auto max-w-7xl px-4 pb-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-primary">Programs</p>
            <h2 className="mt-2 text-5xl sm:text-7xl">Independent programs.<br />One platform.</h2>
          </div>
          <p className="max-w-sm text-muted-foreground">Each program runs on its own — its own events, its own tickets, its own team — powered by Kalee Nation.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {programs.map((p, i) => {
            const ev = p.events[0];
            return (
              <Link key={p.slug} to="/programs/$slug" params={{ slug: p.slug }} className="group relative overflow-hidden rounded-2xl border border-border bg-card transition-all duration-500 hover:-translate-y-1 hover:border-primary/60 hover:shadow-glow animate-rise" style={{ animationDelay: `${i * 0.1}s` }}>
                <img src={p.image} alt={p.name} loading="lazy" decoding="async" width={1024} height={768} className="aspect-[3/4] w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-fade" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">by {p.owner}</p>
                  <h3 className="text-5xl">{p.name}</h3>
                  {ev && <p className="text-sm">{new Date(ev.date).toDateString()} · {ev.city}</p>}
                  <span className="mt-4 inline-block text-sm font-bold uppercase tracking-wider text-primary transition-transform group-hover:translate-x-1">View tickets →</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="border-y border-border bg-card py-24">
        <div className="mx-auto max-w-7xl px-4">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-accent">How it works</p>
          <h2 className="mt-2 text-5xl sm:text-6xl">Ticket to the gate in three steps.</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map(([t, d], i) => (
              <div key={t} className="relative rounded-2xl border border-border bg-background p-8">
                <span className="absolute right-6 top-4 font-display text-7xl text-primary/15">0{i + 1}</span>
                <h3 className="text-3xl">{t}</h3>
                <p className="mt-2 text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="services" className="py-24">
        <div className="mx-auto max-w-7xl px-4">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-accent">What we do</p>
          <h2 className="mt-2 text-5xl sm:text-6xl">From the club to the altar.</h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
            {services.map(([t, d], i) => (
              <div key={t} className="group bg-background p-6 transition-colors hover:bg-secondary">
                <p className="font-display text-5xl text-primary/40 transition-colors group-hover:text-primary">0{i + 1}</p>
                <h3 className="mt-4 text-2xl">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="relative overflow-hidden border-t border-border">
        <div className="bead-strip h-2" />
        <div className="mx-auto max-w-5xl px-4 py-24 text-center">
          <RunnerBolt className="mx-auto h-14 w-16 text-primary" />
          <h2 className="mt-4 text-6xl sm:text-8xl">Let's make it <span className="text-bolt">legendary.</span></h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Planning a wedding, a launch or a festival? Tell us about it and the Kalee team will get back to you.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="mailto:hello@kaleenation.co.ke" className="rounded-md bg-bolt px-8 py-4 font-bold uppercase tracking-wider text-primary-foreground shadow-glow">Email us</a>
            <a href="https://wa.me/254700000000" className="rounded-md border border-border px-8 py-4 font-bold uppercase tracking-wider hover:bg-secondary">WhatsApp</a>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-10 text-center text-sm text-muted-foreground">
        © 2026 Kalee Nation · Eldoret & Nairobi, Kenya
      </footer>
    </div>
  );
}
