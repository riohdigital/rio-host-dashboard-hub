/**
 * Calendário do próprio anúncio pelo perfil salvo do login (E4 da precificação).
 *
 * Abre o multicalendário do anfitrião no mesmo navegador do login e captura as respostas
 * JSON que a própria página busca, como a leitura de reserva (src/reserva.js). Visitar o
 * calendário é o que um anfitrião faz todo dia; nada de chave de API nem cookies copiados.
 *
 * Enquanto o formato das respostas não está mapeado, a rota devolve o diagnóstico: caminho,
 * operação, tamanho e o esqueleto (só nomes de campos, sem valores) das respostas que falam
 * de calendário, preço ou disponibilidade. Só o Airbnb: a sessão da Booking ainda é frágil.
 */
import { esqueleto, lerCalendarioAirbnb } from './extratores.js';
import { LeituraDeReserva } from './reserva.js';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const INTERESSE = /calendar|availability|pricing|price|nightly|multicalendar/i;
// Rolagens no calendário para a página buscar os meses seguintes (cerca de 1 ano).
const MAX_ROLAGENS = 12;

export class LeituraDeCalendario extends LeituraDeReserva {
  constructor({ plataforma, pasta, anuncio, config, urlDoNavegador }) {
    super({ plataforma, pasta, codigo: 'CALENDARIO', config, urlDoNavegador });
    this.anuncio = String(anuncio || '').replace(/\D/g, '');
  }

  async executar() {
    const inicio = Date.now();
    await this.abrir();
    try {
      return await this.airbnbCalendario();
    } finally {
      this.duracao = Date.now() - inicio;
      await this.encerrar();
    }
  }

  async airbnbCalendario() {
    if (this.plataforma !== 'airbnb') return { status: 'error', motivo: 'calendário só no Airbnb por enquanto' };
    if (!this.anuncio) return { status: 'error', motivo: 'id do anúncio do Airbnb não informado' };
    await this.ir(`https://www.airbnb.com.br/multicalendar/${this.anuncio}`);

    // Deixa a página buscar o calendário e rola como uma pessoa, para ela pedir os meses
    // seguintes (a página só busca os meses que aparecem). Para quando a rolagem não traz mais nada.
    await this.assentar(25_000);
    for (let i = 0; i < MAX_ROLAGENS; i++) {
      const antes = this.pedidos.size;
      await this.aba('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 512, y: 450, deltaX: 0, deltaY: 700 + Math.floor(Math.random() * 300) }).catch(() => {});
      await esperar(1500 + Math.floor(Math.random() * 1500));
      await this.assentar(5_000);
      if (this.pedidos.size === antes && i >= 2) break;
    }
    const { passo } = await this.passoAtual(3_000);
    if (passo !== 'conectado' && passo !== 'carregando') return { status: 'auth_required', motivo: `sessão do Airbnb caiu (tela: ${passo})` };

    const respostas = [];
    const corpos = [];
    for (const [requestId, p] of this.pedidos) {
      if (!p.terminou || p.status !== 200 || !String(p.tipo || '').includes('json')) continue;
      const u = new URL(p.url);
      const operacao = (u.pathname.match(/\/api\/v3\/([^/]+)/) || [])[1] || null;
      if (!INTERESSE.test(`${u.pathname} ${operacao || ''}`)) continue;
      let json;
      try {
        json = await this.corpo(requestId);
      } catch {
        continue;
      }
      corpos.push({ operacao, json });
      const texto = JSON.stringify(json);
      respostas.push({ caminho: u.pathname, operacao, tamanho: texto.length, tem_o_anuncio: texto.includes(this.anuncio), esqueleto: esqueleto(json, 0, 10) });
    }

    // Formato conhecido: junta os dias de todas as respostas (um mês por resposta); senão, o
    // diagnóstico para mapear o formato.
    const dias = new Map();
    let operacao = null;
    for (const c of corpos) {
      for (const d of lerCalendarioAirbnb(c.json, this.anuncio) || []) {
        dias.set(d.data, d);
        operacao = operacao || c.operacao;
      }
    }
    if (dias.size) {
      return { status: 'ok', plataforma: 'airbnb', anuncio: this.anuncio, operacao, dias: [...dias.values()].sort((a, b) => a.data.localeCompare(b.data)) };
    }
    return { status: 'diagnostico', plataforma: 'airbnb', anuncio: this.anuncio, respostas };
  }

  /** Espera a página parar de buscar (nenhum pedido novo terminando) ou o prazo acabar. */
  async assentar(prazoMs) {
    const inicio = Date.now();
    let quantos = -1;
    while (Date.now() - inicio < prazoMs) {
      await esperar(1500);
      const agora = [...this.pedidos.values()].filter((p) => p.terminou).length;
      if (agora === quantos && agora > 0) return;
      quantos = agora;
    }
  }
}
