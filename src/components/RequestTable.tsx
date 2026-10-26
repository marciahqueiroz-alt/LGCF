import { Link } from "@tanstack/react-router";
import { StatusBadge } from "./StatusBadge";
import { brl, TYPE_LABEL, type RequestStatus, type RequestType } from "@/lib/workflow";

export type RequestRow = {
  id: string;
  title: string;
  type: RequestType;
  status: RequestStatus;
  destination: string;
  advance_amount: number;
  spent_amount: number;
  settlement_amount: number;
  created_at: string;
  owner?: string;
};

export function amountFor(r: RequestRow) {
  if (r.status === "aprovado") return r.advance_amount;
  if (r.type === "reembolso") return r.settlement_amount || r.spent_amount;
  if (["a_pagar", "pago", "aguardando_diretoria_excedente", "aguardando_devolucao", "concluido"].includes(r.status))
    return r.settlement_amount;
  return r.advance_amount;
}

export function RequestTable({ rows, showOwner, empty }: { rows: RequestRow[]; showOwner?: boolean; empty: string }) {
  if (!rows.length)
    return <div className="rounded-xl border border-dashed bg-card p-10 text-center text-muted-foreground">{empty}</div>;
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Solicitação</th>
            {showOwner && <th className="px-4 py-3">Solicitante</th>}
            <th className="hidden px-4 py-3 md:table-cell">Tipo</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t transition hover:bg-muted/40">
              <td className="px-4 py-3">
                <Link to="/solicitacoes/$id" params={{ id: r.id }} className="font-semibold text-primary hover:underline">
                  {r.title}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {r.destination || "—"} · {new Date(r.created_at).toLocaleDateString("pt-BR")}
                </div>
              </td>
              {showOwner && <td className="px-4 py-3">{r.owner}</td>}
              <td className="hidden px-4 py-3 md:table-cell">{TYPE_LABEL[r.type]}</td>
              <td className="px-4 py-3">
                <StatusBadge status={r.status} />
              </td>
              <td className="tabular px-4 py-3 text-right font-semibold">{brl(Math.abs(amountFor(r)))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
