import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Post } from "@/lib/catalog";

/** Rotates through published news & upcoming-event posts, three at a time. */
export function NewsTicker({ posts }: { posts: Post[] }) {
  const [start, setStart] = useState(0);
  useEffect(() => {
    if (posts.length <= 3) return;
    const t = setInterval(() => setStart((s) => (s + 1) % posts.length), 5000);
    return () => clearInterval(t);
  }, [posts.length]);
  if (!posts.length) return null;
  const visible = Array.from({ length: Math.min(3, posts.length) }, (_, i) => posts[(start + i) % posts.length]);
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {visible.map((p) => (
        <Link key={`${p.id}-${start}`} to="/blog/$slug" params={{ slug: p.slug }}
          className="group animate-rise rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/60 hover:shadow-glow">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${p.kind === "event" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
            {p.kind === "event" ? "Upcoming" : "News"}
          </span>
          <h3 className="mt-4 text-3xl leading-tight">{p.title}</h3>
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.excerpt}</p>
          <span className="mt-4 inline-block text-sm font-bold uppercase tracking-wider text-primary transition-transform group-hover:translate-x-1">Read →</span>
        </Link>
      ))}
    </div>
  );
}
