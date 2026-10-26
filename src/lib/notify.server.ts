// Server-only: e-mails the Financeiro team through Resend. Load inside server handlers with a dynamic import.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { brl, TYPE_LABEL, type RequestType } from "./workflow";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type NewRequest = { id: string; title: string; type: RequestType; destination: string; amount: number; ownerId: string };

/** Never throws: a failed e-mail must not undo a submitted request. */
export async function notifyFinanceNewRequest(req: NewRequest, origin: string | null) {
  try {
    const apiKey = process.env["RESEND_API_KEY"];
    const from = process.env["NOTIFY_FROM_EMAIL"];
    if (!apiKey || !from) {
      console.warn("[notify] RESEND_API_KEY ou NOTIFY_FROM_EMAIL ausente; e-mail ao Financeiro não enviado.");
      return;
    }
    const { data: roles, error } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "financeiro");
    if (error) throw error;
    const ids = [...new Set((roles ?? []).map((r) => r.user_id))].filter((id) => id !== req.ownerId);
    if (!ids.length) return;
    const { data: people, error: peopleError } = await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", [...ids, req.ownerId]);
    if (peopleError) throw peopleError;
    const owner = people?.find((p) => p.id === req.ownerId);
    const to = (people ?? []).filter((p) => p.id !== req.ownerId && p.email).map((p) => p.email);
    if (!to.length) return;

    const base = (process.env["APP_URL"] || origin || "").replace(/\/$/, "");
    const link = base ? `${base}/solicitacoes/${req.id}` : "";
    const ownerName = owner?.full_name || owner?.email || "Um colaborador";
    const amountLine = req.type === "adiantamento" ? `Orçamento solicitado: ${brl(req.amount)}` : `Total das despesas: ${brl(req.amount)}`;
    const subject = `Nova solicitação: ${req.title} — ${ownerName}`;
    const text = [
      `${ownerName} enviou uma nova solicitação no Rota Despesas.`,
      "",
      `Título: ${req.title}`,
      `Tipo: ${TYPE_LABEL[req.type]}`,
      ...(req.destination ? [`Destino: ${req.destination}`] : []),
      amountLine,
      ...(link ? ["", `Abrir: ${link}`] : []),
    ].join("\n");
    const html = `<p>${escapeHtml(ownerName)} enviou uma nova solicitação no <b>Rota Despesas</b>.</p>
<ul>
<li><b>Título:</b> ${escapeHtml(req.title)}</li>
<li><b>Tipo:</b> ${escapeHtml(TYPE_LABEL[req.type])}</li>
${req.destination ? `<li><b>Destino:</b> ${escapeHtml(req.destination)}</li>` : ""}
<li>${escapeHtml(amountLine)}</li>
</ul>
${link ? `<p><a href="${escapeHtml(link)}">Abrir a solicitação</a></p>` : ""}`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text, html }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  } catch (e) {
    console.error("[notify] Falha ao avisar o Financeiro", e);
  }
}
