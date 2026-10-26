import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { setUserRole } from "@/lib/requests.functions";
import { Checkbox } from "@/components/ui/checkbox";
import type { AppRole } from "@/lib/workflow";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({ meta: [
    { title: "Usuários — Rota Despesas" },
    { name: "description", content: "Administre os acessos da equipe no Rota Despesas." },
    { property: "og:title", content: "Usuários — Rota Despesas" },
    { property: "og:description", content: "Administre os acessos da equipe no Rota Despesas." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if (!roles?.some((r) => r.role === "admin")) throw redirect({ to: "/painel" });
  },
  component: Usuarios,
});

const ROLES: { r: AppRole; l: string }[] = [
  { r: "colaborador", l: "Colaborador" },
  { r: "gerente", l: "Gerente" },
  { r: "financeiro", l: "Financeiro" },
  { r: "diretoria", l: "Diretoria" },
  { r: "admin", l: "Admin" },
];

function Usuarios() {
  const setRole = useServerFn(setUserRole);
  const { data, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, department, cost_center").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (p ?? []).map((x) => ({ ...x, roles: (r ?? []).filter((y) => y.user_id === x.id).map((y) => y.role as AppRole) }));
    },
  });

  async function toggle(userId: string, role: AppRole, enabled: boolean) {
    try {
      await setRole({ data: { userId, role, enabled } });
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Usuários</h1>
        <p className="text-muted-foreground">Novos cadastros entram como Gerente. Defina aqui os perfis de cada pessoa.</p>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Departamento / CC</th>
              {ROLES.map((r) => <th key={r.r} className="px-4 py-3 text-center">{r.l}</th>)}
            </tr>
          </thead>
          <tbody>
            {data?.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-3"><div className="font-semibold">{u.full_name || "—"}</div><div className="text-xs text-muted-foreground">{u.email}</div></td>
                <td className="px-4 py-3">{u.department} / {u.cost_center}</td>
                {ROLES.map((r) => (
                  <td key={r.r} className="px-4 py-3 text-center">
                    <Checkbox aria-label={`${r.l}: ${u.full_name || u.email}`} checked={u.roles.includes(r.r)} onCheckedChange={(v) => toggle(u.id, r.r, !!v)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
