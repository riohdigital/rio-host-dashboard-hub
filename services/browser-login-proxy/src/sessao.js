/**
 * Uma sessão de login: um navegador no Browserless com o perfil persistente da
 * plataforma, a tela transmitida ao dashboard e os comandos de mouse e teclado
 * executados em ordem.
 *
 * Nada do que o Dono digita é registrado em log.
 */
import puppeteer from 'puppeteer-core';

import { traduzir } from './comandos.js';
import { PLATAFORMAS, SONDA, passoDoLogin } from './plataformas.js';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const LIMITE_FILA_BYTES = 4 * 1024 * 1024;

export class SessaoLogin {
  constructor({ ws, plataforma, usuario, token, config, supabase, log, aoTerminar }) {
    this.ws = ws;
    this.plataforma = plataforma;
    this.def = PLATAFORMAS[plataforma];
    this.usuario = usuario;
    // Token do login do dashboard: as gravações no banco são feitas em nome do Dono.
    this.token = token;
    this.config = config;
    this.supabase = supabase;
    this.log = log;
    this.aoTerminar = aoTerminar;
    this.viewport = { w: config.larguraTela, h: config.alturaTela };
    this.inicio = Date.now();
    this.ultimaAcao = Date.now();
    this.passo = null;
    this.fila = Promise.resolve();
    this.fim = false;
  }

  enviar(obj) {
    if (this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  async iniciar() {
    const { w, h } = this.viewport;
    this.enviar({ t: 'state', passo: 'conectando' });
    await this.supabase.travar(this.token, this.def.dominio, new Date(Date.now() + this.config.duracaoMaximaMs).toISOString()).catch(() => {});

    // Com janela (headless: false): o modo headless se anuncia como "HeadlessChrome"
    // e é o primeiro sinal de robô que Airbnb e Booking olham.
    const launch = {
      headless: false,
      args: [`--user-data-dir=${this.config.pastaPerfis}/${this.def.perfil}`, `--window-size=${w},${h}`, '--lang=pt-BR'],
      stealth: true,
    };
    const qs = new URLSearchParams({ timeout: String(this.config.duracaoMaximaMs + 60_000), launch: JSON.stringify(launch) });
    if (this.config.browserlessToken) qs.set('token', this.config.browserlessToken);

    this.browser = await puppeteer.connect({
      browserWSEndpoint: `${this.config.browserlessWs}/chromium?${qs}`,
      defaultViewport: { width: w, height: h },
      protocolTimeout: 60_000,
    });
    const paginas = await this.browser.pages();
    this.page = paginas[0] || (await this.browser.newPage());
    await this.page.setViewport({ width: w, height: h });

    this.cdp = await this.page.createCDPSession();
    this.cdp.on('Page.screencastFrame', (quadro) => this.quadro(quadro));
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: w, maxHeight: h, everyNthFrame: 1 });
    this.enviar({ t: 'meta', w, h });

    await this.page.goto(this.def.inicio, { waitUntil: 'domcontentloaded', timeout: 45_000 }).catch(() => {});
    this.vigiar();
    this.log('sessao_iniciada', { plataforma: this.plataforma, usuario: this.usuario.id });
  }

  quadro({ data, sessionId }) {
    // Rede lenta: descarta o quadro em vez de acumular atraso. O próximo vem em seguida.
    if (this.ws.readyState === 1 && this.ws.bufferedAmount < LIMITE_FILA_BYTES) {
      this.ws.send(Buffer.from(data, 'base64'), { binary: true });
    }
    this.cdp?.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  }

