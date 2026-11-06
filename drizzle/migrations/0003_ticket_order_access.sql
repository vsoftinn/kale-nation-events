ALTER TABLE public.ticket_orders ADD COLUMN IF NOT EXISTS ticket_access_hash text;
CREATE INDEX IF NOT EXISTS ticket_orders_access_hash_idx ON public.ticket_orders(ticket_access_hash);