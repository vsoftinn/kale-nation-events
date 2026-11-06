ALTER TABLE public.ticket_orders
  ALTER COLUMN phone DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'mpesa',
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS delivery_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_message_id text,
  ADD COLUMN IF NOT EXISTS whatsapp_status text,
  ADD COLUMN IF NOT EXISTS whatsapp_error text,
  ADD COLUMN IF NOT EXISTS email_status text,
  ADD COLUMN IF NOT EXISTS reservation_expires_at timestamptz NOT NULL DEFAULT (now() + interval '20 minutes');

ALTER TABLE public.ticket_orders
  DROP CONSTRAINT IF EXISTS ticket_orders_status_check,
  ADD CONSTRAINT ticket_orders_status_check
    CHECK (status IN ('pending', 'paid', 'failed', 'refund_pending')),
  DROP CONSTRAINT IF EXISTS ticket_orders_provider_check,
  ADD CONSTRAINT ticket_orders_provider_check
    CHECK (provider IN ('mpesa', 'paystack')),
  DROP CONSTRAINT IF EXISTS ticket_orders_buyer_contact_check,
  ADD CONSTRAINT ticket_orders_buyer_contact_check
    CHECK (
      (
        provider = 'mpesa'
        AND phone IS NOT NULL
        AND phone ~ '^254[17][0-9]{8}$'
      )
      OR (
        provider = 'paystack'
        AND email IS NOT NULL
        AND phone IS NULL
        AND whatsapp IS NULL
      )
    ) NOT VALID;