  vigiar() {
    this.timer = setInterval(async () => {
      if (this.fim) return;
      if (Date.now() - this.inicio > this.config.duracaoMaximaMs) return this.encerrar('tempo');
      if (Date.now() - this.ultimaAcao > this.config.ociosidadeMs) return this.encerrar('ocioso');
      if (this.verificando || this.concluindo) return;
      this.verificando = true;
      try {
        const sonda = await this.page.evaluate(SONDA);
        const { cookies } = await this.cdp.send('Network.getAllCookies');
        const nomes = cookies.filter((c) => this.def.cookiesDe.some((d) => c.domain.endsWith(d))).map((c) => c.name);
        const passo = passoDoLogin(this.plataforma, sonda, nomes);
        if (passo !== this.passo) {
          this.passo = passo;
          this.enviar({ t: 'state', passo, host: sonda.host });
          this.log('passo', { plataforma: this.plataforma, passo });
        }
        if (passo === 'conectado') await this.concluir();
      } catch {
        // Página navegando: a próxima volta lê de novo.
      } finally {
        this.verificando = false;
      }
    }, 1000);
  }

  /** Executa os comandos na ordem em que chegaram (a digitação depende disso). */
  receber(msg) {
    if (this.fim || this.concluindo) return;
    this.ultimaAcao = Date.now();

    if (msg.t === 'ping') return this.enviar({ t: 'pong', id: msg.id });
    if (msg.t === 'token') return this.renovarToken(msg.v);
    if (msg.t === 'cancel') return this.encerrar('cancelado');
    if (msg.t === 'nav') {
      this.fila = this.fila.then(() => this.navegar(msg.para)).catch(() => {});
      return;
    }

    const comandos = traduzir(msg, this.viewport);
    if (!comandos.length) return;
    this.fila = this.fila
      .then(async () => {
        for (const c of comandos) await this.cdp.send(c.method, c.params);
      })
      .catch(() => {});
  }

  /** O front renova o token do dashboard (ele vence em 1 h); só vale se for do mesmo usuário. */
  async renovarToken(novo) {
    const usuario = await this.supabase.usuarioMaster(novo).catch(() => null);
    if (usuario?.id === this.usuario.id) this.token = novo;
  }

  async navegar(para) {
    if (para === 'inicio') await this.page.goto(this.def.inicio, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    else if (para === 'voltar') await this.page.goBack({ waitUntil: 'domcontentloaded', timeout: 20_000 });
    else if (para === 'recarregar') await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 });
  }

  async concluir() {
    this.concluindo = true;
    this.enviar({ t: 'state', passo: 'salvando' });
    try {
      // Deixa a página terminar de gravar o que precisa antes de fechar.
      await esperar(3000);
      const { cookies } = await this.cdp.send('Network.getAllCookies');
      const daPlataforma = cookies.filter((c) => this.def.cookiesDe.some((d) => c.domain.endsWith(d)));
      await this.cdp.send('Page.stopScreencast').catch(() => {});
      // Fechar o navegador de forma limpa grava cookies e perfil em disco.
      await this.browser.close().catch(() => {});
      this.browser = null;
      await this.supabase.registrarLogin(this.token, this.def.dominio, daPlataforma);
      this.enviar({ t: 'state', passo: 'pronto' });
      this.log('login_concluido', { plataforma: this.plataforma, cookies: daPlataforma.length });
      this.encerrar('concluido');
    } catch (erro) {
      this.log('falha_ao_concluir', { plataforma: this.plataforma, erro: String(erro?.message || erro) });
      this.enviar({ t: 'erro', code: 'salvar', msg: 'O login entrou, mas não consegui salvar a sessão. Tente de novo.' });
      this.encerrar('falha');
    }
  }

  async encerrar(motivo) {
    if (this.fim) return;
    this.fim = true;
    clearInterval(this.timer);
    if (this.browser) {
      await this.cdp?.send('Page.stopScreencast').catch(() => {});
      // Fechamento limpo também aqui: o que já avançou (ex.: "lembrar dispositivo") fica no perfil.
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
    await this.supabase.travar(this.token, this.def.dominio, null).catch(() => {});
    if (motivo !== 'concluido' && motivo !== 'desconectado') this.enviar({ t: 'fim', motivo });
    if (this.ws.readyState === 1) this.ws.close(1000, motivo);
    this.log('sessao_encerrada', { plataforma: this.plataforma, motivo, duracao_s: Math.round((Date.now() - this.inicio) / 1000) });
    this.aoTerminar?.();
  }
}
