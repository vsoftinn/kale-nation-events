import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getPrograms } from "@/lib/public.functions";
import { imageFor } from "@/lib/catalog";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { activePhase, ksh } from "@/lib/pricing";

export const programsQuery = queryOptions({ queryKey: ["programs"], queryFn: () => getPrograms(), staleTime: 30_000 });

export const Route = createFileRoute("/events/")({
  head: () => ({
    meta: [
      { title: "Upcoming Events & Tickets — Kalee Nation" },
      { name: "description", content: "Every upcoming festival, club night and event on Kalee Nation. Pick an event and buy tickets online." },
      { property: "og:title", content: "Upcoming Events — Kalee Nation" },
      { property: "og:description", content: "Festivals, club nights and culture events across Kenya." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(programsQuery),
  component: EventsPage,
  errorComponent: ({ error }) => <p className="p-24 text-center">{error.message}</p>,
  notFoundComponent: () => <p className="p-24 text-center">No events found.</p>,
});

function EventsPage() {
  const { data: programs } = useSuspenseQuery(programsQuery);
  const events = programs
    .flatMap((p) => p.events.map((e) => ({ e, p })))
    .filter(({ e }) => +new Date(e.date) > Date.now() - 864e5)
    .sort((a, b) => +new Date(a.e.date) - +new Date(b.e.date));
  return (
    <div>
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-32">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-primary">Events</p>
        <h1 className="mt-2 text-7xl sm:text-8xl">What's on.</h1>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map(({ e, p }) => {
            const from = Math.min(...e.tiers.map((t) => activePhase(t)?.price ?? Infinity));
            return (
              <Link key={e.id} to="/events/$id" params={{ id: e.id }} className="group overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-primary/60 hover:shadow-glow">
                <img src={imageFor(p.imageKey)} alt={e.title} loading="lazy" width={1024} height={768} className="aspect-video w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="p-6">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{p.name}</p>
                  <h2 className="mt-1 text-4xl">{e.title}</h2>
                  <p className="text-sm">{new Date(e.date).toDateString()} · {e.venue}, {e.city}</p>
                  <p className="mt-4 font-bold uppercase tracking-wider text-primary">{Number.isFinite(from) ? `Tickets from ${ksh(from)}` : "Tickets"} →</p>
                </div>
              </Link>
            );
          })}
          {!events.length && <p className="text-muted-foreground">No upcoming events yet.</p>}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
