# Proxy de login das plataformas (Rioh Host)

Serviço que permite ao Dono fazer login no Airbnb e na Booking pelo dashboard,
num navegador da VPS (Browserless) com **perfil persistente**. O keep-alive e a
auditoria usam esse mesmo perfil depois: a plataforma vê sempre o mesmo
"dispositivo", com cookies, localStorage e o "lembrar este dispositivo".

Desenho completo: `n8n-manager/projects/rioh-host/docs/PLANO_AUTOMACAO_AUDITORIA_E_SESSOES_2026-10-06.md`, §4C.

## Como funciona

```
Dashboard (PlatformLoginModal) ──wss──▶ este proxy ──ws interno──▶ Browserless
   mouse, teclado, colar                 só master;                   --user-data-dir=
   ◀── quadros JPEG da tela ──           lista fechada de comandos    /data/profiles/<plataforma>
```

- **Autenticação:** a primeira mensagem traz o token do login do dashboard. O
  proxy confere o usuário no Supabase e exige perfil `master`. Ele **não tem chave
  de service role**: as gravações no banco são feitas com o token do próprio Dono,
  e a política da tabela `agent_browser_sessions` só deixa master ler e atualizar.
- **Comandos permitidos** (`src/comandos.js`): mover, clicar, rolar, digitar e
  teclas de edição. O front não executa JavaScript no navegador logado.
- **Digitação real:** cada caractere vira uma tecla (keyDown com `text`), como um
  teclado físico. Por isso acentos, `~ ^ ´ ` ¨` e aspas chegam inteiros, e o
  Enter envia o formulário uma vez só.
- **Passos:** o proxy lê a página e avisa o front (e-mail → senha → código →
  conectado). Ao conectar, ele fecha o navegador de forma limpa, o que grava o
  perfil em disco, e marca a sessão como válida. Na transição, também guarda os
  cookies, até o agente passar a usar o perfil.
- **Uma sessão por plataforma**, com trava no banco (`login_lock_until`): o
  keep-alive e a auditoria não abrem o perfil durante o login.
- **Nada do que o Dono digita vai para log.**

## Variáveis (EasyPanel)

| Variável | Exemplo | Segredo? |
|---|---|---|
| `SUPABASE_URL` | `https://cwcauobnbmzjpqjmmomc.supabase.co` | não |
| `SUPABASE_ANON_KEY` | a chave pública do front | não (vai no bundle do site) |
| `BROWSERLESS_WS` | `ws://extra-apps_browserless:3000` (rede interna) | não |
| `BROWSERLESS_TOKEN` | o `TOKEN` do Browserless | **sim** — o Dono cola no EasyPanel |
| `ORIGENS_PERMITIDAS` | `rioh-host-dashboard.lovable.app,localhost:8080` | não |
| `PASTA_PERFIS` | `/data/profiles` (volume do Browserless) | não |

## Protocolo do WebSocket `/login`

Do dashboard: `{t:'auth', token, plataforma}` (primeiro), depois `mouse`, `wheel`,
`text`, `key`, `select_all`, `nav` (`inicio`/`voltar`/`recarregar`), `ping`,
`token` (renovação) e `cancel`.

Do proxy: quadros JPEG (binário), `{t:'meta', w, h}`, `{t:'state', passo}`,
`{t:'pong', id}`, `{t:'erro', code, msg}` e `{t:'fim', motivo}`.

## Testes

```sh
npm test        # lógica pura (node:test)
```
