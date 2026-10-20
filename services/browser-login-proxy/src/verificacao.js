/**
 * Verificação de sessão (keep-alive): abre o perfil da plataforma no mesmo
 * navegador do login, vê se continua conectado e fecha de forma limpa.
 *
 * É o mesmo "dispositivo" em que o Dono logou: mesmo perfil, mesmas flags, sem
 * colar cookies num navegador novo (era isso que derrubava as sessões).
 * Devolve só o resultado; cookies nunca saem daqui.
 */
import { Cdp } from './cdp.js';
import { PLATAFORMAS, SONDA, passoDoLogin } from './plataformas.js';
import { urlDoBrowserless } from './sessao.js';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const PASSOS_DE_LOGIN = new Set(['email', 'senha', 'codigo', 'captcha']);

export class Verificacao {
  constructor({ plataforma, config, urlDoNavegador, permanenciaMs }) {
    this.plataforma = plataforma;
    this.def = PLATAFORMAS[plataforma];
    this.config = config;
    this.urlDoNavegador = urlDoNavegador || (() => urlDoBrowserless(config, this.def.perfil));
    // Uma pessoa não fecha a aba no instante em que ela carrega.
    this.permanenciaMs = permanenciaMs ?? 4000 + Math.floor(Math.random() * 8000);
  }

  aba(method, params) {
    return this.cdp.send(method, params, this.sessao);
  }

  async executar({ prazoMs = 30_000 } = {}) {
    const inicio = Date.now();
    this.cdp = new Cdp(this.urlDoNavegador());
    await this.cdp.abrir();
    try {
      const { targetInfos } = await this.cdp.send('Target.getTargets');
      let alvo = targetInfos.find((t) => t.type === 'page');
      if (!alvo) alvo = await this.cdp.send('Target.createTarget', { url: 'about:blank' });
      ({ sessionId: this.sessao } = await this.cdp.send('Target.attachToTarget', { targetId: alvo.targetId, flatten: true }));
      await this.aba('Page.enable');
      if (this.config.fusoHorario) await this.aba('Emulation.setTimezoneOverride', { timezoneId: this.config.fusoHorario }).catch(() => {});

      const carregou = this.cdp.esperarEvento('Page.domContentEventFired', this.sessao, 45_000);
      await this.aba('Page.navigate', { url: this.def.inicio });
      await carregou;

      // Redirecionamentos (login, extranet com ses=) levam alguns segundos.
      let passo = 'carregando';
      let sonda = null;
      let desconectadoDesde = null;
      while (Date.now() - inicio < prazoMs) {
        await esperar(1000);
        try {
          sonda = await this.sondar();
          const { cookies } = await this.cdp.send('Storage.getCookies');
          const nomes = cookies.filter((c) => this.def.cookiesDe.some((d) => c.domain.endsWith(d))).map((c) => c.name);
          passo = passoDoLogin(this.plataforma, sonda, nomes);
        } catch {
          continue; // navegando
        }
        if (passo === 'conectado') break;
        // Tela de login estável por 3 s: a sessão caiu.
        if (PASSOS_DE_LOGIN.has(passo)) {
          desconectadoDesde ??= Date.now();
          if (Date.now() - desconectadoDesde >= 3000) break;
        } else {
          desconectadoDesde = null;
        }
      }

      if (passo === 'conectado') await esperar(this.permanenciaMs);
      return {
        plataforma: this.plataforma,
        conectado: passo === 'conectado',
        passo,
        host: sonda?.host || null,
        caminho: sonda?.caminho || null,
        duracao_ms: Date.now() - inicio,
      };
    } finally {
      await this.encerrar();
    }
  }

  async sondar() {
    if (!this.mundo) {
      const { frameTree } = await this.aba('Page.getFrameTree');
      ({ executionContextId: this.mundo } = await this.aba('Page.createIsolatedWorld', {
        frameId: frameTree.frame.id,
        worldName: 'rioh-sonda',
        grantUniveralAccess: false,
      }));
    }
    try {
      const { result, exceptionDetails } = await this.aba('Runtime.evaluate', { expression: SONDA, contextId: this.mundo, returnByValue: true });
      if (exceptionDetails) throw new Error('sonda');
      return result.value;
    } catch (erro) {
      this.mundo = null;
      throw erro;
    }
  }

  /** Fechamento limpo: grava no perfil o que a visita renovou. */
  async encerrar() {
    if (!this.cdp) return;
    await this.cdp.send('Browser.close').catch(() => {});
    this.cdp.fechar();
    this.cdp = null;
  }
}
