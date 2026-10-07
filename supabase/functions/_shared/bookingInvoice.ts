/**
 * Nota fiscal (NFS-e) da comissão da Booking.com — sinal de que o mês foi pago.
 *
 * Todo mês a Prefeitura de São Paulo envia, por imóvel, a NFS-e que a Booking
 * emite com a comissão das reservas com saída naquele mês. O e-mail só traz o
 * link; o PDF público da nota traz o que importa:
 *
 *   Código do Cliente: 14107413            → hotel_id do imóvel
 *   VALOR DAS VENDAS: R$ 5178.00           → soma do valor comissionável
 *   Valor Líquido a pagar R$ 776.70        → soma das comissões
 *   RPS … emitido em 30/09/2026            → mês das saídas
 *
 * Conferido em 07/10/2026: a nota 6270387 (Copacabana, setembro) bate no
 * centavo com as reservas 5746792143, 6124022858 e 5454394638. Pela R1, a soma
 * do valor delas no dashboard é vendas − comissão (R$ 4.401,30).
 */

// deno-lint-ignore-file no-explicit-any

import { learnSourceHints } from './propertyMatching.ts';

export interface BookingInvoiceLink {
  numero: string;
  pdfUrl: string;
}

export interface BookingInvoice {
  hotelId: string;
  /** Soma do valor comissionável. As notas anteriores a fev/2026 não trazem. */
  vendas: number | null;
  comissao: number;
  /** Primeiro e último dia do mês das saídas (AAAA-MM-DD). */
  mesInicio: string;
  mesFim: string;
}

/** Inscrição municipal (CCM 3.882.162-1) da Booking.com Brasil em São Paulo. */
const CCM_BOOKING = '38821621';

/**
 * Link da NFS-e no e-mail da Prefeitura, convertido no endereço do PDF.
 * Só aceita nota emitida pela Booking: o endereço é montado aqui, com o
 * domínio fixo da Prefeitura, e nunca copiado do e-mail.
 */
export function findBookingInvoiceLink(text: string): BookingInvoiceLink | null {
  const m = /(?:nfe|notaprint|notaprintpdf)\.aspx\?ccm=(\d+)&(?:amp;)?nf=(\d+)&(?:amp;)?cod=([A-Za-z0-9]+)/i.exec(text);
  if (!m || m[1] !== CCM_BOOKING) return null;
  return {
    numero: m[2],
    pdfUrl: `https://nfe.sf.prefeitura.sp.gov.br/contribuinte/notaprintpdf.aspx?ccm=${m[1]}&nf=${m[2]}&cod=${m[3]}`,
  };
}

/** E-mail automático da NFS-e de São Paulo (qualquer prestador). */
export function isPrefeituraInvoiceEmail(from: string | undefined, subject: string | undefined): boolean {
  return /prefeitura\.sp\.gov\.br/i.test(from ?? '') && /NFS-e/i.test(subject ?? '');
}

function valor(texto: string | undefined): number | null {
  if (!texto) return null;
  const limpo = texto.trim();
  // A nota usa ponto decimal ("5178.00") no campo de vendas e vírgula nos totais.
  const normalizado = /,\d{2}$/.test(limpo) ? limpo.replace(/\./g, '').replace(',', '.') : limpo.replace(/,/g, '');
  const n = Number.parseFloat(normalizado);
  return Number.isFinite(n) ? n : null;
}

const ultimoDiaDoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();

/**
 * Mês das saídas que a nota cobre. Visto nas 20 notas de jun/2025 a out/2026:
 * o RPS sai no último dia do mês das saídas (30/09, 31/12, 31/05) e a nota, dias
 * depois; quando o RPS não é do último dia (04/02/2026), vale o mês anterior à
 * emissão da nota (05/02/2026 → janeiro).
 */
function mesDasSaidas(texto: string): { ano: number; mes: number } | null {
  const rps = /emitido em\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(texto);
  if (rps) {
    const [dia, mes, ano] = [Number(rps[1]), Number(rps[2]), Number(rps[3])];
    if (dia === ultimoDiaDoMes(ano, mes)) return { ano, mes };
  }
  // "Data e Hora de Emissão": a primeira data seguida de hora no cabeçalho.
  const nota = /(\d{2})\/(\d{2})\/(\d{4})\s+\d{2}:\d{2}:\d{2}/.exec(texto);
  if (!nota) return null;
  const [mes, ano] = [Number(nota[2]), Number(nota[3])];
  return mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
}

/**
 * Lê o texto do PDF da NFS-e. Devolve null se não for uma nota de comissão da Booking.
 * Layout desde fev/2026: "Valor Líquido a pagar" (comissão) e "VALOR DAS VENDAS".
 * Antes: só "Valor Liquido" (comissão), sem as vendas.
 */
export function parseBookingInvoice(texto: string): BookingInvoice | null {
  if (!/BOOKING\.COM/i.test(texto) || !/COMISS[ÃA]O REFERENTE A RESERVAS/i.test(texto)) return null;

  const hotelId = /C[oó]digo do Cliente:\s*(\d{6,})/i.exec(texto)?.[1];
  const vendas = valor(/VALOR DAS VENDAS:\s*R\$\s*([\d.,]+)/i.exec(texto)?.[1]);
  const comissao = valor(/Valor L[ií]quido(?: a pagar)?\s*R\$\s*([\d.,]+)/i.exec(texto)?.[1]);
  const mes = mesDasSaidas(texto);
  if (!hotelId || comissao === null || !mes) return null;

  const mm = String(mes.mes).padStart(2, '0');
  const dd = String(ultimoDiaDoMes(mes.ano, mes.mes)).padStart(2, '0');
  return { hotelId, vendas, comissao, mesInicio: `${mes.ano}-${mm}-01`, mesFim: `${mes.ano}-${mm}-${dd}` };
}

