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

  async airbnb() {
    if (this.plataforma !== 'airbnb') return { status: 'error', motivo: 'busca só no Airbnb por enquanto' };
    // Caixa do mapa em volta do imóvel (1° de latitude ≈ 111 km).
    const dLat = this.raioKm / 111;
    const dLng = this.raioKm / (111 * Math.max(Math.cos((this.lat * Math.PI) / 180), 0.2));
    const qs = new URLSearchParams({
      refinement_paths: '/homes', search_type: 'filter_change', search_by_map: 'true',
      checkin: this.checkin, checkout: this.checkout, adults: String(this.hospedes),
      ne_lat: (this.lat + dLat).toFixed(6), ne_lng: (this.lng + dLng).toFixed(6),
      sw_lat: (this.lat - dLat).toFixed(6), sw_lng: (this.lng - dLng).toFixed(6),
      zoom_level: '15',
    });
    await this.ir(`https://www.airbnb.com.br/s/homes?${qs}`);

    const alvo = (p) => /\/api\/v3\/StaysSearch\b/.test(p.url);
    const requestId = await this.esperarResposta(alvo, 30_000);
    if (!requestId) {
      const { passo } = await this.passoAtual(5_000);
      if (['email', 'senha', 'codigo', 'captcha'].includes(passo)) return { status: 'auth_required', motivo: `sessão do Airbnb caiu (tela: ${passo})` };
      return { status: 'error', motivo: 'a página de busca não buscou os anúncios' };
    }
    // Uma pessoa olha o mapa antes de fechar.
    await esperar(2000 + Math.floor(Math.random() * 3000));
    const json = await this.corpo(requestId);
    const noites = Math.round((Date.parse(`${this.checkout}T00:00:00Z`) - Date.parse(`${this.checkin}T00:00:00Z`)) / 86400000);
    const anuncios = lerBuscaAirbnb(json, noites);
    if (anuncios && anuncios.length) {
      return { status: 'ok', plataforma: 'airbnb', checkin: this.checkin, checkout: this.checkout, noites, hospedes: this.hospedes, anuncios };
    }
    return { status: 'diagnostico', plataforma: 'airbnb', esqueleto: esqueleto(json, 0, 12) };
  }
}
