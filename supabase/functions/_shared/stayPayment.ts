/**
 * Pagamento pela regra de cada plataforma (pedido do Dono em 23/11/2026).
 *
 * O comprovante continua sendo o sinal principal: o aviso "Enviamos um
 * pagamento" do Airbnb (stayCycles.ts) e a NFS-e mensal da Booking
 * (bookingInvoice.ts). Esta regra é a rede de segurança para quando ele não
 * chega: reserva "Pendente" cuja data de pagamento da plataforma já passou vira
 * "Pago". Sem ela a reserva ficava "Pendente" para sempre.
 *
 * A data é a coluna `payment_date`, calculada no banco pelo gatilho
 * `calculate_payment_date`: Airbnb = dia seguinte ao check-in; Booking.com =
 * dia 1º do mês seguinte ao check-out; Direto e as demais = dia do check-in.
 * `dataDePagamentoDaPlataforma` repete a regra só para a linha sem a coluna.
 *
 * O que nunca é tocado:
 * - pagamento que não está "Pendente" ("Atrasado" é como o Dono marca que não
 *   recebeu; "Pago" já está resolvido);
 * - reserva fora de Confirmada / Em Andamento / Finalizada (Cancelada, pedido);
 * - linha que a regra já marcou para esta mesma data e alguém devolveu para
 *   "Pendente": desfazer à mão vale mais que a regra (a sincronização nunca
 *   sobrescreve trabalho manual). Se a data de pagamento mudar, a regra volta
 *   a valer;
 * - estadia longa do Airbnb ainda não dividida em ciclos (abaixo).
 *
 * Estadia longa do Airbnb (R3, stayCycles.ts): acima de 28 noites o Airbnb paga
 * um ciclo por mês, no dia seguinte ao início de cada ciclo, e o dashboard
 * guarda uma linha por ciclo com o mesmo código. O `payment_date` da linha é o
 * dia seguinte à entrada DELA, então só vale para o trecho de um ciclo. Por isso
 * a linha do Airbnb só é paga pela regra quando cabe inteira em um ciclo da
 * estadia. A linha que atravessa mais de um ciclo (estadia ainda não dividida,
 * ou a última parcela esticada por uma extensão) fica "Pendente" até o aviso de
 * repasse chegar: marcar no D+1 daria como recebidos meses que o Airbnb ainda
 * não pagou.
 *
 * O rastro de que foi a regra, e não um comprovante, fica em
 * `automation_metadata.pagamento_automatico` e numa marca curta em
 * `verification_notes`. Os gatilhos do banco não reagem a essa troca: o de
 * auditoria só dispara em INSERT ou UPDATE de `reservation_status`, o de
 * `payment_date` em datas ou plataforma, e o financeiro em valores.
 */

// deno-lint-ignore-file no-explicit-any

import { cycleBoundaries } from './stayCycles.ts';
import { agoraEmBrasilia } from './stayStatus.ts';

export const REGRA_DATA_DA_PLATAFORMA = 'data_da_plataforma';

const STATUS_COM_PAGAMENTO = ['Confirmada', 'Em Andamento', 'Finalizada'];
const DATA_ISO = /^\d{4}-\d{2}-\d{2}/;

export interface LinhaDePagamento {
  platform?: string | null;
  reservation_status?: string | null;
  payment_status?: string | null;
  payment_date?: string | null;
  check_in_date: string;
  check_out_date: string;
  automation_metadata?: any;
}

export interface Estadia {
  checkIn: string;
  checkOut: string;
}

export type MotivoSemPagamento =
  | 'pagamento_nao_pendente'
  | 'status_da_reserva'
  | 'sem_data'
  | 'antes_da_data'
  | 'desfeito_a_mao'
  | 'estadia_longa_sem_ciclos';

export type DecisaoDePagamento =
  | { pagar: true; dataPagamento: string }
  | { pagar: false; motivo: MotivoSemPagamento };

/** "2026-11-23": o dia de hoje no horário de Brasília. */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return agoraEmBrasilia(agora).slice(0, 10);
}

/**
 * A mesma regra do gatilho `calculate_payment_date`, para a linha que chegar
 * sem `payment_date`. Os nomes de plataforma são comparados como no gatilho.
 */
