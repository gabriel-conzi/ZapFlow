# CONTEXTO_01 — ZapFlow (zapflow-saas)

Sessão de 10/08/2026, atualizado em 19/08/2026. Leia este arquivo no início da próxima conversa sobre o ZapFlow.

## ⚠️ REGRA MAIS IMPORTANTE — leia isto antes de responder qualquer coisa ao Gabriel

**O Gabriel é extremamente leigo em tecnologia — não é desenvolvedor, não é programador,
nunca usou terminal/git antes.** Ele pediu (14/08/2026) pra essa regra ser levada a sério de
verdade, porque uma sessão anterior falhou nisso na prática (disse "só falta você dar `git
add/commit/push`" sem explicar como, e ele ficou sem saber o que fazer).

Isso significa, sempre, sem exceção:

- **Nunca** mencionar um comando, passo técnico ou ação (ex: "dar git push", "rodar
  db:push", "criar uma variável de ambiente") sem imediatamente dar o passo a passo COMPLETO
  e MASTIGADO de como fazer isso — onde clicar, o que abrir, o que colar, nessa ordem.
  Presumir que ele não sabe abrir um terminal, não sabe o que é "raiz do projeto", não sabe
  onde fica "Environment variables" na Netlify, etc. Tudo isso precisa vir explicado, com
  caminho de cliques ou comando pronto pra copiar e colar.
- **Nunca** supor que uma instrução breve tipo "só falta X" é suficiente — sempre expandir em
  passo a passo numerado, mesmo que pareça óbvio pra quem programa.
- Quando o comando for de terminal (git, npm, etc.), dar o comando **pronto pra copiar e
  colar**, dizer exatamente onde abrir o terminal (ex: "na pasta `zapflow-saas`, pela barra de
  endereço do Explorador de Arquivos, digite `powershell` e aperte Enter") e explicar o que
  esperar ver acontecer depois de cada comando.
- Nunca pedir pra ele "editar o código" — sempre é a Claude que edita os arquivos (local, ou
  direto na máquina dele via device bridge) e só pede pra ele rodar comandos de terminal ou
  clicar em botões específicos de interface (Netlify, Mailgun, Meta, etc.).
- Segredos/senhas/chaves de API: nunca a Claude digita ou vê o valor — mas o passo de "ir até
  tal lugar, copiar tal campo, colar em tal outro campo" precisa ser descrito em detalhe,
  com nomes exatos de botões/menus, não só "copie a chave X pra Y".

## O que é o projeto

Clone moderno do ManyChat focado em Instagram, para uso pessoal do Gabriel (não é
multiempresa/multi-tenant hoje). Substituiu totalmente o ZapFlow antigo (Vite+Express) —
esse projeto novo é o único que segue em desenvolvimento.

A partir de 19/08/2026, o projeto ganhou uma segunda frente: virar também um **dashboard de
vendas em marketplace pra um canal de influencer** (ideia do Gabriel, formalizada em
`claude/estrategia-dashboard-influencer-marketplace-2026-08-19.md`, com pesquisa de mercado —
ManyChat+Shopify, Stan Store/Beacons/LTK, e o nicho brasileiro de "automação para afiliados"
como Shozap/IA Divulgadora/DivulgaLinks). Rota escolhida pelo Gabriel: **"vendedor automático
1-a-1"** (comentário/DM de interesse → automação responde com produto/link rastreado →
dashboard de cliques), usando só API oficial da Meta — sem disparo em massa pra grupo (isso
exigiria automação não-oficial de WhatsApp, risco de banimento, descartado conscientemente). A
vitrine pública de produtos deve aproveitar o `biopage` do Usepostflow (o outro produto do
Gabriel) em vez de ser reconstruída dentro do ZapFlow.

- Stack: Next.js 16 (App Router) + TypeScript + Tailwind + componentes estilo shadcn/ui
  (feitos à mão, sem CLI), Auth.js v5 (e-mail/senha + Google), Drizzle ORM + PostgreSQL (Neon),
  Meta Graph API (Instagram), hospedado na Netlify.
- Pasta local: `C:\Users\gabri\Downloads\zapflow-saas`
- Repositório: `https://github.com/gabriel-conzi/ZapFlow.git` (branch `main`)
- Site publicado: `https://cheerful-pony-eadf56.netlify.app` (deploy automático a cada push
  na branch `main` do GitHub — não precisa fazer nada na Netlify depois do `git push`, só
  esperar alguns minutos).
- Gabriel é leigo em código — nunca edita nada manualmente. Sempre entregar arquivos
  completos ou comandos prontos pra copiar/colar.
- **Terminal padrão: PowerShell, sempre** (Gabriel já está acostumado com ele desde antes —
  não trocar pra CMD sem motivo. Uma sessão trocou sem necessidade em 14/08/2026 e confundiu
  o Gabriel; os comandos de git funcionam idêntico nos dois, então não há razão pra usar CMD
  a não ser que o comando específico exija, o que é raro).

## Como publicar mudanças no site (passo a passo padrão, repetir sempre que a Claude alterar código)

Sempre que a Claude terminar de editar arquivos na pasta `zapflow-saas` do Gabriel, ela deve
dar este passo a passo completo (adaptando só a mensagem do commit):

1. Abra o **Explorador de Arquivos** do Windows e navegue até a pasta
   `C:\Users\gabri\Downloads\zapflow-saas`.
2. Clique uma vez na **barra de endereço** (a barra branca em cima que mostra o caminho da
   pasta), apague o que está escrito, digite `powershell` e aperte **Enter**. Isso abre uma
   janela azul de terminal já dentro da pasta certa.
3. Nessa janela azul, cole o comando abaixo e aperte Enter (um comando de cada vez, esperando
   cada um terminar antes do próximo):
   ```
   git add .
   ```
4. Depois cole e aperte Enter:
   ```
   git commit -m "descrição da mudança"
   ```
   (a Claude sempre substitui "descrição da mudança" por um texto pronto — o Gabriel só copia
   e cola exatamente como está)
5. Por fim, cole e aperte Enter:
   ```
   git push
   ```
   Na primeira vez pode pedir login do GitHub pelo navegador — é só autorizar.
6. Pronto — a Netlify detecta o push sozinha e publica o site automaticamente em 1-3 minutos.
   Não precisa fazer mais nada. Pra confirmar que terminou, dá pra abrir
   `https://app.netlify.com/projects/cheerful-pony-eadf56/deploys` e ver o deploy mais recente
   com uma bolinha verde "Published".

## Status: Fase 1 completa e testada em produção, Fase A do dashboard de vendas em código (aguardando publicar)

- [x] Cadastro (`/register`) e login (`/login`) funcionando de verdade no site publicado.
- [x] Dashboard, Inbox, Contatos, Automações, Produtos, Vendas, Configurações, Assinatura.
- [x] Conexão real de contas do Instagram e Páginas do Facebook — hoje o Gabriel tem 2 contas
      do Instagram conectadas (**@usepostflow**, **@fuxica_aqui**) e 2 Páginas do Facebook
      (**Usepostflow**, **Fuxicaaqui**).
- [x] Canal de e-mail via Mailgun — configurado, testado de ponta a ponta e CONFIRMADO
      funcionando pelo Gabriel.
- [x] Resposta manual pela Inbox — funciona nos 4 canais (Instagram, Facebook, Telegram,
      e-mail).
- [x] Estatísticas por automação (`/automations/[id]/stats`).
- [x] Botão de modo escuro/claro.
- [x] Enviar vídeo/arquivo/áudio nas automações.
- [x] Prévia da conversa em formato de celular no editor de automações (abas Visualização e Teste).
- [x] Galeria de modelos prontos ao clicar em "Nova automação".
- [x] Escopo de contas por automação.
- [x] Corrigido loop de mensagens entre as duas contas conectadas.
- [x] Corrigido nó novo aparecendo fora da área visível no editor de automações.
- [x] Campos customizados editáveis manualmente na tela de Contatos.
- [x] Página `/excluir-dados` criada em 18/08/2026 — exigida pela Meta.
- [x] **NOVO (19/08/2026, não publicado ainda) — Fase A do dashboard de vendas**: página
      `/products` (cadastro de produto/link de afiliado, com link curto rastreável automático),
      novo nó "Enviar produto" no construtor de automações (manda imagem + nome + preço + botão
      "Comprar" com link rastreável, buscando o produto sempre atualizado do banco), página
      `/sales` (ranking de produtos e de automações por clique). Detalhes completos em
      `claude/feature-produtos-vendas-2026-08-19.md`. Escrito direto no código do Gabriel via
      device bridge, validado (`tsc`/`eslint`/`next build` limpos num clone à parte) — **falta o
      Gabriel rodar `npm run db:push` (tabelas novas `products`/`product_clicks`) e depois
      publicar (`git add/commit/push`)**, ver "Ação pendente do Gabriel agora" abaixo.

## ⚠️ Ação pendente do Gabriel agora (19/08/2026)

### 1. Rodar `npm run db:push` (cria as tabelas novas de Produtos/Vendas no banco)

Sem isso as páginas `/products` e `/sales`, e o nó "Enviar produto", vão dar erro em produção.

1. Abra o **Explorador de Arquivos** do Windows e vá até `C:\Users\gabri\Downloads\zapflow-saas`.
2. Clique na barra de endereço, digite `powershell` e aperte **Enter**.
3. Cole e aperte Enter:
   ```
   npm run db:push
   ```
4. Pode aparecer uma pergunta no terminal tipo "Is X table created or renamed...?" — se aparecer,
   use as setas do teclado pra escolher a opção **"+ table created"** (a primeira, criar tabela
   nova) e aperte Enter pra cada uma. São 2 tabelas novas (`products` e `product_clicks`).
5. Espere terminar (deve mostrar algo como "Changes applied").

### 2. Publicar o código (git add/commit/push)

Depois do passo 1, na mesma janela do PowerShell (ou abrindo de novo, ver seção "Como publicar
mudanças no site" acima), cole um comando de cada vez:
```
git add .
```
```
git commit -m "Fase A do dashboard de vendas: Produtos, no Enviar produto, pagina Vendas"
```
```
git push
```
Espera 1-3 minutos e o site publica sozinho. Depois de publicado, os links **Produtos** e
**Vendas** aparecem na barra lateral do painel.

### 3. Testar

Cadastrar 1 produto de teste em `/products` (pode usar um link de afiliado de verdade ou
qualquer link por enquanto), copiar o link curto gerado e abrir num navegador (deve redirecionar
pro link de destino) — depois conferir se o clique apareceu em `/sales`. Depois, testar o nó
"Enviar produto" numa automação de teste.

### 4. Itens antigos, ainda pendentes (de sessões anteriores — confirmar se já foram feitos)

- Reconectar as duas contas do Instagram no ZapFlow (Configurações → Desconectar → Conectar de
  novo, pra @usepostflow e @fuxica_aqui) — necessário pra permissão de comentários funcionar.
- Verificar o e-mail de contato do app na Meta (`suporte@usepostflow.com`).

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
5. **Webhook do Instagram não validava no Meta** — causa real: Project visibility = Private
   na Netlify. Corrigido mudando pra **Public**.
6. **Permissões inválidas no login do Instagram** — reescrito pra usar
   `instagram.com/oauth/authorize` + `graph.instagram.com` em vez de `facebook.com`/
   `graph.facebook.com`.
7. **Responder pela Inbox só funcionava pra Instagram** — corrigido reescrevendo a rota de envio
   pra usar `resolveContactChannel`/`sendPlatformMessage`.
8. **`/excluir-dados` provavelmente não estava acessível sem login** (achado em 19/08/2026, ao
   mexer no `proxy.ts` pra Fase A) — a página existe desde 18/08 mas não estava em
   `PUBLIC_PATHS`; a Meta exige que essa URL seja pública. Adicionada junto com `/r/` (link
   curto de produto).

## App no Meta for Developers

- Nome: **ZapFlow** · Portfólio empresarial: **Use Post Flow**
- App ID (Facebook): `1084427634158782`
- ID do app do Instagram: `4580471795509562`
- Caso de uso ativo: **API do Instagram** (Instagram Login direto — não usa Página do
  Facebook). Permissões habilitadas no app: `instagram_business_basic`,
  `instagram_business_manage_comments`, `instagram_business_manage_messages`.
- Testadores do Instagram cadastrados e aceitos: **@usepostflow** e **@fuxica_aqui**.
- Webhook configurado e validado: `https://cheerful-pony-eadf56.netlify.app/api/instagram/webhook`
- App ainda em modo **Development** (não publicado/Live pro público) — provavelmente não
  precisa de Análise do App (App Review) pro uso pessoal do Gabriel, já que só usa contas
  próprias como testadoras.
- Verificação de Empresa (Business Verification) continua **não concluída** — só importa se um
  dia for necessário enviar o app pra Análise de verdade.

## Variáveis de ambiente na Netlify (site cheerful-pony-eadf56)

Já configuradas: `AUTH_SECRET`, `DATABASE_URL`, `META_APP_ID`, `META_APP_SECRET`,
`META_REDIRECT_URI`, `META_WEBHOOK_VERIFY_TOKEN`, `NEXTAUTH_URL`, `INSTAGRAM_APP_ID`,
`INSTAGRAM_APP_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_CONFIG_ID`,
`FACEBOOK_REDIRECT_URI`, `OPENAI_API_KEY`, `CRON_SECRET`, `MAILGUN_API_KEY`,
`MAILGUN_WEBHOOK_SIGNING_KEY`, `MAILGUN_API_BASE`.

`NEXTAUTH_URL` também é usada agora pra montar o link curto rastreável dos produtos
(`lib/products.ts`, `buildTrackedProductUrl`) — não precisa de nenhuma variável nova pra Fase A
do dashboard de vendas.

Nota: `META_APP_ID`/`META_APP_SECRET` ficaram configurados mas **não são usados** pelo
fluxo atual. `INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET` são os que o código usa de verdade hoje.

## Netlify — configurações importantes do site

- Project visibility: **Public** (Project configuration → Visitor access).
- Build command: `npm run build` · Publish directory: `.next`
- `netlify.toml` na raiz com `[[plugins]] package = "@netlify/plugin-nextjs"`.
- Esse site (`cheerful-pony-eadf56`) fica numa conta/time da Netlify **diferente** da conta
  usada pelo outro projeto do Gabriel (Usepostflow, `postflow1`/`postflow-staging`).

## Cron de automações — usando cron-job.org (não a função da Netlify)

A função agendada `netlify/functions/automations-cron.mts` tem um bug (aparentemente da
própria Netlify) que faz ela não disparar sozinha às vezes. O Gabriel configurou um cron
externo gratuito em **cron-job.org** (login: gcconzi1@gmail.com) chamando
`https://cheerful-pony-eadf56.netlify.app/api/automations/resume` a cada 1 minuto (POST,
header `x-cron-secret` = valor de `CRON_SECRET` da Netlify).

## Canal de e-mail (Mailgun) — CONCLUÍDO E TESTADO em 14/08/2026

Domínio dedicado usado: `bot.usepostflow.com`. Conta Mailgun: `gcconzi@gmail.com`.
Endereço conectado no ZapFlow: `contato@bot.usepostflow.com`. Tudo funcionando de ponta a ponta,
ver histórico completo em versões anteriores deste arquivo se precisar dos detalhes de setup.

Importante pro futuro: **eu (Claude) nunca devo digitar/colar chaves de API em nenhum
campo** — nem no site da Mailgun nem na Netlify. Tudo que envolve o valor de um segredo
é o próprio Gabriel quem faz.

## Próximos passos (roadmap detalhado)

- Roadmap "parecer mais com o ManyChat" (construtor de fluxos): ver
  `claude/roadmap-construtor-vs-manychat-2026-08-13.md` — randomizador, sub-fluxo, gatilho por
  tag aplicada, notificar admin, ainda não priorizados.
- Roadmap "dashboard de vendas pra influencer" (novo, 19/08/2026): ver
  `claude/estrategia-dashboard-influencer-marketplace-2026-08-19.md` (Fase A entregue nesta
  sessão, ver `claude/feature-produtos-vendas-2026-08-19.md`) — Fase B seria integração com API
  de afiliados do Mercado Livre (link automático + confirmação de comissão) e tag automática de
  contato por produto de interesse; Fase C seria canal WhatsApp Business Platform oficial com
  catálogo nativo, e vitrine pública unificada com o Usepostflow (biopage).
- Testar se comentários reais em @fuxica_aqui já funcionam (App Review da Meta) — item mais
  antigo, ver `claude/DIAGNOSTICO_automacao_comentario_qualquer_post_2026-08-15.md`.

## Regras que continuam valendo

- Gabriel nunca edita código — sempre arquivo pronto ou comando pra copiar/colar, com passo
  a passo completo (ver seção "REGRA MAIS IMPORTANTE" no topo deste arquivo).
- ZapFlow é 100% independente do usepostflow (projeto separado, sem integração de código) —
  a única ponte planejada é a vitrine de produtos (Fase C do dashboard de vendas), ainda não
  implementada.
- **Terminal padrão: PowerShell** — não trocar pra CMD sem motivo específico.
- **Sempre que uma mudança exigir rodar `npm run db:push`**, avisar o Gabriel explicitamente e
  dar o comando pronto pra copiar/colar — sem isso o banco de produção (Neon) fica com schema
  desatualizado em relação ao código publicado, causando erros em produção.
- **Nunca digitar/colar chaves de API, senhas ou outros segredos em nenhum campo.**
