import { createFileRoute } from "@tanstack/react-router";

// Paystack posts charge.success here. Signature verified before anything is trusted.
export const Route = createFileRoute("/api/public/paystack/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const { paystackSignatureOk, paystackVerify } = await import("@/lib/paystack.server");
        if (!(await paystackSignatureOk(raw, request.headers.get("x-paystack-signature")))) return new Response("bad signature", { status: 401 });
        let ev: any;
        try { ev = JSON.parse(raw); } catch { return new Response("ok"); }
        const ref = ev?.data?.reference;
        if (ev?.event !== "charge.success" || typeof ref !== "string") return new Response("ok");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: o } = await supabaseAdmin.from("ticket_orders").select("id, quantity, total, status").eq("checkout_request_id", ref).eq("provider", "paystack").maybeSingle();
        if (!o || o.status !== "pending") return new Response("ok");
        const v = await paystackVerify(ref);
        if (!v.done) return new Response("retry", { status: 500 });
        if (!v.ok || v.amount < o.total) {
          await supabaseAdmin.from("ticket_orders").update({ status: "failed", result_desc: v.ok ? "Amount mismatch" : v.desc }).eq("id", o.id);
          return new Response("ok");
        }
        const { completeAndDeliver } = await import("@/lib/delivery.server");
        await completeAndDeliver(ref, ref, o.quantity);
        return new Response("ok");
      },
    },
  },
});
