/**
 * Ciclos mensais de estadias longas do Airbnb (REGRAS_DE_NEGOCIO_RESERVAS.md, R3).
 *
 * Estadia acima de 28 noites é paga em ciclos que começam no mesmo dia do mês
 * da entrada (06/04 → 06/05 → 06/06…); o último termina na saída. O valor de
 * cada ciclo é o que o Airbnb repassou nele:
 *
 * - conta titular: soma dos lançamentos do ciclo ("Acomodação", ajustes),
 *   sem o "Recebimento do coanfitrião" negativo, que é a parte que sai para o
 *   proprietário;
 * - conta coanfitriã: o repasse recebido é commission_rate × (valor − limpeza)
 *   + limpeza (limpeza só no 1º ciclo), logo
 *   valor = (repasse − limpeza) ÷ commission_rate + limpeza.
 *
 * Conferido em 06–07/10/2026 contra os repasses reais: HMWE2EHT4F, HMZPZNQTHY,
 * HMJ28CAKQA, HMQFRSSJQ3 e o gabarito de 2025 (HMEQ8AH588, HM4DXBQEJP).
 */

// deno-lint-ignore-file no-explicit-any

/** Um lançamento de repasse, como registrado a partir do e-mail ou da API. */
export interface PayoutEntry {
  tipo: string;
  valor: number;
  /** Data em que o Airbnb liberou o repasse (AAAA-MM-DD). */
  liberadoEm: string;
}

export interface StayCycle {
  indice: number;
  inicio: string;
  fim: string;
  /** Valor do ciclo pelos repasses; null quando ainda não houve repasse. */
  valor: number | null;
  repasses: PayoutEntry[];
}

export type PayoutRole = 'titular' | 'coanfitriao';

const MAX_NOITES_SEM_CICLO = 28;
const TOLERANCIA_CENTAVOS = 0.05;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Mesmo dia do mês, k meses depois. Dia inexistente transborda: 31/03 + 1 mês = 01/05 (como o Airbnb). */
function addMonths(iso: string, k: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + k, d)).toISOString().slice(0, 10);
}

