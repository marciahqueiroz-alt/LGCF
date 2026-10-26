-- CPF is no longer readable through the profiles table; only the owner, Financeiro and Admin get it via profile_cpf().
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, full_name, email, department, cost_center, created_at) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.profile_cpf(_user_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.cpf FROM public.profiles p
  WHERE p.id = _user_id AND (_user_id = auth.uid() OR public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'admin'))
$$;
REVOKE ALL ON FUNCTION public.profile_cpf(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_cpf(uuid) TO authenticated;
