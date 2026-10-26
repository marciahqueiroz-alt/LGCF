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