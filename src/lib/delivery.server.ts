// Sends issued tickets to the buyer after payment. Server-only.
import { ticketCode } from "./mpesa.server";

const GATEWAY = "https://connector-gateway.lovable.dev/whatsapp";
const TEMPLATE = "ticket_order_confirmation"; // Meta approval is required before proactive delivery.

/** Mark order paid (idempotent via complete_ticket_order) then deliver tickets once. */
export async function completeAndDeliver(reference: string, receipt: string, quantity: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.rpc("complete_ticket_order", { _checkout: reference, _receipt: receipt, _codes: Array.from({ length: quantity }, ticketCode) });
  const { data: o } = await supabaseAdmin.from("ticket_orders").select("id").eq("checkout_request_id", reference).eq("status", "paid").maybeSingle();
  if (o) await deliverTickets(o.id);
}

export async function deliverTickets(orderId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Claim once so retries/callback + polling don't double-send.
  const { data: o, error: claimError } = await supabaseAdmin.from("ticket_orders")
    .update({ delivery_claimed_at: new Date().toISOString() })
    .eq("id", orderId).eq("status", "paid").is("delivery_claimed_at", null)
    .select("id, holder, codes, quantity, tier_name, whatsapp, email, events(title, venue, city, date)").maybeSingle();
  if (claimError) throw new Error(`Could not reserve ticket delivery: ${claimError.message}`);
  if (!o) return;
  const ev = (o as any).events as { title: string; venue: string; city: string; date: string } | null;
  const title = ev?.title ?? "your event";
  const codes = (o.codes ?? []).join(", ");

  if (o.whatsapp) {
    try {
      const id = await sendWhatsApp(o.whatsapp, o.holder, title, codes);
      const { error } = await supabaseAdmin.from("ticket_orders").update({ whatsapp_message_id: id, whatsapp_status: "accepted" }).eq("id", o.id);
      if (error) throw new Error(`Could not save WhatsApp delivery status: ${error.message}`);
    } catch (e) {
      console.error("WhatsApp ticket send failed", (e as Error).message);
      await supabaseAdmin.from("ticket_orders").update({ whatsapp_status: "template_approval_required", whatsapp_error: (e as Error).message.slice(0, 500) }).eq("id", o.id);
    }
  }
  if (o.email) {
    // Email sending switches on once the sender domain is verified.
    await supabaseAdmin.from("ticket_orders").update({ email_status: "waiting_for_domain" }).eq("id", o.id);
  }
}

async function post(body: unknown) {
  const lk = process.env["LOVABLE_API_KEY"], wk = process.env["WHATSAPP_API_KEY"];
  if (!lk || !wk) throw new Error("WhatsApp is not configured");
  const r = await fetch(`${GATEWAY}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": wk, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`WhatsApp ${r.status}: ${t}`);
  return (JSON.parse(t) as { messages?: { id: string }[] }).messages?.[0]?.id ?? "";
}

async function sendWhatsApp(to: string, name: string, title: string, codes: string) {
  return post({
    messaging_product: "whatsapp", to, type: "template",
    template: { name: TEMPLATE, language: { code: "en" }, components: [{ type: "body", parameters: [name, title, codes].map((text) => ({ type: "text", text })) }] },
  });
}