export function dataDePagamentoDaPlataforma(
  reserva: { platform?: string | null; check_in_date?: string | null; check_out_date?: string | null },
): string | null {
  const entrada = String(reserva.check_in_date ?? '');
  const saida = String(reserva.check_out_date ?? '');

  if (reserva.platform === 'Booking.com') {
    if (!DATA_ISO.test(saida)) return null;
    const [ano, mes] = saida.split('-').map(Number);
    // Mês em base 1 usado como índice em base 0: é o dia 1º do mês seguinte.
    return new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
  }

  if (!DATA_ISO.test(entrada)) return null;
  if (reserva.platform === 'Airbnb') {
    const d = new Date(`${entrada.slice(0, 10)}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  return entrada.slice(0, 10);
}

/**
 * A estadia inteira de que a linha faz parte: ela e as outras linhas do mesmo
 * código que se encostam ou se sobrepõem (as parcelas de uma estadia longa são
 * contíguas). Linha do mesmo código separada por um intervalo é outra estadia.
 */
export function estadiaDaLinha(
  linha: { check_in_date: string; check_out_date: string },
  irmas: Array<{ check_in_date: string; check_out_date: string }> = [],
): Estadia {
  let checkIn = linha.check_in_date;
  let checkOut = linha.check_out_date;
  const resto = [...irmas];

  let cresceu = true;
  while (cresceu) {
    cresceu = false;
    for (let i = resto.length - 1; i >= 0; i--) {
      const outra = resto[i];
      if (outra.check_in_date > checkOut || outra.check_out_date < checkIn) continue;
      if (outra.check_in_date < checkIn) checkIn = outra.check_in_date;
      if (outra.check_out_date > checkOut) checkOut = outra.check_out_date;
      resto.splice(i, 1);
      cresceu = true;
    }
  }
  return { checkIn, checkOut };
}

/** A linha cabe inteira em um ciclo de repasse da estadia (sempre, até 28 noites). */
export function cabeEmUmCiclo(
  linha: { check_in_date: string; check_out_date: string },
  estadia: Estadia,
): boolean {
  const ciclos = cycleBoundaries(estadia.checkIn, estadia.checkOut);
  if (ciclos.length <= 1) return true;
  return ciclos.some((c) => c.inicio <= linha.check_in_date && linha.check_out_date <= c.fim);
}

/**
 * A reserva deve virar "Pago" hoje pela regra da plataforma?
 * `estadia` é a estadia inteira (todas as linhas do código); sem ela, vale a
 * própria linha.
 */
export function pagamentoPorRegra(
  reserva: LinhaDePagamento,
  hoje: string,
  estadia?: Estadia,
): DecisaoDePagamento {
  if (reserva.payment_status !== 'Pendente') return { pagar: false, motivo: 'pagamento_nao_pendente' };
  if (!STATUS_COM_PAGAMENTO.includes(String(reserva.reservation_status))) return { pagar: false, motivo: 'status_da_reserva' };

  const gravada = String(reserva.payment_date ?? '');
  const dataPagamento = DATA_ISO.test(gravada) ? gravada.slice(0, 10) : dataDePagamentoDaPlataforma(reserva);
  if (!dataPagamento) return { pagar: false, motivo: 'sem_data' };
  if (hoje < dataPagamento) return { pagar: false, motivo: 'antes_da_data' };

  // A regra já marcou esta linha para esta data e alguém a devolveu para "Pendente".
  if (reserva.automation_metadata?.pagamento_automatico?.data_pagamento === dataPagamento) {
    return { pagar: false, motivo: 'desfeito_a_mao' };
  }

  if (reserva.platform === 'Airbnb') {
    const inteira = estadia ?? { checkIn: reserva.check_in_date, checkOut: reserva.check_out_date };
    if (!cabeEmUmCiclo(reserva, inteira)) return { pagar: false, motivo: 'estadia_longa_sem_ciclos' };
  }

  return { pagar: true, dataPagamento };
}

/**
 * Acrescenta a marca da regra à observação, trocando a de uma rodada anterior.
 * O comprovante que chegar depois acrescenta a marca dele ao lado (NFS-e, ciclo
 * do repasse), e a observação fica como histórico.
 */
export function notaDoPagamentoPorRegra(anterior: string | null | undefined, dataPagamento: string): string {
  const marca = `[Pago pela data da plataforma — ${dataPagamento}]`;
  const resto = String(anterior ?? '').replace(/\s*\[Pago pela data da plataforma[^\]]*\]/g, '').trim();
  return resto ? `${resto} ${marca}` : marca;
}

const CODIGOS_POR_CONSULTA = 100;

/**
 * Marca como pagas as reservas "Pendente" cuja data de pagamento já chegou.
 * Devolve quantas foram marcadas e quantas estadias longas do Airbnb seguem
 * esperando o aviso de repasse.
 */
export async function marcarPagamentosPorRegra(
  admin: any,
  agora: Date = new Date(),
): Promise<{ marcadas: number; aguardandoRepasse: number }> {
  const hoje = hojeEmBrasilia(agora);

  // Só o que pode mudar: pendente, em status de estadia e com a data vencida
  // (ou sem data, que a regra calcula).
  const { data, error } = await admin
    .from('reservations')
    .select('id, property_id, platform, reservation_code, reservation_status, payment_status, payment_date, check_in_date, check_out_date, automation_metadata')
    .eq('payment_status', 'Pendente')
    .in('reservation_status', STATUS_COM_PAGAMENTO)
    .or(`payment_date.lte.${hoje},payment_date.is.null`)
    .order('check_in_date', { ascending: true })
    .limit(1000);

  if (error) throw new Error(`Falha ao ler reservas para o pagamento: ${error.message}`);
  if (!data?.length) return { marcadas: 0, aguardandoRepasse: 0 };

  // Parcelas das estadias do Airbnb (inclusive as já pagas), para saber se a
  // linha cabe em um ciclo. Se esta leitura falhar, nada é marcado nesta rodada:
  // sem as parcelas não dá para distinguir a estadia longa.
  const chave = (r: any) => `${r.property_id}|${r.reservation_code}`;
  const codigos = [...new Set<string>(
    data.filter((r: any) => r.platform === 'Airbnb' && r.reservation_code).map((r: any) => String(r.reservation_code)),
  )];
  const parcelas = new Map<string, any[]>();
  for (let i = 0; i < codigos.length; i += CODIGOS_POR_CONSULTA) {
    const { data: linhas, error: e } = await admin
      .from('reservations')
      .select('id, property_id, reservation_code, reservation_status, check_in_date, check_out_date')
      .eq('platform', 'Airbnb')
      .in('reservation_code', codigos.slice(i, i + CODIGOS_POR_CONSULTA))
      .limit(5000);
    if (e) throw new Error(`Falha ao ler as parcelas das estadias do Airbnb: ${e.message}`);
    for (const linha of linhas ?? []) {
      if (String(linha.reservation_status ?? '').toLowerCase().includes('cancel')) continue;
      parcelas.set(chave(linha), [...(parcelas.get(chave(linha)) ?? []), linha]);
    }
  }

  let marcadas = 0;
  let aguardandoRepasse = 0;
  for (const r of data) {
    const irmas = (parcelas.get(chave(r)) ?? []).filter((p) => p.id !== r.id);
    const decisao = pagamentoPorRegra(r, hoje, estadiaDaLinha(r, irmas));
    if (!decisao.pagar) {
      if (decisao.motivo === 'estadia_longa_sem_ciclos') aguardandoRepasse++;
      continue;
    }

    // Relê os dois campos que são reescritos inteiros, logo antes de gravar: o
    // aviso de repasse grava em `automation_metadata` e não pode ser perdido.
    const { data: atual, error: erroLeitura } = await admin
      .from('reservations')
      .select('automation_metadata, verification_notes')
      .eq('id', r.id)
      .maybeSingle();
    if (erroLeitura || !atual) {
      console.error(`Falha ao reler ${r.id} para o pagamento:`, erroLeitura?.message ?? 'reserva não encontrada');
      continue;
    }

    const { data: gravadas, error: e } = await admin
      .from('reservations')
      .update({
        payment_status: 'Pago',
        automation_metadata: {
          ...(atual.automation_metadata ?? {}),
          pagamento_automatico: {
            regra: REGRA_DATA_DA_PLATAFORMA,
            em: agora.toISOString(),
            data_pagamento: decisao.dataPagamento,
          },
        },
        verification_notes: notaDoPagamentoPorRegra(atual.verification_notes, decisao.dataPagamento),
      })
      .eq('id', r.id)
      // Quem mudou o pagamento ou cancelou a reserva nesse meio-tempo ganha.
      .eq('payment_status', 'Pendente')
      .in('reservation_status', STATUS_COM_PAGAMENTO)
      .select('id');
    if (e) console.error(`Falha ao marcar o pagamento de ${r.id}:`, e.message);
    else if (gravadas?.length) marcadas++;
  }

  return { marcadas, aguardandoRepasse };
}
