CREATE TABLE public.ticket_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  tier_id uuid NOT NULL,
  tier_name text NOT NULL,
  quantity int NOT NULL CHECK (quantity BETWEEN 1 AND 10),
  unit_price int NOT NULL,
  total int NOT NULL,
  holder text NOT NULL,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
  checkout_request_id text UNIQUE,
  mpesa_receipt text,
  result_desc text,
  codes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
GRANT SELECT ON public.ticket_orders TO authenticated;
GRANT ALL ON public.ticket_orders TO service_role;
ALTER TABLE public.ticket_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmins view orders" ON public.ticket_orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

CREATE OR REPLACE FUNCTION public.complete_ticket_order(_checkout text, _receipt text, _codes text[])
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.ticket_orders;
BEGIN
  SELECT * INTO o FROM public.ticket_orders WHERE checkout_request_id = _checkout FOR UPDATE;
  IF NOT FOUND OR o.status <> 'pending' THEN RETURN false; END IF;
  UPDATE public.ticket_orders SET status='paid', mpesa_receipt=_receipt, codes=_codes, paid_at=now(), result_desc='Paid'
    WHERE id = o.id;
  UPDATE public.ticket_tiers SET sold = sold + o.quantity WHERE id = o.tier_id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.complete_ticket_order(text,text,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_ticket_order(text,text,text[]) TO service_role;