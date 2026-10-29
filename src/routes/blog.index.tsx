import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getPosts } from "@/lib/public.functions";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export const postsQuery = queryOptions({ queryKey: ["posts"], queryFn: () => getPosts(), staleTime: 30_000 });

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "News & Upcoming Events — Kalee Nation" },
      { name: "description", content: "Latest news, lineups and upcoming events from every program on Kalee Nation." },
      { property: "og:title", content: "Kalee Nation News" },
      { property: "og:description", content: "Lineups, announcements and upcoming events across Kenya." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(postsQuery),
  component: Blog,
  errorComponent: ({ error }) => <p className="p-24 text-center">{error.message}</p>,
  notFoundComponent: () => <p className="p-24 text-center">No posts.</p>,
});

function Blog() {
  const { data: posts } = useSuspenseQuery(postsQuery);
  const [lead, ...rest] = posts;
  return (
    <div>
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-32">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-primary">News</p>
        <h1 className="mt-2 text-7xl sm:text-8xl">From the nation.</h1>
        {lead && (
          <Link to="/blog/$slug" params={{ slug: lead.slug }} className="mt-12 block rounded-2xl border border-border bg-card p-10 transition-colors hover:border-primary/60">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">{lead.kind === "event" ? "Upcoming event" : "Latest news"}</span>
            <h2 className="mt-3 text-5xl sm:text-6xl">{lead.title}</h2>
            <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{lead.excerpt}</p>
          </Link>
        )}
        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rest.map((p) => (
            <Link key={p.id} to="/blog/$slug" params={{ slug: p.slug }} className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/60">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{p.kind === "event" ? "Upcoming" : "News"} · {new Date(p.publishedAt ?? p.createdAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}</span>
              <h3 className="mt-2 text-3xl">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.excerpt}</p>
            </Link>
          ))}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
