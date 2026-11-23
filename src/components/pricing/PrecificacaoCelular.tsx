/**
 * Peças da Precificação no celular (abaixo de 1024px, T8 do plano).
 *
 * - IndicadoresPrecificacao: os 4 números do topo em grade 2×2 (`.m-kpi`).
 * - CartaoSugestao: uma sugestão do radar em um cartão: título do evento ou
 *   motivo + marca IA, imóvel · datas, os três valores lado a lado e as ações.
 *   As explicações longas (motivo, raciocínio, evidências) ficam atrás do "i".
 * - FiltroSugestoes: a contagem da lista e o filtro de status num seletor
 *   (no lugar da segunda barra de abas), com o botão de sincronizar o radar.
 *
 * Só apresentação: os números e as ações chegam prontos do
 * PropertyPricingDashboard (nenhuma consulta ou cálculo novo aqui).
 */
import React from 'react';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MarcaIA from '@/components/comum/MarcaIA';
import AjudaInfo from '@/components/comum/AjudaInfo';
import { Etiqueta } from '@/components/comum/Etiquetas';
import { CLASSE_TITULO_BLOCO } from '@/components/comum/Bloco';
import { TEXTO_DO_TOM, type Tom } from '@/components/comum/cores';
import { cn } from '@/lib/utils';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2026-12-30" → "30 dez" (sem fuso) */
export function diaMes(iso?: string | null): string {
  if (!iso) return '';
  const [, m, d] = iso.slice(0, 10).split('-');
  const mes = MESES[Number(m) - 1];
  return mes ? `${Number(d)} ${mes}` : '';
}

/** "30 dez → 2 jan" */
export const periodoCurto = (inicio?: string | null, fim?: string | null) =>
  inicio && fim && inicio.slice(0, 10) !== fim.slice(0, 10) ? `${diaMes(inicio)} → ${diaMes(fim)}` : diaMes(inicio);

/* ── Indicadores ─────────────────────────────────────────── */

export interface Indicador {
  rotulo: string;
  valor: React.ReactNode;
  tom?: Tom;
  /** Explicação do número (vai para o "i") */
  ajuda?: React.ReactNode;
}

export const IndicadoresPrecificacao = ({ itens }: { itens: Indicador[] }) => (
  <dl className="grid grid-cols-2 gap-2">
    {itens.map((it) => (
      <div key={it.rotulo} className="min-w-0 rounded-[14px] border bg-card px-3 py-2.5 shadow-sm">
        <dt className="flex items-center justify-between gap-1 text-xs text-gray-500">
          <span className="truncate">{it.rotulo}</span>
          {it.ajuda && (
            <AjudaInfo titulo={it.rotulo} rotulo={`Sobre: ${it.rotulo}`} className="-my-3 -mr-3">
              {it.ajuda}
            </AjudaInfo>
          )}
        </dt>
        <dd className={cn('truncate font-mono text-xl font-semibold leading-tight tabular-nums', TEXTO_DO_TOM[it.tom ?? 'neutro'])}>
          {it.valor}
        </dd>
      </div>
    ))}
  </dl>
);

/* ── Filtro de status ────────────────────────────────────── */

export type FiltroStatus = 'all' | 'Pendente' | 'Aprovado' | 'Rejeitado';

interface FiltroSugestoesProps {
  valor: FiltroStatus;
  aoMudar: (v: FiltroStatus) => void;
  pendentes: number;
  /** Quantas sugestões a lista mostra agora */
  total: number;
  aoSincronizar: () => void;
  sincronizando: boolean;
  desabilitado?: boolean;
}

