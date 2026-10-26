import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RequestTable } from "@/components/RequestTable";
import { useMe } from "@/hooks/use-me";
import { fetchRequests } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({ meta: [
    { title: "Minhas solicitações — Rota Despesas" },
    { name: "description", content: "Acompanhe suas solicitações e prestações de contas no Rota Despesas." },
    { property: "og:title", content: "Minhas solicitações — Rota Despesas" },
    { property: "og:description", content: "Acompanhe suas solicitações e prestações de contas no Rota Despesas." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Painel,
});

function Painel() {
  const { data: me } = useMe();
  const { data = [], isLoading } = useQuery({
    queryKey: ["requests", "mine", me?.id],
    queryFn: () => fetchRequests({ mine: me!.id }),
    enabled: !!me,
  });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Minhas solicitações</h1>
          <p className="text-muted-foreground">Adiantamentos e reembolsos de viagem.</p>
        </div>
        <Button asChild size="lg">
          <Link to="/solicitacoes/nova"><Plus className="size-4" /> Nova solicitação</Link>
        </Button>
      </div>
      {isLoading ? <p className="text-muted-foreground">Carregando...</p> : (
        <RequestTable rows={data} empty="Nenhuma solicitação ainda. Crie a primeira!" />
      )}
    </div>
  );
}
