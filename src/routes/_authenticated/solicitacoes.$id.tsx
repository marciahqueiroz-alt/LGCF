import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, FileImage, FileSpreadsheet, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { transitionRequest } from "@/lib/requests.functions";
import { ACTION_LABEL, brl, canPerform, EXPENSE_CATEGORIES, STATUS_LABEL, TYPE_LABEL, type RequestStatus, type WorkflowAction } from "@/lib/workflow";
import { StatusBadge } from "@/components/StatusBadge";
import { ExpenseForm } from "@/components/ExpenseForm";
import { ReturnReceipts } from "@/components/ReturnReceipts";
import { canUploadReturnReceipt } from "@/lib/return-receipts";
import { categoryTotals } from "@/lib/expense-summary";
import { formatCpf } from "@/lib/cpf";
import { ReceiptViewer } from "@/components/ReceiptViewer";
import { exportRequestToExcel } from "@/lib/export-request";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/solicitacoes/$id")({
  head: () => ({ meta: [
    { title: "Solicitação — Rota Despesas" },
    { name: "description", content: "Valores solicitados, prestação de contas e comprovantes da viagem no Rota Despesas." },
    { property: "og:title", content: "Solicitação — Rota Despesas" },
    { property: "og:description", content: "Valores solicitados, prestação de contas e comprovantes da viagem no Rota Despesas." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Detail,
});

type Duplicate = { expense_id: string; other_request_id: string | null; other_request_title: string | null; other_owner: string | null; reason: string };

function describeDuplicates(list: Duplicate[], currentId: string) {
  return list.map((d) => {
    if (!d.other_request_id) return `${d.reason} em outra solicitação`;
    if (d.other_request_id === currentId) return `${d.reason} nesta solicitação`;
    return `${d.reason} em "${d.other_request_title}"${d.other_owner ? ` (${d.other_owner})` : ""}`;
  }).join("; ");
}

const ALL_ACTIONS: WorkflowAction[] = ["enviar", "enviar_prestacao", "aprovar", "pagar_adiantamento", "conferir", "marcar_pago", "confirmar_devolucao", "devolver_correcao", "rejeitar"];

function Detail() {
  const { id } = Route.useParams();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const transition = useServerFn(transitionRequest);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<{ path: string; title: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["request", id],
    queryFn: async () => {
      const { data: r, error } = await supabase.from("requests").select("*").eq("id", id).single();
      if (error) throw error;
      const [{ data: exps }, { data: rawEvents }, { data: owner }, proofs, { data: dups }, { data: cpf }] = await Promise.all([
        supabase.from("expenses").select("*").eq("request_id", id).order("expense_date"),
        supabase.from("request_events").select("*").eq("request_id", id).order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, email, department, cost_center").eq("id", r.user_id).maybeSingle(),
        supabase.from("return_receipts").select("*").eq("request_id", id).order("created_at", { ascending: false }),
        supabase.rpc("expense_duplicates", { _request_id: id }),
        supabase.rpc("profile_cpf", { _user_id: r.user_id }),
      ]);
      if (proofs.error) throw proofs.error;
      const actorIds = [...new Set((rawEvents ?? []).map((e) => e.actor_id))];
      const { data: actors } = actorIds.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", actorIds)
        : { data: [] as { id: string; full_name: string; email: string }[] };
      const actorName = new Map((actors ?? []).map((p) => [p.id, p.full_name || p.email]));
      const events = (rawEvents ?? []).map((e) => ({ ...e, actor: actorName.get(e.actor_id) ?? "Equipe" }));
      const duplicates = new Map<string, Duplicate[]>();
      for (const d of dups ?? []) duplicates.set(d.expense_id, [...(duplicates.get(d.expense_id) ?? []), d]);
      return { r, exps: exps ?? [], events, owner, receipts: proofs.data ?? [], duplicates, cpf: cpf ?? null };
    },
  });

  if (!data || !me) return <p className="text-muted-foreground">Carregando...</p>;
  const { r, exps, events, owner, duplicates, cpf } = data;
  const isOwner = r.user_id === me.id;
  const spent = exps.reduce((s, e) => s + Number(e.amount), 0);
  const advance = Number(r.advance_amount);
  const editable = isOwner && ((r.type === "reembolso" && r.status === "rascunho") || (r.type === "adiantamento" && r.status === "adiantamento_pago"));
  const wf = { ...r, advance_amount: advance };
  const actions = ALL_ACTIONS.filter((a) => canPerform(a, wf, me.id, me.roles));

  async function run(a: WorkflowAction) {
    setBusy(true);
    try {
      await transition({ data: { id, action: a, note } });
      toast.success("Feito!");
      setNote("");
      await refetch();
      qc.invalidateQueries({ queryKey: ["requests"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function del(expId: string, path: string | null) {
    // Delete the row first so a refused delete never leaves an expense without its receipt.
    const { error } = await supabase.from("expenses").delete().eq("id", expId).select("id").single();
    if (error) { toast.error("Não foi possível excluir a despesa."); return; }
    if (path) await supabase.storage.from("receipts").remove([path]);
    refetch();
  }

  async function exportXlsx() {
    setExporting(true);
    try {
      const dupText = new Map([...duplicates].map(([expId, list]) => [expId, describeDuplicates(list, id)]));
      await exportRequestToExcel({ r, owner, cpf, exps, events, duplicates: dupText });
    } catch (e) {
      console.error("Excel export failed", e);
      toast.error("Não foi possível gerar a planilha.");
    } finally {
      setExporting(false);
    }
  }

  const diff = spent - advance;
  const catLabel = (c: string) => EXPENSE_CATEGORIES.find((x) => x.value === c)?.label ?? c;

  return (
    <div className="space-y-6">
      <Link to="/painel" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Voltar</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{TYPE_LABEL[r.type]}</p>
          <h1 className="text-3xl font-bold">{r.title}</h1>
          <p className="text-muted-foreground">
            {owner?.full_name}{cpf && ` · CPF ${formatCpf(cpf)}`} · {owner?.department} · CC {owner?.cost_center}
            {r.destination && ` · ${r.destination}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={r.status as RequestStatus} className="text-sm" />
          <Button variant="outline" size="sm" onClick={exportXlsx} disabled={exporting}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />} Exportar Excel
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Valor originalmente solicitado" value={r.original_requested_amount == null ? "Ainda não enviado" : brl(Number(r.original_requested_amount))} />
        {r.type === "adiantamento" && <Stat label={['rascunho', 'aguardando_diretoria', 'aprovado', 'rejeitado'].includes(r.status) ? "Orçamento para depósito" : "Valor do depósito prévio"} value={brl(advance)} />}
        <Stat label="Total de despesas" value={brl(spent)} />
        {r.type === "adiantamento" && exps.length > 0 && (
          <Stat label={diff > 0 ? "Reembolso ao gerente" : diff < 0 ? "Devolver à empresa" : "Saldo"} value={brl(Math.abs(diff))} />
        )}
      </div>

      {r.purpose && <p className="rounded-xl bg-card p-4 text-sm shadow-card">{r.purpose}</p>}
      {r.last_note && <p className="rounded-xl border-l-4 border-accent bg-card p-4 text-sm"><b>Última observação:</b> {r.last_note}</p>}

      {actions.length > 0 && (
        <div className="space-y-3 rounded-xl border bg-card p-5 shadow-card">
          <h2 className="font-semibold">Ações</h2>
          <Textarea placeholder="Observação (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <Button key={a} disabled={busy} onClick={() => run(a)} variant={a === "rejeitar" ? "destructive" : a === "devolver_correcao" ? "outline" : "default"}>
                {ACTION_LABEL[a]}
              </Button>
            ))}
          </div>
        </div>
      )}

      {(r.type === "reembolso" || ["adiantamento_pago", "em_conferencia", "aguardando_diretoria_excedente", "a_pagar", "aguardando_devolucao", "pago", "concluido"].includes(r.status)) && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Despesas</h2>
          {exps.length > 0 && <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Valores por categoria</h3>
            <dl className="grid gap-x-6 sm:grid-cols-2">
              {categoryTotals(exps).map((total) => <div key={total.category} className="flex justify-between gap-4 border-b py-2 text-sm">
                <dt>{catLabel(total.category)}</dt><dd className="tabular font-semibold">{brl(total.amount)}</dd>
              </div>)}
            </dl>
          </div>}
          {editable && <ExpenseForm requestId={id} userId={me.id} onSaved={() => refetch()} />}
          {exps.length === 0 ? <p className="text-muted-foreground">Nenhuma despesa lançada.</p> : (
            <div className="divide-y rounded-xl border bg-card shadow-card">
              {exps.map((e) => (
                <div key={e.id} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1 break-words">
                    <div className="font-semibold">{e.vendor || catLabel(e.category)}</div>
                    <div className="text-xs text-muted-foreground">
                      {catLabel(e.category)} · {e.expense_date ? new Date(e.expense_date + "T12:00").toLocaleDateString("pt-BR") : "sem data"}
                      {e.description && ` · ${e.description}`}
                    </div>
                    {duplicates.has(e.id) && (
                      <div role="alert" className="mt-1 flex items-start gap-1 text-xs font-medium text-destructive">
                        <AlertTriangle className="mt-0.5 size-3 shrink-0" /> Possível duplicidade: {describeDuplicates(duplicates.get(e.id)!, id)}
                      </div>
                    )}
                  </div>
                  {e.receipt_path && <Button size="icon" variant="ghost" onClick={() => setViewer({ path: e.receipt_path!, title: "Recibo da despesa" })} title="Ver recibo" aria-label="Ver recibo"><FileImage className="size-4" /></Button>}
                  <div className="tabular font-semibold">{brl(Number(e.amount))}</div>
                  {editable && <Button size="icon" variant="ghost" onClick={() => del(e.id, e.receipt_path)}><Trash2 className="size-4" /></Button>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {(r.status === "aguardando_devolucao" || data.receipts.length > 0) && (
        <ReturnReceipts requestId={id} userId={me.id} editable={canUploadReturnReceipt(wf, me.id)} receipts={data.receipts} onSaved={() => { void refetch(); }} onView={(path) => setViewer({ path, title: "Comprovante de devolução" })} />
      )}

      <ReceiptViewer path={viewer?.path ?? null} title={viewer?.title} onClose={() => setViewer(null)} />

      {events.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xl font-bold">Histórico</h2>
          <ul className="space-y-1 text-sm">
            {events.map((ev) => (
              <li key={ev.id} className="text-muted-foreground">
                {new Date(ev.created_at).toLocaleString("pt-BR")} — <b className="text-foreground">{STATUS_LABEL[ev.to_status as RequestStatus]}</b> · {ev.actor}
                {ev.note && ` · "${ev.note}"`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-card">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="tabular mt-1 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}
