import { createFileRoute } from "@tanstack/react-router";

type PaystackWebhook = {
  event?: unknown;
  data?: { reference?: unknown };
};

function response(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export const Route = createFileRoute("/api/public/paystack/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const contentLength = Number(request.headers.get("content-length") ?? 0);
        if (contentLength > 32_768) return response("invalid payload", 413);
        const rawBody = await request.text();
        if (new TextEncoder().encode(rawBody).byteLength > 32_768) {
          return response("invalid payload", 413);
        }

        try {
          const { paystackSignatureOk, paystackVerify } = await import("@/lib/paystack.server");
          if (!(await paystackSignatureOk(rawBody, request.headers.get("x-paystack-signature")))) {
            return response("unauthorized", 401);
          }

          let event: PaystackWebhook;
          try {
            event = JSON.parse(rawBody) as PaystackWebhook;
          } catch {
            return response("invalid payload", 400);
          }
          const reference = event.data?.reference;
          if (event.event !== "charge.success" || typeof reference !== "string") {
            return response("ignored");
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: order, error: orderError } = await supabaseAdmin
            .from("ticket_orders")
            .select("id, quantity, total, status, provider")
            .eq("checkout_request_id", reference)
            .maybeSingle();
          if (orderError) throw new Error("Could not load Paystack order.");
          if (!order || order.provider !== "paystack" || order.status !== "pending") {
            return response("accepted");
          }

          const verification = await paystackVerify(reference);
          if (!verification.done) return response("verification pending", 503);
          if (!verification.ok) {
            const { error } = await supabaseAdmin
              .from("ticket_orders")
              .update({
                status: "failed",
                result_desc: verification.desc.slice(0, 250),
              })
              .eq("id", order.id)
              .eq("status", "pending");
            if (error) throw new Error("Could not record Paystack result.");
            return response("accepted");
          }
          if (
            verification.currency !== "KES" ||
            verification.amountSubunits !== order.total * 100
          ) {
            const { error } = await supabaseAdmin
              .from("ticket_orders")
              .update({
                status: "refund_pending",
                result_desc:
                  "Payment verified but amount or currency did not match; manual review required",
              })
              .eq("id", order.id)
              .eq("status", "pending");
            if (error) throw new Error("Could not record Paystack payment mismatch.");
            return response("accepted");
          }

          const { completeAndDeliver } = await import("@/lib/delivery.server");
          await completeAndDeliver(reference, reference, order.quantity);
          return response("accepted");
        } catch (error) {
          console.error(
            "[paystack-webhook] Could not process event.",
            error instanceof Error ? error.name : "UnknownError",
          );
          return response("retry", 500);
        }
      },
    },
  },
});
