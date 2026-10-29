import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { RunnerBolt } from "@/components/Loader";

export const Route = createFileRoute("/organizers")({
  head: () => ({
    meta: [
      { title: "Sell Tickets Online with Kalee Nation — For Event Organizers" },
      { name: "description", content: "Post your event on Kalee Nation, get your own dashboard, set automatic price changes and sell QR tickets online." },
      { property: "og:title", content: "Sell your event tickets on Kalee Nation" },
      { property: "og:description", content: "Your own dashboard, automatic pricing, QR tickets and our audience." },
    ],
  }),
  component: Organizers,
});

const perks = [
  ["Your own dashboard", "Post events, set ticket types and prices, and close sales whenever you want. Only your team sees it."],
  ["Automatic price changes", "Schedule Early Bird → Advance → Gate pricing. Prices change by themselves at the time you set."],
  ["Secure QR tickets", "Every ticket carries your event watermark and a unique QR code for single-scan entry."],
  ["Our audience", "We feature your event in Kalee Nation news and across our channels so more people buy."],
];

const input = "w-full rounded-md border border-input bg-background px-3 py-2.5";

function Organizers() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const row = {
      name: String(f.get("name") ?? "").trim().slice(0, 120),
      organization: String(f.get("organization") ?? "").trim().slice(0, 120),
      email: String(f.get("email") ?? "").trim().slice(0, 200),
      phone: String(f.get("phone") ?? "").trim().slice(0, 40),
      event_type: String(f.get("event_type") ?? "").slice(0, 60),
      message: String(f.get("message") ?? "").trim().slice(0, 2000),
    };
    if (!row.name || !/^\S+@\S+\.\S+$/.test(row.email)) { setErr("Please add your name and a valid email."); setState("error"); return; }
    setState("sending");
    const { error } = await supabase.from("organizer_applications").insert(row);
    if (error) { setErr("Couldn't send — please try again."); setState("error"); } else setState("sent");
  }
  return (
    <div>
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-32">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-primary">For event organizers</p>
        <h1 className="mt-2 max-w-5xl text-7xl leading-[0.9] sm:text-8xl">Your event. <span className="text-bolt">Our nation.</span> Sold out.</h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">Festival, concert, club night, conference or wedding expo — list it on Kalee Nation and let people buy tickets online in seconds.</p>
      </section>
      <section className="mx-auto grid max-w-7xl gap-6 px-4 md:grid-cols-2 lg:grid-cols-4">
        {perks.map(([t, d], i) => (
          <div key={t} className="rounded-2xl border border-border bg-card p-6">
            <p className="font-display text-5xl text-primary/50">0{i + 1}</p>
            <h3 className="mt-3 text-3xl">{t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>

      <section id="apply" className="mx-auto mt-24 max-w-3xl px-4 pb-24">
        <div className="rounded-2xl border border-primary/40 bg-card p-8 shadow-glow">
          <RunnerBolt className="h-12 w-14 text-primary" />
          <h2 className="mt-3 text-5xl">Apply to sell on Kalee Nation</h2>
          <p className="text-muted-foreground">We review every application and send your dashboard login once approved.</p>
          {state === "sent" ? (
            <p className="mt-8 rounded-lg bg-secondary p-6 text-lg">⚡ Thanks! Your application is in. The Kalee team will contact you soon.</p>
          ) : (
            <form onSubmit={submit} className="mt-8 grid gap-4 sm:grid-cols-2">
              <input name="name" placeholder="Your name *" className={input} maxLength={120} required />
              <input name="organization" placeholder="Organization / brand" className={input} maxLength={120} />
              <input name="email" type="email" placeholder="Email *" className={input} maxLength={200} required />
              <input name="phone" placeholder="Phone / WhatsApp" className={input} maxLength={40} />
              <select name="event_type" className={`${input} sm:col-span-2`} defaultValue="Festival / concert">
                {["Festival / concert", "Club night", "Wedding / pre-wedding", "Corporate event", "Other"].map((o) => <option key={o}>{o}</option>)}
              </select>
              <textarea name="message" placeholder="Tell us about your event" rows={4} className={`${input} sm:col-span-2`} maxLength={2000} />
              {state === "error" && <p className="text-destructive sm:col-span-2">{err}</p>}
              <button disabled={state === "sending"} className="rounded-md bg-bolt px-8 py-4 font-bold uppercase tracking-wider text-primary-foreground sm:col-span-2">
                {state === "sending" ? "Sending…" : "Send application"}
              </button>
            </form>
          )}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
