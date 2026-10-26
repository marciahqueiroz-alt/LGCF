import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plane } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cpfDigits, formatCpf, validCpf } from "@/lib/cpf";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Rota Despesas" },
      { name: "description", content: "Acesse sua conta para gerenciar despesas de viagem." },
      { property: "og:title", content: "Entrar — Rota Despesas" },
      { property: "og:description", content: "Acesse sua conta para gerenciar despesas de viagem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [f, setF] = useState({ email: "", password: "", full_name: "", department: "", cost_center: "", cpf: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/painel" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
        if (error) {
          if (/not confirmed/i.test(error.message)) {
            setSent(true);
            toast.error("Confirme seu e-mail antes de entrar.");
            return;
          }
          throw error;
        }
        navigate({ to: "/painel" });
      } else if (mode === "signup") {
        if (!validCpf(f.cpf)) throw new Error("Informe um CPF válido.");
        const { error } = await supabase.auth.signUp({
          email: f.email,
          password: f.password,
          options: {
            emailRedirectTo: window.location.origin + "/painel",
            data: { full_name: f.full_name, department: f.department, cost_center: f.cost_center, cpf: cpfDigits(f.cpf) },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Confira seu e-mail para confirmar o cadastro.");
        setSent(true);
        setMode("login");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(f.email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        toast.success("Enviamos um link para redefinir sua senha.");
        setMode("login");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!f.email) {
      toast.error("Digite seu e-mail primeiro.");
      return;
    }
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: f.email,
      options: { emailRedirectTo: window.location.origin + "/painel" },
    });
    setResending(false);
    if (error) toast.error(error.message);
    else toast.success("E-mail de confirmação enviado de novo. Confira também a caixa de spam.");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-hero px-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl bg-card p-8 shadow-card">
        <div className="flex items-center gap-2 font-display text-lg font-bold text-primary">
          <Plane className="size-5" /> Rota Despesas
        </div>
        <h1 className="text-2xl font-bold">
          {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Recuperar senha"}
        </h1>
        {sent && (
          <div className="space-y-2 rounded-xl border border-primary/25 bg-primary/5 p-4">
            <p className="text-sm font-semibold text-foreground">Confirme seu e-mail para entrar</p>
            <p className="text-sm text-muted-foreground">
              Enviamos um link para {f.email || "seu e-mail"}. Abra esse e-mail e clique no link para ativar a conta;
              depois volte aqui para entrar. Não apareceu? Confira a caixa de spam ou envie de novo.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={resend} disabled={resending}>
              {resending ? "Enviando..." : "Reenviar e-mail de confirmação"}
            </Button>
          </div>
        )}
        {mode === "signup" && (
          <>
            <Field label="Nome completo"><Input required value={f.full_name} onChange={set("full_name")} /></Field>
            <Field label="CPF"><Input aria-label="CPF" required inputMode="numeric" placeholder="000.000.000-00" maxLength={14} value={f.cpf} onChange={(e) => setF({ ...f, cpf: formatCpf(e.target.value) })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Departamento"><Input required value={f.department} onChange={set("department")} /></Field>
              <Field label="Centro de custo"><Input required value={f.cost_center} onChange={set("cost_center")} /></Field>
            </div>
          </>
        )}
        <Field label="E-mail"><Input type="email" required value={f.email} onChange={set("email")} /></Field>
        {mode !== "forgot" && (
          <Field label="Senha"><Input type="password" required minLength={6} value={f.password} onChange={set("password")} /></Field>
        )}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Aguarde..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
        </Button>
        <div className="flex justify-between text-sm">
          {mode === "login" ? (
            <>
              <button type="button" className="text-primary hover:underline" onClick={() => { setSent(false); setMode("signup"); }}>Criar conta</button>
              <button type="button" className="text-muted-foreground hover:underline" onClick={() => { setSent(false); setMode("forgot"); }}>Esqueci a senha</button>
            </>
          ) : (
            <button type="button" className="text-primary hover:underline" onClick={() => { setSent(false); setMode("login"); }}>Voltar para entrar</button>
          )}
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
