# CONTEXTO_01 — ZapFlow (zapflow-saas)

Sessão de 10/08/2026. Leia este arquivo no início da próxima conversa sobre o ZapFlow.

## O que é o projeto

Clone moderno do ManyChat focado em Instagram, para uso pessoal do Gabriel (não é
multiempresa/multi-tenant hoje). Substituiu totalmente o ZapFlow antigo (Vite+Express) —
esse projeto novo é o único que segue em desenvolvimento.

- Stack: Next.js 16 (App Router) + TypeScript + Tailwind + componentes estilo shadcn/ui
  (feitos à mão, sem CLI), Auth.js v5 (e-mail/senha + Google), Drizzle ORM + PostgreSQL (Neon),
  Meta Graph API (Instagram), hospedado na Netlify.
- Pasta local: `C:\Users\gabri\Downloads\zapflow-saas`
- Repositório: `https://github.com/gabriel-conzi/ZapFlow.git` (branch `main`)
- Site publicado: `https://cheerful-pony-eadf56.netlify.app`
- Gabriel é leigo em código — nunca edita nada manualmente. Sempre entregar arquivos
  completos ou comandos prontos pra copiar/colar (PowerShell ou CMD).

## Status: Fase 1 completa e testada em produção

- [x] Cadastro (`/register`) e login (`/login`) funcionando de verdade no site publicado.
- [x] Dashboard, Inbox, Contatos, Automações, Configurações, Assinatura (só Configurações
      tem lógica real hoje; o resto é estrutura pronta pra Fase 2+).
- [x] Conexão real da conta do Instagram **@usepostflow** — testada e confirmada
      funcionando (aparece "Conectado" na tela de Configurações).

## Erros resolvidos nesta sessão (não repetir)

1. **UntrustedHost do Auth.js** — faltava `trustHost: true` em `src/lib/auth.ts` (obrigatório
   na Netlify, diferente da Vercel que detecta sozinho).
2. **Cadastro dava 405 Method Not Allowed** — `src/proxy.ts` (middleware) não tinha
   `/api/register` na lista `PUBLIC_PATHS`, então redirecionava POST pra `/login` (que só
   aceita GET). Corrigido incluindo `/api/register` na lista.
3. **netlify.toml salvo como `netlify.toml.txt`** pelo Notepad (extensão escondida) — nunca
   usar Notepad com esse usuário; sempre comando de terminal pra criar/editar arquivo.
4. **Env vars novas não pegavam** — depois de adicionar variável na Netlify, é preciso um
   novo deploy ("Clear cache and deploy site") pra função pegar o valor.
5. **Webhook do Instagram não validava no Meta** ("Não foi possível validar a URL de callback")
   — causa real: o site na Netlify estava com **Project visibility = Private**
   (Project configuration → Visitor access), o que bloqueia requisições de fora (inclusive o
   validador do Meta) mesmo que o dono logado consiga acessar normalmente. Corrigido mudando
   pra **Public**.
6. **Permissões inválidas no login do Instagram** ("Invalid Scopes: pages_show_list...") —
   o código original usava o fluxo clássico (Facebook Login for Business + Instagram Graph
   API via Página do Facebook), mas esse app novo no Meta só tinha o produto moderno
   habilitado ("API do Instagram" / Instagram Login direto, sem precisar de Página).
   Reescrito `src/app/api/instagram/connect/route.ts` e `.../callback/route.ts` pra usar
   `instagram.com/oauth/authorize` + `graph.instagram.com` em vez de `facebook.com`/
   `graph.facebook.com`. Coluna `page_id` da tabela `instagram_accounts` virou opcional
   (`pageId: text("page_id")`, sem `.notNull()`) porque esse fluxo não tem Página vinculada.

## App no Meta for Developers

- Nome: **ZapFlow** · Portfólio empresarial: **Use Post Flow**
- App ID (Facebook): `1084427634158782`
- ID do app do Instagram: `4580471795509562`
- Caso de uso ativo: **API do Instagram** (Instagram Login direto — não usa Página do
  Facebook). Permissões: `instagram_business_basic`, `instagram_business_manage_comments`,
  `instagram_business_manage_messages`.
- Testador do Instagram cadastrado e aceito: conta **@usepostflow**.
- Webhook configurado e validado: `https://cheerful-pony-eadf56.netlify.app/api/instagram/webhook`
- Redirecionamento OAuth cadastrado (nos dois lugares — Login do Facebook para Empresas E
  Configurar login da empresa no Instagram): `https://cheerful-pony-eadf56.netlify.app/api/instagram/callback`
- App ainda em modo **Development** (não publicado/Live) — funciona pra contas
  admin/testador. Se no futuro quiser liberar pra outras contas Instagram, precisa enviar
  pra análise do app (Passo 5 do assistente).

## Variáveis de ambiente na Netlify (site cheerful-pony-eadf56)

Já configuradas: `AUTH_SECRET`, `DATABASE_URL`, `META_APP_ID`, `META_APP_SECRET`,
`META_REDIRECT_URI`, `META_WEBHOOK_VERIFY_TOKEN`, `NEXTAUTH_URL`, `INSTAGRAM_APP_ID`,
`INSTAGRAM_APP_SECRET`.

Nota: `META_APP_ID`/`META_APP_SECRET` ficaram configurados mas **não são usados** pelo
fluxo atual (era pro fluxo clássico via Página, abandonado). `INSTAGRAM_APP_ID`/
`INSTAGRAM_APP_SECRET` são os que o código usa de verdade hoje.

## Netlify — configurações importantes do site

- Project visibility: **Public** (Project configuration → Visitor access) — precisa ficar
  assim pra webhooks/robôs externos conseguirem acessar. Se algum dia esse aviso "project is
  private" voltar a aparecer, é isso que precisa ser checado de novo.
- Build command: `npm run build` · Publish directory: `.next`
- `netlify.toml` na raiz com `[[plugins]] package = "@netlify/plugin-nextjs"`.

## Próximos passos (não iniciados)

- **Fase 2**: inbox real — listar as conversas de verdade vindas do Instagram (banco já tem
  as tabelas `conversations`/`messages`), responder manualmente pela interface.
- **Fase 3**: processar os webhooks de verdade (hoje só loga no console, ver
  `src/app/api/instagram/webhook/route.ts`), construtor visual de automações.
- **Fase 4**: respostas automáticas com IA (OpenAI).
- **Fase 5**: assinatura via Stripe, logs, polimento geral.

## Regras que continuam valendo

- Gabriel nunca edita código — sempre arquivo pronto ou comando pra copiar/colar.
- ZapFlow é 100% independente do usepostflow (projeto separado, sem integração de código).
- Sempre CMD ou PowerShell conforme indicado no comando (heredoc `<<EOF` não funciona no
  cmd.exe do Windows; usar `@'...'@ | Set-Content` no PowerShell pra arquivos multi-linha).
