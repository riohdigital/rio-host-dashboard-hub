/**
 * Parsers dos e-mails transacionais do Airbnb e do Booking.com.
 *
 * Os layouts mudam com frequência, então a estratégia é sempre heurística e
 * tolerante: extraímos o que dá, marcamos o que faltou em `missing` e deixamos
 * a Edge Function decidir entre aplicar automaticamente ou mandar para a fila
 * de conferência.
 */

import {
  findLabelledValue,
  findMoneyInText,
  htmlToText,
  normalizeForMatch,
  parseDateFlexible,
  parseDateRange,
  parseMoney,
  toLines,
} from './textUtils.ts';

export type SyncPlatform = 'Airbnb' | 'Booking.com';

/**
 * O que o e-mail é. Só 'new', 'modified' e 'cancelled' mexem em reserva.
 *
 * - 'request': pedido de reserva ainda não aceito ("Pendente: Pedido de
 *   Reserva em …"). Não é reserva (REGRAS_DE_NEGOCIO_RESERVAS.md, R6).
 * - 'inquiry': consulta de hóspede ("Consulta sobre …").
 * - 'payout': aviso de repasse ("Enviamos um pagamento de …"). Traz o valor
 *   de cada ciclo por reserva, mas não é fonte de dados da reserva em si.
 * - 'marketing': newsletters e dicas da plataforma.
 */
export type EmailIntent =
  | 'new'
  | 'modified'
  | 'cancelled'
  | 'request'
  | 'inquiry'
  | 'payout'
  | 'marketing'
  | 'unknown';

export interface RawEmail {
  from?: string;
  subject?: string;
  html?: string;
  text?: string;
  messageId?: string;
  receivedAt?: string;
}

export interface ParsedEmailReservation {
  platform: SyncPlatform | null;
  intent: EmailIntent;
  locale: 'pt' | 'en';
  reservationCode: string | null;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  checkIn: string | null;
  checkOut: string | null;
  numberOfGuests: number | null;
  /** Valor da reserva (R1) quando pode ir direto para a reserva. */
  totalRevenue: number | null;
  /**
   * Valor (R1) da estadia inteira. Igual a totalRevenue, exceto em estadia
   * acima de 28 noites, cujo valor por ciclo mensal vem dos repasses (R3).
   */
  stayTotal: number | null;
  commissionAmount: number | null;
  listingName: string | null;
  /**
   * Identificador numérico da acomodação no Booking.com, presente nos links
   * do e-mail (`hotel_id=14107413`). É o dado mais confiável para identificar
   * a propriedade: não muda quando o anúncio é renomeado.
   */
  bookingHotelId: string | null;
  /** Campos essenciais que não puderam ser extraídos. */
  missing: string[];
  /** Texto normalizado, guardado para auditoria/depuração. */
  normalizedText: string;
}

const AIRBNB_SENDERS = ['airbnb.com', 'airbnb.com.br'];
const BOOKING_SENDERS = ['booking.com', 'bstatic.com'];

export function detectPlatform(email: RawEmail, body: string): SyncPlatform | null {
  const from = normalizeForMatch(email.from ?? '');
  const subject = normalizeForMatch(email.subject ?? '');
  const haystack = normalizeForMatch(body).slice(0, 4000);

  if (AIRBNB_SENDERS.some((d) => from.includes(d))) return 'Airbnb';
  if (BOOKING_SENDERS.some((d) => from.includes(d))) return 'Booking.com';
  if (subject.includes('airbnb') || haystack.includes('airbnb.com')) return 'Airbnb';
  if (subject.includes('booking.com') || haystack.includes('booking.com')) return 'Booking.com';

  return null;
}

