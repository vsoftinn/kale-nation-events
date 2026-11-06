import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const checkoutInput = z.object({
  tierId: z.string().uuid(),
  qty: z.number().int().min(1).max(10),
  holder: z.string().trim().min(2).max(60),
  provider: z.enum(["mpesa", "paystack"]).default("mpesa"),
  phone: z.string().max(30).optional(),
  email: z.string().trim().email().max(254).optional(),
});

export const startCheckout = createServerFn({ method: "POST" })
  .inputValidator((input) => checkoutInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertMpesaConfigured, normalizePhone, stkPush } = await import("./mpesa.server");
    const { assertPaystackConfigured, paystackInit } = await import("./paystack.server");
    const phone = data.provider === "mpesa" ? normalizePhone(data.phone ?? "") : null;
    const email = (data.provider === "paystack" ? data.email?.trim().toLowerCase() : null) ?? null;

    if (data.provider === "mpesa" && !phone) {
      throw new Error("Enter a valid Kenyan mobile number, such as 0712345678.");
    }
    if (data.provider === "paystack" && !email) {
      throw new Error("Enter a valid email address for your Paystack receipt.");
    }
    if (data.provider === "mpesa") assertMpesaConfigured();
    else assertPaystackConfigured();

    const reference = crypto.randomUUID();
    const { data: order, error: reserveError } = await supabaseAdmin.rpc("reserve_ticket_order", {
      _tier_id: data.tierId,
      _quantity: data.qty,
      _holder: data.holder,
      _phone: phone,
      _email: email,
      _provider: data.provider,
      _reference: reference,
    });
    if (reserveError || !order) {
      if (reserveError?.code === "PGRST202") {
        console.error(
          "[checkout] Reservation RPC is missing from the Supabase schema cache. Apply migration 0003_ticket_order_security.sql.",
        );
        throw new Error(
          "Ticket checkout is not enabled yet. The database setup is incomplete; please contact the site administrator.",
        );
      }
      console.error("[checkout] Could not reserve tickets.", reserveError?.code);
      throw new Error("Could not reserve tickets for this order.");
    }

    let providerRequestStarted = false;
    try {
      if (data.provider === "mpesa" && phone) {
        providerRequestStarted = true;
        const checkoutId = await stkPush({
          phone,
          amount: order.total,
          reference: order.id.replaceAll("-", "").slice(0, 12),
          desc: "Kalee event tickets",
        });
        const { data: savedOrder, error: saveError } = await supabaseAdmin
          .from("ticket_orders")
          .update({ checkout_request_id: checkoutId })
          .eq("id", order.id)
          .eq("status", "pending")
          .select("id")
          .maybeSingle();
        if (saveError || !savedOrder) {
          console.error("[checkout] Could not save the M-Pesa checkout ID.", saveError?.code);
          throw new Error("M-Pesa request may have been sent. Do not retry yet; contact support.");
        }
        return {
          orderId: order.id,
          authorizationUrl: null,
          pendingSetup: false,
          message: null,
        };
      }

      if (data.provider === "paystack" && email) {
        const baseUrl = (
          process.env["APP_BASE_URL"] || "https://events.v-soft-innovations.com"
        ).replace(/\/+$/, "");
        if (!baseUrl.startsWith("https://")) {
          throw new Error("The application base URL must use HTTPS.");
        }
        providerRequestStarted = true;
        const authorizationUrl = await paystackInit({
          email,
          amount: order.total,
          reference,
          callbackUrl: `${baseUrl}/events/${order.event_id}?orderId=${encodeURIComponent(order.id)}`,
          metadata: { order_id: order.id, event_id: order.event_id },
        });
        return { orderId: order.id, authorizationUrl, pendingSetup: false, message: null };
      }

      throw new Error("Unsupported payment provider.");
    } catch (error) {
      if (!providerRequestStarted) {
        const { error: statusError } = await supabaseAdmin
          .from("ticket_orders")
          .update({ status: "failed", result_desc: "Payment setup failed" })
          .eq("id", order.id)
          .eq("status", "pending");
        if (statusError) {
          console.error("[checkout] Could not release the ticket reservation.", statusError.code);
        }
      }
      if (
        error instanceof Error &&
        (error.message.startsWith("Enter a valid Kenyan") ||
          error.message.startsWith("M-Pesa request may have been sent."))
      ) {
        throw error;
      }
      console.error(
        "[checkout] Provider checkout could not be confirmed.",
        error instanceof Error ? error.name : "UnknownError",
      );
      if (providerRequestStarted) {
        return {
          orderId: order.id,
          authorizationUrl: null,
          pendingSetup: true,
          message: "Payment setup may still be processing. Do not retry yet; contact support.",
        };
      }
      throw new Error("Could not start payment. Please try again or contact support.");
    }
  });

