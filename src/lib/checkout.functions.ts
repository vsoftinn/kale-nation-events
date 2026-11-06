import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { activePhase, orderTotal, tierStatus } from "./pricing";
import { mapTier } from "./catalog";

export const startCheckout = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      tierId: z.string().uuid(), qty: z.number().int().min(1).max(10),
      holder: z.string().trim().min(2).max(60), phone: z.string().max(20),
      email: z.string().trim().email().max(254), whatsapp: z.string().max(20),
      provider: z.enum(["mpesa", "paystack"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizePhone, stkPush } = await import("./mpesa.server");
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Enter a valid Safaricom number, e.g. 0712 345 678");
    const whatsapp = data.whatsapp.trim() ? normalizePhone(data.whatsapp) : null;
    if (data.whatsapp.trim() && !whatsapp) throw new Error("Enter a valid WhatsApp number, e.g. 0712 345 678");
    const { data: row } = await supabaseAdmin.from("ticket_tiers").select("*, price_phases(*), events(id, title)").eq("id", data.tierId).maybeSingle();
    if (!row) throw new Error("Ticket not found");
    const tier = mapTier(row);
    const phase = activePhase(tier);
    if (tierStatus(tier) !== "on-sale" || !phase) throw new Error("These tickets are no longer on sale");
    const { qty, total } = orderTotal(phase.price, data.qty, tier.quantity - tier.sold);
    if (qty < 1) throw new Error("Sold out");
    const { data: order, error } = await supabaseAdmin.from("ticket_orders").insert({
      event_id: row.event_id, tier_id: tier.id, tier_name: tier.name, quantity: qty, unit_price: phase.price, total,
      holder: data.holder, phone, email: data.email.trim().toLowerCase(), whatsapp, provider: data.provider,
    }).select("id").single();
    if (error) throw new Error(error.message);
    try {
      let checkoutId: string;
      let paymentUrl: string | undefined;
      if (data.provider === "mpesa") {
        checkoutId = await stkPush({ phone, amount: total, reference: "KaleeNation", desc: "Tickets" });
      } else {
        const { paystackInit } = await import("./paystack.server");
        const callbackUrl = `https://kale-ticket-garden.lovable.app/events/${row.event_id}?reference=${encodeURIComponent(order.id)}`;
        paymentUrl = await paystackInit({
          email: data.email.trim().toLowerCase(), amount: total, reference: order.id, callbackUrl,
          metadata: { orderId: order.id, eventId: row.event_id },
        });
        checkoutId = order.id;
      }
      await supabaseAdmin.from("ticket_orders").update({ checkout_request_id: checkoutId }).eq("id", order.id);
      return { orderId: order.id, total, qty, paymentUrl };
    } catch (e) {
      await supabaseAdmin.from("ticket_orders").update({ status: "failed", result_desc: (e as Error).message }).eq("id", order.id);
      throw e;
    }
  });

export const orderStatus = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { paystackVerify } = await import("./paystack.server");
    const { completeAndDeliver } = await import("./delivery.server");
    const sel = "id, provider, status, codes, result_desc, holder, tier_name, unit_price, total, checkout_request_id, created_at, quantity";
    let { data: o } = await supabaseAdmin.from("ticket_orders").select(sel).eq("id", data.orderId).eq("email", data.email.trim().toLowerCase()).maybeSingle();
    if (!o) throw new Error("Order not found");
    // A verified provider result, never a browser callback, is what issues tickets.
    if (o.status === "pending" && o.checkout_request_id && Date.now() - +new Date(o.created_at) > 5_000) {
      try {
        const q = o.provider === "paystack"
          ? await paystackVerify(o.checkout_request_id)
          : await (await import("./mpesa.server")).stkQuery(o.checkout_request_id);
        if (q.done) {
          if (q.ok) {
            const amount = "amount" in q ? q.amount : o.total;
            if (amount === o.total) await completeAndDeliver(o.checkout_request_id, o.checkout_request_id, o.quantity);
            else await supabaseAdmin.from("ticket_orders").update({ status: "failed", result_desc: "Amount mismatch" }).eq("id", o.id).eq("status", "pending");
          } else {
            await supabaseAdmin.from("ticket_orders").update({ status: "failed", result_desc: q.desc }).eq("id", o.id).eq("status", "pending");
          }
          const refreshed = await supabaseAdmin.from("ticket_orders").select(sel).eq("id", o.id).single();
          if (refreshed.error) throw new Error("Could not refresh order status");
          o = refreshed.data;
        }
      } catch { /* keep waiting */ }
    }
    return { status: o.status, codes: o.codes, message: o.result_desc, holder: o.holder, tierName: o.tier_name, unitPrice: o.unit_price, total: o.total };
  });
