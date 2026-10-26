import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { canPerform, nextStatus, type AppRole, type WorkflowAction } from "./workflow";

export const transitionRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; action: WorkflowAction; note?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: req, error } = await supabase.from("requests").select("*").eq("id", data.id).single();
    if (error || !req) throw new Error("Solicitação não encontrada");
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (roleRows ?? []).map((r) => r.role as AppRole);
    const wf = { ...req, advance_amount: Number(req.advance_amount) };
    if (!canPerform(data.action, wf, userId, roles)) throw new Error("Você não tem permissão para esta ação");

    const { data: exps, error: expenseError } = await supabase.from("expenses").select("amount").eq("request_id", data.id);
    if (expenseError) throw new Error("Não foi possível verificar as despesas");
    const spent = (exps ?? []).reduce((s, e) => s + Number(e.amount), 0);
    if ((data.action === "enviar" && req.type === "reembolso") || data.action === "enviar_prestacao") {
      if (!exps?.length) throw new Error("Adicione ao menos uma despesa antes de enviar");
    }
    if (data.action === "enviar" && req.type === "adiantamento" && Number(req.advance_amount) <= 0) {
      throw new Error("Informe o valor do orçamento");
    }
    const t = nextStatus(wf, data.action, spent);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Database["public"]["Tables"]["requests"]["Update"] = {
      status: t.status,
      last_note: data.note ?? "",
      updated_at: new Date().toISOString(),
      spent_amount: spent,
    };
    if (t.settlement_amount !== undefined) patch.settlement_amount = t.settlement_amount;
    if (data.action === "enviar") patch.submitted_at = new Date().toISOString();
    if (t.status === "pago" || data.action === "pagar_adiantamento") patch.paid_at = new Date().toISOString();
    const { error: upErr } = await supabaseAdmin.from("requests").update(patch).eq("id", data.id).eq("status", req.status).select("id").single();
    if (upErr) throw new Error(upErr.message);
    await supabaseAdmin.from("request_events").insert({
      request_id: data.id,
      actor_id: userId,
      action: data.action,
      from_status: req.status,
      to_status: t.status,
      note: data.note ?? "",
    });
    if (data.action === "enviar") {
      const { getRequest } = await import("@tanstack/react-start/server");
      const { notifyFinanceNewRequest } = await import("./notify.server");
      await notifyFinanceNewRequest(
        { id: req.id, title: req.title, type: req.type, destination: req.destination, ownerId: req.user_id, amount: req.type === "adiantamento" ? Number(req.advance_amount) : spent },
        getRequest()?.headers.get("origin") ?? null,
      );
    }
    return { status: t.status };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: AppRole; enabled: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas administradores");
    if (data.userId === context.userId && data.role === "admin" && !data.enabled)
      throw new Error("Você não pode remover seu próprio acesso de administrador");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.enabled) {
      const { error } = await supabaseAdmin.from("user_roles").upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error("Não foi possível atribuir o perfil");
    } else {
      const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role);
      if (error) throw new Error("Não foi possível remover o perfil");
    }
    return { ok: true };
  });

export type ReceiptScan = {
  vendor: string;
  date: string | null;
  amount: number | null;
  category: string;
  description: string;
};

/** Vision-capable OpenAI model used when OPENAI_MODEL is not set. */
const DEFAULT_OPENAI_MODEL = "gpt-5-mini";

/** Per-user AI reading limits: [window in ms, max readings]. */
const SCAN_LIMITS: [number, number][] = [
  [60 * 60 * 1000, 30],
  [24 * 60 * 60 * 1000, 100],
];

export const scanReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dataUrl: string }) => {
    if (!input.dataUrl?.startsWith("data:")) throw new Error("Imagem inválida");
    if (input.dataUrl.length > 8_000_000) throw new Error("Imagem muito grande");
    return input;
  })
  .handler(async ({ data, context }): Promise<ReceiptScan> => {
    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) throw new Error("Leitura automática não configurada");
    const modelId = process.env["OPENAI_MODEL"] || DEFAULT_OPENAI_MODEL;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const [ms, max] of SCAN_LIMITS) {
      const { count, error } = await supabaseAdmin
        .from("receipt_scans")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .gte("created_at", new Date(Date.now() - ms).toISOString());
      if (error) throw new Error("Não foi possível ler o recibo. Preencha os dados manualmente.");
      if ((count ?? 0) >= max) throw new Error("Limite de leituras automáticas atingido. Preencha os dados manualmente.");
    }
    await supabaseAdmin.from("receipt_scans").insert({ user_id: context.userId });
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { generateText, Output, jsonSchema } = await import("ai");
    const provider = createOpenAI({ apiKey });
    const isPdf = data.dataUrl.startsWith("data:application/pdf");
    const filePart = isPdf
      ? { type: "file" as const, filename: "recibo.pdf", data: data.dataUrl.split(",")[1] ?? "", mediaType: "application/pdf" }
      : { type: "image" as const, image: new URL(data.dataUrl) };
    const schema = jsonSchema<ReceiptScan>({
      type: "object",
      additionalProperties: false,
      required: ["vendor", "date", "amount", "category", "description"],
      properties: {
        vendor: { type: "string", description: "Nome do estabelecimento" },
        date: { type: ["string", "null"], description: "Data no formato YYYY-MM-DD" },
        amount: { type: ["number", "null"], description: "Valor total pago em reais" },
        category: {
          type: "string",
          enum: ["hospedagem", "alimentacao", "transporte", "combustivel", "passagem", "outros"],
        },
        description: { type: "string", description: "Resumo curto da despesa em português" },
      },
    });
    // Reasoning models (gpt-5*, o*) accept a reasoning effort; other models reject the option.
    const reasoning = /^(gpt-5|o\d)/.test(modelId);
    let text: string;
    try {
      ({ text } = await generateText({
        model: provider.responses(modelId),
        system:
          "Você lê recibos e notas fiscais brasileiras de despesas de viagem e extrai os dados. Use o valor TOTAL pago. Se algo não estiver legível, use null.",
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: "Extraia os dados deste recibo." }, filePart],
          },
        ],
        experimental_output: Output.object({ schema }),
        providerOptions: {
          openai: reasoning ? { reasoningEffort: "low", store: false } : { store: false },
        },
      }));
    } catch (e) {
      const status = (e as { statusCode?: number })?.statusCode;
      console.error("[scanReceipt] OpenAI falhou", e);
      if (status === 429) throw new Error("Muitas leituras agora ou créditos da OpenAI esgotados. Preencha os dados manualmente.");
      throw new Error("Não foi possível ler o recibo. Preencha os dados manualmente.");
    }
    try {
      return JSON.parse(text) as ReceiptScan;
    } catch {
      throw new Error("Não foi possível ler o recibo. Preencha os dados manualmente.");
    }
  });
