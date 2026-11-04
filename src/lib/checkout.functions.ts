import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { activePhase, orderTotal, tierStatus } from "./pricing";
import { mapTier } from "./catalog";

export const startCheckout = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ tierId: z.string().uuid(), qty: z.number().int().min(1).max(10), holder: z.string().trim().min(2).max(60), phone: z.string().max(20) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizePhone, stkPush } = await import("./mpesa.server");
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Enter a valid Safaricom number, e.g. 0712 345 678");
    const { data: row } = await supabaseAdmin.from("ticket_tiers").select("*, price_phases(*), events(id, title)").eq("id", data.tierId).maybeSingle();
    if (!row) throw new Error("Ticket not found");
    const tier = mapTier(row);
    const phase = activePhase(tier);
    if (tierStatus(tier) !== "on-sale" || !phase) throw new Error("These tickets are no longer on sale");
    const { qty, total } = orderTotal(phase.price, data.qty, tier.quantity - tier.sold);
    if (qty < 1) throw new Error("Sold out");
    const { data: order, error } = await supabaseAdmin.from("ticket_orders").insert({
      event_id: row.event_id, tier_id: tier.id, tier_name: tier.name, quantity: qty, unit_price: phase.price, total, holder: data.holder, phone,
    }).select("id").single();
    if (error) throw new Error(error.message);
    try {
      const checkoutId = await stkPush({ phone, amount: total, reference: "KaleeNation", desc: "Tickets" });
      await supabaseAdmin.from("ticket_orders").update({ checkout_request_id: checkoutId }).eq("id", order.id);
    } catch (e) {
      await supabaseAdmin.from("ticket_orders").update({ status: "failed", result_desc: (e as Error).message }).eq("id", order.id);
      throw e;
    }
    return { orderId: order.id, total, qty };
  });

export const orderStatus = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sel = "status, codes, result_desc, holder, tier_name, unit_price, total, checkout_request_id, created_at";
    let { data: o } = await supabaseAdmin.from("ticket_orders").select(sel).eq("id", data.orderId).maybeSingle();
    if (!o) throw new Error("Order not found");
    // Callback may not reach us (e.g. preview); after 20s ask Safaricom directly.
    if (o.status === "pending" && o.checkout_request_id && Date.now() - +new Date(o.created_at) > 20_000) {
      const { stkQuery, ticketCode } = await import("./mpesa.server");
      try {
        const q = await stkQuery(o.checkout_request_id);
        if (q.done) {
          if (q.ok) {
            const { data: full } = await supabaseAdmin.from("ticket_orders").select("quantity").eq("id", data.orderId).single();
            await supabaseAdmin.rpc("complete_ticket_order", { _checkout: o.checkout_request_id, _receipt: "query", _codes: Array.from({ length: full!.quantity }, ticketCode) });
          } else {
            await supabaseAdmin.from("ticket_orders").update({ status: "failed", result_desc: q.desc }).eq("id", data.orderId).eq("status", "pending");
          }
          o = (await supabaseAdmin.from("ticket_orders").select(sel).eq("id", data.orderId).single()).data!;
        }
      } catch { /* keep waiting */ }
    }
    return { status: o.status, codes: o.codes, message: o.result_desc, holder: o.holder, tierName: o.tier_name, unitPrice: o.unit_price, total: o.total };
  });
