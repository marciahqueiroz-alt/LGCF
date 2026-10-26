import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RequestTable } from "@/components/RequestTable";
import { fetchRequests } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/diretoria")({
  head: () => ({ meta: [
    { title: "Aprovações da diretoria — Rota Despesas" },
    { name: "description", content: "Aprove orçamentos e libere pagamentos de despesas conferidas pelo Financeiro no Rota Despesas." },
    { property: "og:title", content: "Aprovações da diretoria — Rota Despesas" },
    { property: "og:description", content: "Aprove orçamentos e libere pagamentos de despesas conferidas pelo Financeiro no Rota Despesas." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Diretoria,
});

function Diretoria() {
  const { data = [] } = useQuery({
    queryKey: ["requests", "diretoria"],
    queryFn: () => fetchRequests({ statuses: ["aguardando_diretoria", "aguardando_diretoria_excedente", "aguardando_diretoria_pagamento"] }),
  });
  const orc = data.filter((r) => r.status === "aguardando_diretoria");
  const exc = data.filter((r) => r.status === "aguardando_diretoria_excedente");
  const payments = data.filter((r) => r.status === "aguardando_diretoria_pagamento");
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Aprovações da diretoria</h1>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Pagamentos conferidos pelo Financeiro</h2>
        <RequestTable rows={payments} showOwner empty="Nenhum pagamento aguardando liberação." />
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Orçamentos para depósito prévio</h2>
        <RequestTable rows={orc} showOwner empty="Nenhum orçamento aguardando." />
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Gastos acima do orçamento</h2>
        <RequestTable rows={exc} showOwner empty="Nenhum excedente aguardando." />
      </section>
    </div>
  );
}
