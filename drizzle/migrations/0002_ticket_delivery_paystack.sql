ALTER TABLE public.ticket_orders
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'mpesa',
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS delivery_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_message_id text,
  ADD COLUMN IF NOT EXISTS whatsapp_status text,
  ADD COLUMN IF NOT EXISTS whatsapp_error text,
  ADD COLUMN IF NOT EXISTS email_status text;
CREATE INDEX IF NOT EXISTS ticket_orders_wa_msg ON public.ticket_orders(whatsapp_message_id);

CREATE TABLE public.whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id text NOT NULL UNIQUE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text
);
GRANT SELECT ON public.whatsapp_webhook_events TO authenticated;
GRANT ALL ON public.whatsapp_webhook_events TO service_role;
ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmins read whatsapp events" ON public.whatsapp_webhook_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));