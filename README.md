# ZapFlow — automação de Instagram (clone estilo ManyChat)

Painel de automação de Instagram: conectar sua conta comercial, receber e responder Direct e
comentários automaticamente, construtor visual de fluxos e IA — usando só a API oficial da Meta.

**Status: Fase 1 concluída.** Login, banco de dados e conexão com o Instagram já funcionam.
Caixa de entrada, automações de verdade e IA chegam nas próximas fases (veja o roadmap no final).

## Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, componentes no
  padrão shadcn/ui (Radix UI + Tailwind)
- **Backend:** Next.js API Routes (Node.js)
- **Banco:** PostgreSQL, via [Neon](https://neon.tech) (gratuito), acessado com Drizzle ORM
- **Autenticação:** Auth.js v5 — e-mail/senha e login com Google
- **Hospedagem:** Netlify
- **Integrações:** Meta Graph API (Instagram Business Login, Webhooks)

## Estrutura de pastas

```
zapflow-saas/
  src/
    app/
      (auth)/login, (auth)/register        → páginas públicas de login/cadastro
      (dashboard)/                          → painel (protegido por login)
        dashboard/  inbox/  contacts/  automations/  settings/  billing/
      api/
        auth/[...nextauth]                  → Auth.js
        register                            → criação de conta
        instagram/connect                   → inicia o OAuth da Meta
        instagram/callback                  → recebe o retorno do OAuth, salva a conexão
        instagram/webhook                   → recebe eventos em tempo real da Meta
    components/ui/                          → componentes de interface (botão, card, input...)
    db/
      schema.ts                             → modelo completo do banco (Drizzle)
      index.ts                              → conexão com o Postgres
    lib/
      auth.ts                               → configuração do Auth.js
      workspace.ts                          → helper para pegar o workspace do usuário logado
    proxy.ts                                → protege as rotas do painel (exige login)
  drizzle/                                  → SQL de migração gerado a partir do schema.ts
  .env.example                              → todas as variáveis de ambiente necessárias
```

## Passo a passo — rodar localmente

### 1. Pré-requisitos

- [Node.js](https://nodejs.org) 20 ou superior instalado.

### 2. Criar o banco de dados (Neon, gratuito)

1. Acesse [neon.tech](https://neon.tech) e crie uma conta gratuita.
2. Crie um novo projeto (pode chamar de `zapflow`).
3. Na tela do projeto, copie a **Connection string** (algo como
   `postgresql://usuario:senha@ep-xxxx.neon.tech/neondb?sslmode=require`).

### 3. Configurar as variáveis de ambiente

1. Dentro da pasta `zapflow-saas`, copie o arquivo `.env.example` e renomeie a cópia para `.env`.
2. Abra o `.env` com o Bloco de Notas e preencha:
   - `DATABASE_URL` → a connection string do Neon (passo 2).
   - `AUTH_SECRET` → qualquer texto aleatório longo (ou rode `npx auth secret` no terminal, dentro
     da pasta do projeto, que ele gera um pra você).
   - `NEXTAUTH_URL` → `http://localhost:3000` (pra rodar local; troque pela URL do Netlify quando
     publicar).
   - As demais variáveis (`META_*`, `AUTH_GOOGLE_*`) podem ficar em branco por enquanto — sem elas,
     só o login por e-mail/senha funciona, o que já é suficiente para testar a Fase 1.

### 4. Instalar e preparar o banco

No terminal, dentro da pasta `zapflow-saas`:

```
npm install
npm run db:push
```

O `db:push` cria todas as 16 tabelas no seu banco Neon a partir do `src/db/schema.ts`.

### 5. Rodar o app

```
npm run dev
```

Acesse `http://localhost:3000` — deve redirecionar pra tela de login. Clique em "Cadastre-se",
crie sua conta, e você cai direto no painel.

## Como testar cada funcionalidade da Fase 1

| Funcionalidade | Como testar |
|---|---|
| Cadastro | Vá em `/register`, preencha nome/e-mail/senha → deve criar a conta e já entrar logado |
| Login e-mail/senha | Saia (botão de logout na sidebar) e entre de novo em `/login` |
| Login Google | Só funciona depois de configurar `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` (veja abaixo) |
| Proteção de rotas | Tente acessar `/dashboard` sem estar logado → deve redirecionar pro login |
| Painel inicial | Deve mostrar contadores zerados (nenhum contato/conversa ainda, é esperado) |
| Conectar Instagram | Só funciona depois de configurar as chaves da Meta (veja abaixo) |

## Configurar o login com Google (opcional)

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Crie um projeto (ou use um existente) → "Criar credenciais" → "ID do cliente OAuth".
3. Tipo de aplicativo: "Aplicativo da Web".
4. Em "URIs de redirecionamento autorizados", adicione:
   `http://localhost:3000/api/auth/callback/google` (e depois a versão com o domínio do Netlify).
5. Copie o **Client ID** e **Client Secret** para `AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET` no `.env`.

## Configurar a conexão com o Instagram (Meta Developer)

Como o uso é só seu (não multi-tenant), você **não precisa passar pela revisão do app da Meta**
— contas cadastradas como administrador/testador do seu próprio app já podem usar todas as
permissões sem esperar aprovação.

1. Acesse [developers.facebook.com](https://developers.facebook.com/) e crie uma conta de
   desenvolvedor, se ainda não tiver.
2. "Meus Apps" → "Criar app" → tipo **"Empresa"**.
3. No painel do app, adicione o produto **"Instagram"** (Instagram Business Login/Graph API).
4. Em "Configurações básicas", copie o **ID do aplicativo** e o **Chave secreta do aplicativo**
   para `META_APP_ID` e `META_APP_SECRET` no `.env`.
5. Em "Facebook Login → Configurações", adicione em **URIs de redirecionamento OAuth válidos**:
   `http://localhost:3000/api/instagram/callback` (e depois a versão com o domínio do Netlify).
6. Sua conta comercial do Instagram precisa estar vinculada a uma Página do Facebook (é um
   requisito da própria Meta, não do ZapFlow) — se ainda não estiver, faça isso no app do
   Instagram: Configurações → Contas vinculadas → Facebook.
7. Adicione você mesmo como **testador** do app (Papéis → Testadores) usando a conta do Facebook
   ligada à sua Página.
8. Com o `.env` preenchido, reinicie `npm run dev`, vá em **Configurações** no painel do ZapFlow e
   clique em "Conectar Instagram".

### Configurar o Webhook (necessário a partir da Fase 3, pode deixar para depois)

1. No painel do app da Meta: produto "Webhooks" → "Instagram".
2. URL de callback: `https://SEU-DOMINIO-NETLIFY/api/instagram/webhook`
3. Token de verificação: o mesmo valor que você colocou em `META_WEBHOOK_VERIFY_TOKEN` no `.env`.
4. Inscreva-se nos campos `messages` e `comments`.

## Publicar no Netlify

1. Suba o projeto pro GitHub primeiro (veja a seção abaixo).
2. Acesse [app.netlify.com](https://app.netlify.com) → "Add new site" → "Import an existing
   project" → escolha o repositório `ZapFlow` no GitHub.
3. O Netlify detecta Next.js automaticamente — não precisa mudar comando de build.
4. Em "Site settings → Environment variables", adicione **todas** as variáveis do seu `.env`
   (com `NEXTAUTH_URL` e `META_REDIRECT_URI` já apontando para o domínio `.netlify.app` ou o seu
   domínio final).
5. Clique em "Deploy site".
6. **Dica:** o Netlify também tem uma extensão "Neon" (Integrations → Neon) que cria e conecta o
   banco automaticamente, se preferir não criar a conta separadamente no passo 2 do setup local.

## Subir o código para o GitHub

Repositório: `https://github.com/gabriel-conzi/ZapFlow.git`

No terminal, dentro da pasta `zapflow-saas` (rode um comando de cada vez):

```
git init
git add .
git commit -m "ZapFlow - Fase 1"
git branch -M main
git remote add origin https://github.com/gabriel-conzi/ZapFlow.git
git push -u origin main
```

Na primeira vez, o Git vai pedir para você fazer login no GitHub pelo navegador — é só autorizar.

## Roadmap (próximas fases)

- **Fase 2:** caixa de entrada de verdade (listar conversas do banco), responder manualmente,
  histórico de conversas.
- **Fase 3:** processar os webhooks da Meta (salvar mensagens/comentários recebidos automaticamente),
  construtor visual de automações, palavras-chave, condições, delay, tags.
- **Fase 4:** respostas automáticas com IA (OpenAI) e tela de configuração de prompt.
- **Fase 5:** página de assinatura funcional (Stripe), logs detalhados, polimento geral.

## Notas de arquitetura importantes

- O banco já está modelado com o conceito de **workspace** (empresa), mesmo você usando só um —
  isso evita ter que migrar dados se um dia o produto virar multiempresa de verdade.
- As tabelas de automação (`automations`) guardam o fluxo visual como JSON (`nodes`/`edges`), o
  mesmo formato usado por ferramentas como o React Flow — pronto pra Fase 3.
- `messages.sender` já diferencia mensagens do contato, do atendente humano, de uma automação ou
  da IA — importante pro histórico fazer sentido desde o início.
- Autenticação usa sessão via **JWT** (não sessão em banco) porque é o modo compatível com login
  por e-mail/senha (Credentials) no Auth.js v5.
