import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, CheckCircle2, Plane, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rota Despesas — despesas de viagem dos gerentes" },
      { name: "description", content: "Adiantamentos, prestação de contas e reembolsos de viagem com leitura automática de recibos." },
      { property: "og:title", content: "Rota Despesas — despesas de viagem dos gerentes" },
      { property: "og:description", content: "Adiantamentos, prestação de contas e reembolsos de viagem com leitura automática de recibos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const items = [
    { icon: Wallet, t: "Depósito prévio", d: "Orçamento aprovado pela diretoria e depositado antes da viagem." },
    { icon: Camera, t: "Foto do recibo", d: "Fotografe a nota e os dados são preenchidos automaticamente." },
    { icon: CheckCircle2, t: "Financeiro no controle", d: "Veja o que está pendente, para pagamento e já pago." },
  ];
  return (
    <div className="min-h-screen bg-hero text-sidebar-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-16 px-6 py-16">
        <div className="flex items-center gap-2 font-display text-xl font-bold">
          <span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Plane className="size-5" />
          </span>
          Rota Despesas
        </div>
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold leading-tight md:text-6xl">Despesas de viagem sem planilha e sem papel.</h1>
          <p className="mt-5 text-lg text-sidebar-foreground/75">
            Solicite adiantamentos, preste contas e peça reembolsos. A diretoria aprova, o financeiro paga.
          </p>
          <Button asChild size="lg" className="mt-8 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
            <Link to="/auth">Entrar</Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {items.map((i) => (
            <div key={i.t} className="rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-5">
              <i.icon className="size-6 text-sidebar-primary" />
              <h3 className="mt-3 font-semibold">{i.t}</h3>
              <p className="mt-1 text-sm text-sidebar-foreground/70">{i.d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
