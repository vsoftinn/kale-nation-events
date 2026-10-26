import { useEffect, useState } from "react";

export function RunnerBolt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 100" className={className} aria-hidden>
      <g className="animate-run-bob" fill="currentColor">
        <circle cx="68" cy="14" r="9" />
        <path d="M60 26 L44 50 L58 54 L52 80 L62 82 L70 54 L84 62 L94 50 L78 44 L74 30 Z" />
        <path d="M44 50 L26 46 L24 54 L46 60 Z" />
        <path d="M52 80 L38 92 L44 98 L60 84 Z" />
      </g>
      <path
        className="animate-bolt text-primary"
        fill="currentColor"
        d="M18 4 L4 34 H16 L8 60 L34 24 H20 L30 4 Z"
      />
      <path
        className="animate-bolt text-primary"
        style={{ animationDelay: ".4s" }}
        fill="currentColor"
        d="M104 10 L96 28 H104 L98 44 L114 22 H106 L112 10 Z"
      />
    </svg>
  );
}

export function Loader() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 1400);
    return () => clearTimeout(t);
  }, []);
  if (done) return null;
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background transition-opacity">
      <RunnerBolt className="h-32 w-40 text-foreground" />
      <div className="h-1 w-56 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full w-full animate-track"
          style={{ backgroundImage: "repeating-linear-gradient(90deg, var(--primary) 0 40px, transparent 40px 80px)" }}
        />
      </div>
      <p className="font-display text-2xl tracking-[0.3em]">KALEE NATION</p>
    </div>
  );
}
