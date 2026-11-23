/**
 * Contas do Calendário sobre o período do filtro global (regra D2): os meses
 * do período, o que acontece em cada dia (entradas, saídas, hospedados e
 * quantos imóveis estão ocupados) e as janelas de 14 dias de Imóveis e Agenda.
 *
 * Tudo trabalha com datas em texto 'AAAA-MM-DD' (sem fuso), como vêm do banco.
 * Uma noite ocupa o dia do check-in até a véspera do check-out.
 */
import { format } from 'date-fns';
import { noites, somarDias } from '@/components/pricing/ocupacao';
import { CalendarReservation } from '@/types/calendar';

export const NOMES_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const SEMANA_CURTA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
export const SEMANA_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Dias por janela em Imóveis e Agenda */
export const DIAS_POR_JANELA = 14;
/** Meses abertos de cada vez na visão Mês */
export const MESES_POR_VEZ = 3;

/** Topo grudento abaixo da barra do celular (no computador, o topo da página) */
export const TOPO_GRUDENTO = 'top-[calc(3.5rem+1px+env(safe-area-inset-top))] lg:top-0';

export const paraTexto = (d: Date) => format(d, 'yyyy-MM-dd');
const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Partes numéricas de 'AAAA-MM-DD' */
const partes = (d: string) => {
  const [a, m, dia] = d.slice(0, 10).split('-').map(Number);
  return { a, m: m - 1, dia };
};

/** Dia da semana (0 = domingo) de 'AAAA-MM-DD' */
export const diaDaSemana = (d: string) => {
  const { a, m, dia } = partes(d);
  return new Date(Date.UTC(a, m, dia)).getUTCDay();
};

const diasNoMes = (a: number, m: number) => new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
const doisDig = (n: number) => String(n).padStart(2, '0');
const textoDe = (a: number, m: number, dia: number) => `${a}-${doisDig(m + 1)}-${doisDig(dia)}`;

/** "15 jan", "3 de janeiro" etc. */
export function rotuloDia(d: string, longo = false): string {
  const { m, dia } = partes(d);
  return longo ? `${dia} de ${NOMES_MES[m]}` : `${dia} ${NOMES_MES[m].slice(0, 3)}`;
}

/** "Qui, 15 de janeiro" */
export const rotuloDiaComSemana = (d: string) => `${SEMANA_ABREV[diaDaSemana(d)]}, ${rotuloDia(d, true)}`;

/** "1 a 14 de janeiro", "25 de janeiro a 7 de fevereiro", com o ano quando cruza anos */
export function rotuloIntervalo(inicio: string, fim: string): string {
  const a = partes(inicio);
  const b = partes(fim);
  if (a.a !== b.a) return `${rotuloDia(inicio, true)} de ${a.a} a ${rotuloDia(fim, true)} de ${b.a}`;
  if (a.m === b.m) return inicio === fim ? rotuloDia(inicio, true) : `${a.dia} a ${rotuloDia(fim, true)}`;
  return `${rotuloDia(inicio, true)} a ${rotuloDia(fim, true)}`;
}

export interface MesDoPeriodo {
  /** 'AAAA-MM' */
  chave: string;
  ano: number;
  /** 0 a 11 */
  mes: number;
  /** "Janeiro" (com o ano quando o período cruza anos) */
  nome: string;
  /** "Jan" */
  curto: string;
  /** Primeiro e último dia do mês */
  primeiroDia: string;
  ultimoDia: string;
  /** Pedaço do mês que está dentro do período */
  inicio: string;
  fim: string;
  /** Dias do mês dentro do período */
  dias: number;
}

/** Os meses que o período toca, em ordem */
export function mesesDoPeriodo(inicio: string, fim: string): MesDoPeriodo[] {
  if (!inicio || !fim || inicio > fim) return [];
  const ini = partes(inicio);
  const fi = partes(fim);
  const variosAnos = ini.a !== fi.a;
  const meses: MesDoPeriodo[] = [];
  let a = ini.a;
  let m = ini.m;
  while (a < fi.a || (a === fi.a && m <= fi.m)) {
    const primeiroDia = textoDe(a, m, 1);
    const ultimoDia = textoDe(a, m, diasNoMes(a, m));
    const i = primeiroDia < inicio ? inicio : primeiroDia;
    const f = ultimoDia > fim ? fim : ultimoDia;
    const nomeMes = capitalizar(NOMES_MES[m]);
    meses.push({
      chave: `${a}-${doisDig(m + 1)}`,
      ano: a,
      mes: m,
      nome: variosAnos ? `${nomeMes} de ${a}` : nomeMes,
      curto: capitalizar(NOMES_MES[m].slice(0, 3)),
      primeiroDia,
      ultimoDia,
      inicio: i,
      fim: f,
      dias: noites(i, f) + 1,
    });
    m += 1;
    if (m > 11) {
      m = 0;
      a += 1;
    }
  }
  return meses;
}

/**
 * Período que o calendário desenha. "Geral" (1900–2099) e outros períodos
 * enormes encolhem para os meses que têm reservas (ou o ano corrente, sem
 * reservas), para não desenhar séculos de meses vazios.
 */
