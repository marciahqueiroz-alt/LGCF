import { ACTION_LABEL, EXPENSE_CATEGORIES, STATUS_LABEL, TYPE_LABEL, type RequestStatus, type RequestType, type WorkflowAction } from "./workflow";

export type ExportRequest = {
  r: {
    id: string; title: string; type: RequestType; status: RequestStatus; destination: string; purpose: string;
    start_date: string | null; end_date: string | null; advance_amount: number | string; original_requested_amount: number | string | null;
    settlement_amount: number | string; submitted_at: string | null; paid_at: string | null; created_at: string;
  };
  owner: { full_name: string; email: string; department: string; cost_center: string } | null;
  cpf: string | null;
  exps: { id: string; expense_date: string | null; category: string; vendor: string; description: string; amount: number | string; receipt_path: string | null }[];
  events: { created_at: string; action: string; from_status: string | null; to_status: string; note: string; actor: string }[];
  duplicates: Map<string, string>;
};

const MONEY = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
// exceljs stores Dates as UTC, so build them with the wall-clock values that should appear in the sheet.
const day = (d: string | null) => (d ? new Date(d + "T00:00:00Z") : null);
const stamp = (d: string | null) => {
  if (!d) return null;
  const t = new Date(d);
  return new Date(t.getTime() - t.getTimezoneOffset() * 60_000);
};
const catLabel = (c: string) => EXPENSE_CATEGORIES.find((x) => x.value === c)?.label ?? c;
const cpfText = (cpf: string) => cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");

export function exportFileSlug(title: string) {
  return title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

/** Builds the .xlsx in the browser (exceljs is loaded on demand) and starts the download. */
export async function exportRequestToExcel({ r, owner, cpf, exps, events, duplicates }: ExportRequest) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Rota Despesas";
  wb.created = new Date();

  const spent = exps.reduce((s, e) => s + Number(e.amount), 0);
  const advance = Number(r.advance_amount);

  const summary = wb.addWorksheet("Solicitação");
  summary.columns = [{ width: 32 }, { width: 50 }];
  const rows: [string, string | number | Date | null, string?][] = [
    ["Título", r.title],
    ["Tipo", TYPE_LABEL[r.type]],
    ["Status", STATUS_LABEL[r.status]],
    ["Solicitante", owner?.full_name || owner?.email || "—"],
    ["E-mail", owner?.email ?? ""],
    ...(cpf ? [["CPF", cpfText(cpf)] as [string, string]] : []),
    ["Departamento", owner?.department ?? ""],
    ["Centro de custo", owner?.cost_center ?? ""],
    ["Destino", r.destination],
    ["Ida", day(r.start_date), "dd/mm/yyyy"],
    ["Volta", day(r.end_date), "dd/mm/yyyy"],
    ["Motivo", r.purpose],
    ["Valor originalmente solicitado", r.original_requested_amount == null ? null : Number(r.original_requested_amount), MONEY],
    ...(r.type === "adiantamento" ? [["Depósito prévio", advance, MONEY] as [string, number, string]] : []),
    ["Total de despesas", spent, MONEY],
    ...(r.type === "adiantamento" ? [["Saldo (+ reembolsar / − devolver)", spent - advance, MONEY] as [string, number, string]] : []),
    ["Valor de acerto", Number(r.settlement_amount), MONEY],
    ["Criada em", stamp(r.created_at), "dd/mm/yyyy hh:mm"],
    ["Enviada em", stamp(r.submitted_at), "dd/mm/yyyy hh:mm"],
    ["Paga em", stamp(r.paid_at), "dd/mm/yyyy hh:mm"],
    ["Código", r.id],
  ];
  for (const [label, value, fmt] of rows) {
    const row = summary.addRow([label, value ?? ""]);
    row.getCell(1).font = { bold: true };
    if (fmt && value != null) row.getCell(2).numFmt = fmt;
    row.getCell(2).alignment = { wrapText: true, vertical: "top", horizontal: "left" };
  }

  const sheet = wb.addWorksheet("Despesas");
  sheet.columns = [
    { header: "Data", key: "date", width: 12, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Categoria", key: "category", width: 16 },
    { header: "Estabelecimento", key: "vendor", width: 30 },
    { header: "Descrição", key: "description", width: 40 },
    { header: "Valor", key: "amount", width: 14, style: { numFmt: MONEY } },
    { header: "Recibo anexado", key: "receipt", width: 15 },
    { header: "Possível duplicidade", key: "duplicate", width: 40 },
  ];
  for (const e of exps) {
    sheet.addRow({
      date: day(e.expense_date), category: catLabel(e.category), vendor: e.vendor, description: e.description,
      amount: Number(e.amount), receipt: e.receipt_path ? "Sim" : "Não", duplicate: duplicates.get(e.id) ?? "",
    });
  }
  const total = sheet.addRow({ description: "Total", amount: spent });
  total.font = { bold: true };
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  if (exps.length) sheet.autoFilter = { from: "A1", to: `G${exps.length + 1}` };

  const history = wb.addWorksheet("Histórico");
  history.columns = [
    { header: "Data", key: "at", width: 18, style: { numFmt: "dd/mm/yyyy hh:mm" } },
    { header: "Ação", key: "action", width: 34 },
    { header: "De", key: "from", width: 30 },
    { header: "Para", key: "to", width: 30 },
    { header: "Responsável", key: "actor", width: 28 },
    { header: "Observação", key: "note", width: 50 },
  ];
  for (const ev of [...events].reverse()) {
    history.addRow({
      at: stamp(ev.created_at),
      action: ACTION_LABEL[ev.action as WorkflowAction] ?? ev.action,
      from: ev.from_status ? STATUS_LABEL[ev.from_status as RequestStatus] : "",
      to: STATUS_LABEL[ev.to_status as RequestStatus],
      actor: ev.actor,
      note: ev.note,
    });
  }
  history.getRow(1).font = { bold: true };

  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `solicitacao-${exportFileSlug(r.title) || r.id}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
