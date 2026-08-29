import * as XLSX from 'xlsx';

/**
 * Leitura dos extratos que as plataformas exportam.
 *
 * É por aqui que entra o dinheiro: nem o Airbnb nem o Booking.com informam
 * valores por e-mail ou por iCal. O arquivo é lido no navegador e só vira
 * reserva depois que você confere a prévia.
 */

export type StatementPlatform = 'Airbnb' | 'Booking.com';

export interface StatementRow {
  reservationCode: string;
  guestName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  numberOfGuests: number | null;
  /** Líquido recebido: o que a plataforma deposita, já sem a comissão dela. */
  totalRevenue: number | null;
  /** Comissão cobrada pela plataforma, guardada apenas como referência. */
  platformCommission: number | null;
  grossAmount: number | null;
  listingName: string | null;
  nights: number | null;
  cancelled: boolean;
  /** Motivo pelo qual a linha merece conferência antes de importar. */
  warning: string | null;
}

export interface StatementFile {
  platform: StatementPlatform;
  rows: StatementRow[];
  /** Linhas do arquivo que não são reserva (repasses, ajustes sem código). */
  ignoredRows: number;
}

/**
 * Converte um valor monetário do extrato.
 *
 * Os dois arquivos misturam convenções — o Booking exporta `56.784 BRL` com
 * ponto decimal e quatro casas, o Airbnb exporta `1.030,79` no padrão
 * brasileiro. Vale sempre o último separador como decimal.
 */
export function parseAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;

  const cleaned = String(raw).replace(/[^\d.,-]/g, '').trim();
  if (!cleaned || !/\d/.test(cleaned)) return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized = cleaned;
  if (lastComma > lastDot) normalized = cleaned.replace(/\./g, '').replace(',', '.');
  else if (lastDot > lastComma) normalized = cleaned.replace(/,/g, '');

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Datas do Airbnb vêm como MM/DD/AAAA; as do Booking já em AAAA-MM-DD. */
export function parseStatementDate(raw: unknown, formato: 'us' | 'iso'): string | null {
  if (!raw) return null;

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }

  const texto = String(raw).trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const barras = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(texto);
  if (barras) {
    const [, a, b, anoBruto] = barras;
    // Extratos com ano abreviado ("8/22/26") são deste século.
    const ano = anoBruto.length === 2 ? String(2000 + Number(anoBruto)) : anoBruto;
    const mes = formato === 'us' ? a : b;
    const dia = formato === 'us' ? b : a;
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  return null;
}

