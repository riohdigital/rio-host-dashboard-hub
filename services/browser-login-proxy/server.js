/**
 * Rioh Host — proxy de login das plataformas (Airbnb, Booking).
 *
 * O dashboard abre um WebSocket em /login. A primeira mensagem traz o token do
 * usuário logado no dashboard e a plataforma; só usuário master entra. Daí em
 * diante o proxy transmite a tela do navegador (JPEG binário) e executa os
 * comandos de mouse e teclado da lista fechada (src/comandos.js).
 *
 * O Browserless fica atrás deste serviço, na rede interna e com TOKEN: o front
 * nunca fala com ele diretamente.
 */
import http from 'node:http';
import { WebSocketServer } from 'ws';

import { carregarConfig, origemPermitida, pedidoInterno } from './src/config.js';
import { PLATAFORMAS } from './src/plataformas.js';
import { SessaoLogin } from './src/sessao.js';
import { Verificacao } from './src/verificacao.js';
import { criarSupabase } from './src/supabase.js';
import { codigoDaVersao } from './src/versao.js';

const config = carregarConfig();
const supabase = criarSupabase(config);
const ativas = new Map();
const VERSAO = codigoDaVersao();

const log = (evento, dados = {}) => console.log(JSON.stringify({ quando: new Date().toISOString(), evento, ...dados }));

/** O Browserless responde pela rede interna? (só a versão do Chrome; nada de sessão) */
async function browserlessNoAr() {
  try {
    const base = config.browserlessWs.replace(/^ws/, 'http');
    const qs = config.browserlessToken ? `?token=${encodeURIComponent(config.browserlessToken)}` : '';
    const r = await fetch(`${base}/json/version${qs}`, { signal: AbortSignal.timeout(3000) });
    return r.ok ? ((await r.json()).Browser || true) : false;
  } catch {
    return false;
  }
}

const json = (res, codigo, corpo) => {
  res.writeHead(codigo, { 'content-type': 'application/json' });
  res.end(JSON.stringify(corpo));
};

async function lerCorpo(req) {
  let dados = '';
  for await (const pedaco of req) {
    dados += pedaco;
    if (dados.length > 4096) throw new Error('corpo grande demais');
  }
  return dados ? JSON.parse(dados) : {};
}

/** Keep-alive: o n8n pergunta se a plataforma continua conectada (só pela rede interna). */
async function verificar(req, res) {
  if (!pedidoInterno(req, config.hostsInternos)) return json(res, 403, { erro: 'somente rede interna' });
  let corpo;
  try {
    corpo = await lerCorpo(req);
  } catch {
    return json(res, 400, { erro: 'corpo inválido' });
  }
  const plataforma = corpo.plataforma;
  if (!PLATAFORMAS[plataforma]) return json(res, 400, { erro: 'plataforma desconhecida' });
  // Mesmo perfil não abre duas vezes: login em andamento ou outra verificação.
  if (ativas.has(plataforma)) return json(res, 409, { erro: 'ocupado', plataforma });

  const v = new Verificacao({ plataforma, config });
  ativas.set(plataforma, v);
  try {
    const resultado = await v.executar();
    log('verificacao', { plataforma, conectado: resultado.conectado, passo: resultado.passo, duracao_ms: resultado.duracao_ms });
    return json(res, 200, resultado);
  } catch (erro) {
    log('verificacao_falhou', { plataforma, erro: String(erro?.message || erro) });
    return json(res, 502, { erro: 'navegador', plataforma, detalhe: String(erro?.message || erro).slice(0, 200) });
  } finally {
    ativas.delete(plataforma);
  }
}

const servidor = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/interno/verificar') return verificar(req, res);
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, codigo: VERSAO, sessoes: [...ativas.keys()], browserless: await browserlessNoAr() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

servidor.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/login' || !origemPermitida(req.headers.origin, config.origens)) {
    log('recusado', { caminho: url.pathname, origem: req.headers.origin || null });
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => atender(ws));
});

function recusar(ws, code, msg) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ t: 'erro', code, msg }));
    ws.close(4000, code);
  }
}

function atender(ws) {
  let sessao = null;
  let autenticando = false;
  const prazo = setTimeout(() => recusar(ws, 'auth', 'Tempo esgotado para autenticar.'), 10_000);

  ws.on('message', async (dados, binario) => {
    if (binario) return;
    let msg;
    try {
      msg = JSON.parse(dados.toString());
    } catch {
      return;
    }

    if (sessao) return sessao.receber(msg);
    if (autenticando || msg.t !== 'auth') return;
    autenticando = true;
    clearTimeout(prazo);

    const usuario = await supabase.usuarioMaster(msg.token).catch(() => null);
    if (!usuario) return recusar(ws, 'auth', 'Acesso restrito ao administrador do sistema. Entre de novo no dashboard.');
    if (!PLATAFORMAS[msg.plataforma]) return recusar(ws, 'plataforma', 'Plataforma desconhecida.');
    if (ativas.has(msg.plataforma)) return recusar(ws, 'ocupado', 'Já existe um login desta plataforma em andamento. Aguarde terminar.');

    sessao = new SessaoLogin({
      ws,
      plataforma: msg.plataforma,
      usuario,
      token: msg.token,
      config,
      supabase,
      log,
      aoTerminar: () => ativas.delete(msg.plataforma),
    });
    ativas.set(msg.plataforma, sessao);
    sessao.iniciar().catch((erro) => {
      log('falha_ao_iniciar', { plataforma: msg.plataforma, erro: String(erro?.message || erro) });
      recusar(ws, 'navegador', 'Não consegui abrir o navegador agora. Tente de novo em instantes.');
      sessao.encerrar('falha');
    });
  });

  ws.on('close', () => {
    clearTimeout(prazo);
    sessao?.encerrar('desconectado');
  });
}

const desligar = async () => {
  log('desligando', { sessoes: [...ativas.keys()] });
  await Promise.all([...ativas.values()].map((s) => s.encerrar('reinicio')));
  servidor.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on('SIGTERM', desligar);
process.on('SIGINT', desligar);

servidor.listen(config.porta, () => log('no_ar', { porta: config.porta, codigo: VERSAO, origens: config.origens }));
