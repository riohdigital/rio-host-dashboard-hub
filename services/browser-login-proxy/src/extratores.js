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
