ALTER TABLE public.requests ADD COLUMN original_requested_amount numeric;
COMMENT ON COLUMN public.requests.original_requested_amount IS 'Immutable original requested amount; advance captured at creation, reimbursement at first submission. Legacy rows backfilled from available totals.';
UPDATE public.requests r SET original_requested_amount = CASE WHEN r.type = 'adiantamento' THEN r.advance_amount ELSE COALESCE(NULLIF(r.spent_amount, 0), (SELECT SUM(e.amount) FROM public.expenses e WHERE e.request_id = r.id), 0) END WHERE r.type = 'adiantamento' OR r.status <> 'rascunho';
CREATE OR REPLACE FUNCTION public.preserve_original_requested_amount() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.original_requested_amount := CASE WHEN NEW.type = 'adiantamento' THEN NEW.advance_amount ELSE NULL END;
  ELSE
    IF OLD.original_requested_amount IS NOT NULL THEN
      IF NEW.original_requested_amount IS DISTINCT FROM OLD.original_requested_amount THEN
        RAISE EXCEPTION 'O valor originalmente solicitado não pode ser alterado';
      END IF;
      NEW.original_requested_amount := OLD.original_requested_amount;
    ELSIF OLD.status = 'rascunho' AND NEW.status <> 'rascunho' THEN
      NEW.original_requested_amount := CASE WHEN NEW.type = 'adiantamento' THEN NEW.advance_amount ELSE COALESCE((SELECT SUM(amount) FROM public.expenses WHERE request_id = NEW.id), 0) END;
    ELSE
      NEW.original_requested_amount := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER preserve_original_requested_amount BEFORE INSERT OR UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.preserve_original_requested_amount();
CREATE TABLE public.return_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL REFERENCES public.requests(id),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 receipt_path text NOT NULL,
 file_name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.return_receipts TO authenticated;
GRANT ALL ON public.return_receipts TO service_role;
ALTER TABLE public.return_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner or staff read return receipts" ON public.return_receipts FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "owner uploads return proof while awaiting return" ON public.return_receipts FOR INSERT TO authenticated WITH CHECK (
 user_id = auth.uid() AND
 receipt_path LIKE user_id::text || '/' || request_id::text || '/returns/%' AND
 EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_id AND r.user_id = auth.uid() AND r.type = 'adiantamento' AND r.status = 'aguardando_devolucao')
);