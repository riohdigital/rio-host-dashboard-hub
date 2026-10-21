# rio-host-dashboard-hub

Dashboard de gestão de hospedagens: reúne imóveis anunciados no Airbnb e no
Booking.com, organiza reservas, faxinas, despesas e repasses.

Vite + React + TypeScript + shadcn/ui no front; Supabase (Postgres + Edge
Functions em Deno) no back. O projeto é editado também pelo **Lovable**.

**Antes de mexer na coleta automática de reservas, leia
[`docs/HANDOFF.md`](docs/HANDOFF.md).** Ele tem o estado do sistema, o que
ainda falta e as armadilhas já descobertas nos dados reais das plataformas.

## Regra P0: nada pela metade

**Antes de criar ou mudar qualquer funcionalidade, leia
`n8n-manager/projects/rioh-host/MAPA_DE_FUNCIONALIDADES_DASHBOARD.md`.**
Ele lista os módulos (do Dashboard às Configurações), com o que cada um se
relaciona, a matriz "mudou X → revise Y" e o checklist de integração
obrigatório. Toda entrega cobre todos os pontos relacionados: cadastro, telas,
Configurações, Anfitrião Alerta, Dashboard e Relatórios, Chat AI, automação e
multi-inquilino. Ao terminar, atualize o mapa.

Também é P0: o dashboard é **multi-inquilino**. Nada fixo no código; tudo vem
do cadastro e das configurações de cada usuário.

## Idioma

Código, comentários, mensagens de commit, descrições de PR e conversa com o
usuário: **português do Brasil**.

## Limites deste ambiente

- **O Supabase não é alcançável daqui.** O proxy da sessão bloqueia
  `*.supabase.co` (`api.github.com` responde 200, o Supabase responde 000).
  Não há como consultar o banco, invocar as Edge Functions nem aplicar
  migrations. Para qualquer dado do banco, **peça ao usuário para rodar a
  consulta no SQL Editor e colar o resultado** — nunca deduza o conteúdo do
  banco a partir de saídas antigas.
- **Exceção: a Management API do Supabase responde** (`api.supabase.com`, não
  `*.supabase.co`), com o `RIOH_HOST_SUPABASE_ACCESS_TOKEN` do `.env` do
  n8n-manager. O `SUPABASE_ACCESS_TOKEN` de lá é de outra conta e é recusado.
  Foi usada em 20/10/2026 para ler e ajustar o Auth (`/config/auth`). Leitura
  pode ser feita direto; **gravar exige o sim explícito do usuário**.
- **O Google Apps Script vive na conta do usuário.** Alterações em
  `docs/scripts/gmail-forwarder.gs` só entram em vigor quando ele copia e cola
  o arquivo. Avise sempre que o script mudar.
- **O Deno não instala aqui** (download bloqueado). Para exercitar os parsers,
  use `node --experimental-strip-types` apontando para os arquivos `.ts` de
  `supabase/functions/_shared/`.

## Verificações antes de subir

```sh
npx tsc -p tsconfig.app.json --noEmit          # aplicação
npx tsc -p supabase/functions/tsconfig.json --noEmit   # Edge Functions
npx eslint <arquivos alterados>
npm run build
```

O segundo comando não é opcional: o `tsconfig.app.json` cobre apenas `src/`, e
as Edge Functions já foram para produção quebradas por uma variável usada antes
da declaração que esse typecheck pega (`TS2448`). O mesmo passo roda no
workflow e bloqueia o deploy.

Os testes dos parsers ficam em `supabase/functions/_shared/parsers.test.ts`
(`deno test`, quando houver Deno disponível).

## Deploy

Merge na `main` dispara `.github/workflows/deploy-supabase-functions.yml`, que
publica as três Edge Functions. **Confirme que a execução terminou com sucesso
antes de pedir ao usuário para testar** — um deploy que falha silenciosamente
já fez o usuário testar código antigo e concluir que a correção não funcionou.

O front está em dois lugares, os dois alimentados pela `main`:

- **Vercel** (oficial): `https://anfitriao.rioh.digital` e
  `https://rio-host-dashboard-hub.vercel.app`. A Vercel publica sozinha a cada
  push na `main` que mexa no front (o `ignoreCommand` do `vercel.json` pula os
  pushes que só mexem em `supabase/`, `services/` ou `docs/`). Confira que o
  deploy ficou `READY` antes de pedir teste.
- **Lovable** (em paralelo, sem data para desligar):
  `https://rioh-host-dashboard.lovable.app`. Só muda quando o usuário clica em
  **Publish** no Lovable.

A rede do trabalho do usuário (Zscaler) bloqueia todo o `rioh.digital`. Lá ele
usa o endereço `vercel.app`. Pelo mesmo motivo, as chamadas do front ao n8n
passam por `src/lib/n8n.ts` (`fetchN8n`): principal `n8n.rioh.digital`, com
reserva automática no endereço do EasyPanel só quando o pedido não chegou ao n8n
(falha de rede ou 403 em HTML do Zscaler). Webhook novo do n8n no front: use
`fetchN8n`, nunca um endereço fixo. Domínio novo para o front precisa entrar em três
lugares: Redirect URLs do Supabase Auth, `ORIGENS` do
`n8n-manager/tools/provisionar_browser_login_proxy.py` (proxy de login) e o
próprio projeto na Vercel. Estudo completo:
`n8n-manager/projects/rioh-host/MIGRACAO_FRONTEND_VERCEL.md`.

## Lovable

O projeto está conectado ao repositório na branch `main`. Se o Lovable empurrar
uma branch `lovable-sync` oferecendo um pull request, **confira o diff antes**:
a cópia interna dele pode ser anterior ao trabalho recente, e mergear apagaria
código. O caminho certo é trazer o que ele acrescentou para a `main`, não o
contrário.

## Como o usuário prefere trabalhar

- **Faça, não instrua.** Abrir e mergear PRs, conferir deploys e diagnosticar
  faz parte do trabalho. Passo a passo só para o que realmente depende dele
  (Apps Script, extranets das plataformas, SQL Editor).
- Quando um passo for inevitavelmente dele, escreva o caminho exato de cliques.
- Automatize o que der: ele prefere que o sistema aprenda sozinho e pergunte
  apenas quando estiver genuinamente ambíguo.
