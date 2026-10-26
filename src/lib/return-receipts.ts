import type { WorkflowRequest } from "./workflow";

export function canUploadReturnReceipt(req: WorkflowRequest, actorId: string) {
  return req.user_id === actorId && req.type === "adiantamento" && req.status === "aguardando_devolucao";
}

export function validateReturnReceipt(file: Pick<File, "type" | "size">) {
  if (!file.type.startsWith("image/") && file.type !== "application/pdf")
    throw new Error("Selecione uma imagem ou PDF.");
  if (file.size > 10 * 1024 * 1024) throw new Error("O comprovante deve ter no máximo 10 MB.");
}