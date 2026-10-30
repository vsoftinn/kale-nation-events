import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createFirstSuperadmin, needsSetup } from "@/lib/admin.functions";
import { RunnerBolt } from "@/components/Loader";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Team Sign In — Kalee Nation" },
      { name: "description", content: "Sign in for Kalee Nation program admins." },
      { property: "og:title", content: "Kalee Nation Team Sign In" },
      { property: "og:description", content: "Admins only." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthPage,
});

const input = "w-full rounded-md border border-input bg-background px-3 py-2.5";

function AuthPage() {
  const navigate = useNavigate();
  const setupFn = useServerFn(needsSetup);
  const createFn = useServerFn(createFirstSuperadmin);
  const { data: setup } = useQuery({ queryKey: ["needs-setup"], queryFn: () => setupFn() });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim();
    const password = String(f.get("password"));
    setErr(""); setBusy(true);
    try {
      if (setup) await createFn({ data: { email, password } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/admin" });
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Sign in failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-8">
        <RunnerBolt className="h-12 w-14 text-primary" />
        <h1 className="text-5xl">{setup ? "Create super admin" : "Team sign in"}</h1>
        <p className="text-sm text-muted-foreground">{setup ? "First-time setup: this account will control the whole platform." : "Admins only. Logins are issued by the super admin."}</p>
        <input name="email" type="email" placeholder="Email" className={input} required />
        <input name="password" type="password" placeholder="Password" minLength={8} className={input} required />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button disabled={busy} className="w-full rounded-md bg-bolt py-3 font-bold uppercase text-primary-foreground">{busy ? "…" : setup ? "Create & sign in" : "Sign in"}</button>
      </form>
    </div>
  );
}
