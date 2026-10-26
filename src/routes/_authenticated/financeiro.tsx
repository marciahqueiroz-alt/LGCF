import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RequestTable, amountFor } from "@/components/RequestTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchRequests } from "@/lib/queries";
import { brl, FINANCE_DONE, FINANCE_PENDING, FINANCE_TO_PAY } from "@/lib/workflow";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({ meta: [
    { title: "Financeiro — Rota Despesas" },
    { name: "description", content: "Confira despesas e acompanhe pagamentos e devoluções no Rota Despesas." },
    { property: "og:title", content: "Financeiro — Rota Despesas" },
    { property: "og:description", content: "Confira despesas e acompanhe pagamentos e devoluções no Rota Despesas." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Financeiro,
});

function Financeiro() {
  const { data = [] } = useQuery({ queryKey: ["requests", "all"], queryFn: () => fetchRequests() });
  const sent = data.filter((r) => r.status !== "rascunho");
  const toPay = sent.filter((r) => FINANCE_TO_PAY.includes(r.status));
  const pending = sent.filter((r) => FINANCE_PENDING.includes(r.status) && !FINANCE_TO_PAY.includes(r.status));
  const done = sent.filter((r) => FINANCE_DONE.includes(r.status));
  const sum = (rows: typeof data) => brl(rows.reduce((s, r) => s + Math.abs(amountFor(r)), 0));

  const cards = [
    { k: "pagar", label: "Para pagamento", rows: toPay },
    { k: "pendente", label: "Pendentes", rows: pending },
    { k: "pago", label: "Pagos / concluídos", rows: done },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Financeiro</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.k} className="rounded-xl bg-card p-4 shadow-card">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</div>
            <div className="tabular mt-1 font-display text-2xl font-bold">{sum(c.rows)}</div>
            <div className="text-sm text-muted-foreground">{c.rows.length} solicitações</div>
          </div>
        ))}
      </div>
      <Tabs defaultValue="pagar">
        <TabsList>
          {cards.map((c) => <TabsTrigger key={c.k} value={c.k}>{c.label} ({c.rows.length})</TabsTrigger>)}
          <TabsTrigger value="todas">Todas</TabsTrigger>
        </TabsList>
        {cards.map((c) => (
          <TabsContent key={c.k} value={c.k}><RequestTable rows={c.rows} showOwner empty="Nada por aqui." /></TabsContent>
        ))}
        <TabsContent value="todas"><RequestTable rows={sent} showOwner empty="Nada por aqui." /></TabsContent>
      </Tabs>
    </div>
  );
}
