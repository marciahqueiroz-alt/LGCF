-- Private bucket for expense receipts and return proofs (Lovable Cloud created it outside the migrations).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts', 'receipts', false, 10485760, ARRAY['image/*', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;