function chaveNormalizada(nome: string): string {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Lê uma coluna pelo nome, comparando sem acento nem caixa: a codificação dos
 * arquivos exportados varia e "Data de início" já chegou de formas diferentes.
 */
function celula(linha: Record<string, unknown>, ...nomes: string[]): string {
  const indice = new Map<string, unknown>();
  for (const [chave, valor] of Object.entries(linha)) {
    indice.set(chaveNormalizada(chave), valor);
  }

  for (const nome of nomes) {
    const valor = indice.get(chaveNormalizada(nome));
    if (valor !== undefined && valor !== null && String(valor).trim()) return String(valor).trim();
  }
  return '';
}

/**
 * Extrato do Booking.com ("Reservas → Exportar"), uma linha por reserva.
 * Cada arquivo cobre uma acomodação só — daí a propriedade ser escolhida na tela.
 */
function parseBooking(linhas: Record<string, unknown>[]): StatementFile {
  const rows: StatementRow[] = [];
  let ignoredRows = 0;

  for (const linha of linhas) {
    const codigo = celula(linha, 'Book Number', 'Número da reserva');
    if (!/^\d{6,}$/.test(codigo)) {
      ignoredRows++;
      continue;
    }

    const bruto = parseAmount(celula(linha, 'Price', 'Preço'));
    const comissao = parseAmount(celula(linha, 'Commission Amount', 'Valor da comissão'));
    const percentual = parseAmount(celula(linha, 'Commission %', 'Comissão %'));

    // O arquivo traz o percentual: se a comissão não bate com ele, algum valor
    // foi lido errado e é melhor conferir do que gravar dinheiro incorreto.
    let warning: string | null = null;
    if (bruto !== null && comissao !== null && percentual) {
      const esperada = (bruto * percentual) / 100;
      if (Math.abs(esperada - comissao) > Math.max(0.05, esperada * 0.02)) {
        warning = `Comissão de ${comissao} não confere com ${percentual}% de ${bruto}`;
      }
    }

    const liquido = bruto !== null && comissao !== null ? Number((bruto - comissao).toFixed(2)) : bruto;
    const status = celula(linha, 'Status').toLowerCase();

    rows.push({
      reservationCode: codigo,
      guestName: celula(linha, 'Guest Name(s)', 'Booked by') || null,
      checkIn: parseStatementDate(celula(linha, 'Check-in'), 'iso'),
      checkOut: parseStatementDate(celula(linha, 'Check-out'), 'iso'),
      numberOfGuests: Number.parseInt(celula(linha, 'People', 'Adults'), 10) || null,
      totalRevenue: liquido,
      platformCommission: comissao,
      grossAmount: bruto,
      listingName: celula(linha, 'Unit type') || null,
      nights: Number.parseInt(celula(linha, 'Duration (nights)'), 10) || null,
      cancelled: status !== '' && status !== 'ok',
      warning,
    });
  }

  return { platform: 'Booking.com', rows, ignoredRows };
}

/** Tipos de linha do extrato do Airbnb que compõem o valor de uma reserva. */
const AIRBNB_TIPOS_DE_RECEITA = new Set(['reserva', 'reservation', 'ajuste', 'adjustment']);

/**
 * Extrato do Airbnb ("Ganhos → Histórico de transações").
 *
 * Diferente do Booking, aqui uma reserva pode ocupar várias linhas: uma estadia
 * longa é paga em parcelas mensais, e ajustes entram como linhas à parte. O
 * valor da reserva é a soma delas. As linhas de repasse ("Payout") e de
 * coanfitrião não entram — a primeira é a transferência bancária do conjunto, a
 * segunda é um acerto entre anfitriões.
 */
function parseAirbnb(linhas: Record<string, unknown>[]): StatementFile {
  const porCodigo = new Map<string, StatementRow>();
  let ignoredRows = 0;

  for (const linha of linhas) {
    const codigo = celula(linha, 'Código de Confirmação', 'Confirmation Code').toUpperCase();
    const tipo = celula(linha, 'Tipo', 'Type').toLowerCase();

    if (!codigo || !AIRBNB_TIPOS_DE_RECEITA.has(tipo)) {
      ignoredRows++;
      continue;
    }

    const valor = parseAmount(celula(linha, 'Valor', 'Amount')) ?? 0;
    const existente = porCodigo.get(codigo);

    if (existente) {
      existente.totalRevenue = Number(((existente.totalRevenue ?? 0) + valor).toFixed(2));
      continue;
    }

    porCodigo.set(codigo, {
      reservationCode: codigo,
      guestName: celula(linha, 'Hóspede', 'Guest') || null,
      checkIn: parseStatementDate(celula(linha, 'Data de início', 'Start date'), 'us'),
      checkOut: parseStatementDate(celula(linha, 'Data de término', 'End date'), 'us'),
      numberOfGuests: null,
      totalRevenue: Number(valor.toFixed(2)),
      platformCommission: parseAmount(celula(linha, 'Taxa de serviço', 'Service fee')),
      grossAmount: parseAmount(celula(linha, 'Ganhos brutos', 'Gross earnings')),
      listingName: celula(linha, 'Anúncio', 'Listing') || null,
      nights: Number.parseInt(celula(linha, 'Noites', 'Nights'), 10) || null,
      cancelled: false,
      warning: null,
    });
  }

  const rows = [...porCodigo.values()];
  for (const row of rows) {
    if ((row.totalRevenue ?? 0) <= 0) {
      row.warning = 'Valor somado ficou zero ou negativo — confira antes de importar';
    }
  }

  return { platform: 'Airbnb', rows, ignoredRows };
}

/** Lê o arquivo exportado e reconhece a plataforma pelo cabeçalho. */
export async function parseStatementFile(file: File): Promise<StatementFile> {
  const buffer = await file.arrayBuffer();
  // `raw: true` entrega o conteúdo como está no arquivo. Com a formatação
  // ligada, o SheetJS reescreve "08/22/2026" como "8/22/26" e o ano de dois
  // dígitos se perde.
  const workbook = XLSX.read(buffer, { type: 'array', raw: true });
  const planilha = workbook.Sheets[workbook.SheetNames[0]];

  if (!planilha) throw new Error('O arquivo não tem nenhuma planilha legível.');

  const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(planilha, {
    raw: true,
    defval: '',
  });

  if (linhas.length === 0) throw new Error('O arquivo está vazio.');

  const colunas = Object.keys(linhas[0]);

  if (colunas.some((coluna) => /^Book Number$/i.test(coluna))) return parseBooking(linhas);
  if (colunas.some((coluna) => /Código de Confirmação|Confirmation Code/i.test(coluna))) {
    return parseAirbnb(linhas);
  }

  throw new Error(
    'Não reconheci o formato. Use a exportação de reservas do Booking.com ou o histórico de transações do Airbnb.',
  );
}
