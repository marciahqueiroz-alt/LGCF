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