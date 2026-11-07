CREATE OR REPLACE FUNCTION public.admin_sales_summary()
RETURNS TABLE(event_id uuid, event_title text, program_id uuid, program_name text, event_date timestamptz, tier_name text, tickets_sold bigint, funds bigint, orders bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, e.title, p.id, p.name, e.date, o.tier_name,
    COALESCE(SUM(o.quantity),0)::bigint, COALESCE(SUM(o.total),0)::bigint, COUNT(o.id)::bigint
  FROM public.events e
  JOIN public.programs p ON p.id = e.program_id
  JOIN public.ticket_orders o ON o.event_id = e.id AND o.status = 'paid'
  WHERE auth.uid() IS NOT NULL AND public.can_manage_program(e.program_id)
  GROUP BY e.id, e.title, p.id, p.name, e.date, o.tier_name
$$;
REVOKE ALL ON FUNCTION public.admin_sales_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_sales_summary() TO authenticated;