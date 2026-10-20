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
- **Navegador com cara de pessoa.** O antifraude de login (a Booking em especial)
  recusa com "Sign in failed – try again later" quando vê sinais de automação. Por isso:
  - o proxy fala **CDP direto** (`src/cdp.js`), sem Puppeteer. O Puppeteer liga
    `Runtime.enable` em toda página, e isso é detectável;
  - a sonda do passo roda num **mundo isolado**: ela enxerga o DOM, mas os scripts da
    página não veem as chamadas dela;
  - sem `stealth` e sem emulação de tamanho: a janela ocupa a tela virtual do
    Browserless (1024×768), como uma janela maximizada;
  - fuso horário coerente com o IP de saída da VPS (Holanda), em vez de UTC.
  Testado contra um Chrome local com detectores na página: nem o `Runtime.enable` nem
  a sonda foram vistos.
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
| `FUSO_HORARIO` | `Europe/Amsterdam` (o do IP da VPS) | não |
| `IDIOMA` | `pt-BR` | não |
| `LARGURA_TELA` / `ALTURA_TELA` | `1024` / `768` (a tela virtual do Browserless) | não |

## Protocolo do WebSocket `/login`

Do dashboard: `{t:'auth', token, plataforma}` (primeiro), depois `mouse`, `wheel`,
`text`, `key`, `select_all`, `nav` (`inicio`/`voltar`/`recarregar`), `ping`,
`token` (renovação) e `cancel`.

Do proxy: quadros JPEG (binário), `{t:'meta', w, h}`, `{t:'state', passo}`,
`{t:'pong', id}`, `{t:'erro', code, msg}` e `{t:'fim', motivo}`.

## Verificação de sessão (keep-alive)

`POST /interno/verificar` com `{"plataforma": "airbnb" | "booking"}`. Só aceita pedidos da
rede interna do EasyPanel (`http://extra-apps_rioh-host-browser-login:3000`): qualquer
requisição que passou pelo Traefik (`X-Forwarded-*`) ou chegou pelo domínio público é
recusada com 403.

O proxy abre o perfil da plataforma no mesmo navegador do login, vê se continua conectado,
fica alguns segundos na página e fecha de forma limpa. Devolve
`{plataforma, conectado, passo, host, caminho, duracao_ms}`, nunca cookies. Se um login ou
outra verificação estiver usando o perfil, responde 409 (`ocupado`).

Quem chama é o workflow de keep-alive do n8n, que decide o ritmo de cada plataforma,
registra as verificações e avisa o Dono.

## Leitura de reserva (auditoria)

`POST /interno/reserva` com `{"plataforma", "codigo", "hotel_id"}` (o `hotel_id` só na Booking).
Mesmas regras das outras rotas internas: só a rede da VPS e o perfil abre uma vez por vez.

O proxy abre a página da reserva com o perfil do login e **captura a resposta JSON que a
própria página busca**. Não usa hash fixo, chave de API nem cookies copiados.
- **Airbnb:** `StayHostingDetailsQuery` → `src/extratores.js` (`lerReservaAirbnb`):
  - R1: Total (BRL) de "Você recebe" + |Cotas do coanfitrião|;
  - datas em Brasília, status (cancelada/pedido), limpeza e hóspedes.

  O formato devolvido é o mesmo que a auditoria do n8n já compara.
- **Booking:** por enquanto devolve `status: "diagnostico"`, com o **esqueleto** das respostas
  JSON da página de detalhe (só nomes de campos e tipos, sem valores). Isso serve para
  escrever o extrator.

## Testes

```sh
npm test        # lógica pura (node:test)
```
