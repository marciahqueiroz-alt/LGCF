import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/workflow";

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, department, cost_center").eq("id", u.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", u.user.id),
    ]);
    const r = (roles ?? []).map((x) => x.role as AppRole);
    return {
      id: u.user.id,
      email: u.user.email ?? "",
      profile,
      roles: r,
      is: (role: AppRole) => r.includes(role) || r.includes("admin"),
    };
  },
});

export function useMe() {
  return useQuery(meQuery);
}
