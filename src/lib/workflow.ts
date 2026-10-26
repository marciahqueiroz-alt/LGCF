export type AppRole = "colaborador" | "gerente" | "financeiro" | "diretoria" | "admin";
export type RequestType = "adiantamento" | "reembolso";
export type RequestStatus =
  | "rascunho"
  | "aguardando_diretoria"
  | "aprovado"
  | "adiantamento_pago"
  | "em_conferencia"
  | "aguardando_diretoria_excedente"
  | "aguardando_diretoria_pagamento"
  | "a_pagar"
  | "aguardando_devolucao"
  | "pago"
  | "concluido"
  | "rejeitado";

export type WorkflowAction =
  | "enviar"
  | "aprovar"
  | "rejeitar"
  | "pagar_adiantamento"
  | "enviar_prestacao"
  | "conferir"
  | "devolver_correcao"
  | "marcar_pago"
  | "confirmar_devolucao";

export const STATUS_LABEL: Record<RequestStatus, string> = {
  rascunho: "Rascunho",
  aguardando_diretoria: "Aguardando diretoria",
  aprovado: "Aprovado – aguardando depósito",
  adiantamento_pago: "Depositado – prestar contas",
  em_conferencia: "Em conferência",
  aguardando_diretoria_excedente: "Excedente aguardando diretoria",
  aguardando_diretoria_pagamento: "Pagamento aguardando diretoria",
  a_pagar: "Para pagamento",
  aguardando_devolucao: "Aguardando devolução",
  pago: "Pago",
  concluido: "Concluído",
  rejeitado: "Rejeitado",
};

export const ACTION_LABEL: Record<WorkflowAction, string> = {
  enviar: "Enviar solicitação",
  aprovar: "Aprovar",
  rejeitar: "Rejeitar",
  pagar_adiantamento: "Confirmar depósito do adiantamento",
  enviar_prestacao: "Enviar prestação de contas",
  conferir: "Confirmar conferência das despesas",
  devolver_correcao: "Devolver para correção",
  marcar_pago: "Marcar como pago",
  confirmar_devolucao: "Confirmar devolução recebida",
};

export const TYPE_LABEL: Record<RequestType, string> = {
  adiantamento: "Depósito prévio",
  reembolso: "Reembolso sem liberação prévia",
};

/** Finance board buckets */
export const FINANCE_PENDING: RequestStatus[] = [
  "aguardando_diretoria",
  "aprovado",
  "adiantamento_pago",
  "em_conferencia",
  "aguardando_diretoria_excedente",
  "aguardando_diretoria_pagamento",
  "aguardando_devolucao",
];
export const FINANCE_TO_PAY: RequestStatus[] = ["aprovado", "a_pagar"];
export const FINANCE_DONE: RequestStatus[] = ["pago", "concluido"];

export interface WorkflowRequest {
  type: RequestType;
  status: RequestStatus;
  advance_amount: number;
  user_id: string;
}

export interface Transition {
  status: RequestStatus;
  settlement_amount?: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

const ACTION_ROLES: Record<WorkflowAction, AppRole[] | "owner"> = {
  enviar: "owner",
  enviar_prestacao: "owner",
  // Admin mediates the whole process and may perform every step.
  aprovar: ["diretoria", "admin"],
  rejeitar: ["diretoria", "financeiro", "admin"],
  pagar_adiantamento: ["financeiro", "admin"],
  conferir: ["financeiro", "admin"],
  devolver_correcao: ["financeiro", "admin"],
  marcar_pago: ["financeiro", "admin"],
  confirmar_devolucao: ["financeiro", "admin"],
};

export function canPerform(
  action: WorkflowAction,
  req: WorkflowRequest,
  actorId: string,
  roles: AppRole[],
): boolean {
  const allowed = ACTION_ROLES[action];
  if (allowed === "owner") {
    if (req.user_id !== actorId) return false;
  } else if (!allowed.some((r) => roles.includes(r))) {
    return false;
  }
  // Segregation of duties: Financeiro never acts on its own request; Diretoria and Admin may.
  const admin = roles.includes("admin");
  const blockedOwn = req.user_id === actorId && !admin;
  if (action === "rejeitar") {
    const byDirector =
      (req.status === "aguardando_diretoria" || req.status === "aguardando_diretoria_excedente" || req.status === "aguardando_diretoria_pagamento") &&
      (roles.includes("diretoria") || admin);
    const byFinance = req.status === "em_conferencia" && (roles.includes("financeiro") || admin) && !blockedOwn;
    return byDirector || byFinance;
  }
  if (blockedOwn && allowed !== "owner" && action !== "aprovar") return false;
  try {
    nextStatus(req, action, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pure state machine. `spent` is the sum of expenses (used on settlement / check).
 */
export function nextStatus(req: WorkflowRequest, action: WorkflowAction, spent: number): Transition {
  const s = req.status;
  const fail = (): never => {
    throw new Error(`Ação "${ACTION_LABEL[action]}" não permitida no status "${STATUS_LABEL[s]}"`);
  };
  switch (action) {
    case "enviar":
      if (s !== "rascunho") return fail();
      return { status: req.type === "adiantamento" ? "aguardando_diretoria" : "em_conferencia" };
    case "aprovar":
      if (s === "aguardando_diretoria" && req.type === "adiantamento") return { status: "aprovado" };
      if (s === "aguardando_diretoria_excedente" || s === "aguardando_diretoria_pagamento") return { status: "a_pagar" };
      return fail();
    case "rejeitar":
      if (s === "aguardando_diretoria" || s === "aguardando_diretoria_excedente" || s === "aguardando_diretoria_pagamento" || s === "em_conferencia")
        return { status: "rejeitado" };
      return fail();
    case "pagar_adiantamento":
      if (s !== "aprovado") return fail();
      return { status: "adiantamento_pago" };
    case "enviar_prestacao":
      if (s !== "adiantamento_pago") return fail();
      return { status: "em_conferencia" };
    case "devolver_correcao":
      if (s !== "em_conferencia") return fail();
      return { status: req.type === "adiantamento" ? "adiantamento_pago" : "rascunho" };
    case "conferir": {
      if (s !== "em_conferencia") return fail();
      if (req.type === "reembolso") return { status: "aguardando_diretoria_pagamento", settlement_amount: round(spent) };
      const diff = round(spent - req.advance_amount);
      if (diff > 0) return { status: "aguardando_diretoria_excedente", settlement_amount: diff };
      if (diff < 0) return { status: "aguardando_devolucao", settlement_amount: diff };
      return { status: "concluido", settlement_amount: 0 };
    }
    case "marcar_pago":
      if (s !== "a_pagar") return fail();
      return { status: "pago" };
    case "confirmar_devolucao":
      if (s !== "aguardando_devolucao") return fail();
      return { status: "concluido" };
  }
}

export const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export const EXPENSE_CATEGORIES = [
  { value: "hospedagem", label: "Hospedagem" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "transporte", label: "Transporte" },
  { value: "combustivel", label: "Combustível" },
  { value: "passagem", label: "Passagem" },
  { value: "outros", label: "Outros" },
] as const;
