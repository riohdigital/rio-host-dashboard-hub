/**
 * Uma sessão de login: um navegador no Browserless com o perfil persistente da
 * plataforma, a tela transmitida ao dashboard e os comandos de mouse e teclado
 * executados em ordem.
 *
 * O navegador precisa parecer o de uma pessoa: antifraude de login (a Booking
 * em especial) recusa com "Sign in failed – try again later" quando vê sinais
 * de automação. Por isso:
 *   - CDP direto (src/cdp.js), sem Puppeteer, que liga `Runtime.enable` em toda página;
 *   - a sonda do passo roda num mundo isolado, invisível aos scripts da página;
 *   - sem `stealth` (com janela de verdade, as "camuflagens" é que denunciam) e sem
 *     emulação de tamanho: a janela ocupa a tela virtual inteira, como maximizada;
 *   - fuso horário coerente com o IP de saída da VPS, em vez de UTC.
 *
 * Nada do que o Dono digita é registrado em log.
 */
import { Cdp } from './cdp.js';
import { traduzir } from './comandos.js';
import { PLATAFORMAS, SONDA, passoDoLogin } from './plataformas.js';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const LIMITE_FILA_BYTES = 4 * 1024 * 1024;
const MUNDO_DA_SONDA = 'rioh-sonda';

/** Endereço do Chrome no Browserless, com o perfil da plataforma. */
export function urlDoBrowserless(config, perfil) {
  const launch = {
    headless: false,
    stealth: false,
    args: [
      `--user-data-dir=${config.pastaPerfis}/${perfil}`,
      `--window-size=${config.larguraTela},${config.alturaTela}`,
      '--window-position=0,0',
      `--lang=${config.idioma}`,
    ],
  };
  const qs = new URLSearchParams({ timeout: String(config.duracaoMaximaMs + 60_000), launch: JSON.stringify(launch) });
  if (config.browserlessToken) qs.set('token', config.browserlessToken);
  return `${config.browserlessWs}/chromium?${qs}`;
}

