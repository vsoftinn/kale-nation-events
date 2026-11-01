import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getPrograms } from "@/lib/public.functions";

/** Auto-rotating upcoming events; pauses while hovered/touched/focused. */
export function UpcomingStrip() {
  const { data: programs } = useQuery({ queryKey: ["programs"], queryFn: () => getPrograms(), staleTime: 60_000 });
  const now = Date.now();
  const events = (programs ?? [])
    .flatMap((p) => p.events.filter((e) => e.published && new Date(e.date).getTime() > now).map((e) => ({ ...e, programName: p.name })))
    .sort((a, b) => a.date.localeCompare(b.date));
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || events.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % events.length), 3500);
    return () => clearInterval(t);
  }, [paused, events.length]);
  if (!events.length) return null;
  const ev = events[i % events.length]!;
  return (
    <div
      className="border-y border-border bg-card/60"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
        <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">⚡ Upcoming</span>
        <Link key={ev.id} to="/events/$id" params={{ id: ev.id }} className="animate-rise flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 hover:text-primary">
          <span className="font-display text-2xl">{ev.title}</span>
          <span className="truncate text-sm text-muted-foreground">
            {new Date(ev.date).toLocaleDateString("en-KE", { dateStyle: "medium", timeZone: "Africa/Nairobi" })} · {ev.venue}, {ev.city} · {ev.programName}
          </span>
        </Link>
        <Link to="/events/$id" params={{ id: ev.id }} className="shrink-0 text-sm font-bold uppercase tracking-wider text-primary">Tickets →</Link>
      </div>
    </div>
  );
}
