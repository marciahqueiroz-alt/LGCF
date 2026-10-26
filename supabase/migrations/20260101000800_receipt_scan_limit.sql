-- Log of AI receipt readings, written only by the scanReceipt server fn (service role) to enforce per-user limits.
CREATE TABLE public.receipt_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX receipt_scans_user_created_idx ON public.receipt_scans (user_id, created_at);
GRANT ALL ON public.receipt_scans TO service_role;
ALTER TABLE public.receipt_scans ENABLE ROW LEVEL SECURITY;
