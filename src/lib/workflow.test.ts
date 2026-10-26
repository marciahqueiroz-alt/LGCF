import { describe, expect, it } from "vitest";
import { canPerform, nextStatus, FINANCE_PENDING, FINANCE_TO_PAY, type WorkflowRequest } from "./workflow";

const adv = (status: WorkflowRequest["status"], advance = 1000): WorkflowRequest => ({
  type: "adiantamento",
  status,
  advance_amount: advance,
  user_id: "u1",
});
const reimb = (status: WorkflowRequest["status"]): WorkflowRequest => ({
  type: "reembolso",
  status,
  advance_amount: 0,
  user_id: "u1",
});

describe("workflow", () => {
  it("adiantamento enviado vai para aprovação da diretoria", () => {
    expect(nextStatus(adv("rascunho"), "enviar", 0).status).toBe("aguardando_diretoria");
  });
  it("financeiro não pode aprovar o orçamento, só a diretoria", () => {
    expect(canPerform("aprovar", adv("aguardando_diretoria"), "x", ["financeiro"])).toBe(false);
    expect(canPerform("aprovar", adv("aguardando_diretoria"), "x", ["diretoria"])).toBe(true);
  });
  it("depósito só após aprovação da diretoria", () => {
    expect(canPerform("pagar_adiantamento", adv("aguardando_diretoria"), "x", ["financeiro"])).toBe(false);
    expect(nextStatus(adv("aprovado"), "pagar_adiantamento", 0).status).toBe("adiantamento_pago");
  });
  it("gasto acima do adiantamento exige nova aprovação da diretoria", () => {
    const t = nextStatus(adv("em_conferencia", 1000), "conferir", 1250.5);
    expect(t).toEqual({ status: "aguardando_diretoria_excedente", settlement_amount: 250.5 });
    expect(nextStatus(adv("aguardando_diretoria_excedente"), "aprovar", 0).status).toBe("a_pagar");
  });
  it("sobra do adiantamento gera devolução à empresa", () => {
    expect(nextStatus(adv("em_conferencia", 1000), "conferir", 800)).toEqual({
      status: "aguardando_devolucao",
      settlement_amount: -200,
    });
  });
  it("gasto igual ao adiantamento conclui", () => {
    expect(nextStatus(adv("em_conferencia", 1000), "conferir", 1000).status).toBe("concluido");
  });
  it("reembolso só vai à diretoria após conferência financeira e retorna para pagamento", () => {
    expect(nextStatus(reimb("rascunho"), "enviar", 0).status).toBe("em_conferencia");
    expect(nextStatus(reimb("em_conferencia"), "conferir", 300)).toEqual({ status: "aguardando_diretoria_pagamento", settlement_amount: 300 });
    expect(nextStatus(reimb("aguardando_diretoria_pagamento"), "aprovar", 300)).toEqual({ status: "a_pagar" });
    expect(nextStatus(reimb("a_pagar"), "marcar_pago", 0).status).toBe("pago");
  });
  it("colaborador envia e presta contas apenas das próprias solicitações, sem liberar pagamentos", () => {
    expect(canPerform("enviar", reimb("rascunho"), "u1", ["colaborador"])).toBe(true);
    expect(canPerform("enviar", reimb("rascunho"), "outro", ["colaborador"])).toBe(false);
    expect(canPerform("enviar_prestacao", adv("adiantamento_pago"), "u1", ["colaborador"])).toBe(true);
    expect(canPerform("conferir", reimb("em_conferencia"), "u1", ["colaborador"])).toBe(false);
    expect(canPerform("aprovar", reimb("aguardando_diretoria_pagamento"), "u1", ["colaborador"])).toBe(false);
    expect(canPerform("marcar_pago", reimb("a_pagar"), "u1", ["colaborador"])).toBe(false);
  });
  it("diretoria não libera pagamento antes da conferência pelo financeiro", () => {
    expect(canPerform("aprovar", reimb("em_conferencia"), "x", ["diretoria"])).toBe(false);
    expect(canPerform("conferir", reimb("em_conferencia"), "x", ["diretoria"])).toBe(false);
    expect(canPerform("conferir", reimb("em_conferencia"), "x", ["financeiro"])).toBe(true);
    expect(canPerform("aprovar", reimb("aguardando_diretoria_pagamento"), "x", ["financeiro"])).toBe(false);
    expect(canPerform("aprovar", reimb("aguardando_diretoria_pagamento"), "x", ["diretoria"])).toBe(true);
  });
  it("financeiro só sinaliza pagamento depois da aprovação da diretoria", () => {
    expect(canPerform("marcar_pago", reimb("aguardando_diretoria_pagamento"), "x", ["financeiro"])).toBe(false);
    expect(canPerform("marcar_pago", reimb("a_pagar"), "x", ["financeiro"])).toBe(true);
    expect(canPerform("marcar_pago", reimb("a_pagar"), "x", ["diretoria"])).toBe(false);
    expect(FINANCE_PENDING).toContain("aguardando_diretoria_pagamento");
    expect(FINANCE_TO_PAY).not.toContain("aguardando_diretoria_pagamento");
  });
  it("diretoria pode rejeitar um pagamento conferido", () => {
    expect(canPerform("rejeitar", reimb("aguardando_diretoria_pagamento"), "x", ["diretoria"])).toBe(true);
    expect(nextStatus(reimb("aguardando_diretoria_pagamento"), "rejeitar", 300).status).toBe("rejeitado");
  });
  it("diretoria aprova e rejeita inclusive as próprias solicitações", () => {
    expect(canPerform("aprovar", adv("aguardando_diretoria"), "u1", ["diretoria"])).toBe(true);
    expect(canPerform("aprovar", adv("aguardando_diretoria_excedente"), "u1", ["diretoria"])).toBe(true);
    expect(canPerform("aprovar", reimb("aguardando_diretoria_pagamento"), "u1", ["diretoria"])).toBe(true);
    expect(canPerform("rejeitar", reimb("aguardando_diretoria_pagamento"), "u1", ["diretoria"])).toBe(true);
  });
  it("financeiro não confere, paga, devolve nem rejeita a própria solicitação", () => {
    const fin = ["financeiro", "diretoria"] as const;
    expect(canPerform("pagar_adiantamento", adv("aprovado"), "u1", [...fin])).toBe(false);
    expect(canPerform("conferir", reimb("em_conferencia"), "u1", [...fin])).toBe(false);
    expect(canPerform("devolver_correcao", reimb("em_conferencia"), "u1", [...fin])).toBe(false);
    expect(canPerform("marcar_pago", reimb("a_pagar"), "u1", [...fin])).toBe(false);
    expect(canPerform("confirmar_devolucao", adv("aguardando_devolucao"), "u1", [...fin])).toBe(false);
    expect(canPerform("rejeitar", reimb("em_conferencia"), "u1", [...fin])).toBe(false);
    expect(canPerform("conferir", reimb("em_conferencia"), "x", ["financeiro"])).toBe(true);
  });
  it("admin media todo o processo, inclusive nas próprias solicitações", () => {
    for (const actor of ["x", "u1"]) {
      expect(canPerform("aprovar", adv("aguardando_diretoria"), actor, ["admin"])).toBe(true);
      expect(canPerform("aprovar", reimb("aguardando_diretoria_pagamento"), actor, ["admin"])).toBe(true);
      expect(canPerform("pagar_adiantamento", adv("aprovado"), actor, ["admin"])).toBe(true);
      expect(canPerform("conferir", reimb("em_conferencia"), actor, ["admin"])).toBe(true);
      expect(canPerform("devolver_correcao", reimb("em_conferencia"), actor, ["admin"])).toBe(true);
      expect(canPerform("marcar_pago", reimb("a_pagar"), actor, ["admin"])).toBe(true);
      expect(canPerform("confirmar_devolucao", adv("aguardando_devolucao"), actor, ["admin"])).toBe(true);
      expect(canPerform("rejeitar", reimb("em_conferencia"), actor, ["admin"])).toBe(true);
      expect(canPerform("rejeitar", adv("aguardando_diretoria"), actor, ["admin"])).toBe(true);
    }
  });
  it("admin continua sem enviar solicitação de outra pessoa", () => {
    expect(canPerform("enviar", reimb("rascunho"), "x", ["admin"])).toBe(false);
  });
  it("admin continua podendo criar e enviar as próprias solicitações", () => {
    expect(canPerform("enviar", reimb("rascunho"), "u1", ["admin"])).toBe(true);
    expect(canPerform("enviar_prestacao", adv("adiantamento_pago"), "u1", ["admin"])).toBe(true);
  });
  it("só o dono envia a própria solicitação", () => {
    expect(canPerform("enviar", reimb("rascunho"), "outro", ["gerente"])).toBe(false);
    expect(canPerform("enviar", reimb("rascunho"), "u1", ["gerente"])).toBe(true);
  });
});
