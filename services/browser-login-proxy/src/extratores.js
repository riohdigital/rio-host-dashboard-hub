/**
 * Leitura determinística das respostas que as páginas das plataformas buscam.
 * Regras de valor: n8n-manager/projects/rioh-host/REGRAS_DE_NEGOCIO_RESERVAS.md (R1).
 *
 * O formato devolvido é o mesmo que a auditoria do n8n já entende ("4. Comparar com o
 * Banco"), para trocar o agente de IA por estes extratores sem mexer na comparação.
 */

/** "R$ 2.598,37" | "-R$ 578,63" → número. */
export function valorBRL(texto) {
  if (texto === null || texto === undefined) return null;
  const s = String(texto).replace(/\s/g, '');
  const m = s.match(/(-)?R\$(-)?([\d.]+(?:,\d{1,2})?)/);
  if (!m) return null;
  const n = Number(m[3].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? (m[1] || m[2] ? -n : n) : null;
}

/** Data local de Brasília (AAAA-MM-DD) de um instante ISO. */
export function dataEmBrasilia(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

const centavos = (n) => Math.round(n * 100) / 100;

/**
 * Airbnb — resposta de `StayHostingDetailsQuery` (página /hosting/stay/<código>).
 * R1: Total (BRL) do grupo "Você recebe" + |Cota(s) do coanfitrião|.
 */
export function lerReservaAirbnb(resposta, codigo) {
  const h = resposta?.data?.presentation?.hostingDetails?.stayHostingDetails;
  if (!h) return { status: 'error', platform: 'Airbnb', reservation_code: codigo, discrepancies: ['a página não trouxe o detalhe da reserva'] };

  const secoes = [...(h.headerPlacement || []), ...(h.rootPlacement || [])];
  const secao = (id) => secoes.find((s) => s.sectionId === id)?.sectionData || null;
  const cabecalho = String(secao('HEADER_SECTION')?.title || '');
  const resumo = secao('SMART_SUMMARY_SECTION') || {};
  const datas = secao('CHECK_IN_CHECK_OUT_SECTION') || {};
  const quem = secao('WHOSCOMING_SECTION') || {};
  const rosto = secao('FACEPILE_SECTION') || {};
  const pagamento = secao('PAYMENTINFO_SECTION') || {};
  const recebe = pagamento.hostEarningsGroup || {};

  const entradaIso = datas.checkInAction?.checkInTime || datas.checkoutAction?.checkInTime;
  const saidaIso = datas.checkInAction?.checkOutTime || datas.checkoutAction?.checkOutTime;
  const entrada = dataEmBrasilia(entradaIso);
  const saida = dataEmBrasilia(saidaIso);
  const noites = entrada && saida ? Math.round((Date.parse(saida) - Date.parse(entrada)) / 86_400_000) : null;

  const linhas = (recebe.lineItems || []).map((l) => ({ rotulo: String(l.label || ''), valor: valorBRL(l.formattedValue) }));
  const total = valorBRL(recebe.totalLineItem?.formattedValue);
  const cota = linhas.filter((l) => /cota/i.test(l.rotulo) && /coanfitri/i.test(l.rotulo)).reduce((s, l) => s + Math.abs(l.valor || 0), 0);
  const limpeza = linhas.find((l) => /limpeza/i.test(l.rotulo))?.valor ?? null;

  const textoStatus = `${cabecalho} ${resumo.title || ''}`;
  const cancelada = /cancelad/i.test(textoStatus) || (quem.reservationGroups || []).some((g) => g.isCanceled === true);
  const pedido = !cancelada && (/pedido de reserva|pediu para|solicita/i.test(textoStatus) || pagamento.isConfirmed === false);
  const hospede = quem.reservationGroups?.[0]?.guests?.[0]?.name || rosto.guests?.[0]?.name || null;
  const pessoas = Array.isArray(rosto.guests) ? rosto.guests.length + (Number(rosto.additionalGuests) || 0) : null;

  const avisos = [];
  if (total === null) avisos.push('o bloco "Você recebe" não trouxe o Total (BRL)');
  if (cota) avisos.push(`valor = Total ${total} + cota do coanfitrião ${centavos(cota)} (R1)`);

  return {
    status: total === null || !entrada || !saida ? 'error' : 'success',
    platform: 'Airbnb',
    reservation_code: codigo,
    is_booking_request_only: pedido,
    reservation_status: cancelada ? 'Cancelada' : 'Confirmada',
    status_portal: cabecalho || resumo.title || null,
    guest_name: hospede,
    check_in_date: entrada,
    check_out_date: saida,
    number_of_nights: noites,
    number_of_guests: pessoas,
    total_revenue: total === null ? null : centavos(total + cota),
    cleaning_fee: limpeza,
    payout_breakdown: { host_payout: total, cohost_fee: centavos(cota), gross_total: total === null ? null : centavos(total + cota) },
    is_multi_month: noites !== null && noites > 28,
    installments: [],
    discrepancies: avisos,
    fonte: 'perfil:StayHostingDetailsQuery',
  };
}

/**
 * Esqueleto de um JSON: nomes de campos e tipos, sem nenhum valor (nem nomes de hóspede,
 * nem valores). Usado no diagnóstico da extranet da Booking.
 */
export function esqueleto(valor, profundidade = 0, limite = 5) {
  if (valor === null) return 'null';
  if (Array.isArray(valor)) return valor.length ? [esqueleto(valor[0], profundidade + 1, limite), `×${valor.length}`] : [];
  if (typeof valor !== 'object') return typeof valor;
  if (profundidade >= limite) return '{…}';
  const r = {};
  for (const [k, v] of Object.entries(valor).slice(0, 60)) r[k] = esqueleto(v, profundidade + 1, limite);
  return r;
}

/**
 * Airbnb — dias do calendário do anúncio numa resposta do multicalendário (E4).
 * Procura objetos de dia (data AAAA-MM-DD) com preço; só aceita a resposta com ao menos uma
 * semana de dias com preço, para não confundir com outro bloco da página. Sem isso, null
 * (a rota devolve o diagnóstico do formato).
 */
export function lerCalendarioAirbnb(resposta) {
  const dias = new Map();
  const DATA = /^\d{4}-\d{2}-\d{2}$/;
  const preco = (o) => {
    for (const [k, v] of Object.entries(o)) {
      if (!/price/i.test(k) || v === null || v === undefined) continue;
      if (typeof v === 'number' && v > 0) return v;
      if (typeof v === 'string') {
        const n = valorBRL(v.includes('R$') ? v : `R$${v}`);
        if (n > 0) return n;
      }
      if (typeof v === 'object') {
        if (typeof v.amount === 'number' && v.amount > 0) return v.amount;
        if (typeof v.amountMicros === 'number' && v.amountMicros > 0) return v.amountMicros / 1e6;
        for (const t of [v.amountFormatted, v.localPriceFormatted, v.priceFormatted, v.formatted]) {
          const n = valorBRL(t);
          if (n > 0) return n;
        }
      }
    }
    return null;
  };
  const visitar = (no, profundidade) => {
    if (!no || typeof no !== 'object' || profundidade > 14) return;
    if (Array.isArray(no)) return no.forEach((x) => visitar(x, profundidade + 1));
    const data = ['calendarDate', 'date', 'day'].map((k) => no[k]).find((v) => typeof v === 'string' && DATA.test(v));
    if (data) {
      const valor = preco(no);
      if (valor !== null && !dias.has(data)) {
        const disponivel = [no.available, no.isAvailable, no.availableForCheckin, no.bookable].find((v) => typeof v === 'boolean');
        const minimo = [no.minNights, no.minimumNights, no.min_nights].find((v) => Number.isInteger(v) && v > 0);
        dias.set(data, { data, diaria: centavos(valor), disponivel: disponivel ?? null, estadia_minima: minimo ?? null });
      }
    }
    for (const v of Object.values(no)) if (v && typeof v === 'object') visitar(v, profundidade + 1);
  };
  visitar(resposta, 0);
  if (dias.size < 7) return null;
  return [...dias.values()].sort((a, b) => a.data.localeCompare(b.data));
}

/** Número do anúncio dentro de um id do Airbnb ("DemandStayListing:123" em base64, ou já número). */
function numeroDoAnuncio(id) {
  if (id === null || id === undefined) return null;
  const s = String(id);
  if (/^\d{4,20}$/.test(s)) return s;
  try {
    const m = Buffer.from(s, 'base64').toString('utf8').match(/Listing:(\d{4,20})/);
    if (m) return m[1];
  } catch {
    /* não é base64 */
  }
  const m = s.match(/(\d{6,20})/);
  return m ? m[1] : null;
}

/**
 * Airbnb — anúncios de uma resposta de busca (StaysSearch), com o preço das datas pesquisadas.
 * O preço vem do texto que a página mostra; "total" é dividido pelas noites. Cada anúncio leva
 * `bruto`: o trecho do preço como a página mostrou (prova da origem).
 */
export function lerBuscaAirbnb(resposta, noites) {
  const achados = new Map();
  const texto = (v) => (typeof v === 'string' ? v : v && typeof v === 'object' ? v.localizedStringWithTranslationPreference || v.localizedString || null : null);
  const visitar = (no, profundidade) => {
    if (!no || typeof no !== 'object' || profundidade > 16) return;
    if (Array.isArray(no)) return no.forEach((x) => visitar(x, profundidade + 1));
    const precoBloco = no.structuredDisplayPrice || no.pricingQuote?.structuredStayDisplayPrice || null;
    const listing = no.demandStayListing || no.listing || null;
    if (precoBloco && listing) {
      const id = numeroDoAnuncio(listing.id) || numeroDoAnuncio(no.listingParamOverrides?.listingId);
      const linha = precoBloco.primaryLine || {};
      const rotulo = String(linha.accessibilityLabel || linha.qualifier || '');
      const valor = valorBRL(linha.discountedPrice) ?? valorBRL(linha.price) ?? valorBRL(rotulo);
      if (id && valor > 0 && !achados.has(id)) {
        const total = /total/i.test(`${rotulo} ${linha.qualifier || ''}`) || (noites > 1 && !/noite|night/i.test(rotulo));
        const nota = String(no.avgRatingLocalized || no.avgRatingA11yLabel || listing.avgRatingLocalized || '');
        const mNota = nota.match(/(\d[.,]\d{1,2})/);
        const mAval = nota.match(/\((\d[\d.]*)\)/) || nota.match(/(\d[\d.]*)\s+(?:avalia|review)/i);
        const conteudo = JSON.stringify(no.structuredContent || {});
        const mQuartos = conteudo.match(/(\d+)\s+quartos?/i);
        const coord = listing.location?.coordinate || listing.coordinate || {};
        achados.set(id, {
          id,
          nome: texto(no.nameLocalized) || texto(listing.description?.name) || texto(no.title) || listing.name || null,
          titulo: texto(no.title) || null,
          diaria: centavos(total && noites > 0 ? valor / noites : valor),
          preco_mostrado: valor,
          preco_e_total: Boolean(total),
          nota: mNota ? Number(mNota[1].replace(',', '.')) : null,
          avaliacoes: mAval ? Number(mAval[1].replace(/\./g, '')) : null,
          quartos: mQuartos ? Number(mQuartos[1]) : /est[uú]dio|studio/i.test(conteudo) ? 0 : null,
          lat: Number.isFinite(coord.latitude) ? coord.latitude : null,
          lng: Number.isFinite(coord.longitude) ? coord.longitude : null,
          bruto: { primaryLine: { price: linha.price ?? null, discountedPrice: linha.discountedPrice ?? null, qualifier: linha.qualifier ?? null, accessibilityLabel: linha.accessibilityLabel ?? null } },
        });
      }
    }
    for (const v of Object.values(no)) if (v && typeof v === 'object') visitar(v, profundidade + 1);
  };
  visitar(resposta, 0);
  return achados.size ? [...achados.values()] : null;
}
