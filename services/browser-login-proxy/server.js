/**
 * Rioh Host — proxy de login das plataformas (Airbnb, Booking).
 *
 * O dashboard abre um WebSocket em /login. A primeira mensagem traz o token do
 * usuário logado no dashboard e a plataforma; entra quem cuida de imóveis
 * (master ou owner), sempre na PRÓPRIA conta da plataforma (multi-inquilino). Daí em
 * diante o proxy transmite a tela do navegador (JPEG binário) e executa os
 * comandos de mouse e teclado da lista fechada (src/comandos.js).
 *
 * O Browserless fica atrás deste serviço, na rede interna e com TOKEN: o front
 * nunca fala com ele diretamente.
 */
import http from 'node:http';
import { WebSocketServer } from 'ws';

import { carregarConfig, origemPermitida, pedidoInterno } from './src/config.js';
import { PLATAFORMAS, pastaValida } from './src/plataformas.js';
import { SessaoLogin } from './src/sessao.js';
import { LeituraDeReserva } from './src/reserva.js';
import { LeituraDeCalendario } from './src/calendario.js';
import { BuscaNoMapa } from './src/busca.js';
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

/**
 * Rotas internas (só rede da VPS): o n8n usa o perfil salvo do login.
 * - verificar: a plataforma continua conectada? (keep-alive)
 * - reserva: dados de uma reserva lidos da página dela (auditoria)
 * - calendario: diárias e disponibilidade do próprio anúncio (precificação, E4)
 * - busca: anúncios no mapa em volta do imóvel, com preço das datas (concorrentes, E5 e E6)
 * O mesmo perfil nunca abre duas vezes: com login ou outra rota em andamento, 409.
 * O n8n informa a pasta do perfil (`pasta`, de agent_browser_sessions.profile_dir);
 * sem ela, vale a pasta antiga da plataforma (pedidos de antes da F7).
 */
async function rotaInterna(req, res, nome, criar) {
  if (!pedidoInterno(req, config.hostsInternos)) return json(res, 403, { erro: 'somente rede interna' });
  let corpo;
  try {
    corpo = await lerCorpo(req);
  } catch {
    return json(res, 400, { erro: 'corpo inválido' });
  }
  const plataforma = corpo.plataforma;
  if (!PLATAFORMAS[plataforma]) return json(res, 400, { erro: 'plataforma desconhecida' });
  const pasta = corpo.pasta || PLATAFORMAS[plataforma].perfil;
  if (!pastaValida(pasta, plataforma)) return json(res, 400, { erro: 'pasta de perfil inválida' });
  if (ativas.has(pasta)) return json(res, 409, { erro: 'ocupado', plataforma });

  const tarefa = criar(plataforma, { ...corpo, pasta });
  if (!tarefa) return json(res, 400, { erro: 'pedido incompleto' });
  ativas.set(pasta, tarefa);
  try {
    const resultado = await tarefa.executar();
    // Só o desfecho vai para o log: nada de hóspede nem valores.
    log(nome, { plataforma, status: resultado.status ?? null, conectado: resultado.conectado ?? null, passo: resultado.passo ?? null });
    return json(res, 200, resultado);
  } catch (erro) {
    log(`${nome}_falhou`, { plataforma, erro: String(erro?.message || erro) });
    return json(res, 502, { erro: 'navegador', plataforma, detalhe: String(erro?.message || erro).slice(0, 200) });
  } finally {
    ativas.delete(pasta);
  }
}

const verificar = (req, res) =>
  rotaInterna(req, res, 'verificacao', (plataforma, corpo) => new Verificacao({ plataforma, pasta: corpo.pasta, config }));
const lerReserva = (req, res) =>
  rotaInterna(req, res, 'leitura_reserva', (plataforma, corpo) =>
    /^[A-Z0-9]{6,20}$/i.test(String(corpo.codigo || '').trim())
      ? new LeituraDeReserva({ plataforma, pasta: corpo.pasta, codigo: corpo.codigo, hotelId: corpo.hotel_id, config })
      : null);

const lerCalendario = (req, res) =>
  rotaInterna(req, res, 'leitura_calendario', (plataforma, corpo) =>
    /^\d{4,20}$/.test(String(corpo.anuncio || '').trim())
      ? new LeituraDeCalendario({ plataforma, pasta: corpo.pasta, anuncio: corpo.anuncio, config })
      : null);

const buscar = (req, res) =>
  rotaInterna(req, res, 'busca', (plataforma, corpo) =>
    BuscaNoMapa.valido(corpo)
      ? new BuscaNoMapa({ plataforma, pasta: corpo.pasta, lat: corpo.lat, lng: corpo.lng, raioKm: corpo.raio_km, checkin: corpo.checkin, checkout: corpo.checkout, hospedes: corpo.hospedes, config })
      : null);

const servidor = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/interno/verificar') return verificar(req, res);
  if (req.method === 'POST' && req.url === '/interno/reserva') return lerReserva(req, res);
  if (req.method === 'POST' && req.url === '/interno/calendario') return lerCalendario(req, res);
  if (req.method === 'POST' && req.url === '/interno/busca') return buscar(req, res);
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

    const usuario = await supabase.usuarioQueConecta(msg.token).catch(() => null);
    if (!usuario) return recusar(ws, 'auth', 'Conectar plataformas é para quem cuida de imóveis. Entre de novo no dashboard.');
    if (!PLATAFORMAS[msg.plataforma]) return recusar(ws, 'plataforma', 'Plataforma desconhecida.');
    const minha = await supabase.sessaoDoUsuario(msg.token, usuario.id, msg.plataforma).catch((erro) => {
      log('sessao_nao_encontrada', { plataforma: msg.plataforma, erro: String(erro?.message || erro) });
      return null;
    });
    if (!minha) return recusar(ws, 'sessao', 'Não consegui preparar a sua sessão desta plataforma. Tente de novo.');
    if (ativas.has(minha.pasta)) return recusar(ws, 'ocupado', 'Já existe um login desta plataforma em andamento. Aguarde terminar.');

    sessao = new SessaoLogin({
      ws,
      plataforma: msg.plataforma,
      sessaoId: minha.id,
      pasta: minha.pasta,
      usuario,
      token: msg.token,
      config,
      supabase,
      log,
      aoTerminar: () => ativas.delete(minha.pasta),
    });
    ativas.set(minha.pasta, sessao);
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
