import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Receipt, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { RequestType } from "@/lib/workflow";

export const Route = createFileRoute("/_authenticated/solicitacoes/nova")({
  head: () => ({ meta: [
    { title: "Nova solicitação — Rota Despesas" },
    { name: "description", content: "Solicite depósito prévio ou reembolso de viagem no Rota Despesas." },
    { property: "og:title", content: "Nova solicitação — Rota Despesas" },
    { property: "og:description", content: "Solicite depósito prévio ou reembolso de viagem no Rota Despesas." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Nova,
});

function Nova() {
  const navigate = useNavigate();
  const [type, setType] = useState<RequestType>("adiantamento");
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ title: "", destination: "", purpose: "", start_date: "", end_date: "", advance_amount: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data, error } = await supabase.from("requests").insert({
      type,
      title: f.title,
      destination: f.destination,
      purpose: f.purpose,
      start_date: f.start_date || null,
      end_date: f.end_date || null,
      advance_amount: type === "adiantamento" ? Number(f.advance_amount.replace(",", ".")) || 0 : 0,
    }).select("id").single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/solicitacoes/$id", params: { id: data.id } });
  }

  const opts = [
    { v: "adiantamento" as const, icon: Wallet, t: "Depósito prévio", d: "Orçamento depositado antes da viagem. Depois você presta contas." },
    { v: "reembolso" as const, icon: Receipt, t: "Reembolso", d: "Despesas que já aconteceram, sem liberação prévia." },
  ];

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Nova solicitação</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {opts.map((o) => (
          <button type="button" key={o.v} onClick={() => setType(o.v)}
            className={cn("rounded-xl border-2 bg-card p-4 text-left transition", type === o.v ? "border-primary shadow-card" : "border-transparent hover:border-border")}>
            <o.icon className="size-5 text-primary" />
            <div className="mt-2 font-semibold">{o.t}</div>
            <div className="text-sm text-muted-foreground">{o.d}</div>
          </button>
        ))}
      </div>
      <div className="space-y-4 rounded-xl bg-card p-6 shadow-card">
        <F label="Título"><Input required placeholder="Ex.: Visita cliente São Paulo" value={f.title} onChange={set("title")} /></F>
        <F label="Destino"><Input value={f.destination} onChange={set("destination")} /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Ida"><Input type="date" value={f.start_date} onChange={set("start_date")} /></F>
          <F label="Volta"><Input type="date" value={f.end_date} onChange={set("end_date")} /></F>
        </div>
        <F label="Motivo da viagem"><Textarea value={f.purpose} onChange={set("purpose")} /></F>
        {type === "adiantamento" && (
          <F label="Valor do orçamento (R$)"><Input required inputMode="decimal" placeholder="0,00" value={f.advance_amount} onChange={set("advance_amount")} /></F>
        )}
      </div>
      <Button type="submit" size="lg" disabled={saving}>Criar rascunho</Button>
    </form>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
