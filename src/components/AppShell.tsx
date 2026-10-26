import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Plane } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";

export function AppShell() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const links = [
    { to: "/painel" as const, label: "Minhas solicitações", show: true },
    { to: "/diretoria" as const, label: "Diretoria", show: !!me?.is("diretoria") },
    { to: "/financeiro" as const, label: "Financeiro", show: !!me?.is("financeiro") },
    { to: "/usuarios" as const, label: "Usuários", show: !!me?.roles.includes("admin") },
  ];

  return (
    <div className="min-h-screen">
      <header className="bg-hero text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/painel" className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="grid size-8 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Plane className="size-4" />
            </span>
            Rota Despesas
          </Link>
          <nav className="flex flex-1 flex-wrap gap-1">
            {links
              .filter((l) => l.show)
              .map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-sidebar-foreground/75 transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  activeProps={{ className: "bg-sidebar-accent text-sidebar-foreground" }}
                >
                  {l.label}
                </Link>
              ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-sidebar-foreground/75 sm:inline">
              {me?.profile?.full_name || me?.email}
            </span>
            <Button size="sm" variant="ghost" onClick={signOut} className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground">
              <LogOut className="size-4" /> Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