export function nightsBetween(inicio: string, fim: string): number {
  return Math.round((Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86_400_000);
}

/** Fronteiras dos ciclos da estadia. Até 28 noites, um ciclo só. */
export function cycleBoundaries(checkIn: string, checkOut: string): Array<{ inicio: string; fim: string }> {
  if (!(checkIn < checkOut)) return [];
  if (nightsBetween(checkIn, checkOut) <= MAX_NOITES_SEM_CICLO) return [{ inicio: checkIn, fim: checkOut }];

  const ciclos: Array<{ inicio: string; fim: string }> = [];
  let inicio = checkIn;
  for (let k = 1; inicio < checkOut && k <= 36; k++) {
    const proximo = addMonths(checkIn, k);
    const fim = proximo < checkOut ? proximo : checkOut;
    ciclos.push({ inicio, fim });
    inicio = fim;
  }
  return ciclos;
}

const ehCota = (tipo: string) => /coanfitri|split/i.test(tipo);

/** Titular quando há lançamento que não é a cota; coanfitriã quando só há cota recebida. */
export function payoutRole(repasses: PayoutEntry[]): PayoutRole | null {
  if (repasses.some((r) => !ehCota(r.tipo))) return 'titular';
  if (repasses.some((r) => ehCota(r.tipo) && r.valor > 0)) return 'coanfitriao';
  return null;
}

/**
 * Remove o mesmo lançamento visto duas vezes: e-mail reenviado, ou o mesmo
 * repasse gravado pelo e-mail ("Acomodação") e pelo histórico do portal
 * ("RESERVATION_ALLOCATION"). Mesmo grupo (cota ou não), mesmo valor e envio
 * com até 3 dias de diferença.
 */
export function dedupePayouts(repasses: PayoutEntry[]): PayoutEntry[] {
  const mantidos: PayoutEntry[] = [];
  for (const r of repasses) {
    const repetido = mantidos.some((m) =>
      ehCota(m.tipo) === ehCota(r.tipo) &&
      m.valor.toFixed(2) === r.valor.toFixed(2) &&
      Math.abs(nightsBetween(m.liberadoEm, r.liberadoEm)) <= 3);
    if (!repetido) mantidos.push(r);
  }
  return mantidos;
}

/** Acrescenta a marca do ciclo à observação, trocando a de uma rodada anterior. */
function notaDoCiclo(anterior: string | null | undefined, marca: string): string {
  const resto = String(anterior ?? '').replace(/\s*\[Ciclo \d+\/\d+ pelo repasse do Airbnb\][^[]*/g, '').trim();
  return resto ? `${resto} ${marca}` : marca;
}

/**
 * Calcula os ciclos e o valor de cada um. Cada repasse pertence ao ciclo que
 * já tinha começado na véspera da liberação (o Airbnb libera no dia seguinte
 * ao início do ciclo; repasses extras no meio do mês ficam no mesmo ciclo).
 */
export function computeStayCycles(input: {
  checkIn: string;
  checkOut: string;
  repasses: PayoutEntry[];
  commissionRate: number;
  cleaningFee: number;
}): StayCycle[] {
  const fronteiras = cycleBoundaries(input.checkIn, input.checkOut);
  const repasses = dedupePayouts(input.repasses);
  const papel = payoutRole(repasses);

  const ciclos: StayCycle[] = fronteiras.map((f, i) => ({ indice: i + 1, ...f, valor: null, repasses: [] }));
  if (ciclos.length === 0) return ciclos;

  for (const r of repasses) {
    const referencia = addDays(r.liberadoEm, -1);
    let alvo = ciclos[0];
    for (const c of ciclos) if (c.inicio <= referencia) alvo = c;
    alvo.repasses.push(r);
  }

  for (const c of ciclos) {
    if (c.repasses.length === 0 || !papel) continue;
    if (papel === 'titular') {
      c.valor = round2(c.repasses.filter((r) => !ehCota(r.tipo)).reduce((s, r) => s + r.valor, 0));
    } else if (input.commissionRate > 0) {
      const recebido = c.repasses.filter((r) => ehCota(r.tipo)).reduce((s, r) => s + r.valor, 0);
      const limpeza = c.indice === 1 ? input.cleaningFee : 0;
      c.valor = round2((recebido - limpeza) / input.commissionRate + limpeza);
    }
  }
  return ciclos;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Leva para o banco os ciclos que já têm repasse: cada ciclo pago fica numa
 * linha com as datas e o valor exatos. Linha que cobre mais de um ciclo é
 * cortada no início do ciclo seguinte; ciclo pago sem linha ganha uma nova.
 *
 * O valor do repasse substitui o valor estimado à mão (decisão do Dono em
 * 07/10/2026: "eu adicionei valores aproximados"); o anterior fica na nota.
 * Campos de faxina não são tocados, porque também são o pagamento da faxineira.
 */
export async function reconcileStayCycles(
  admin: any,
  code: string,
): Promise<{ atualizadas: number; criadas: number; motivo?: string }> {
  const { data: linhas, error } = await admin
    .from('reservations')
    .select('*')
    .eq('platform', 'Airbnb')
    .eq('reservation_code', code)
    .order('check_in_date', { ascending: true });

  if (error) throw new Error(`Falha ao ler a reserva ${code}: ${error.message}`);
  if (!linhas?.length) return { atualizadas: 0, criadas: 0, motivo: 'reserva não encontrada' };

  const ativas = linhas.filter((r: any) => !String(r.reservation_status ?? '').toLowerCase().includes('cancel'));
  if (ativas.length === 0) return { atualizadas: 0, criadas: 0, motivo: 'reserva cancelada' };

  const checkIn = ativas[0].check_in_date;
  const checkOut = ativas.map((r: any) => r.check_out_date).sort().slice(-1)[0];

  const repasses: PayoutEntry[] = ativas.flatMap((r: any) =>
    (Array.isArray(r.automation_metadata?.repasses) ? r.automation_metadata.repasses : [])
      .filter((p: any) => p?.liberado_em && Number.isFinite(Number(p.valor)))
      .map((p: any) => ({ tipo: String(p.tipo ?? ''), valor: Number(p.valor), liberadoEm: String(p.liberado_em).slice(0, 10) })));

  const { data: imovel } = await admin
    .from('properties')
    .select('commission_rate, cleaning_fee')
    .eq('id', ativas[0].property_id)
    .maybeSingle();

  const ciclos = computeStayCycles({
    checkIn,
    checkOut,
    repasses,
    commissionRate: Number(imovel?.commission_rate ?? 0),
    cleaningFee: Number(ativas[0].cleaning_fee || imovel?.cleaning_fee || 0),
  });

  // Estadia curta: o repasse só confirma o pagamento. O valor lançado vale (R5);
  // o do repasse entra apenas se a reserva estiver sem valor. Lançamento só
  // negativo (estorno, cota paga) não é pagamento recebido.
  if (nightsBetween(checkIn, checkOut) <= MAX_NOITES_SEM_CICLO) {
    const ciclo = ciclos[0];
    if (!ciclo || !ciclo.repasses.some((r) => r.valor > 0)) return { atualizadas: 0, criadas: 0, motivo: 'sem repasse' };
    const linha = ativas[0];
    const mudancas: Record<string, unknown> = {};
    if (linha.payment_status !== 'Pago') mudancas.payment_status = 'Pago';
    if (!Number(linha.total_revenue) && ciclo.valor !== null) mudancas.total_revenue = ciclo.valor;
    if (Object.keys(mudancas).length === 0) return { atualizadas: 0, criadas: 0 };
    const { error: e } = await admin.from('reservations').update(mudancas).eq('id', linha.id);
    if (e) throw new Error(`Falha ao marcar ${code} como paga: ${e.message}`);
    return { atualizadas: 1, criadas: 0 };
  }

  let atualizadas = 0;
  let criadas = 0;
  const hoje = new Date().toISOString().slice(0, 10);
  const modelo = ativas[0];
  let atuais: any[] = [...ativas];

  for (const c of ciclos) {
    if (c.valor === null) continue;
    const resumo = c.repasses.map((r) => `${r.liberadoEm} R$ ${r.valor.toFixed(2)}`).join('; ');
    const meta = { indice: c.indice, total: ciclos.length, inicio: c.inicio, fim: c.fim, origem: 'repasse', repasses: c.repasses };
    const linha = atuais.find((r) => r.check_in_date === c.inicio);

    if (linha) {
      // A linha só encolhe até o fim do ciclo quando o ciclo seguinte já tem a
      // sua linha (ou quando é o último). Sem isso, a estadia estendida ficaria
      // sem linha no calendário até o próximo repasse chegar.
      const ultimo = c.indice === ciclos.length;
      const seguinteTemLinha = atuais.some((r) => r.check_in_date === c.fim);
      const fimDesejado = ultimo || seguinteTemLinha || linha.check_out_date <= c.fim ? c.fim : linha.check_out_date;

      const mudancas: Record<string, unknown> = {};
      // Até R$ 0,05 é arredondamento: na conta coanfitriã o repasse é dividido
      // pela taxa e o erro de 1 centavo cresce. O valor lançado fica — ele pode
      // ter sido acertado para a estadia fechar no total (HMZPZNQTHY).
      if (Math.abs(Number(linha.total_revenue || 0) - c.valor) > TOLERANCIA_CENTAVOS) mudancas.total_revenue = c.valor;
      if (linha.check_out_date !== fimDesejado) mudancas.check_out_date = fimDesejado;
      if (linha.payment_status !== 'Pago') mudancas.payment_status = 'Pago';
      if (linha.payment_date !== addDays(c.inicio, 1)) mudancas.payment_date = addDays(c.inicio, 1);
      if (Object.keys(mudancas).length === 0) continue;

      const antes = mudancas.total_revenue !== undefined ? ` Antes: R$ ${Number(linha.total_revenue || 0).toFixed(2)}.` : '';
      mudancas.automation_metadata = { ...(linha.automation_metadata ?? {}), ciclo: meta };
      mudancas.verification_notes = notaDoCiclo(
        linha.verification_notes,
        `[Ciclo ${c.indice}/${ciclos.length} pelo repasse do Airbnb] ${c.inicio} → ${c.fim}: R$ ${c.valor.toFixed(2)} (${resumo}).${antes}`,
      );
      const { error: e } = await admin.from('reservations').update(mudancas).eq('id', linha.id);
      if (e) throw new Error(`Falha ao atualizar o ciclo ${c.indice} de ${code}: ${e.message}`);
      Object.assign(linha, mudancas);
      atualizadas++;
      continue;
    }

    // Ciclo pago sem linha: corta a linha que o cobre e cria a do ciclo.
    const cobre = atuais.find((r) => r.check_in_date < c.inicio && r.check_out_date > c.inicio);
    if (cobre) {
      const { error: e } = await admin.from('reservations').update({ check_out_date: c.inicio }).eq('id', cobre.id);
      if (e) throw new Error(`Falha ao cortar a parcela de ${code}: ${e.message}`);
      cobre.check_out_date = c.inicio;
      atualizadas++;
    }

    // Sem linha depois deste ciclo, a nova cobre até a saída (o ciclo seguinte
    // será cortado dela quando o repasse dele chegar).
    const fimNova = c.indice === ciclos.length || atuais.some((r) => r.check_in_date >= c.fim) ? c.fim : checkOut;

    const nova = {
      property_id: modelo.property_id,
      platform: 'Airbnb',
      reservation_code: code,
      guest_name: modelo.guest_name,
      guest_phone: modelo.guest_phone,
      guest_email: modelo.guest_email,
      number_of_guests: modelo.number_of_guests,
      checkin_time: modelo.checkin_time,
      checkout_time: modelo.checkout_time,
      check_in_date: c.inicio,
      check_out_date: fimNova,
      payment_date: addDays(c.inicio, 1),
      total_revenue: c.valor,
      cleaning_fee: 0,
      reservation_status: c.fim <= hoje ? 'Finalizada' : (c.inicio <= hoje ? 'Em Andamento' : 'Confirmada'),
      payment_status: 'Pago',
      created_by_source: 'airbnb_repasse',
      automation_metadata: { ciclo: meta },
      verification_notes: `[Ciclo ${c.indice}/${ciclos.length} pelo repasse do Airbnb] ${c.inicio} → ${c.fim}: R$ ${c.valor.toFixed(2)} (${resumo}).`,
    };
    const { data: criada, error: e } = await admin.from('reservations').insert(nova).select('*').single();
    if (e) throw new Error(`Falha ao criar o ciclo ${c.indice} de ${code}: ${e.message}`);
    atuais = [...atuais, criada].sort((a, b) => a.check_in_date.localeCompare(b.check_in_date));
    criadas++;
  }

  return { atualizadas, criadas };
}
