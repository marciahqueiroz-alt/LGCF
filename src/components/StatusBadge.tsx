import { cva } from "class-variance-authority";
import { STATUS_LABEL, type RequestStatus } from "@/lib/workflow";
import { cn } from "@/lib/utils";

const badge = cva("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", {
  variants: {
    tone: {
      neutral: "bg-muted text-muted-foreground",
      wait: "bg-warning/25 text-warning-foreground",
      info: "bg-info/15 text-info",
      pay: "bg-accent text-accent-foreground",
      ok: "bg-success/15 text-success",
      bad: "bg-destructive/12 text-destructive",
    },
  },
});

const TONE: Record<RequestStatus, "neutral" | "wait" | "info" | "pay" | "ok" | "bad"> = {
  rascunho: "neutral",
  aguardando_diretoria: "wait",
  aprovado: "pay",
  adiantamento_pago: "info",
  em_conferencia: "info",
  aguardando_diretoria_excedente: "wait",
  aguardando_diretoria_pagamento: "wait",
  a_pagar: "pay",
  aguardando_devolucao: "wait",
  pago: "ok",
  concluido: "ok",
  rejeitado: "bad",
};

export function StatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  return <span className={cn(badge({ tone: TONE[status] }), className)}>{STATUS_LABEL[status]}</span>;
}
