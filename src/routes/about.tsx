import { createFileRoute, Link } from "@tanstack/react-router";
import heroImg from "@/assets/hero.jpg";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Kalee Nation — Events & Entertainment, Kenya" },
      { name: "description", content: "Kalee Nation produces club nights, pre-weddings, weddings, corporate events and brand campaigns from Eldoret and Nairobi." },
      { property: "og:title", content: "About Kalee Nation" },
      { property: "og:description", content: "The team behind Kalee Nights, culture festivals and unforgettable events." },
    ],
  }),
  component: About,
});

const services = [
  ["Club Hosting", "The Kalee Nights tour brings top DJs and MCs to clubs across Eldoret, Nakuru and Nairobi."],
  ["Pre-Weddings", "Ruracio, koito and engagement celebrations produced with culture and class."],
  ["Weddings", "Planning, décor, sound, MCs and entertainment for the whole day."],
  ["Corporate Events", "Product launches, team nights and brand activations."],
  ["Marketing & Branding", "We promote programs to our audience and sell their tickets online."],
];

const values = [
  ["Culture first", "We celebrate Kenyan heritage — the music, the beads, the people."],
  ["Energy", "Like our runner logo: fast, bold, always moving."],
  ["Trust", "Secure tickets, honest pricing and partners who deliver."],
];

function About() {
  return (
    <div>
      <SiteHeader />
      <section className="relative flex min-h-[70vh] items-end overflow-hidden">
        <img src={heroImg} alt="Kalee Nation crowd" width={1920} height={1088} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-fade" />
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-16">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-primary">About us</p>
          <h1 className="mt-2 max-w-4xl text-7xl leading-[0.9] sm:text-8xl">We make moments the nation remembers.</h1>
        </div>
      </section>
      <div className="bead-strip h-2" />

      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-24 lg:grid-cols-2">
        <h2 className="text-5xl sm:text-6xl">Born in the Rift.<br /><span className="text-bolt">Built for Kenya.</span></h2>
        <div className="space-y-4 text-lg text-muted-foreground">
          <p>Kalee Nation started on the dance floors of Eldoret, hosting club nights that brought together the best DJs, MCs and fans in the Rift Valley.</p>
          <p>Today we produce events of every size — from intimate pre-weddings to culture festivals — and we run an online ticketing platform where independent programs like Kutit Culture and SimbaFest sell tickets under their own name.</p>
        </div>
      </section>

      <section className="border-y border-border bg-card py-24">
        <div className="mx-auto max-w-7xl px-4">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-accent">What we do</p>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
            {services.map(([t, d], i) => (
              <div key={t} className="bg-background p-6">
                <p className="font-display text-5xl text-primary/50">0{i + 1}</p>
                <h3 className="mt-4 text-2xl">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-24">
        <div className="grid gap-6 md:grid-cols-3">
          {values.map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-border p-8">
              <h3 className="text-4xl text-primary">{t}</h3>
              <p className="mt-2 text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-16 flex flex-wrap gap-3">
          <Link to="/events" className="rounded-md bg-bolt px-8 py-4 font-bold uppercase tracking-wider text-primary-foreground shadow-glow">See events</Link>
          <Link to="/organizers" className="rounded-md border border-border px-8 py-4 font-bold uppercase tracking-wider hover:bg-secondary">Partner with us</Link>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
