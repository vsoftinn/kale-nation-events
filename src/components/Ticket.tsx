import { QRCodeSVG } from "qrcode.react";
import type { EventItem, Program } from "@/lib/catalog";
import { ksh } from "@/lib/pricing";

export function Ticket({
  program, event, tierName, price, holder, code,
}: { program: Program; event: EventItem; tierName: string; price: number; holder: string; code: string }) {
  const d = new Date(event.date);
  return (
    <div className="relative mx-auto flex w-full max-w-2xl overflow-hidden rounded-xl bg-paper text-paper-foreground shadow-glow">
      {/* watermark */}
      <div className="pointer-events-none absolute inset-0 flex select-none flex-wrap content-center gap-x-8 gap-y-2 opacity-[0.07] -rotate-12 scale-125">
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i} className="font-display text-3xl">{program.name.toUpperCase()}</span>
        ))}
      </div>
      <div className="relative flex-1 p-6">
        <div className="bead-strip absolute inset-x-0 top-0 h-2" />
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.3em] opacity-70">Kalee Nation presents</p>
        <h3 className="mt-1 text-4xl leading-none">{event.title}</h3>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-[10px] uppercase opacity-60">Date</p><p className="font-semibold">{d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</p></div>
          <div><p className="text-[10px] uppercase opacity-60">Gates</p><p className="font-semibold">{d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</p></div>
          <div><p className="text-[10px] uppercase opacity-60">Venue</p><p className="font-semibold">{event.venue}, {event.city}</p></div>
          <div><p className="text-[10px] uppercase opacity-60">Holder</p><p className="font-semibold">{holder}</p></div>
        </div>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-paper-foreground px-3 py-1 text-xs font-bold uppercase tracking-wider text-paper">
          {tierName} · {ksh(price)}
        </div>
      </div>
      {/* perforation */}
      <div className="relative w-0 border-l-2 border-dashed border-paper-foreground/30">
        <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-background" />
        <span className="absolute -bottom-3 -left-3 h-6 w-6 rounded-full bg-background" />
      </div>
      <div className="relative flex w-44 flex-col items-center justify-center gap-2 p-4">
        <QRCodeSVG value={`KALEE:${event.id}:${code}`} size={120} bgColor="transparent" fgColor="currentColor" level="H" />
        <p className="font-mono text-[10px] tracking-widest">{code}</p>
        <p className="text-[9px] uppercase opacity-60">Scan at gate · single entry</p>
      </div>
    </div>
  );
}
