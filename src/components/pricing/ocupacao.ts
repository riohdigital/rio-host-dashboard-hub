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
  cleaning_fee?: number | string | null;
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
  region_code?: string | null;
  country_code?: string | null;
}

/** Localização do imóvel encontrada pela esteira (E1) ou digitada pelo usuário. */
export interface LocalizacaoDoImovel {
  city?: string | null;
  state_code?: string | null;
  country_code?: string | null;
  geo_status?: string | null;
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

/** O imóvel tem localização conferida (achada pelo endereço ou digitada pelo usuário)? */
export function imovelLocalizado(p: LocalizacaoDoImovel): boolean {
  return (p.geo_status === 'ok' || p.geo_status === 'manual') && Boolean(p.country_code);
}

/**
 * O evento vale para o imóvel? Pelo escopo do evento (país → estado → cidade) contra a
 * localização do imóvel. Mesma regra do radar no n8n. Sem localização conferida, nenhum
 * evento vale: a página pede para completar o cadastro em vez de adivinhar pela cidade.
 */
export function eventoValeParaImovel(ev: Pick<EventoLocal, 'city' | 'region_code' | 'country_code'>, p: LocalizacaoDoImovel): boolean {
  if (!imovelLocalizado(p)) return false;
  if (!ev.country_code && !ev.city) return false;
  if (ev.country_code && ev.country_code !== p.country_code) return false;
  if (ev.region_code && ev.region_code !== p.state_code) return false;
  if (ev.city && normalizar(ev.city) !== normalizar(p.city || '')) return false;
  return true;
}

const nomeDoPais = (codigo: string) => {
  try {
    return new Intl.DisplayNames(['pt-BR'], { type: 'region' }).of(codigo) || codigo;
  } catch {
    return codigo;
  }
};

/** Onde o evento vale, para mostrar: a cidade, o estado ou o país inteiro. */
export function escopoDoEvento(ev: Pick<EventoLocal, 'city' | 'region_code' | 'country_code'>): string {
  if (ev.city) return ev.city;
  if (ev.region_code) return `Estado ${ev.region_code.split('-').pop()}`;
  if (ev.country_code) return `Todo o país (${nomeDoPais(ev.country_code)})`;
  return 'Local não informado';
}

/** Tipo de data do evento, o mesmo que a regra aprendida do imóvel usa. */
export function tipoDeData(ev: Pick<EventoLocal, 'category' | 'demand_impact'>): string {
  if (ev.category === 'Feriado prolongado') return 'feriado_prolongado';
  if (ev.category && ev.category.startsWith('Feriado')) return 'feriado';
  return ev.demand_impact === 'Crítico' ? 'evento_critico' : 'evento_alto';
}

export const NOME_DO_TIPO: Record<string, string> = {
  feriado_prolongado: 'Feriado prolongado',
  feriado: 'Feriado',
  fim_de_semana: 'Fim de semana',
  evento_critico: 'Evento de grande porte',
  evento_alto: 'Evento',
};

export const ORIGEM_DA_REGRA: Record<string, string> = {
  historico: 'seu histórico',
  mercado: 'concorrentes',
  manual: 'definida por você',
};

/** Fator em percentual legível: 1,57 → "+57%". */
export function percentual(fator: number): string {
  const p = Math.round((fator - 1) * 100);
  return `${p > 0 ? '+' : ''}${p}%`;
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

/**
 * Eventos ainda por vir (ou em andamento), sem repetir o mesmo nome no mesmo período e no mesmo
 * lugar. Feriado de um dia que cai dentro de um feriado prolongado do mesmo país some: o
 * prolongado já cobre essas noites (mesma regra do radar).
 */
export function eventosFuturos(eventos: EventoLocal[], hoje: string): EventoLocal[] {
  const vistos = new Set<string>();
  const prolongados = eventos.filter((e) => e.category === 'Feriado prolongado');
  return eventos
    .filter((e) => (e.end_date || e.start_date) >= hoje)
    .filter((e) => !(e.category && e.category.startsWith('Feriado') && e.category !== 'Feriado prolongado' &&
      prolongados.some((l) => (l.country_code ?? null) === (e.country_code ?? null) && e.start_date >= l.start_date && e.start_date <= l.end_date)))
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .filter((e) => {
      const lugar = `${e.city ?? ''}|${e.region_code ?? ''}|${e.country_code ?? ''}`;
      const chave = `${lugar}|${e.start_date}|${e.end_date}|${e.name.toLowerCase().replace(/\s+prolongado$/, '').trim()}`;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    })
    // Dias seguidos do mesmo feriado no mesmo lugar (ex.: segunda e terça de Carnaval) viram um só.
    .reduce<EventoLocal[]>((acc, e) => {
      const anterior = acc.find((a) => a.name === e.name && a.category === e.category &&
        (a.city ?? null) === (e.city ?? null) && (a.region_code ?? null) === (e.region_code ?? null) &&
        (a.country_code ?? null) === (e.country_code ?? null) && e.start_date <= a.end_date);
      if (anterior) {
        if (e.end_date > anterior.end_date) anterior.end_date = e.end_date;
      } else {
        acc.push({ ...e });
      }
      return acc;
    }, []);
}
