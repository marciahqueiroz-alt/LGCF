import { describe, expect, it } from "vitest";
import { canUploadReturnReceipt, validateReturnReceipt } from "./return-receipts";
import type { WorkflowRequest } from "./workflow";

const req: WorkflowRequest = { type: "adiantamento", status: "aguardando_devolucao", user_id: "gerente", advance_amount: 1000 };
describe("comprovante da devolução", () => {
  it("permite ao gerente dono anexar a devolução do depósito prévio", () => {
    expect(canUploadReturnReceipt(req, "gerente")).toBe(true);
    expect(canUploadReturnReceipt(req, "outro")).toBe(false);
  });
  it("não permite anexar fora da devolução pendente", () => {
    expect(canUploadReturnReceipt({ ...req, status: "concluido" }, "gerente")).toBe(false);
    expect(canUploadReturnReceipt({ ...req, type: "reembolso" }, "gerente")).toBe(false);
  });
  it("aceita comprovantes em imagem ou PDF até o limite do armazenamento", () => {
    expect(() => validateReturnReceipt({ type: "application/pdf", size: 10 * 1024 * 1024 })).not.toThrow();
    expect(() => validateReturnReceipt({ type: "image/jpeg", size: 1000 })).not.toThrow();
    expect(() => validateReturnReceipt({ type: "text/html", size: 1000 })).toThrow();
    expect(() => validateReturnReceipt({ type: "application/pdf", size: 10 * 1024 * 1024 + 1 })).toThrow();
  });
});