function detectLocale(text: string): 'pt' | 'en' {
  const normalized = normalizeForMatch(text);
  const ptHits = ['reserva', 'hospede', 'chegada', 'check-in', 'noites', 'valor total', 'acomodacao']
    .filter((term) => normalized.includes(term)).length;
  const enHits = ['reservation', 'guest', 'arrival', 'nights', 'total payout', 'booking number']
    .filter((term) => normalized.includes(term)).length;
  return enHits > ptHits ? 'en' : 'pt';
}

function detectIntent(subject: string, body: string, from = ''): EmailIntent {
  const assunto = normalizeForMatch(subject);
  const remetente = normalizeForMatch(from);
  const haystack = normalizeForMatch(`${subject}\n${body.slice(0, 3000)}`);

  // Primeiro, o que não é reserva. Padrões tirados dos e-mails reais que já
  // viraram reserva falsa ou pendência sem sentido.
  if (/\bdiscover@/.test(remetente) || /^(perspectiva de reservas|dicas para|novidades)/.test(assunto)) {
    return 'marketing';
  }
  if (/(enviamos um pagamento|foram enviados hoje|we sent you a payout|payout was sent)/.test(haystack)) {
    return 'payout';
  }
  if (/^(consulta sobre|inquiry about)/.test(assunto)) return 'inquiry';
  if (/(pedido de reserva|reservation request|pre-?aprovacao|pre-?approval)/.test(assunto)) return 'request';

  // Cancelamento: o assunto decide. No corpo, só frases inequívocas — toda
  // confirmação traz "Política de cancelamento" e não pode virar cancelada.
  if (
    /(cancelad|cancelled|canceled|cancelamento|cancellation)/.test(assunto) ||
    /(foi cancelada|cancelou a reserva|cancelou sua reserva|reservation (?:has been|was) cancell?ed)/.test(haystack)
  ) {
    return 'cancelled';
  }
  if (/(alterad|modificad|atualizad|modified|changed|alteracao|change to your)/.test(haystack)) return 'modified';
  if (/(nova reserva|reserva confirmada|new booking|new reservation|reservation confirmed|booking confirmed|reserva recebida)/.test(haystack)) {
    return 'new';
  }
  return 'unknown';
}

/** Airbnb: código sempre no formato HM + alfanuméricos. */
function extractAirbnbCode(text: string): string | null {
  const labelled = findLabelledValue(toLines(text), [
    'Código de confirmação', 'Codigo de confirmacao', 'Confirmation code', 'Código da reserva',
  ]);
  const fromLabel = labelled ? /\b(HM[A-Z0-9]{5,})\b/i.exec(labelled) : null;
  if (fromLabel) return fromLabel[1].toUpperCase();

  const anywhere = /\b(HM[A-Z0-9]{5,})\b/.exec(text.toUpperCase());
  return anywhere ? anywhere[1] : null;
}

/** Booking.com: número da reserva com 9 ou 10 dígitos. */
function extractBookingCode(text: string): string | null {
  const labelled = findLabelledValue(toLines(text), [
    'Número da reserva', 'Numero da reserva', 'Booking number', 'Reservation number',
    'Número de reserva', 'ID da reserva',
  ]);
  const fromLabel = labelled ? /\b(\d{9,10})\b/.exec(labelled.replace(/[.\s]/g, '')) : null;
  if (fromLabel) return fromLabel[1];

  const contextual = /(?:reserva|booking|reservation)[^\d]{0,40}(\d{9,10})\b/i.exec(text);
  return contextual ? contextual[1] : null;
}

function extractGuestCount(text: string): number | null {
  const lines = toLines(text);
  const labelled = findLabelledValue(lines, [
    'Número de hóspedes', 'Numero de hospedes', 'Hóspedes', 'Hospedes',
    'Number of guests', 'Guests',
  ]);

  const source = labelled ?? text;
  const explicit = /(\d{1,2})\s*(?:hospede|hóspede|guest|adulto|adult)/i.exec(source);
  if (explicit) {
    const adults = Number.parseInt(explicit[1], 10);
    const children = /(\d{1,2})\s*(?:crianca|criança|child|children)/i.exec(source);
    return adults + (children ? Number.parseInt(children[1], 10) : 0);
  }

  if (labelled) {
    const bare = /^(\d{1,2})\b/.exec(labelled.trim());
    if (bare) return Number.parseInt(bare[1], 10);
  }

  return null;
}

