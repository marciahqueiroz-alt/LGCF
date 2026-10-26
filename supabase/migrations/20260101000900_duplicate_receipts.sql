-- Same receipt file (SHA-256 of the original upload) is blocked in any non-rejected request;
-- same date + amount + establishment is flagged as a possible duplicate for review.
ALTER TABLE public.expenses ADD COLUMN receipt_hash text;
CREATE INDEX expenses_receipt_hash_idx ON public.expenses (receipt_hash) WHERE receipt_hash IS NOT NULL;
CREATE INDEX expenses_date_amount_idx ON public.expenses (expense_date, amount);

CREATE OR REPLACE FUNCTION public.normalize_vendor(_vendor text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(btrim(regexp_replace(coalesce(_vendor, ''), '\s+', ' ', 'g')))
$$;

CREATE OR REPLACE FUNCTION public.receipt_hash_in_use(_hash text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.expenses e JOIN public.requests r ON r.id = e.request_id
    WHERE e.receipt_hash = _hash AND r.status <> 'rejeitado'
  )
$$;
REVOKE ALL ON FUNCTION public.receipt_hash_in_use(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.receipt_hash_in_use(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.block_duplicate_receipt() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.receipt_hash IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.expenses e JOIN public.requests r ON r.id = e.request_id
    WHERE e.receipt_hash = NEW.receipt_hash AND e.id <> NEW.id AND r.status <> 'rejeitado'
  ) THEN
    RAISE EXCEPTION 'Este recibo já foi lançado em outra despesa.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER block_duplicate_receipt BEFORE INSERT OR UPDATE OF receipt_hash ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.block_duplicate_receipt();

-- Possible duplicates of a request's expenses. Details of other people's requests are returned only to staff.
CREATE OR REPLACE FUNCTION public.expense_duplicates(_request_id uuid)
RETURNS TABLE (expense_id uuid, other_request_id uuid, other_request_title text, other_owner text, reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH caller AS (
    SELECT public.is_staff(auth.uid()) AS staff,
      EXISTS (SELECT 1 FROM public.requests WHERE id = _request_id AND user_id = auth.uid()) AS owner
  )
  SELECT e.id,
    CASE WHEN c.staff OR o.user_id = auth.uid() THEN o.request_id END,
    CASE WHEN c.staff OR o.user_id = auth.uid() THEN r.title END,
    CASE WHEN c.staff OR o.user_id = auth.uid() THEN coalesce(nullif(p.full_name, ''), p.email) END,
    CASE WHEN e.receipt_hash IS NOT NULL AND e.receipt_hash = o.receipt_hash THEN 'mesmo arquivo de recibo'
      ELSE 'mesma data, valor e estabelecimento' END
  FROM caller c
  JOIN public.expenses e ON e.request_id = _request_id
  JOIN public.expenses o ON o.id <> e.id AND (
    (e.receipt_hash IS NOT NULL AND o.receipt_hash = e.receipt_hash)
    OR (e.expense_date IS NOT NULL AND o.expense_date = e.expense_date AND o.amount = e.amount AND e.amount > 0
        AND public.normalize_vendor(e.vendor) <> '' AND public.normalize_vendor(o.vendor) = public.normalize_vendor(e.vendor))
  )
  JOIN public.requests r ON r.id = o.request_id AND r.status <> 'rejeitado'
  LEFT JOIN public.profiles p ON p.id = o.user_id
  WHERE c.staff OR c.owner
$$;
REVOKE ALL ON FUNCTION public.expense_duplicates(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expense_duplicates(uuid) TO authenticated;
