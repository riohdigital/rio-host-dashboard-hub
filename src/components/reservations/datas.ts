/** Datas curtas das reservas no celular ("27 nov → 1 dez"), sem fuso */

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "2026-11-27" → { a: 2026, m: 11, d: 27 } */
const partes = (data?: string | null) => {
  const [a, m, d] = (data || '').slice(0, 10).split('-').map(Number);
  return { a, m, d };
};

/** "2026-11-27" → "27 nov" */
export function dataCurta(data?: string | null): string {
  const { m, d } = partes(data);
  if (!m || !d) return '';
  return `${d} ${MESES[m - 1]}`;
}

/** "27 nov → 1 dez" ou "21 → 26 nov" */
export function periodoCurto(entrada?: string | null, saida?: string | null): string {
  if (!entrada || !saida) return dataCurta(entrada || saida);
  const a = partes(entrada);
  const b = partes(saida);
  return a.m === b.m && a.a === b.a ? `${a.d} → ${b.d} ${MESES[b.m - 1]}` : `${dataCurta(entrada)} → ${dataCurta(saida)}`;
}

/** Noites entre a entrada e a saída */
export function noites(entrada?: string | null, saida?: string | null): number {
  if (!entrada || !saida) return 0;
  const ms = Date.parse(`${saida.slice(0, 10)}T00:00:00Z`) - Date.parse(`${entrada.slice(0, 10)}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** Hoje no fuso do aparelho, "2026-11-23" */
export function hojeISO(): string {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
}

/** O hóspede está no imóvel hoje (entrou e ainda não saiu) */
export function emCurso(entrada?: string | null, saida?: string | null, hoje = hojeISO()): boolean {
  if (!entrada || !saida) return false;
  return entrada.slice(0, 10) <= hoje && hoje < saida.slice(0, 10);
}

/** "2026-11" → "Novembro 2026" */
export function nomeDoMes(anoMes: string): string {
  const [a, m] = anoMes.split('-').map(Number);
  if (!a || !m) return 'Sem data';
  const nome = MESES_LONGOS[m - 1];
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${a}`;
}

/** "09:30:00" → ", 09:30"; vazio sem hora */
export const comHora = (hora?: string | null) => (hora ? `, ${hora.slice(0, 5)}` : '');