function extractEmail(text: string): string | null {
  const match = /[\w.+-]+@[\w-]+\.[\w.-]+/.exec(text);
  if (!match) return null;
  const value = match[0].toLowerCase();
  // Ignora endereços das próprias plataformas.
  if (/(airbnb|booking|bstatic|noreply|no-reply)/.test(value)) return null;
  return value;
}

function extractPhone(text: string): string | null {
  const labelled = findLabelledValue(toLines(text), [
    'Telefone', 'Phone number', 'Phone', 'Celular', 'Contato do hóspede',
  ]);
  const source = labelled ?? '';
  const match = /(\+?\d[\d\s().-]{7,}\d)/.exec(source);
  return match ? match[1].trim() : null;
}

function extractDates(
  text: string,
  locale: 'pt' | 'en',
  reference: Date,
): { checkIn: string | null; checkOut: string | null } {
  const lines = toLines(text);

  const checkInRaw = findLabelledValue(lines, [
    'Check-in', 'Checkin', 'Chegada', 'Data de entrada', 'Entrada', 'Arrival',
  ]);
  const checkOutRaw = findLabelledValue(lines, [
    'Check-out', 'Checkout', 'Partida', 'Saída', 'Saida', 'Data de saída',
    'Data de saida', 'Departure',
  ]);

  let checkIn = parseDateFlexible(checkInRaw, { locale, reference });
  let checkOut = parseDateFlexible(checkOutRaw, { locale, reference });

  // Fallback: período numa linha só ("para 2 – 19 de out. de 2026").
  if (!checkIn || !checkOut) {
    for (const line of lines) {
      const range = parseDateRange(line, { locale, reference });
      if (!range) continue;
      checkIn = checkIn ?? range.checkIn;
      checkOut = checkOut ?? range.checkOut;
      break;
    }
  }

  if (checkIn && checkOut && checkOut <= checkIn) {
    // Virada de ano sem ano escrito ("29 de dez." → "3 de jan."): a saída é
    // no ano seguinte. Fora isso, as datas não fecham e a saída é descartada —
    // gravar uma saída anterior à entrada estraga a reserva.
    const [, mesEntrada] = checkIn.split('-').map(Number);
    const [ano, mes, dia] = checkOut.split('-').map(Number);
    checkOut = mes < mesEntrada
      ? `${ano + 1}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
      : null;
  }

  return { checkIn, checkOut };
}

function extractTotal(text: string, platform: SyncPlatform): number | null {
  const lines = toLines(text);

  const labels = platform === 'Airbnb'
    ? [
        'Total (BRL)', 'Total (USD)', 'Você recebe', 'Voce recebe', 'Você ganha',
        'Voce ganha', 'You earn', 'Total payout', 'Valor total', 'Total',
      ]
    : [
        'Preço total', 'Preco total', 'Valor total', 'Total price', 'Total',
        'Valor da reserva', 'Total da reserva',
      ];

  for (const label of labels) {
    const value = findLabelledValue(lines, [label]);
    if (!value) continue;
    const money = findMoneyInText(value) ?? parseMoney(value);
    if (money && money > 0) return money;
  }

  return null;
}

/**
 * Airbnb: valor da reserva (R1) a partir do bloco "PAGAMENTO DO ANFITRIÃO" do
 * e-mail de confirmação — "VOCÊ RECEBE" mais a cota do coanfitrião, quando o
 * e-mail a lista. O bloco anterior, "O HÓSPEDE PAGOU", tem outro "TOTAL (BRL)"
 * (o que o hóspede pagou) e nunca é o valor da reserva: era ele que estava
 * sendo gravado (HM552TTR5Z: R$ 4.994,44 no lugar de R$ 4.084,81).
 */
export function extractAirbnbHostPayout(text: string): number | null {
  const lines = toLines(text);
  const inicio = lines.findIndex((linha) => /^pagamento do anfitriao\b/.test(normalizeForMatch(linha)));
  if (inicio < 0) return null;

  let recebe: number | null = null;
  let cota = 0;

  for (let i = inicio + 1; i < Math.min(lines.length, inicio + 40); i++) {
    const linha = normalizeForMatch(lines[i]);
    if (/^(consultar ganhos|cancelamentos|o processamento)/.test(linha)) break;

    const valorDaLinha = () => findMoneyInText(lines[i]) ?? (lines[i + 1] ? findMoneyInText(lines[i + 1]) : null);

    if (/^voce recebe\b/.test(linha)) recebe = valorDaLinha();
    if (/^cotas? do coanfitri/.test(linha)) cota = Math.abs(valorDaLinha() ?? 0);
  }

  return recebe === null ? null : Number((recebe + cota).toFixed(2));
}

function extractCommission(text: string): number | null {
  const value = findLabelledValue(toLines(text), [
    'Comissão', 'Comissao', 'Commission', 'Taxa de serviço', 'Taxa de servico', 'Service fee',
  ]);
  if (!value) return null;
  const money = findMoneyInText(value) ?? parseMoney(value);
  return money && money > 0 ? money : null;
}

/** Palavras que aparecem em falsos positivos de nome ("Nome da acomodação"). */
const NAO_SAO_NOMES = new Set([
  'da', 'de', 'do', 'das', 'dos', 'a', 'o', 'e', 'em', 'para', 'com',
  'acomodacao', 'reserva', 'reservas', 'hospede', 'hospedes', 'guest',
  'nova reserva', 'ultima hora', 'booking com', 'airbnb',
  // "quarta-feira" já rendeu um "feira" como nome de hóspede.
  'feira', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo',
  'segunda-feira', 'terca-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
]);

/**
 * Filtra o lixo que os assuntos e rótulos genéricos produzem: pedaços de
 * código de reserva ("(6859442149"), preposições soltas ("da"), datas.
 */
export function isPlausibleGuestName(value: string | null | undefined): boolean {
  if (!value) return false;

  const trimmed = value.trim();
  if (trimmed.length < 3 || trimmed.length > 80) return false;

  // Nome começa com letra — não com parêntese, número ou pontuação.
  if (!/^[\p{L}]/u.test(trimmed)) return false;

  // Nenhum dígito: código de reserva e data não são nome.
  if (/\d/.test(trimmed)) return false;

  if (NAO_SAO_NOMES.has(normalizeForMatch(trimmed))) return false;

  const palavras = trimmed.split(/\s+/);
  if (palavras.length > 6) return false;

  // Uma palavra só, toda em maiúsculas, é rótulo de interface ("PAGOU", do
  // e-mail de confirmação do Airbnb), não nome de hóspede.
  if (palavras.length === 1 && trimmed === trimmed.toUpperCase()) return false;

  // Palavras de frase e de interface: "se for possível fazer" veio do texto de
  // uma mensagem e foi gravado como hóspede.
  if (palavras.some((palavra) => PALAVRAS_QUE_NAO_SAO_NOME.has(normalizeForMatch(palavra)))) return false;

  // Precisa de pelo menos uma palavra de verdade.
  return /[\p{L}]{3,}/u.test(trimmed);
}

const PALAVRAS_QUE_NAO_SAO_NOME = new Set([
  'pagou', 'pago', 'pagamento', 'total', 'valor', 'voce', 'hospede', 'hospedes', 'reserva',
  'confirmada', 'confirmado', 'noite', 'noites', 'taxa', 'limpeza', 'ganhos', 'recebe',
  'se', 'for', 'possivel', 'fazer', 'que', 'nao', 'sim', 'pode', 'poderia', 'gostaria',
  'meu', 'minha', 'obrigado', 'obrigada', 'ola', 'oi', 'bom', 'boa', 'check-in', 'checkout',
]);

function extractGuestName(
  text: string,
  subject: string,
  platform: SyncPlatform,
): string | null {
  // 'Nome' sozinho é genérico demais: casa com "Nome da acomodação".
  const labelled = findLabelledValue(toLines(text), [
    'Nome do hóspede', 'Nome do hospede', 'Hóspede', 'Hospede',
    'Guest name', 'Guest',
  ]);

  if (labelled) {
    const cleaned = labelled.split(/[|•\-–—(]/)[0].trim();
    if (isPlausibleGuestName(cleaned)) return cleaned;
  }

  const candidates: string[] = [];

  if (platform === 'Airbnb') {
    // "Reserva confirmada: Maria chega em 12 de set" e o formato atual,
    // "Reserva confirmada - Luuk Hurkx chega em 10 de dez."
    const pt = /reserva confirmada\s*[:\-–]?\s*([^,\n]+?)\s+(?:chega|chegara|chegará)/i.exec(subject);
    if (pt) candidates.push(pt[1]);
    const en = /reservation confirmed\s*[:\-–]?\s*([^,\n]+?)\s+arrives/i.exec(subject);
    if (en) candidates.push(en[1]);
  } else {
    // "Recebemos uma mensagem de Maico Mombach"
    const mensagem = /(?:mensagem|message) de\s+([^,\n(]{3,60})/i.exec(subject);
    if (mensagem) candidates.push(mensagem[1]);
    // "A solicitação de Bartłomiej Korpała foi confirmada"
    const solicitacao = /solicita(?:ç|c)[ãa]o de\s+([^,\n(]{3,60}?)\s+foi/i.exec(subject);
    if (solicitacao) candidates.push(solicitacao[1]);
    // O assunto do "Nova reserva!" do Booking.com traz apenas código e data
    // — "(5000446589, quarta-feira, 22 de julho de 2026)" — nunca o hóspede.
    // Para esses, o nome vem do rótulo no corpo ou de um e-mail posterior.
  }

  for (const candidate of candidates) {
    const cleaned = candidate.trim();
    if (isPlausibleGuestName(cleaned)) return cleaned;
  }

  return null;
}

function extractListingName(text: string, platform: SyncPlatform): string | null {
  const lines = toLines(text);

  if (platform === 'Airbnb') {
    // No e-mail real o anúncio é a linha logo acima do tipo de espaço
    // ("Maravilhoso Studio…" / "Casa/apto inteiro"). O rótulo "Acomodação"
    // casava com "Preço da acomodação para 58 noites", e esse lixo era
    // aprendido como apelido do imóvel.
    const tipo = lines.findIndex((linha) =>
      /^(casa\/apto inteiro|quarto (inteiro|privativo|compartilhado)|espaco inteiro|entire (home|place)|private room)/
        .test(normalizeForMatch(linha)));
    const anterior = tipo > 0 ? lines[tipo - 1].replace(/^.*Envie uma Mensagem para \S+/i, '').trim() : '';
    if (anterior.length > 1 && anterior.length <= 120 && !/\d+\s+noites?/i.test(anterior)) return anterior;
  }

  const labels = platform === 'Airbnb'
    ? ['Anúncio', 'Anuncio', 'Listing']
    : ['Nome da acomodação', 'Nome da acomodacao', 'Nome da propriedade', 'Acomodação', 'Acomodacao',
       'Property', 'Propriedade', 'Quarto', 'Unidade', 'Room'];

  const value = findLabelledValue(lines, labels);
  if (!value) return null;
  const cleaned = value.split(/[|•]/)[0].trim();
  return cleaned.length > 1 && cleaned.length <= 120 ? cleaned : null;
}

/**
 * O e-mail é mesmo sobre uma reserva?
 *
 * As plataformas mandam muito mais que confirmações: avisos de conta, pedidos
 * de avaliação, mensagens de hóspede, marketing. Sem código de reserva e sem
 * datas não há o que aproveitar — e mandar isso para a fila de conferência só
 * gera ruído que esconde os casos que importam.
 */
export function looksLikeReservation(parsed: ParsedEmailReservation): boolean {
  if (!parsed.platform) return false;
  if (parsed.reservationCode) return true;
  return !!parsed.checkIn && !!parsed.checkOut;
}

export function parseReservationEmail(
  email: RawEmail,
  options: { reference?: Date } = {},
): ParsedEmailReservation {
  const reference = options.reference ?? new Date();
  const body = email.text?.trim()
    ? email.text
    : htmlToText(email.html ?? '');
  const subject = email.subject ?? '';
  const fullText = `${subject}\n${body}`;

  const platform = detectPlatform(email, body);
  const locale = detectLocale(fullText);
  const intent = detectIntent(subject, body, email.from ?? '');

  const result: ParsedEmailReservation = {
    platform,
    intent,
    locale,
    reservationCode: null,
    guestName: null,
    guestEmail: null,
    guestPhone: null,
    checkIn: null,
    checkOut: null,
    numberOfGuests: null,
    totalRevenue: null,
    stayTotal: null,
    commissionAmount: null,
    listingName: null,
    bookingHotelId: null,
    missing: [],
    normalizedText: body.slice(0, 8000),
  };

  if (!platform) {
    result.missing.push('platform');
    return result;
  }

  result.reservationCode = platform === 'Airbnb'
    ? extractAirbnbCode(fullText)
    : extractBookingCode(fullText);

  const { checkIn, checkOut } = extractDates(fullText, locale, reference);
  result.checkIn = checkIn;
  result.checkOut = checkOut;

  // O Booking anuncia a data de entrada no próprio assunto:
  // "Nova reserva! (6124022858, sexta-feira, 11 de setembro de 2026)".
  // Só o check-in já basta para achar a reserva que o iCal criou.
  if (!result.checkIn) {
    result.checkIn = parseDateFlexible(subject, { locale, reference });
  }

  result.guestName = extractGuestName(body, subject, platform);
  result.guestEmail = extractEmail(body);
  result.guestPhone = extractPhone(body);
  result.numberOfGuests = extractGuestCount(fullText);

  // Valor da reserva = regra R1 de REGRAS_DE_NEGOCIO_RESERVAS.md.
  // - Booking: valor comissionável − comissão. Só quando o e-mail traz os dois.
  // - Airbnb: "Você recebe" (+ cota do coanfitrião) do bloco "Pagamento do
  //   anfitrião". Estadia acima de 28 noites é paga em ciclos mensais (R3): o
  //   total fica registrado, e o valor de cada mês vem dos repasses.
  if (platform === 'Booking.com') {
    const bruto = extractTotal(fullText, platform);
    result.commissionAmount = extractCommission(fullText);
    result.totalRevenue = bruto && result.commissionAmount && result.commissionAmount < bruto
      ? Number((bruto - result.commissionAmount).toFixed(2))
      : null;
    result.stayTotal = result.totalRevenue;
  } else {
    result.stayTotal = extractAirbnbHostPayout(fullText);
    const noites = result.checkIn && result.checkOut
      ? (Date.parse(result.checkOut) - Date.parse(result.checkIn)) / 86_400_000
      : null;
    result.totalRevenue = result.stayTotal !== null && noites !== null && noites <= 28
      ? result.stayTotal
      : null;
  }
  result.listingName = extractListingName(body, platform);

  // O identificador vive no link da extranet, e o link nem sempre aparece como
  // texto visível — às vezes só existe no href. Por isso olha o HTML cru também.
  const comLinks = `${fullText}\n${email.html ?? ''}`;
  // O mesmo link costuma aparecer várias vezes, e alguma dessas cópias pode vir
  // quebrada pela codificação do e-mail ("14107413" virando "1410"). Entre as
  // ocorrências, a mais longa é a íntegra.
  const idsEncontrados = [...comLinks.matchAll(/hotel_id=(\d{4,})/gi)]
    .map((achado) => achado[1])
    .sort((a, b) => b.length - a.length);
  result.bookingHotelId = idsEncontrados[0] ?? null;

  if (!result.reservationCode) result.missing.push('reservationCode');
  if (!result.checkIn) result.missing.push('checkIn');
  if (!result.checkOut) result.missing.push('checkOut');
  if (!result.totalRevenue) result.missing.push('totalRevenue');

  return result;
}

export interface PayoutLine {
  hospede: string | null;
  valor: number;
  /** "Acomodação", "Recebimento do coanfitrião", "Ajuste"… como o Airbnb escreve. */
  tipo: string;
  periodoInicio: string | null;
  periodoFim: string | null;
  anuncio: string | null;
  codigo: string | null;
}

export interface ParsedPayout {
  identificador: string | null;
  totalPago: number | null;
  linhas: PayoutLine[];
}

/**
 * Aviso de repasse do Airbnb ("Enviamos um pagamento de R$905,73 BRL").
 *
 * Cada repasse lista, por reserva, o valor de cada lançamento do ciclo:
 *
 *   Fernando Franca   R$4.412,47 BRL
 *   Acomodação • 06/04/2026 - 02/10/2026
 *   Resort com Píer e Vista Lateral Mar (1366714016506588224)
 *   HMWE2EHT4F
 *
 * É o mesmo dado da tela de Ganhos: o valor de cada mês de uma estadia longa
 * (REGRAS_DE_NEGOCIO_RESERVAS.md, R3) chega sozinho por aqui.
 */
export function parsePayoutEmail(text: string): ParsedPayout {
  const linhas = toLines(text);
  const resultado: ParsedPayout = { identificador: null, totalPago: null, linhas: [] };

  const indiceId = linhas.findIndex((l) => /^identifica[cç][aã]o do pagamento$/i.test(l));
  if (indiceId >= 0 && linhas[indiceId + 1]) resultado.identificador = linhas[indiceId + 1].trim();

  const total = linhas.find((l) => /^total pago/i.test(l));
  if (total) resultado.totalPago = parseMoney(total.replace(/^total pago:?/i, ''));

  for (let i = 0; i < linhas.length; i++) {
    const valorLinha = /^(.*?)\s{2,}(-?)R\$\s?([\d.,]+)\s*BRL$/.exec(linhas[i]);
    const tipoLinha = linhas[i + 1]
      ? /^(.+?)\s*•\s*(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2})\/(\d{2})\/(\d{4})$/.exec(linhas[i + 1])
      : null;
    if (!valorLinha || !tipoLinha) continue;

    const valor = parseMoney(valorLinha[3]);
    if (valor === null) continue;

    const codigo = [linhas[i + 2], linhas[i + 3]]
      .map((l) => /^(HM[A-Z0-9]{8})$/.exec((l ?? '').trim())?.[1])
      .find(Boolean) ?? null;

    resultado.linhas.push({
      hospede: valorLinha[1].trim() || null,
      valor: valorLinha[2] === '-' ? -valor : valor,
      tipo: tipoLinha[1].trim(),
      periodoInicio: `${tipoLinha[4]}-${tipoLinha[3]}-${tipoLinha[2]}`,
      periodoFim: `${tipoLinha[7]}-${tipoLinha[6]}-${tipoLinha[5]}`,
      anuncio: linhas[i + 2]?.replace(/\s*\(\d+\)\s*$/, '').trim() || null,
      codigo,
    });
  }

  return resultado;
}
