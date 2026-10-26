-- Rota Despesas: instalação completa do banco num projeto Supabase NOVO.
-- Gerado a partir de supabase/migrations (mesma ordem). Cole tudo no SQL Editor e clique em Run.

-- ===== 20260101000000_travel_expenses.sql =====
create type public.app_role as enum ('gerente','financeiro','diretoria','admin');
create type public.request_type as enum ('adiantamento','reembolso');
create type public.request_status as enum ('rascunho','aguardando_diretoria','aprovado','adiantamento_pago','em_conferencia','aguardando_diretoria_excedente','a_pagar','aguardando_devolucao','pago','concluido','rejeitado');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  department text not null default '',
  cost_center text not null default '',
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('financeiro','diretoria','admin'))
$$;

create policy "own or staff read profiles" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff(auth.uid()));
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "own or admin read roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, department, cost_center)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.email,''),
    coalesce(new.raw_user_meta_data->>'department',''),
    coalesce(new.raw_user_meta_data->>'cost_center',''));
  insert into public.user_roles (user_id, role) values (new.id, 'gerente');
  if (select count(*) from public.user_roles where role = 'admin') = 0 then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  type public.request_type not null,
  status public.request_status not null default 'rascunho',
  title text not null,
  destination text not null default '',
  purpose text not null default '',
  start_date date,
  end_date date,
  advance_amount numeric(12,2) not null default 0,
  spent_amount numeric(12,2) not null default 0,
  settlement_amount numeric(12,2) not null default 0,
  last_note text not null default '',
  submitted_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.requests to authenticated;
grant all on public.requests to service_role;
alter table public.requests enable row level security;
create policy "read own or staff" on public.requests for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "insert own draft" on public.requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'rascunho');
create policy "update own draft" on public.requests for update to authenticated
  using (user_id = auth.uid() and status = 'rascunho') with check (user_id = auth.uid() and status = 'rascunho');
create policy "delete own draft" on public.requests for delete to authenticated
  using (user_id = auth.uid() and status = 'rascunho');

create table public.request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  actor_id uuid not null,
  action text not null,
  from_status public.request_status,
  to_status public.request_status not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
grant select on public.request_events to authenticated;
grant all on public.request_events to service_role;
alter table public.request_events enable row level security;
create policy "read events" on public.request_events for select to authenticated
  using (exists (select 1 from public.requests r where r.id = request_id and (r.user_id = auth.uid() or public.is_staff(auth.uid()))));

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  expense_date date,
  category text not null default 'outros',
  vendor text not null default '',
  description text not null default '',
  amount numeric(12,2) not null default 0,
  receipt_path text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;
alter table public.expenses enable row level security;

create or replace function public.can_edit_expenses(_request_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.requests r where r.id = _request_id and r.user_id = auth.uid()
    and ((r.type = 'reembolso' and r.status = 'rascunho') or (r.type = 'adiantamento' and r.status = 'adiantamento_pago')))
$$;
create policy "read expenses" on public.expenses for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "insert expenses" on public.expenses for insert to authenticated
  with check (user_id = auth.uid() and public.can_edit_expenses(request_id));
create policy "update expenses" on public.expenses for update to authenticated
  using (user_id = auth.uid() and public.can_edit_expenses(request_id))
  with check (user_id = auth.uid() and public.can_edit_expenses(request_id));
create policy "delete expenses" on public.expenses for delete to authenticated
  using (user_id = auth.uid() and public.can_edit_expenses(request_id));

create policy "upload own receipts" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read receipts" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff(auth.uid())));
create policy "delete own receipts" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

-- ===== 20260101000100_return_receipts_and_original_amount.sql =====
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

-- ===== 20260101000200_protect_saved_return_receipt_files.sql =====
DROP POLICY "delete own receipts" ON storage.objects;
CREATE POLICY "delete own receipts" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text AND NOT EXISTS (SELECT 1 FROM public.return_receipts proof WHERE proof.receipt_path = name));

-- ===== 20260101000300_profile_cpf.sql =====
ALTER TABLE public.profiles ADD COLUMN cpf text NOT NULL DEFAULT '';
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
begin
  insert into public.profiles (id, full_name, email, department, cost_center, cpf)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.email,''),
    coalesce(new.raw_user_meta_data->>'department',''),
    coalesce(new.raw_user_meta_data->>'cost_center',''),
    regexp_replace(coalesce(new.raw_user_meta_data->>'cpf',''), '[^0-9]', '', 'g'));
  insert into public.user_roles (user_id, role) values (new.id, 'gerente');
  if (select count(*) from public.user_roles where role = 'admin') = 0 then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end;
$$;

-- ===== 20260101000400_collaborator_and_director_payment_review.sql =====
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'colaborador';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'aguardando_diretoria_pagamento';

-- ===== 20260101000500_no_automatic_admin.sql =====
-- Signup no longer grants Admin when no admin exists; admins are granted only by an existing admin or manually via SQL.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
begin
  insert into public.profiles (id, full_name, email, department, cost_center, cpf)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.email,''),
    coalesce(new.raw_user_meta_data->>'department',''),
    coalesce(new.raw_user_meta_data->>'cost_center',''),
    regexp_replace(coalesce(new.raw_user_meta_data->>'cpf',''), '[^0-9]', '', 'g'));
  insert into public.user_roles (user_id, role) values (new.id, 'gerente');
  return new;
end;
$$;

-- ===== 20260101000600_lock_submitted_receipt_files.sql =====
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

-- ===== 20260101000700_restrict_cpf_to_finance.sql =====
-- CPF is no longer readable through the profiles table; only the owner, Financeiro and Admin get it via profile_cpf().
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, full_name, email, department, cost_center, created_at) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.profile_cpf(_user_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.cpf FROM public.profiles p
  WHERE p.id = _user_id AND (_user_id = auth.uid() OR public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'admin'))
$$;
REVOKE ALL ON FUNCTION public.profile_cpf(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_cpf(uuid) TO authenticated;

-- ===== 20260101000800_receipt_scan_limit.sql =====
-- Log of AI receipt readings, written only by the scanReceipt server fn (service role) to enforce per-user limits.
CREATE TABLE public.receipt_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX receipt_scans_user_created_idx ON public.receipt_scans (user_id, created_at);
GRANT ALL ON public.receipt_scans TO service_role;
ALTER TABLE public.receipt_scans ENABLE ROW LEVEL SECURITY;

-- ===== 20260101000900_duplicate_receipts.sql =====
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

-- ===== 20260101001000_receipts_bucket.sql =====
-- Private bucket for expense receipts and return proofs (Lovable Cloud created it outside the migrations).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts', 'receipts', false, 10485760, ARRAY['image/*', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;
