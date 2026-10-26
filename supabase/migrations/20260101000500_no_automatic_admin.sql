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
