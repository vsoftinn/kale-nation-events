import { createFileRoute } from "@tanstack/react-router";

// Safaricom calls this after the customer answers the STK prompt.
// Safety: we only act on a CheckoutRequestID we created and that is still pending.
export const Route = createFileRoute("/api/public/mpesa/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ack = Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
        let cb: any;
        try { cb = (await request.json())?.Body?.stkCallback; } catch { return ack; }
        if (!cb?.CheckoutRequestID || typeof cb.CheckoutRequestID !== "string") return ack;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: o } = await supabaseAdmin.from("ticket_orders").select("id, quantity, total, status").eq("checkout_request_id", cb.CheckoutRequestID).maybeSingle();
        if (!o || o.status !== "pending") return ack;
        if (cb.ResultCode === 0) {
          const items: { Name: string; Value?: unknown }[] = cb.CallbackMetadata?.Item ?? [];
          const amount = Number(items.find((i) => i.Name === "Amount")?.Value ?? 0);
          const receipt = String(items.find((i) => i.Name === "MpesaReceiptNumber")?.Value ?? "");
          if (amount < o.total) {
            await supabaseAdmin.from("ticket_orders").update({ status: "failed", result_desc: "Amount mismatch" }).eq("id", o.id);
            return ack;
          }
          const { completeAndDeliver } = await import("@/lib/delivery.server");
          await completeAndDeliver(cb.CheckoutRequestID, receipt, o.quantity);
        } else {
          await supabaseAdmin.from("ticket_orders").update({ status: "failed", result_desc: String(cb.ResultDesc ?? "Cancelled") }).eq("id", o.id);
        }
        return ack;
      },
    },
  },
});
