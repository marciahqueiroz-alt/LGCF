# Rota Despesas

Controle de despesas de viagem: depósito prévio (adiantamento), prestação de contas e reembolso, com leitura automática de recibos por IA.

Feito com TanStack Start, React, Tailwind CSS e Supabase. Leitura de recibos pela OpenAI e e-mails pelo Resend.

**Para publicar, siga o [PUBLICAR.md](PUBLICAR.md).**

## Fluxos

**Depósito prévio:** Rascunho → Diretoria aprova o orçamento → Financeiro deposita → gerente presta contas → Financeiro confere →
- gastou igual ao depósito: Concluído;
- gastou menos: Aguardando devolução (gerente anexa o comprovante) → Financeiro confirma → Concluído;
- gastou mais: Diretoria aprova o excedente → Financeiro paga → Pago.

**Reembolso:** Rascunho → Financeiro confere → Diretoria libera → Financeiro paga → Pago.

O Financeiro pode devolver para correção durante a conferência, mas nunca confere, deposita ou paga a própria solicitação. A Diretoria pode aprovar qualquer solicitação, inclusive as suas. O Admin pode executar qualquer etapa.

## Perfis

| Perfil | Pode |
| --- | --- |
| Gerente / Colaborador | Criar, enviar e prestar contas das próprias solicitações |
| Financeiro | Conferir, depositar, pagar, confirmar devoluções e ver CPF; não age nas próprias solicitações |
| Diretoria | Aprovar ou rejeitar orçamentos, excedentes e pagamentos, inclusive os próprios |
| Admin | Único que atribui perfis em **Usuários**; media todo o processo e pode executar qualquer etapa, inclusive nas próprias solicitações |

Novos cadastros entram como Gerente. O cadastro **não** cria administradores: o primeiro admin é definido direto no banco:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'pessoa@empresa.com.br';
```

## Recursos

- Foto ou PDF do recibo com preenchimento automático (até 30 leituras por hora e 100 por dia por pessoa).
- Bloqueio do mesmo arquivo de recibo em duas despesas e aviso de possível duplicidade (mesma data, valor e estabelecimento).
- Exportação da solicitação para Excel (resumo, despesas e histórico).
- E-mail ao Financeiro quando uma nova solicitação é enviada.
- Recibos ficam travados depois do envio; comprovantes de devolução nunca podem ser apagados.

## Configuração

Todas as variáveis estão explicadas em [.env.example](.env.example):

| Variável | Para quê |
| --- | --- |
| `VITE_SUPABASE_URL`, `SUPABASE_URL` | Endereço do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PUBLISHABLE_KEY` | Chave pública do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave secreta do Supabase (só no servidor) |
| `OPENAI_API_KEY`, `OPENAI_MODEL` (opcional) | Leitura de recibos por IA |
| `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL` | E-mails ao Financeiro |
| `APP_URL` | Endereço publicado, usado no link do e-mail |

Sem `RESEND_API_KEY`, o app funciona e só não envia e-mails. Sem `OPENAI_API_KEY`, os dados do recibo são preenchidos à mão.

## Banco de dados

- `supabase/migrations`: cada mudança do banco, em ordem de data.
- `supabase/setup.sql`: tudo junto, para instalar num projeto Supabase novo pelo SQL Editor.

## Desenvolvimento local

```sh
npm install
npm test
npm run dev
```
