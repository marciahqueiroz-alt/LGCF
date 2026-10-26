# Como publicar o Rota Despesas fora do Lovable

Tempo estimado: 1 a 2 horas na primeira vez. Não precisa programar; é criar contas, copiar chaves e colar SQL.

Você vai montar 4 peças:

| Peça | Serviço | Para quê |
| --- | --- | --- |
| Código | GitHub | Guardar o projeto e publicar automaticamente a cada mudança |
| Banco, login e arquivos | Supabase | Usuários, solicitações, despesas e recibos |
| Hospedagem | Vercel (ou Netlify) | Deixar o app no ar num endereço |
| Serviços | OpenAI e Resend | Ler recibos por IA e enviar e-mails |

---

## Passo 1 — Colocar o código no GitHub

O jeito mais simples é o **GitHub Desktop** (o site só aceita 100 arquivos por envio, e o projeto tem cerca de 130).

1. Crie uma conta em [github.com](https://github.com) e instale o [GitHub Desktop](https://desktop.github.com).
2. No GitHub Desktop: **File → Add local repository**, escolha a pasta `rota-despesas-independente` e, quando ele perguntar, clique em **create a repository** (deixe *Git ignore* em *None*, porque a pasta já tem um).
3. Escreva um resumo como `Versão inicial` e clique em **Commit to main**.
4. Clique em **Publish repository**, deixe **Keep this code private** marcado e publique.
   - O arquivo `.gitignore` já impede que um `.env` com senhas seja enviado.

> Se alguém da equipe usa Git no terminal, pode fazer `git init`, `git add .`, `git commit` e `git push` no lugar destes passos.

---

## Passo 2 — Criar o banco no Supabase

1. Crie uma conta em [supabase.com](https://supabase.com) e clique em **New project**.
   - Nome: `rota-despesas`
   - Região: **South America (São Paulo)**
   - Anote a senha do banco num lugar seguro.
2. Quando o projeto terminar de criar, abra **SQL Editor** → **New query**.
3. Abra o arquivo [`supabase/setup.sql`](supabase/setup.sql), copie **tudo**, cole no editor e clique em **Run**.
   - Deve aparecer *Success. No rows returned*.
   - Isso cria as tabelas, as regras de acesso, o local dos recibos (`receipts`) e todas as proteções.
4. Abra **Storage** e confira que existe o bucket **receipts** marcado como privado.

### Chaves do Supabase
Em **Project Settings → API Keys** (ou **API**), anote:

| O que | Onde usar |
| --- | --- |
| **Project URL** (ex.: `https://abcd.supabase.co`) | `VITE_SUPABASE_URL` e `SUPABASE_URL` |
| **Publishable key** (ou *anon public*) | `VITE_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_PUBLISHABLE_KEY` |
| **Secret key** (ou *service_role*) — **secreta** | `SUPABASE_SERVICE_ROLE_KEY` |

---

## Passo 3 — Chave da OpenAI (leitura de recibos)

1. Entre em [platform.openai.com](https://platform.openai.com), cadastre um cartão em **Billing** e coloque um limite de gasto mensal (ex.: US$ 10).
2. Em **API keys**, crie uma chave chamada `rota-despesas` e anote (começa com `sk-`). É secreta.
3. O app usa o modelo `gpt-5-mini` por padrão. Para trocar, defina `OPENAI_MODEL` (precisa ser um modelo que lê imagens).

---

## Passo 4 — Resend (e-mails)

1. Crie uma conta em [resend.com](https://resend.com).
2. Em **Domains**, adicione o domínio da empresa (ex.: `suaempresa.com.br`) e cadastre os registros DNS que ele mostrar (quem cuida do site/domínio da empresa faz isso em minutos). Espere ficar **Verified**.
3. Em **API Keys**, crie uma chave e anote (começa com `re_`).

### Usar o Resend nos e-mails de login do Supabase
O Supabase, sem isso, envia poucos e-mails por hora e eles caem no spam.
Em Supabase → **Authentication → Emails → SMTP Settings**, ative **Custom SMTP**:

| Campo | Valor |
| --- | --- |
| Sender email | `despesas@suaempresa.com.br` |
| Sender name | `Rota Despesas` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | a chave `re_...` |

---

## Passo 5 — Publicar na Vercel

> **Uso comercial:** o plano gratuito (*Hobby*) da Vercel é só para uso pessoal. Para a empresa, use o plano **Pro** (cerca de US$ 20/mês) ou a alternativa Netlify no fim deste guia.

1. Crie uma conta em [vercel.com](https://vercel.com) entrando com o GitHub.
2. Clique em **Add New → Project** e importe o repositório `rota-despesas`.
3. Deixe *Framework Preset* como está (ou **Other**). Build command: `npm run build`.
4. Abra **Environment Variables** e cadastre:

| Nome | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key |
| `OPENAI_API_KEY` | `sk-...` |
| `RESEND_API_KEY` | `re_...` |
| `NOTIFY_FROM_EMAIL` | `Rota Despesas <despesas@suaempresa.com.br>` |
| `APP_URL` | o endereço final do app (pode ajustar depois) |

5. Clique em **Deploy** e espere terminar. A Vercel mostra o endereço (ex.: `rota-despesas.vercel.app`).
6. (Opcional) Em **Settings → Domains**, ligue um endereço próprio, como `despesas.suaempresa.com.br`, e atualize `APP_URL`.

> Toda vez que algo mudar no GitHub, a Vercel publica de novo sozinha.

---

## Passo 6 — Ligar o login ao endereço do app

No Supabase → **Authentication → URL Configuration**:

- **Site URL:** o endereço do app (ex.: `https://despesas.suaempresa.com.br`)
- **Redirect URLs:** adicione `https://despesas.suaempresa.com.br/**`
  (e também o endereço `.vercel.app`, se for usar)

Sem isso, o link de confirmação de cadastro e o de "Esqueci a senha" não funcionam.

---

## Passo 7 — Primeiro acesso

1. Abra o app, clique em **Criar conta** e cadastre-se. Confirme pelo e-mail.
2. No Supabase → **SQL Editor**, rode (com o seu e-mail):

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'seu-email@empresa.com.br';
```

3. Saia e entre de novo no app. O menu **Usuários** vai aparecer.
4. Peça para a equipe se cadastrar e atribua os perfis (Financeiro, Diretoria...) em **Usuários**.

---

## Passo 8 — Testar antes de liberar

- [ ] Criar uma solicitação de reembolso, fotografar um recibo e ver os campos preenchidos.
- [ ] Enviar a solicitação e conferir se o Financeiro recebeu o e-mail.
- [ ] Tentar lançar o mesmo arquivo de recibo de novo (deve bloquear).
- [ ] Conferir, aprovar e marcar como pago com os perfis certos.
- [ ] Exportar para Excel.
- [ ] Abrir no celular e usar **Adicionar à tela inicial**.

---

## Custos aproximados (confira nos sites, os valores mudam)

| Serviço | Gratuito | Observação |
| --- | --- | --- |
| Supabase | Sim | O gratuito **pausa após ~7 dias sem uso**. Para uso diário da empresa, plano Pro (~US$ 25/mês), que também faz backup diário. |
| Vercel | Só uso pessoal | Pro ~US$ 20/mês por pessoa da conta |
| OpenAI | Não | Paga por uso; cada leitura de recibo custa frações de centavo de dólar |
| Resend | Sim | Até alguns milhares de e-mails por mês |

---

## Alternativa: Netlify em vez da Vercel

O plano gratuito da Netlify permite uso comercial.

1. Em [netlify.com](https://netlify.com) → **Add new site → Import from Git** → escolha o repositório.
2. Build command: `npm run build`.
3. Em **Environment variables**, cadastre as mesmas variáveis do Passo 5 **e** `NITRO_PRESET` = `netlify`.
4. Faça o deploy e siga os Passos 6 a 8 com o endereço da Netlify.

---

## Desenvolvimento no computador (opcional)

Só se alguém for mexer no código:

1. Instale o [Node.js](https://nodejs.org) versão 20 ou mais nova.
2. Copie `.env.example` para `.env` e preencha.
3. No terminal, dentro da pasta:

```sh
npm install
npm test
npm run dev
```

4. Abra http://localhost:3000 e adicione `http://localhost:3000/**` nas Redirect URLs do Supabase.

## Mudanças no banco no futuro

Novas mudanças viram um arquivo novo em `supabase/migrations` (com data no nome). Rode o conteúdo dele no SQL Editor do Supabase **antes** de publicar o código que depende dele, e atualize o `supabase/setup.sql`.
