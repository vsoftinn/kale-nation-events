import { createFileRoute } from "@tanstack/react-router";

type CallbackItem = { Name?: unknown; Value?: unknown };
type StkCallback = {
  CheckoutRequestID?: unknown;
  ResultCode?: unknown;
  ResultDesc?: unknown;
  CallbackMetadata?: { Item?: CallbackItem[] };
};
type CallbackBody = { Body?: { stkCallback?: StkCallback } };

function response(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export const Route = createFileRoute("/api/public/mpesa/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const contentLength = Number(request.headers.get("content-length") ?? 0);
        if (contentLength > 32_768) return response({ ResultCode: 1 }, 413);

        const rawBody = await request.text();
        if (new TextEncoder().encode(rawBody).byteLength > 32_768) {
          return response({ ResultCode: 1 }, 413);
        }

        let payload: CallbackBody;
        try {
          payload = JSON.parse(rawBody) as CallbackBody;
        } catch {
          return response({ ResultCode: 1 }, 400);
        }
        const callback = payload.Body?.stkCallback;
        const checkoutId = callback?.CheckoutRequestID;
        if (typeof checkoutId !== "string" || checkoutId.length > 100) {
          return response({ ResultCode: 1 }, 400);
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: order, error: orderError } = await supabaseAdmin
            .from("ticket_orders")
            .select("id, quantity, total, status, provider")
            .eq("checkout_request_id", checkoutId)
            .maybeSingle();
          if (orderError) throw new Error("Could not load M-Pesa order.");
          if (!order || order.provider !== "mpesa" || order.status !== "pending") {
            return response({ ResultCode: 0, ResultDesc: "Accepted" });
          }

          const { stkQuery } = await import("@/lib/mpesa.server");
          const verification = await stkQuery(checkoutId);
          if (!verification.done) {
            return response({ ResultCode: 1, ResultDesc: "Payment verification pending" }, 503);
          }
          if (!verification.ok) {
            const { error } = await supabaseAdmin
              .from("ticket_orders")
              .update({
                status: "failed",
                result_desc: verification.desc.slice(0, 250),
              })
              .eq("id", order.id)
              .eq("status", "pending");
            if (error) throw new Error("Could not record M-Pesa result.");
            return response({ ResultCode: 0, ResultDesc: "Accepted" });
          }

          const items = callback?.CallbackMetadata?.Item ?? [];
          const amount = Number(items.find((item) => item.Name === "Amount")?.Value);
          const receipt = items.find((item) => item.Name === "MpesaReceiptNumber")?.Value;
          if (
            String(callback?.ResultCode) !== "0" ||
            amount !== order.total ||
            typeof receipt !== "string" ||
            !/^[A-Z0-9]{5,20}$/.test(receipt)
          ) {
            const { error } = await supabaseAdmin
              .from("ticket_orders")
              .update({
                status: "refund_pending",
                result_desc: "Payment verified but details did not match; manual review required",
              })
              .eq("id", order.id)
              .eq("status", "pending");
            if (error) throw new Error("Could not record M-Pesa payment mismatch.");
            return response({ ResultCode: 0, ResultDesc: "Accepted" });
          }

          const { completeAndDeliver } = await import("@/lib/delivery.server");
          await completeAndDeliver(checkoutId, receipt, order.quantity);
          return response({ ResultCode: 0, ResultDesc: "Accepted" });
        } catch (error) {
          console.error(
            "[mpesa-callback] Could not process callback.",
            error instanceof Error ? error.name : "UnknownError",
          );
          return response({ ResultCode: 1, ResultDesc: "Callback processing failed" }, 500);
        }
      },
    },
  },
});