const arredonda = (n: number) => Math.round(n * 100) / 100;

/** Reservas da Booking do imóvel com saída no mês da nota, sem as canceladas. */
async function reservasDoMes(admin: any, propertyId: string, nota: BookingInvoice): Promise<any[]> {
  const { data, error } = await admin
    .from('reservations')
    .select('id, reservation_code, total_revenue, payment_status, reservation_status, verification_notes')
    .eq('platform', 'Booking.com')
    .eq('property_id', propertyId)
    .gte('check_out_date', nota.mesInicio)
    .lte('check_out_date', nota.mesFim);
  if (error) throw new Error(`Falha ao ler as reservas do imóvel ${propertyId}: ${error.message}`);
  return (data ?? []).filter((r: any) => !String(r.reservation_status ?? '').toLowerCase().includes('cancel'));
}

const somaDoMes = (reservas: any[]) => arredonda(reservas.reduce((s, r) => s + Number(r.total_revenue || 0), 0));

/**
 * Marca como pagas as reservas da Booking do imóvel com saída no mês da nota e
 * confere os totais. Divergência não impede a marcação (a Booking fechou o mês),
 * mas vira pendência com os números para conferência.
 *
 * Código do Cliente ainda desconhecido: entre os imóveis com saída da Booking no
 * mês e sem outro código cadastrado, o único cujo mês soma vendas − comissão é o
 * da nota, e o código passa a ficar gravado no calendário dele (Rio Marina =
 * 13783833 e Triplex = 15209784 foram achados assim, ao centavo).
 */
export async function applyBookingInvoice(
  admin: any,
  numero: string,
  nota: BookingInvoice,
): Promise<{ pagas: number; divergencia: string | null; propertyId: string | null; aprendido?: boolean }> {
  // Sem as vendas (notas antigas) não há total para conferir nem para achar o imóvel.
  const esperado = nota.vendas === null ? null : arredonda(nota.vendas - nota.comissao);
  const conta = esperado === null
    ? `comissão R$ ${nota.comissao.toFixed(2)}`
    : `vendas R$ ${nota.vendas!.toFixed(2)} − comissão R$ ${nota.comissao.toFixed(2)} = R$ ${esperado.toFixed(2)}`;
  const { data: fontes } = await admin
    .from('channel_sync_sources')
    .select('property_id, listing_alias')
    .eq('platform', 'Booking.com');
  const codigos = (f: any) => [...String(f.listing_alias ?? '').matchAll(/booking_hotel_id:(\d{6,})/g)].map((m) => m[1]);

  let propertyId: string | null = (fontes ?? []).find((f: any) => codigos(f).includes(nota.hotelId))?.property_id ?? null;
  let ativas: any[] = [];
  let aprendido = false;

  if (propertyId) {
    ativas = await reservasDoMes(admin, propertyId, nota);
  } else {
    // Candidatos: imóveis com saída da Booking no mês que não têm outro código
    // cadastrado (com ou sem calendário da Booking configurado).
    const comOutroCodigo = new Set((fontes ?? []).filter((f: any) => codigos(f).length > 0).map((f: any) => f.property_id));
    const { data: doMes } = esperado === null ? { data: [] } : await admin
      .from('reservations')
      .select('property_id')
      .eq('platform', 'Booking.com')
      .gte('check_out_date', nota.mesInicio)
      .lte('check_out_date', nota.mesFim);
    const candidatos: Array<{ id: string; reservas: any[] }> = [];
    for (const id of new Set<string>((doMes ?? []).map((r: any) => r.property_id))) {
      if (comOutroCodigo.has(id)) continue;
      const reservas = await reservasDoMes(admin, id, nota);
      if (reservas.length && Math.abs(somaDoMes(reservas) - esperado!) <= 1) candidatos.push({ id, reservas });
    }
    if (candidatos.length !== 1) {
      return {
        pagas: 0,
        propertyId: null,
        divergencia: `NFS-e ${numero}: Código do Cliente ${nota.hotelId} não está cadastrado em nenhum imóvel da Booking ` +
          `(${conta}, saídas de ${nota.mesInicio} a ${nota.mesFim}).`,
      };
    }
    propertyId = candidatos[0].id;
    ativas = candidatos[0].reservas;
    // Sem calendário da Booking cadastrado, não há onde gravar o código: a próxima nota acha o imóvel pela soma de novo.
    if ((fontes ?? []).some((f: any) => f.property_id === propertyId)) {
      await learnSourceHints(admin, propertyId, 'Booking.com', { hotelId: nota.hotelId });
      aprendido = true;
    }
  }

  const soma = somaDoMes(ativas);
  const divergencia = esperado !== null && Math.abs(soma - esperado) > 1
    ? `NFS-e ${numero}: ${conta}; dashboard soma R$ ${soma.toFixed(2)} em ${ativas.length} reserva(s) ` +
      `com saída de ${nota.mesInicio} a ${nota.mesFim}.`
    : null;

  let pagas = 0;
  for (const r of ativas) {
    if (r.payment_status === 'Pago') continue;
    const marca = `[Pago — NFS-e ${numero} da Booking, saídas de ${nota.mesInicio.slice(0, 7)}]`;
    const observacao = r.verification_notes ? `${r.verification_notes} ${marca}` : marca;
    const { error: e } = await admin
      .from('reservations')
      .update({ payment_status: 'Pago', verification_notes: observacao })
      .eq('id', r.id);
    if (e) throw new Error(`Falha ao marcar ${r.reservation_code} como paga: ${e.message}`);
    pagas++;
  }

  return { pagas, divergencia, propertyId, aprendido };
}
