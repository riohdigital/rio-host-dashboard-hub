/**
 * Leitura de uma reserva pelo perfil salvo do login (agente da auditoria, fase 3.3).
 *
 * O proxy abre a página da reserva no mesmo navegador do login e captura a resposta
 * JSON que a própria página busca (Airbnb: StayHostingDetailsQuery). Nada de hash fixo,
 * chave de API ou cookies copiados: se a plataforma mudar a consulta, a página continua
 * buscando o detalhe e a captura continua funcionando.
 *
 * Booking: o formato da lista de reservas (retrieve_list_v2) ainda está sendo levantado; a
 * rota devolve o esqueleto (só nomes de campos) das respostas JSON da página.
 */
import { Cdp } from './cdp.js';
import { esqueleto, lerReservaAirbnb } from './extratores.js';
import { PLATAFORMAS, SONDA, passoDoLogin } from './plataformas.js';
import { urlDoBrowserless } from './sessao.js';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export class LeituraDeReserva {
  constructor({ plataforma, codigo, hotelId, config, urlDoNavegador }) {
    this.plataforma = plataforma;
    this.def = PLATAFORMAS[plataforma];
    this.codigo = String(codigo || '').trim().toUpperCase();
    this.hotelId = hotelId ? String(hotelId).replace(/\D/g, '') : null;
    this.config = config;
    this.urlDoNavegador = urlDoNavegador || (() => urlDoBrowserless(config, this.def.perfil));
    this.pedidos = new Map();
  }

  aba(method, params) {
    return this.cdp.send(method, params, this.sessao);
  }

  async abrir() {
    this.cdp = new Cdp(this.urlDoNavegador());
    await this.cdp.abrir();
    const { targetInfos } = await this.cdp.send('Target.getTargets');
    let alvo = targetInfos.find((t) => t.type === 'page');
    if (!alvo) alvo = await this.cdp.send('Target.createTarget', { url: 'about:blank' });
    ({ sessionId: this.sessao } = await this.cdp.send('Target.attachToTarget', { targetId: alvo.targetId, flatten: true }));
    await this.aba('Page.enable');
    if (this.config.fusoHorario) await this.aba('Emulation.setTimezoneOverride', { timezoneId: this.config.fusoHorario }).catch(() => {});

    // Rede: só o que a página busca por XHR/fetch. O domínio Network não é visível à página.
    this.cdp.on('Network.requestWillBeSent', (p, sid) => {
      if (sid !== this.sessao || !['XHR', 'Fetch'].includes(p.type)) return;
      this.pedidos.set(p.requestId, { url: p.request.url, metodo: p.request.method, corpoPedido: p.request.postData || null });
    });
    this.cdp.on('Network.responseReceived', (p, sid) => {
      const pedido = sid === this.sessao && this.pedidos.get(p.requestId);
      if (pedido) Object.assign(pedido, { status: p.response.status, tipo: p.response.mimeType });
    });
    this.cdp.on('Network.loadingFinished', (p, sid) => {
      const pedido = sid === this.sessao && this.pedidos.get(p.requestId);
      if (pedido) pedido.terminou = true;
    });
    await this.aba('Network.enable', { maxPostDataSize: 65536 });
  }

  async ir(url) {
    const carregou = this.cdp.esperarEvento('Page.domContentEventFired', this.sessao, 45_000);
    await this.aba('Page.navigate', { url });
    await carregou;
  }

  async sondar() {
    if (!this.mundo) {
      const { frameTree } = await this.aba('Page.getFrameTree');
      ({ executionContextId: this.mundo } = await this.aba('Page.createIsolatedWorld', { frameId: frameTree.frame.id, worldName: 'rioh-sonda', grantUniveralAccess: false }));
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

  /** Espera a página assentar: login (sessão caiu) ou a área logada da plataforma. */
  async passoAtual(prazoMs = 20_000) {
    const inicio = Date.now();
    let passo = 'carregando';
    let sonda = null;
    while (Date.now() - inicio < prazoMs) {
      await esperar(1000);
      try {
        sonda = await this.sondar();
        const { cookies } = await this.cdp.send('Storage.getCookies');
        const nomes = cookies.filter((c) => this.def.cookiesDe.some((d) => c.domain.endsWith(d))).map((c) => c.name);
        passo = passoDoLogin(this.plataforma, sonda, nomes);
      } catch {
        continue;
      }
      if (passo === 'conectado' || ['email', 'senha', 'codigo', 'captcha'].includes(passo)) break;
    }
    return { passo, sonda };
  }

  /** Corpo de uma resposta capturada, já como JSON. */
  async corpo(requestId) {
    const { body, base64Encoded } = await this.aba('Network.getResponseBody', { requestId });
    const texto = base64Encoded ? Buffer.from(body, 'base64').toString('utf8') : body;
    return JSON.parse(texto);
  }

  /** Espera até `filtro` achar uma resposta terminada (ou o prazo acabar). */
  async esperarResposta(filtro, prazoMs) {
    const inicio = Date.now();
    while (Date.now() - inicio < prazoMs) {
      const achadas = [...this.pedidos.entries()].filter(([, p]) => p.terminou && p.status === 200 && filtro(p));
      if (achadas.length) return achadas[achadas.length - 1][0];
      await esperar(500);
    }
    return null;
  }

  async executar() {
    const inicio = Date.now();
    await this.abrir();
    try {
      return this.plataforma === 'airbnb' ? await this.airbnb() : await this.booking();
    } finally {
      this.duracao = Date.now() - inicio;
      await this.encerrar();
    }
  }

  async airbnb() {
    await this.ir(`https://www.airbnb.com.br/hosting/reservations/details/${encodeURIComponent(this.codigo)}`);
    const alvo = (p) => p.url.includes('/api/v3/StayHostingDetailsQuery/') && decodeURIComponent(p.url).includes(`"confirmationCode":"${this.codigo}"`);
    const requestId = await this.esperarResposta(alvo, 25_000);
    if (!requestId) {
      const { passo } = await this.passoAtual(5_000);
      if (passo !== 'conectado') return { status: 'auth_required', platform: 'Airbnb', reservation_code: this.codigo, discrepancies: [`sessão do Airbnb caiu (tela: ${passo})`] };
      return { status: 'error', platform: 'Airbnb', reservation_code: this.codigo, discrepancies: ['a página da reserva não buscou o detalhe (código inexistente nesta conta?)'] };
    }
    // Uma pessoa não fecha a aba no instante em que os dados aparecem.
    await esperar(2000 + Math.floor(Math.random() * 3000));
    return lerReservaAirbnb(await this.corpo(requestId), this.codigo);
  }

  async booking() {
    // A extranet logada sempre leva a um endereço com `ses=`; a página de detalhe precisa dele.
    await this.ir(this.def.inicio);
    const { passo, sonda } = await this.passoAtual();
    if (passo !== 'conectado') return { status: 'auth_required', platform: 'Booking.com', reservation_code: this.codigo, discrepancies: [`sessão da Booking caiu (tela: ${passo})`] };
    const ses = new URLSearchParams(sonda.busca || '').get('ses');
    if (!this.hotelId) return { status: 'error', platform: 'Booking.com', reservation_code: this.codigo, discrepancies: ['hotel_id da Booking não informado para este imóvel'] };

    this.pedidos.clear();
    // Lista de reservas, não o detalhe: a página de detalhe pede verificação de identidade
    // (auth-assurance) por mostrar dados pessoais do hóspede. Visto em 20/10/2026.
    const qs = new URLSearchParams({ hotel_id: this.hotelId, lang: 'pt', ses });
    await this.ir(`https://admin.booking.com/hotel/hoteladmin/extranet_ng/manage/search_reservations.html?${qs}`);
    // Deixa a página buscar o que precisa.
    const inicio = Date.now();
    let quantos = -1;
    while (Date.now() - inicio < 20_000) {
      await esperar(1500);
      const agora = [...this.pedidos.values()].filter((p) => p.terminou).length;
      if (agora === quantos && agora > 0) break;
      quantos = agora;
    }

    const respostas = [];
    for (const [requestId, p] of this.pedidos) {
      if (!p.terminou || !String(p.tipo || '').includes('json')) continue;
      let json = null;
      try {
        json = await this.corpo(requestId);
      } catch {
        continue;
      }
      const texto = JSON.stringify(json);
      const u = new URL(p.url);
      respostas.push({
        caminho: u.pathname,
        parametros: [...u.searchParams.keys()].filter((k) => !['ses', 'token'].includes(k)),
        metodo: p.metodo,
        status: p.status,
        tamanho: texto.length,
        tem_o_codigo: texto.includes(this.codigo),
        corpo_do_pedido: p.corpoPedido ? esqueletoDoPedido(p.corpoPedido) : null,
        esqueleto: texto.includes(this.codigo) || u.pathname.includes('retrieve_list') ? esqueleto(json) : null,
      });
    }
    return {
      status: 'diagnostico',
      platform: 'Booking.com',
      reservation_code: this.codigo,
      pagina: (await this.sondar().catch(() => null))?.caminho || null,
      respostas,
    };
  }

  async encerrar() {
    if (!this.cdp) return;
    await this.cdp.send('Browser.close').catch(() => {});
    this.cdp.fechar();
    this.cdp = null;
  }
}

/** Corpo de um POST: só as chaves (JSON ou formulário), nunca os valores. */
function esqueletoDoPedido(corpo) {
  try {
    return esqueleto(JSON.parse(corpo));
  } catch {
    return [...new URLSearchParams(corpo).keys()];
  }
}
