import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getProgram } from "@/lib/public.functions";
import { imageFor } from "@/lib/catalog";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

const programQuery = (slug: string) => queryOptions({ queryKey: ["program", slug], queryFn: () => getProgram({ data: { slug } }), staleTime: 30_000 });

export const Route = createFileRoute("/programs/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(programQuery(params.slug)),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Program"} — Kalee Nation` },
      { name: "description", content: loaderData?.tagline ?? "Events on Kalee Nation." },
      { property: "og:title", content: `${loaderData?.name ?? "Program"} — Kalee Nation` },
      { property: "og:description", content: loaderData?.tagline ?? "Events on Kalee Nation." },
    ],
  }),
  component: ProgramPage,
  errorComponent: ({ error }) => <p className="p-24 text-center">{error.message}</p>,
  notFoundComponent: () => <div className="p-24 text-center"><h1 className="text-5xl">Program not found</h1><Link to="/" className="text-primary">Home</Link></div>,
});

function ProgramPage() {
  const { slug } = Route.useParams();
  const { data: program } = useSuspenseQuery(programQuery(slug));
  return (
    <div>
      <SiteHeader />
      <section className="relative flex min-h-[60vh] items-end overflow-hidden">
        <img src={imageFor(program.imageKey)} alt={program.name} width={1024} height={768} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-fade" />
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-12">
          <Link to="/events" className="text-sm text-muted-foreground hover:text-foreground">← All events</Link>
          <h1 className="mt-2 text-7xl sm:text-8xl animate-rise">{program.name}</h1>
          <p className="max-w-xl text-lg text-muted-foreground">{program.tagline}</p>
          <p className="mt-2 text-xs uppercase tracking-widest">Owned by {program.owner} · ticketed by Kalee Nation</p>
        </div>
      </section>
      <div className="bead-strip h-2" />
      <section className="mx-auto max-w-7xl space-y-4 px-4 py-16">
        {program.events.map((ev) => (
          <Link key={ev.id} to="/events/$id" params={{ id: ev.id }} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/60">
            <div>
              <h2 className="text-4xl">{ev.title}</h2>
              <p className="text-muted-foreground">{new Date(ev.date).toDateString()} · {ev.venue}, {ev.city}</p>
            </div>
            <span className="rounded-md bg-bolt px-5 py-3 font-bold uppercase text-primary-foreground">Get tickets</span>
          </Link>
        ))}
        {!program.events.length && <p className="text-muted-foreground">No events posted yet.</p>}
      </section>
      <SiteFooter />
    </div>
  );
}
