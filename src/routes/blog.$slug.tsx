import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getPost } from "@/lib/public.functions";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

const postQuery = (slug: string) => queryOptions({ queryKey: ["post", slug], queryFn: () => getPost({ data: { slug } }) });

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(postQuery(params.slug)),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.title} — Kalee Nation` : "News — Kalee Nation" },
      { name: "description", content: loaderData?.excerpt ?? "Kalee Nation news." },
      { property: "og:title", content: loaderData?.title ?? "Kalee Nation news" },
      { property: "og:description", content: loaderData?.excerpt ?? "Kalee Nation news." },
      { property: "og:type", content: "article" },
    ],
  }),
  component: PostPage,
  errorComponent: ({ error }) => <p className="p-24 text-center">{error.message}</p>,
  notFoundComponent: () => <div className="p-24 text-center"><h1 className="text-5xl">Post not found</h1><Link to="/blog" className="text-primary">All news</Link></div>,
});

function PostPage() {
  const { slug } = Route.useParams();
  const { data: p } = useSuspenseQuery(postQuery(slug));
  return (
    <div>
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-4 pb-24 pt-32">
        <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground">← All news</Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-widest text-primary">{p.kind === "event" ? "Upcoming event" : "News"} · {new Date(p.publishedAt ?? p.createdAt).toLocaleDateString("en-KE", { dateStyle: "long" })}</p>
        <h1 className="mt-2 text-6xl sm:text-7xl">{p.title}</h1>
        <p className="mt-4 text-xl text-muted-foreground">{p.excerpt}</p>
        <div className="bead-strip my-8 h-1.5" />
        <div className="space-y-4 text-lg leading-relaxed">
          {p.body.split(/\n+/).map((para, i) => <p key={i}>{para}</p>)}
        </div>
        {p.eventId && (
          <Link to="/events/$id" params={{ id: p.eventId }} className="mt-10 inline-block rounded-md bg-bolt px-8 py-4 font-bold uppercase tracking-wider text-primary-foreground shadow-glow">Get tickets</Link>
        )}
      </article>
      <SiteFooter />
    </div>
  );
}