export class SessaoLogin {
  constructor({ ws, plataforma, usuario, token, config, supabase, log, aoTerminar, urlDoNavegador }) {
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
    // Nos testes, um Chrome local; em produção, o Browserless.
    this.urlDoNavegador = urlDoNavegador || (() => urlDoBrowserless(config, this.def.perfil));
    // Tamanho da página em px CSS. Vem dos quadros da tela (a janela real manda).
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

  /** Comando na aba do login. */
  aba(method, params) {
    return this.cdp.send(method, params, this.sessao);
  }

  async iniciar() {
    this.enviar({ t: 'state', passo: 'conectando' });
    await this.supabase.travar(this.token, this.def.dominio, new Date(Date.now() + this.config.duracaoMaximaMs).toISOString()).catch(() => {});

    this.cdp = new Cdp(this.urlDoNavegador());
    await this.cdp.abrir();
    this.cdp.aoFechar = () => {
      if (!this.fim && !this.concluindo) this.encerrar('navegador');
    };

    const { targetInfos } = await this.cdp.send('Target.getTargets');
    let alvo = targetInfos.find((t) => t.type === 'page');
    if (!alvo) {
      const { targetId } = await this.cdp.send('Target.createTarget', { url: 'about:blank' });
      alvo = { targetId };
    }
    ({ sessionId: this.sessao } = await this.cdp.send('Target.attachToTarget', { targetId: alvo.targetId, flatten: true }));

    await this.aba('Page.enable');
    if (this.config.fusoHorario) await this.aba('Emulation.setTimezoneOverride', { timezoneId: this.config.fusoHorario }).catch(() => {});

    this.cdp.on('Page.screencastFrame', (quadro, sid) => {
      if (sid === this.sessao) this.quadro(quadro);
    });
    await this.aba('Page.startScreencast', {
      format: 'jpeg',
      quality: 80,
      maxWidth: this.config.larguraTela,
      maxHeight: this.config.alturaTela,
      everyNthFrame: 1,
    });

    await this.ir(this.def.inicio);
    this.vigiar();
    this.log('sessao_iniciada', { plataforma: this.plataforma, usuario: this.usuario.id });
  }

  quadro({ data, sessionId, metadata }) {
    // O tamanho da página pode mudar (ex.: barra de rolagem); o front acompanha pelo `meta`.
    const w = Math.round(metadata?.deviceWidth || 0);
    const h = Math.round(metadata?.deviceHeight || 0);
    if (w && h && (w !== this.viewport.w || h !== this.viewport.h || !this.metaEnviada)) {
      this.viewport = { w, h };
      this.metaEnviada = true;
      this.enviar({ t: 'meta', w, h });
    }
    // Rede lenta: descarta o quadro em vez de acumular atraso. O próximo vem em seguida.
    if (this.ws.readyState === 1 && this.ws.bufferedAmount < LIMITE_FILA_BYTES) {
      this.ws.send(Buffer.from(data, 'base64'), { binary: true });
    }
    this.aba('Page.screencastFrameAck', { sessionId }).catch(() => {});
  }

  /** Abre um endereço e espera o DOM, sem travar se a página demorar. */
  async ir(url) {
    const carregou = this.cdp.esperarEvento('Page.domContentEventFired', this.sessao, 45_000);
    await this.aba('Page.navigate', { url });
    await carregou;
  }

  /**
   * A sonda roda num mundo isolado: enxerga o mesmo DOM, mas os scripts da
   * página não veem as chamadas dela. O mundo some a cada navegação; aí é recriado.
   */
  async sondar() {
    if (!this.mundo) {
      const { frameTree } = await this.aba('Page.getFrameTree');
      ({ executionContextId: this.mundo } = await this.aba('Page.createIsolatedWorld', {
        frameId: frameTree.frame.id,
        worldName: MUNDO_DA_SONDA,
        grantUniveralAccess: false,
      }));
    }
    try {
      const { result, exceptionDetails } = await this.aba('Runtime.evaluate', {
        expression: SONDA,
        contextId: this.mundo,
        returnByValue: true,
      });
      if (exceptionDetails) throw new Error('sonda');
      return result.value;
    } catch (erro) {
      this.mundo = null;
      throw erro;
    }
  }

  async cookiesDaPlataforma() {
    const { cookies } = await this.cdp.send('Storage.getCookies');
    return cookies.filter((c) => this.def.cookiesDe.some((d) => c.domain.endsWith(d)));
  }

  vigiar() {
    this.timer = setInterval(async () => {
      if (this.fim) return;
      if (Date.now() - this.inicio > this.config.duracaoMaximaMs) return this.encerrar('tempo');
      if (Date.now() - this.ultimaAcao > this.config.ociosidadeMs) return this.encerrar('ocioso');
      if (this.verificando || this.concluindo) return;
      this.verificando = true;
      try {
        const sonda = await this.sondar();
        const nomes = (await this.cookiesDaPlataforma()).map((c) => c.name);
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
        for (const c of comandos) await this.aba(c.method, c.params);
      })
      .catch(() => {});
  }

  /** O front renova o token do dashboard (ele vence em 1 h); só vale se for do mesmo usuário. */
  async renovarToken(novo) {
    const usuario = await this.supabase.usuarioMaster(novo).catch(() => null);
    if (usuario?.id === this.usuario.id) this.token = novo;
  }

  async navegar(para) {
    if (para === 'inicio') return this.ir(this.def.inicio);
    if (para === 'recarregar') {
      const carregou = this.cdp.esperarEvento('Page.domContentEventFired', this.sessao, 45_000);
      await this.aba('Page.reload');
      return carregou;
    }
    if (para === 'voltar') {
      const { currentIndex, entries } = await this.aba('Page.getNavigationHistory');
      if (currentIndex > 0) await this.aba('Page.navigateToHistoryEntry', { entryId: entries[currentIndex - 1].id });
    }
  }

  /** Fecha o Chrome pelo próprio Chrome: é o fechamento limpo que grava cookies e perfil em disco. */
  async fecharNavegador() {
    if (!this.cdp) return;
    await this.aba('Page.stopScreencast').catch(() => {});
    await this.cdp.send('Browser.close').catch(() => {});
    this.cdp.fechar();
    this.cdp = null;
  }

  async concluir() {
    this.concluindo = true;
    this.enviar({ t: 'state', passo: 'salvando' });
    try {
      // Deixa a página terminar de gravar o que precisa antes de fechar.
      await esperar(3000);
      const daPlataforma = await this.cookiesDaPlataforma();
      await this.fecharNavegador();
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
    // Fechamento limpo também aqui: o que já avançou (ex.: "lembrar dispositivo") fica no perfil.
    await this.fecharNavegador();
    await this.supabase.travar(this.token, this.def.dominio, null).catch(() => {});
    if (motivo !== 'concluido' && motivo !== 'desconectado') this.enviar({ t: 'fim', motivo });
    if (this.ws.readyState === 1) this.ws.close(1000, motivo);
    this.log('sessao_encerrada', { plataforma: this.plataforma, motivo, duracao_s: Math.round((Date.now() - this.inicio) / 1000) });
    this.aoTerminar?.();
  }
}
