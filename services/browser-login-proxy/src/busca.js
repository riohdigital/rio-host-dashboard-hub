/**
 * Busca de anúncios no mapa pelo perfil salvo do login (E5 e E6 da precificação).
 *
 * Abre a busca do Airbnb em volta do imóvel, com as datas e os hóspedes pedidos, e captura a
 * resposta de busca que a própria página faz (StaysSearch). Uma busca traz dezenas de anúncios
 * com o preço daquelas datas: é assim que a esteira descobre os concorrentes (E5) e lê os preços
 * deles nas datas que importam (E6), sem abrir anúncio por anúncio.
 *
 * Formato reconhecido: devolve os anúncios. Senão, o diagnóstico (só nomes de campos).
 */
import { esqueleto, lerBuscaAirbnb } from './extratores.js';
import { LeituraDeReserva } from './reserva.js';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export class BuscaNoMapa extends LeituraDeReserva {
  constructor({ plataforma, pasta, lat, lng, raioKm, checkin, checkout, hospedes, config, urlDoNavegador }) {
    super({ plataforma, pasta, codigo: 'BUSCA', config, urlDoNavegador });
    this.lat = Number(lat);
    this.lng = Number(lng);
    this.raioKm = Math.min(Math.max(Number(raioKm) || 1.5, 0.3), 10);
    this.checkin = checkin;
    this.checkout = checkout;
    this.hospedes = Math.min(Math.max(parseInt(hospedes, 10) || 2, 1), 16);
  }

  /** Pedido válido? (coordenadas, datas em ordem) */
  static valido(c) {
    const lat = Number(c.lat);
    const lng = Number(c.lng);
    return Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180 &&
      DATA.test(String(c.checkin)) && DATA.test(String(c.checkout)) && String(c.checkout) > String(c.checkin);
  }

  async executar() {
    const inicio = Date.now();
    await this.abrir();
    try {
      return await this.airbnb();
    } finally {
      this.duracao = Date.now() - inicio;
      await this.encerrar();
    }
  }

  /**
   * Região com poucos anúncios (resort, cidade pequena): afasta o mapa como uma pessoa faria,
   * dobrando o raio até achar anúncios suficientes para comparar (ou chegar a 8 km).
   */
  async airbnb() {
    if (this.plataforma !== 'airbnb') return { status: 'error', motivo: 'busca só no Airbnb por enquanto' };
    const MIN_ANUNCIOS = 8;
    let melhor = null;
    for (let raio = this.raioKm, zoom = 15; raio <= 8.01; raio *= 2, zoom -= 1) {
      const r = await this.buscarUma(raio, zoom);
      if (r.status !== 'ok') return melhor || r;
      if (!melhor || r.anuncios.length > melhor.anuncios.length) melhor = r;
      if (r.anuncios.length >= MIN_ANUNCIOS) break;
      // Uma pausa antes de afastar o mapa.
      await esperar(3000 + Math.floor(Math.random() * 4000));
    }
    return melhor;
  }

  async buscarUma(raioKm, zoom) {
    // Caixa do mapa em volta do imóvel (1° de latitude ≈ 111 km).
    const dLat = raioKm / 111;
    const dLng = raioKm / (111 * Math.max(Math.cos((this.lat * Math.PI) / 180), 0.2));
    const qs = new URLSearchParams({
      refinement_paths: '/homes', search_type: 'filter_change', search_by_map: 'true',
      checkin: this.checkin, checkout: this.checkout, adults: String(this.hospedes),
      ne_lat: (this.lat + dLat).toFixed(6), ne_lng: (this.lng + dLng).toFixed(6),
      sw_lat: (this.lat - dLat).toFixed(6), sw_lng: (this.lng - dLng).toFixed(6),
      zoom_level: String(Math.max(zoom, 11)),
    });
    this.pedidos.clear();
    await this.ir(`https://www.airbnb.com.br/s/homes?${qs}`);

    const noites = Math.round((Date.parse(`${this.checkout}T00:00:00Z`) - Date.parse(`${this.checkin}T00:00:00Z`)) / 86400000);
    const fim = (anuncios, origem) => ({ status: 'ok', plataforma: 'airbnb', origem, raio_km: Math.round(raioKm * 10) / 10, checkin: this.checkin, checkout: this.checkout, noites, hospedes: this.hospedes, anuncios });

    // 1) A busca que a página faz por XHR (quando o mapa se move ou a página pede mais).
    const alvo = (p) => /\/api\/v3\/StaysSearch\b/.test(p.url);
    const requestId = await this.esperarResposta(alvo, 15_000);
    // Uma pessoa olha o mapa antes de seguir.
    await esperar(2000 + Math.floor(Math.random() * 3000));
    if (requestId) {
      const anuncios = lerBuscaAirbnb(await this.corpo(requestId), noites);
      if (anuncios && anuncios.length) return fim(anuncios, 'xhr');
    }

    // 2) O primeiro resultado vem embutido no HTML (estado da página), sem chamada à parte.
    const { passo } = await this.passoAtual(3_000);
    if (['email', 'senha', 'codigo', 'captcha'].includes(passo)) return { status: 'auth_required', motivo: `sessão do Airbnb caiu (tela: ${passo})` };
    const estados = await this.estadoEmbutido();
    for (const estado of estados) {
      const anuncios = lerBuscaAirbnb(estado, noites);
      if (anuncios && anuncios.length) return fim(anuncios, 'estado_da_pagina');
    }
    const operacoes = [...new Set([...this.pedidos.values()].map((p) => (p.url.match(/\/api\/v3\/([^/?]+)/) || [])[1]).filter(Boolean))];
    return { status: 'diagnostico', plataforma: 'airbnb', operacoes, estados: estados.map((e) => esqueleto(e, 0, 9)) };
  }

  /** JSON embutido nos <script> de estado da página (lido num mundo isolado, invisível à página). */
  async estadoEmbutido() {
    try {
      const { frameTree } = await this.aba('Page.getFrameTree');
      const { executionContextId } = await this.aba('Page.createIsolatedWorld', { frameId: frameTree.frame.id, worldName: 'rioh-estado', grantUniveralAccess: false });
      const { result } = await this.aba('Runtime.evaluate', {
        contextId: executionContextId,
        returnByValue: true,
        expression: `Array.from(document.querySelectorAll('script[id^="data-deferred-state"], script[type="application/json"]')).map((s) => s.textContent).filter((t) => t && t.length > 200 && t.length < 8000000)`,
      });
      return (result.value || []).map((t) => {
        try {
          return JSON.parse(t);
        } catch {
          return null;
        }
      }).filter(Boolean);
    } catch {
      return [];
    }
  }
}
