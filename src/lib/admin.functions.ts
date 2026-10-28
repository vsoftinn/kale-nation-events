import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function superadminCount() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "superadmin");
  return count ?? 0;
}

/** True only until the first super admin account exists. */
export const needsSetup = createServerFn({ method: "GET" }).handler(async () => (await superadminCount()) === 0);

export const createFirstSuperadmin = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string }) => {
    if (!/^\S+@\S+\.\S+$/.test(d.email) || d.password.length < 8) throw new Error("Enter a valid email and a password of 8+ characters");
    return d;
  })
  .handler(async ({ data }) => {
    if ((await superadminCount()) > 0) throw new Error("Setup already completed");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error } = await supabaseAdmin.auth.admin.createUser({ email: data.email, password: data.password, email_confirm: true });
    if (error || !u.user) throw new Error(error?.message ?? "Could not create account");
    await supabaseAdmin.from("user_roles").insert({ user_id: u.user.id, role: "superadmin" });
    return { ok: true };
  });

async function assertSuperadmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "superadmin" });
  if (!data) throw new Error("Only the super admin can do this");
}

export const createAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; password: string; programId: string }) => {
    if (!/^\S+@\S+\.\S+$/.test(d.email) || d.password.length < 8 || !d.programId) throw new Error("Email, 8+ character password and a program are required");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error } = await supabaseAdmin.auth.admin.createUser({ email: data.email, password: data.password, email_confirm: true });
    if (error || !u.user) throw new Error(error?.message ?? "Could not create login");
    await supabaseAdmin.from("user_roles").insert({ user_id: u.user.id, role: "admin" });
    await supabaseAdmin.from("program_admins").insert({ user_id: u.user.id, program_id: data.programId, email: data.email });
    return { ok: true };
  });

export const removeAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context);
    if (data.userId === context.userId) throw new Error("You can't remove yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("program_admins").delete().eq("user_id", data.userId);
    await supabaseAdmin.auth.admin.deleteUser(data.userId);
    return { ok: true };
  });

export const runAutomationNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperadmin(context);
    const { runAutomation } = await import("./automation.server");
    return runAutomation({ force: true });
  });