CREATE INDEX IF NOT EXISTS ticket_orders_active_reservations
  ON public.ticket_orders (tier_id, reservation_expires_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS ticket_orders_recent_email
  ON public.ticket_orders (email, created_at DESC)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS ticket_orders_recent_phone
  ON public.ticket_orders (phone, created_at DESC)
  WHERE phone IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reserve_ticket_order(
  _tier_id uuid,
  _quantity integer,
  _holder text,
  _phone text,
  _email text,
  _provider text,
  _reference text
)
RETURNS public.ticket_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  selected_tier public.ticket_tiers%rowtype;
  selected_price integer;
  active_reservations integer;
  contact_key text;
  created_order public.ticket_orders%rowtype;
BEGIN
  IF _provider NOT IN ('mpesa', 'paystack') THEN
    RAISE EXCEPTION 'Unsupported payment provider';
  END IF;
  IF _quantity < 1 OR _quantity > 10 THEN
    RAISE EXCEPTION 'Choose between 1 and 10 tickets';
  END IF;
  IF char_length(trim(_holder)) NOT BETWEEN 2 AND 60 THEN
    RAISE EXCEPTION 'Enter a name between 2 and 60 characters';
  END IF;
  IF _provider = 'mpesa' AND (_phone IS NULL OR _phone !~ '^254[17][0-9]{8}$') THEN
    RAISE EXCEPTION 'Enter a valid Kenyan mobile number';
  END IF;
  IF _provider = 'paystack' AND (
    _email IS NULL
    OR char_length(trim(_email)) NOT BETWEEN 3 AND 254
    OR _email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR _reference IS NULL
    OR char_length(_reference) > 100
  ) THEN
    RAISE EXCEPTION 'Enter a valid email address for Paystack';
  END IF;

  contact_key := CASE
    WHEN _provider = 'mpesa' THEN _phone
    ELSE lower(trim(_email))
  END;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(contact_key, 917241));

  IF (
    SELECT count(*)
      FROM public.ticket_orders AS recent_order
     WHERE recent_order.created_at > now() - interval '10 minutes'
       AND (
         (_provider = 'mpesa' AND recent_order.phone = _phone)
         OR (_provider = 'paystack' AND recent_order.email = lower(trim(_email)))
       )
  ) >= 5 THEN
    RAISE EXCEPTION 'Too many recent checkout attempts';
  END IF;

  SELECT tier.*
    INTO selected_tier
    FROM public.ticket_tiers AS tier
    JOIN public.events AS event ON event.id = tier.event_id
   WHERE tier.id = _tier_id
     AND event.published = true
   FOR UPDATE OF tier;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This event or ticket tier is unavailable';
  END IF;
  IF selected_tier.closed OR selected_tier.sales_end_at <= now() THEN
    RAISE EXCEPTION 'Ticket sales for this tier have closed';
  END IF;

  SELECT phase.price
    INTO selected_price
    FROM public.price_phases AS phase
   WHERE phase.tier_id = _tier_id
     AND phase.starts_at <= now()
   ORDER BY phase.starts_at DESC
   LIMIT 1;

  IF selected_price IS NULL OR selected_price <= 0 THEN
    RAISE EXCEPTION 'Ticket sales have not started';
  END IF;

  SELECT coalesce(sum(order_row.quantity), 0)::integer
    INTO active_reservations
    FROM public.ticket_orders AS order_row
   WHERE order_row.tier_id = _tier_id
     AND order_row.status = 'pending'
     AND order_row.reservation_expires_at > now();

  IF selected_tier.sold + active_reservations + _quantity > selected_tier.quantity THEN
    RAISE EXCEPTION 'Not enough tickets remain for this order';
  END IF;

  INSERT INTO public.ticket_orders (
    event_id,
    tier_id,
    tier_name,
    quantity,
    unit_price,
    total,
    holder,
    phone,
    whatsapp,
    email,
    provider,
    checkout_request_id
  )
  VALUES (
    selected_tier.event_id,
    selected_tier.id,
    selected_tier.name,
    _quantity,
    selected_price,
    selected_price * _quantity,
    trim(_holder),
    CASE WHEN _provider = 'mpesa' THEN _phone ELSE NULL END,
    NULL,
    CASE WHEN _provider = 'paystack' THEN lower(trim(_email)) ELSE NULL END,
    _provider,
    CASE WHEN _provider = 'paystack' THEN _reference ELSE NULL END
  )
  RETURNING * INTO created_order;

  RETURN created_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_ticket_order(
  _checkout text,
  _receipt text,
  _codes text[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  selected_order public.ticket_orders%rowtype;
  selected_tier public.ticket_tiers%rowtype;
  active_reservations integer;
BEGIN
  SELECT *
    INTO selected_order
    FROM public.ticket_orders
   WHERE checkout_request_id = _checkout
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket order not found';
  END IF;
  IF selected_order.status = 'paid' THEN
    RETURN true;
  END IF;
  IF selected_order.status <> 'pending' THEN
    RETURN false;
  END IF;
  IF _receipt IS NULL OR char_length(_receipt) > 100 THEN
    RAISE EXCEPTION 'Invalid payment receipt';
  END IF;
  IF coalesce(array_length(_codes, 1), 0) <> selected_order.quantity THEN
    RAISE EXCEPTION 'Ticket codes do not match the order quantity';
  END IF;

  SELECT *
    INTO selected_tier
    FROM public.ticket_tiers
   WHERE id = selected_order.tier_id
   FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE public.ticket_orders
       SET status = 'refund_pending',
           result_desc = 'Payment verified; ticket tier is unavailable and needs review'
     WHERE id = selected_order.id;
    RETURN false;
  END IF;

  SELECT coalesce(sum(order_row.quantity), 0)::integer
    INTO active_reservations
    FROM public.ticket_orders AS order_row
   WHERE order_row.tier_id = selected_order.tier_id
     AND order_row.id <> selected_order.id
     AND order_row.status = 'pending'
     AND order_row.reservation_expires_at > now();

  IF selected_tier.sold + active_reservations + selected_order.quantity > selected_tier.quantity THEN
    UPDATE public.ticket_orders
       SET status = 'refund_pending',
           result_desc = 'Payment verified; ticket inventory is unavailable and needs refund review'
     WHERE id = selected_order.id;
    RETURN false;
  END IF;

  UPDATE public.ticket_tiers
     SET sold = sold + selected_order.quantity
   WHERE id = selected_order.tier_id;

  UPDATE public.ticket_orders
     SET status = 'paid',
         mpesa_receipt = _receipt,
         codes = _codes,
         paid_at = now(),
         result_desc = 'Paid'
   WHERE id = selected_order.id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ticket_order(uuid, integer, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_ticket_order(text, text, text[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ticket_order(uuid, integer, text, text, text, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_ticket_order(text, text, text[])
  TO service_role;

NOTIFY pgrst, 'reload schema';