export const FiltroSugestoes = ({ valor, aoMudar, pendentes, total, aoSincronizar, sincronizando, desabilitado }: FiltroSugestoesProps) => (
  <div className="flex min-w-0 items-center gap-2">
    <p className="min-w-0 flex-1 truncate text-sm text-gray-600">
      <span className="font-mono font-semibold tabular-nums text-gray-900">{total}</span> {total === 1 ? 'sugestão' : 'sugestões'}
    </p>
    <Select value={valor} onValueChange={(v) => aoMudar(v as FiltroStatus)}>
      <SelectTrigger aria-label="Mostrar sugestões" className="h-11 w-auto min-w-[148px] rounded-full text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="Pendente">Pendentes ({pendentes})</SelectItem>
        <SelectItem value="Aprovado">Aprovadas</SelectItem>
        <SelectItem value="Rejeitado">Rejeitadas</SelectItem>
        <SelectItem value="all">Todas</SelectItem>
      </SelectContent>
    </Select>
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={aoSincronizar}
      disabled={sincronizando || desabilitado}
      aria-label={sincronizando ? 'Analisando…' : 'Sincronizar radar'}
      title="Sincronizar radar"
      className="h-11 w-11 shrink-0 rounded-full"
    >
      <RefreshCw className={cn('h-[18px] w-[18px]', sincronizando && 'animate-spin')} aria-hidden="true" />
    </Button>
  </div>
);

/* ── Cartão de sugestão ──────────────────────────────────── */

export interface ValorSugestao {
  rotulo: string;
  valor: React.ReactNode;
  tom?: Tom;
}

export interface AcaoSugestao {
  rotulo: string;
  aoTocar: () => void;
  variante?: 'principal' | 'secundaria';
}

interface CartaoSugestaoProps {
  titulo: React.ReactNode;
  /** Imóvel · datas */
  subtitulo: React.ReactNode;
  /** Etiqueta ao lado da marca IA (ex.: urgência crítica) */
  etiqueta?: React.ReactNode;
  valores: ValorSugestao[];
  /** Explicação completa (motivo, raciocínio, evidências) atrás do "i" */
  explicacao?: React.ReactNode;
  /** Ações quando pendente; sem ações, mostra o `desfecho` */
  acoes?: AcaoSugestao[];
  desfecho?: React.ReactNode;
  tomDesfecho?: Tom;
  ocupado?: boolean;
  apagado?: boolean;
}

export const CartaoSugestao = ({
  titulo,
  subtitulo,
  etiqueta,
  valores,
  explicacao,
  acoes,
  desfecho,
  tomDesfecho = 'neutro',
  ocupado,
  apagado,
}: CartaoSugestaoProps) => (
  <section className={cn('min-w-0 rounded-2xl border bg-card p-3.5 shadow-sm', apagado && 'opacity-70')}>
    <div className="flex min-w-0 items-center justify-between gap-2">
      <h3 className={cn(CLASSE_TITULO_BLOCO, 'min-w-0 truncate')}>{titulo}</h3>
      <div className="flex shrink-0 items-center gap-1.5">
        {etiqueta}
        <MarcaIA />
        {explicacao && (
          <AjudaInfo titulo="Por que esta sugestão" rotulo="Por que esta sugestão" className="-my-3 -mr-3">
            {explicacao}
          </AjudaInfo>
        )}
      </div>
    </div>
    <p className="truncate text-xs text-gray-500">{subtitulo}</p>

    <dl
      className="mt-3 grid gap-2.5 border-t border-gray-100 pt-3"
      style={{ gridTemplateColumns: `repeat(${valores.length}, minmax(0, 1fr))` }}
    >
      {valores.map((v) => (
        <div key={v.rotulo} className="min-w-0">
          <dt className="truncate text-xs text-gray-500">{v.rotulo}</dt>
          <dd className={cn('truncate font-mono text-sm font-semibold tabular-nums', TEXTO_DO_TOM[v.tom ?? 'neutro'])}>{v.valor}</dd>
        </div>
      ))}
    </dl>

    {acoes && acoes.length > 0 ? (
      <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${acoes.length}, minmax(0, 1fr))` }}>
        {acoes.map((a, i) => (
          <Button
            key={a.rotulo}
            type="button"
            variant={a.variante === 'secundaria' || i > 0 ? 'outline' : 'default'}
            onClick={a.aoTocar}
            disabled={ocupado}
            className="min-h-11 min-w-0 gap-1.5 rounded-full px-2 text-[13px] font-semibold"
          >
            {i === 0 && <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />}
            {a.rotulo === 'Rejeitar' && <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />}
            <span className="truncate">{a.rotulo}</span>
          </Button>
        ))}
      </div>
    ) : desfecho ? (
      <div className="mt-3">
        <Etiqueta tom={tomDesfecho} className="max-w-full whitespace-normal">
          {desfecho}
        </Etiqueta>
      </div>
    ) : null}
  </section>
);
