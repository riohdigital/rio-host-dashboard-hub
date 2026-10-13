/**
 * Conexão mínima com o Chrome pelo DevTools Protocol (CDP), sem Puppeteer.
 *
 * Por que não Puppeteer: ele liga o domínio `Runtime` em toda página que toca
 * (`Runtime.enable`), e sites com antifraude detectam isso. É um dos sinais
 * clássicos de navegador controlado por robô. Aqui só vão os comandos que o
 * login precisa: tela, mouse, teclado, navegação, cookies e a sonda do passo.
 */
import WebSocket from 'ws';

export class Cdp {
  constructor(url, { tempoLimiteMs = 60_000 } = {}) {
    this.url = url;
    this.tempoLimiteMs = tempoLimiteMs;
    this.proximoId = 1;
    this.pendentes = new Map();
    this.ouvintes = new Map();
    this.aoFechar = null;
  }

  abrir() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
      this.ws = ws;
      ws.once('open', () => resolve(this));
      ws.once('error', reject);
      ws.on('message', (dados) => this.receber(dados));
      ws.on('close', () => {
        for (const { reject: falhar, timer } of this.pendentes.values()) {
          clearTimeout(timer);
          falhar(new Error('conexão com o navegador fechada'));
        }
        this.pendentes.clear();
        this.aoFechar?.();
      });
    });
  }

  receber(dados) {
    let msg;
    try {
      msg = JSON.parse(dados.toString());
    } catch {
      return;
    }
    if (msg.id) {
      const pendente = this.pendentes.get(msg.id);
      if (!pendente) return;
      this.pendentes.delete(msg.id);
      clearTimeout(pendente.timer);
      if (msg.error) pendente.reject(new Error(`${pendente.method}: ${msg.error.message}`));
      else pendente.resolve(msg.result || {});
      return;
    }
    if (msg.method) {
      for (const fn of this.ouvintes.get(msg.method) || []) fn(msg.params || {}, msg.sessionId);
    }
  }

  /** Comando no navegador (sem sessionId) ou numa aba (com sessionId). */
  send(method, params = {}, sessionId) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error('navegador desconectado'));
    const id = this.proximoId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendentes.delete(id);
        reject(new Error(`${method}: sem resposta`));
      }, this.tempoLimiteMs);
      this.pendentes.set(id, { resolve, reject, timer, method });
      this.ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    });
  }

  on(method, fn) {
    if (!this.ouvintes.has(method)) this.ouvintes.set(method, []);
    this.ouvintes.get(method).push(fn);
  }

  /** Espera um evento da aba (ex.: a página terminar de carregar), com prazo. */
  esperarEvento(method, sessionId, prazoMs) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => fim(false), prazoMs);
      const fn = (_params, sid) => {
        if (sid === sessionId) fim(true);
      };
      const fim = (ok) => {
        clearTimeout(timer);
        const lista = this.ouvintes.get(method) || [];
        const i = lista.indexOf(fn);
        if (i >= 0) lista.splice(i, 1);
        resolve(ok);
      };
      this.on(method, fn);
    });
  }

  fechar() {
    try {
      this.ws?.close();
    } catch {
      // já fechada
    }
  }
}