export function periodoDesenhavel(inicio: string, fim: string, reservas: CalendarReservation[], hoje: string): { inicio: string; fim: string } {
  const LIMITE_DIAS = 3 * 366;
  if (noites(inicio, fim) <= LIMITE_DIAS) return { inicio, fim };
  let min = '';
  let max = '';
  for (const r of reservas) {
    if (r.reservation_status === 'Cancelada') continue;
    if (!min || r.check_in_date < min) min = r.check_in_date;
    if (!max || r.check_out_date > max) max = r.check_out_date;
  }
  if (!min) {
    const ano = hoje.slice(0, 4);
    return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
  }
  const i = `${min.slice(0, 7)}-01`;
  const { a, m } = partes(max);
  const f = textoDe(a, m, diasNoMes(a, m));
  return { inicio: i < inicio ? inicio : i, fim: f > fim ? fim : f };
}

export interface DiaDoCalendario {
  entradas: CalendarReservation[];
  saidas: CalendarReservation[];
  /** Hospedados que não entraram nesse dia */
  hospedados: CalendarReservation[];
  /** Imóveis com noite ocupada nesse dia */
  ocupados: number;
}

const diaVazio = (): DiaDoCalendario => ({ entradas: [], saidas: [], hospedados: [], ocupados: 0 });

/**
 * O que acontece em cada dia do período, só com os imóveis do filtro e sem
 * as canceladas. Dias sem nada não entram no mapa.
 */
export function indexarDias(
  reservas: CalendarReservation[],
  imoveis: Set<string>,
  inicio: string,
  fim: string,
): Map<string, DiaDoCalendario> {
  const mapa = new Map<string, DiaDoCalendario>();
  const ocupadosPorDia = new Map<string, Set<string>>();
  const pegar = (d: string) => {
    let x = mapa.get(d);
    if (!x) {
      x = diaVazio();
      mapa.set(d, x);
    }
    return x;
  };
  const ordenadas = [...reservas].sort((a, b) => a.check_in_date.localeCompare(b.check_in_date));
  for (const r of ordenadas) {
    if (r.reservation_status === 'Cancelada' || !imoveis.has(r.property_id)) continue;
    const ci = r.check_in_date.slice(0, 10);
    const co = r.check_out_date.slice(0, 10);
    if (ci >= inicio && ci <= fim) pegar(ci).entradas.push(r);
    if (co >= inicio && co <= fim) pegar(co).saidas.push(r);
    // Noites dentro do período
    let d = ci < inicio ? inicio : ci;
    while (d < co && d <= fim) {
      if (d !== ci) pegar(d).hospedados.push(r);
      let s = ocupadosPorDia.get(d);
      if (!s) {
        s = new Set();
        ocupadosPorDia.set(d, s);
      }
      s.add(r.property_id);
      d = somarDias(d, 1);
    }
  }
  for (const [d, s] of ocupadosPorDia) pegar(d).ocupados = s.size;
  return mapa;
}

/** Ocupação (0 a 1) e reservas de um mês dentro do período */
export function resumoDoMes(mes: MesDoPeriodo, dias: Map<string, DiaDoCalendario>, totalImoveis: number) {
  let ocupadas = 0;
  const reservas = new Set<string>();
  let d = mes.inicio;
  while (d <= mes.fim) {
    const x = dias.get(d);
    if (x) {
      ocupadas += x.ocupados;
      for (const r of x.entradas) reservas.add(r.id);
      for (const r of x.hospedados) reservas.add(r.id);
    }
    d = somarDias(d, 1);
  }
  const capacidade = mes.dias * totalImoveis;
  return { ocupacao: capacidade > 0 ? ocupadas / capacidade : 0, reservas: reservas.size };
}

/** Semanas (domingo a sábado) que cobrem o mês; null = dia de outro mês */
export function semanasDoMes(mes: MesDoPeriodo): (string | null)[][] {
  const celulas: (string | null)[] = Array(diaDaSemana(mes.primeiroDia)).fill(null);
  let d = mes.primeiroDia;
  while (d <= mes.ultimoDia) {
    celulas.push(d);
    d = somarDias(d, 1);
  }
  while (celulas.length % 7) celulas.push(null);
  const semanas: (string | null)[][] = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));
  return semanas;
}

/** Início da janela de 14 dias que contém `dia`, contando do começo do período */
export function janelaQueContem(inicioPeriodo: string, dia: string): string {
  const n = Math.floor(noites(inicioPeriodo, dia) / DIAS_POR_JANELA);
  return somarDias(inicioPeriodo, n * DIAS_POR_JANELA);
}

/** Primeiro nome do hóspede (para a barra da reserva) */
export const primeiroNome = (nome?: string | null) => (nome || '').trim().split(/\s+/)[0] || '';

/** Hora 'HH:MM' de '14:00:00' */
export const hora = (h?: string | null) => (h ? h.slice(0, 5) : '');

/** Nome do imóvel da reserva */
export const nomeDoImovel = (r: CalendarReservation, imoveis?: Map<string, string>) =>
  imoveis?.get(r.property_id) || r.properties?.nickname || r.properties?.name || 'Imóvel';
