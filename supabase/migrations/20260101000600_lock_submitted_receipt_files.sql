-- A receipt file is locked once it backs a return proof or an expense whose request is no longer editable by its owner.
CREATE OR REPLACE FUNCTION public.receipt_file_locked(_path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.return_receipts proof WHERE proof.receipt_path = _path)
    OR EXISTS (
      SELECT 1 FROM public.expenses e JOIN public.requests r ON r.id = e.request_id
      WHERE e.receipt_path = _path
        AND NOT ((r.type = 'reembolso' AND r.status = 'rascunho') OR (r.type = 'adiantamento' AND r.status = 'adiantamento_pago'))
    )
$$;
REVOKE ALL ON FUNCTION public.receipt_file_locked(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.receipt_file_locked(text) TO authenticated;

DROP POLICY "delete own receipts" ON storage.objects;
CREATE POLICY "delete own receipts" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text AND NOT public.receipt_file_locked(name));
