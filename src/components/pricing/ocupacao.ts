/**
 * Cálculos da página de Precificação a partir de dados reais (reservas e cadastro).
 *
 * Desde 20/10/2026 a página só mostra o que tem origem comprovada: os preços e
 * concorrentes de antes eram gerados (ver n8n-manager/projects/rioh-host/docs/
 * DIAGNOSTICO_PRECIFICACAO_2026-10-20.md). Datas são sempre 'AAAA-MM-DD', e uma
 * reserva ocupa as noites de check-in até a véspera do checkout.
 */

export interface ReservaParaOcupacao {
  property_id: string;
  check_in_date: string;
  check_out_date: string;
  total_revenue: number | string | null;
  cleaning_fee: number | string | null;
  base_revenue?: number | string | null;
  reservation_status?: string | null;
}

export interface EventoLocal {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  demand_impact?: string | null;
  category?: string | null;
  city?: string | null;
}

const DIA = 86_400_000;
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`);

/** Hoje no fuso de quem está usando o dashboard (multi-inquilino: nada de fuso fixo). */
export function hojeLocal(agora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Cidade do imóvel entre as cidades que têm eventos: a que aparece primeiro no endereço
 * (sem acento e sem espaço). Endereço brasileiro traz a cidade antes do estado, então
 * "Rio das Ostras, Rio de Janeiro" é Rio das Ostras. Mesma regra do radar no n8n.
 * Provisório até o cadastro do imóvel ter um campo de cidade.
 */
export function cidadeDoImovel(endereco: string | null | undefined, cidades: string[]): string | null {
  if (!endereco) return null;
  const e = normalizar(endereco);
  let melhor: { cidade: string; pos: number; tam: number } | null = null;
  for (const cidade of cidades) {
    const c = normalizar(cidade);
    if (!c) continue;
    const pos = e.indexOf(c);
    if (pos < 0) continue;
    if (!melhor || pos < melhor.pos || (pos === melhor.pos && c.length > melhor.tam)) melhor = { cidade, pos, tam: c.length };
  }
  return melhor?.cidade ?? null;
}

/** O evento vale para o imóvel? Sem cidade no evento, vale para todos. */
export function eventoValeParaImovel(ev: Pick<EventoLocal, 'city'>, endereco: string | null | undefined, cidades: string[]): boolean {
  if (!ev.city) return true;
  return cidadeDoImovel(endereco, cidades) === ev.city;
}

export function somarDias(data: string, dias: number): string {
  return new Date(ms(data) + dias * DIA).toISOString().slice(0, 10);
}

/** Noites entre duas datas (checkout − check-in). */
export function noites(inicio: string, fim: string): number {
  return Math.max(0, Math.round((ms(fim) - ms(inicio)) / DIA));
}

/** Noites da reserva que caem dentro de [inicio, fim). */
export function noitesNaJanela(r: Pick<ReservaParaOcupacao, 'check_in_date' | 'check_out_date'>, inicio: string, fim: string): number {
  const a = Math.max(ms(r.check_in_date), ms(inicio));
  const b = Math.min(ms(r.check_out_date), ms(fim));
  return Math.max(0, Math.round((b - a) / DIA));
}

/** Receita da hospedagem (sem a limpeza), dividida igualmente pelas noites da reserva. */
export function receitaPorNoite(r: ReservaParaOcupacao): number {
  const n = noites(r.check_in_date, r.check_out_date);
  if (!n) return 0;
  const base = r.base_revenue !== undefined && r.base_revenue !== null ? num(r.base_revenue) : num(r.total_revenue) - num(r.cleaning_fee);
  return Math.max(0, base) / n;
}

const ativa = (r: ReservaParaOcupacao) => !String(r.reservation_status || '').toLowerCase().includes('cancel');

export interface OcupacaoDoImovel {
  noitesNaJanela: number;
  noitesReservadas: number;
  noitesLivres: number;
  ocupacao: number; // 0–1
  receitaReservada: number;
  diariaMediaReservada: number | null;
  /** Primeiras sequências de noites livres (início, noites), para mostrar na tela. */
  janelasLivres: { inicio: string; noites: number }[];
}

export function ocupacaoDoImovel(reservas: ReservaParaOcupacao[], inicio: string, fim: string): OcupacaoDoImovel {
  const total = noites(inicio, fim);
  const ocupadas = new Set<number>();
  let receita = 0;
  for (const r of reservas.filter(ativa)) {
    const n = noitesNaJanela(r, inicio, fim);
    if (!n) continue;
    receita += receitaPorNoite(r) * n;
    const a = Math.max(ms(r.check_in_date), ms(inicio));
    for (let i = 0; i < n; i++) ocupadas.add(a + i * DIA);
  }
  const janelasLivres: { inicio: string; noites: number }[] = [];
  let atual: { inicio: string; noites: number } | null = null;
  for (let i = 0; i < total; i++) {
    const t = ms(inicio) + i * DIA;
    if (ocupadas.has(t)) {
      atual = null;
      continue;
    }
    if (!atual) {
      atual = { inicio: new Date(t).toISOString().slice(0, 10), noites: 0 };
      janelasLivres.push(atual);
    }
    atual.noites++;
  }
  const reservadas = ocupadas.size;
  return {
    noitesNaJanela: total,
    noitesReservadas: reservadas,
    noitesLivres: total - reservadas,
    ocupacao: total ? reservadas / total : 0,
    receitaReservada: receita,
    diariaMediaReservada: reservadas ? receita / reservadas : null,
    janelasLivres,
  };
}

export type SituacaoNoEvento = 'livre' | 'parcial' | 'reservado';

/** Situação do imóvel nas noites do evento (o último dia do evento é a noite de saída). */
export function situacaoNoEvento(reservas: ReservaParaOcupacao[], ev: EventoLocal): { situacao: SituacaoNoEvento; noitesLivres: number; noitesDoEvento: number } {
  const fim = ev.end_date > ev.start_date ? ev.end_date : somarDias(ev.start_date, 1);
  const o = ocupacaoDoImovel(reservas, ev.start_date, fim);
  const situacao: SituacaoNoEvento = o.noitesReservadas === 0 ? 'livre' : o.noitesLivres === 0 ? 'reservado' : 'parcial';
  return { situacao, noitesLivres: o.noitesLivres, noitesDoEvento: o.noitesNaJanela };
}

/** Eventos ainda por vir (ou em andamento), sem repetir o mesmo nome no mesmo período e na mesma cidade. */
export function eventosFuturos(eventos: EventoLocal[], hoje: string): EventoLocal[] {
  const vistos = new Set<string>();
  return eventos
    .filter((e) => (e.end_date || e.start_date) >= hoje)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .filter((e) => {
      const chave = `${e.city ?? ''}|${e.start_date}|${e.end_date}|${e.name.toLowerCase().replace(/\s+prolongado$/, '').trim()}`;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });
}
