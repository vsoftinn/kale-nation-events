import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookRequest } from "@lovable.dev/webhooks-js";

const RANK: Record<string, number> = { accepted: 0, sent: 1, delivered: 2, read: 3, failed: 4 };

// Lovable forwards WhatsApp delivery statuses here. Stored first, then applied to orders.
export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["WHATSAPP_API_KEY"];
        if (!secret) return new Response("not configured", { status: 500 });
        let body: string;
        try {
          const v: any = await verifyWebhookRequest({ request, secret, maxBodyBytes: 4 * 1024 * 1024 } as any);
          body = typeof v === "string" ? v : (v?.body ?? v?.rawBody ?? "");
        } catch { return new Response("unauthorized", { status: 401 }); }
        const deliveryId = request.headers.get("X-Lovable-Delivery"), event = request.headers.get("X-Lovable-Event");
        if (!deliveryId || !event) return new Response("missing headers", { status: 400 });
        let payload: any;
        try { payload = JSON.parse(body); } catch { payload = { raw: body }; }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const ins = await supabaseAdmin.from("whatsapp_webhook_events").upsert({ delivery_id: deliveryId, event, payload }, { onConflict: "delivery_id", ignoreDuplicates: true });
        if (ins.error) return new Response("store failed", { status: 500 });
        const pending = await supabaseAdmin.from("whatsapp_webhook_events").select("id, event, payload").is("processed_at", null).order("received_at").limit(20);
        for (const row of pending.data ?? []) {
          try {
            if (row.event === "whatsapp.status") {
              for (const s of (row.payload as any)?.entry?.[0]?.changes?.[0]?.value?.statuses ?? []) {
                const { data: o } = await supabaseAdmin.from("ticket_orders").select("id, whatsapp_status").eq("whatsapp_message_id", s.id).maybeSingle();
                if (!o) continue;
                if ((RANK[s.status] ?? 0) >= (RANK[o.whatsapp_status ?? "accepted"] ?? 0))
                  await supabaseAdmin.from("ticket_orders").update({ whatsapp_status: s.status, whatsapp_error: s.errors ? JSON.stringify(s.errors).slice(0, 500) : null }).eq("id", o.id);
              }
            }
            await supabaseAdmin.from("whatsapp_webhook_events").update({ processed_at: new Date().toISOString() }).eq("id", row.id);
          } catch (e) {
            await supabaseAdmin.from("whatsapp_webhook_events").update({ processing_error: (e as Error).message }).eq("id", row.id);
          }
        }
        return new Response("ok");
      },
    },
  },
});
