import { ticketCode } from "./mpesa.server";

export async function completeAndDeliver(
  reference: string,
  receipt: string,
  quantity: number,
): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: completed, error: completionError } = await supabaseAdmin.rpc(
    "complete_ticket_order",
    {
      _checkout: reference,
      _receipt: receipt,
      _codes: Array.from({ length: quantity }, ticketCode),
    },
  );
  if (completionError) {
    console.error("[ticket-delivery] Could not complete paid order.", completionError.code);
    throw new Error("Could not issue tickets for the verified payment.");
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("ticket_orders")
    .select("id, status")
    .eq("checkout_request_id", reference)
    .maybeSingle();
  if (orderError || !order) {
    console.error("[ticket-delivery] Could not reload completed order.", orderError?.code);
    throw new Error("Could not confirm ticket order status.");
  }
  if (order.status === "paid") await deliverTickets(order.id);
  return completed && order.status === "paid";
}

async function deliverTickets(orderId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order, error } = await supabaseAdmin
    .from("ticket_orders")
    .update({ delivery_claimed_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "paid")
    .is("delivery_claimed_at", null)
    .select("id, email")
    .maybeSingle();
  if (error) {
    console.error("[ticket-delivery] Could not claim ticket delivery.", error.code);
    throw new Error("Could not prepare ticket delivery.");
  }
  if (!order) return;

  if (order.email) {
    const { error: emailError } = await supabaseAdmin
      .from("ticket_orders")
      .update({ email_status: "waiting_for_domain" })
      .eq("id", order.id);
    if (emailError) {
      console.error("[ticket-delivery] Could not record email delivery status.", emailError.code);
      throw new Error("Could not record ticket delivery status.");
    }
  }
}