export const orderStatus = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const select =
      "id, status, codes, result_desc, holder, tier_name, unit_price, total, quantity, provider, checkout_request_id, created_at";
    const { data: order, error: orderError } = await supabaseAdmin
      .from("ticket_orders")
      .select(select)
      .eq("id", data.orderId)
      .maybeSingle();
    if (orderError || !order) {
      console.error("[checkout] Could not load payment status.", orderError?.code);
      throw new Error("Could not find this ticket order.");
    }

    if (
      order.status === "pending" &&
      order.checkout_request_id &&
      Date.now() - Date.parse(order.created_at) > 20_000
    ) {
      try {
        if (order.provider === "mpesa") {
          const { stkQuery } = await import("./mpesa.server");
          const result = await stkQuery(order.checkout_request_id);
          if (result.done) {
            if (result.ok) {
              const { completeAndDeliver } = await import("./delivery.server");
              await completeAndDeliver(
                order.checkout_request_id,
                `STK-QUERY-${order.checkout_request_id}`,
                order.quantity,
              );
            } else {
              await markOrderStatus(order.id, "failed", result.desc);
            }
          }
        } else if (order.provider === "paystack") {
          const { paystackVerify } = await import("./paystack.server");
          const result = await paystackVerify(order.checkout_request_id);
          if (result.done) {
            if (
              result.ok &&
              result.currency === "KES" &&
              result.amountSubunits === order.total * 100
            ) {
              const { completeAndDeliver } = await import("./delivery.server");
              await completeAndDeliver(
                order.checkout_request_id,
                order.checkout_request_id,
                order.quantity,
              );
            } else if (result.ok) {
              await markOrderStatus(
                order.id,
                "refund_pending",
                "Payment amount or currency mismatch; manual refund review required",
              );
            } else {
              await markOrderStatus(order.id, "failed", result.desc);
            }
          }
        }
      } catch (error) {
        console.error(
          "[checkout] Provider payment status check failed.",
          error instanceof Error ? error.name : "UnknownError",
        );
      }
    }

    const { data: current, error: currentError } = await supabaseAdmin
      .from("ticket_orders")
      .select(select)
      .eq("id", order.id)
      .single();
    if (currentError || !current) {
      console.error("[checkout] Could not reload payment status.", currentError?.code);
      throw new Error("Could not load this payment status.");
    }
    return {
      status: current.status,
      provider: current.provider,
      codes: current.status === "paid" ? current.codes : [],
      message: current.result_desc,
      holder: current.holder,
      tierName: current.tier_name,
      unitPrice: current.unit_price,
      total: current.total,
    };
  });

async function markOrderStatus(
  orderId: string,
  status: "failed" | "refund_pending",
  message: string,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("ticket_orders")
    .update({ status, result_desc: message.slice(0, 250) })
    .eq("id", orderId)
    .eq("status", "pending");
  if (error) {
    console.error("[checkout] Could not update ticket order status.", error.code);
    throw new Error("Could not update ticket order status.");
  }
}
