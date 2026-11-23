/**
 * Topo do Calendário: as estatísticas viram uma linha (ocupação · receita ·
 * reservas do período) que abre os detalhes por imóvel ao tocar, e os
 * feriados viram uma etiqueta ("N feriados no período") que abre a lista.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarHeart, ChevronRight } from 'lucide-react';
import FolhaDetalhes from '@/components/comum/FolhaDetalhes';
import LinhaLista from '@/components/comum/LinhaLista';
import { ListaLinhas } from '@/components/comum/GrupoLista';
import { formatarMoedaCurta, formatarMoedaSemCentavos } from '@/components/comum/formatos';
import { Button } from '@/components/ui/button';
import { OccupancyStats } from '@/hooks/useOccupancyStats';
import { Property } from '@/types/property';
import { FeriadosDoPeriodo } from './FeriadosDoPeriodo';
import { FeriadoRelevante, rotuloFeriados } from './feriados';

interface Props {
  stats: OccupancyStats[];
  /** "1 de janeiro a 31 de dezembro de 2026" */
  rotuloPeriodo: string;
  feriados: { relevantes: FeriadoRelevante[]; semLocal: Property[]; feriados: number; eventos: number };
}

const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

const ResumoDoPeriodo = ({ stats, rotuloPeriodo, feriados }: Props) => {
  const [statsAberto, setStatsAberto] = useState(false);
  const [feriadosAberto, setFeriadosAberto] = useState(false);

  const receita = stats.reduce((s, x) => s + x.totalRevenue, 0);
  const ocupacao = stats.length ? stats.reduce((s, x) => s + x.occupancyRate, 0) / stats.length : 0;
  const reservas = stats.reduce((s, x) => s + x.reservationCount, 0);
  const temFeriados = feriados.relevantes.length > 0 || feriados.semLocal.length > 0;
  const textoFeriados = feriados.relevantes.length ? rotuloFeriados(feriados.feriados, feriados.eventos) : 'Feriados';
  // Na etiqueta, feriados numa linha e eventos na outra
  const linhasFeriados = textoFeriados.split(' e ');

  return (
    <>
      <div className="flex min-w-0 items-stretch gap-2">
        <button
          type="button"
          onClick={() => setStatsAberto(true)}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl border bg-card px-3.5 py-2 text-left text-[13px] text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-label={`Ocupação ${pct(ocupacao)}, receita ${formatarMoedaSemCentavos(receita)}, ${reservas} reservas no período. Ver detalhes por imóvel`}
        >
          {/* Celular: ocupação numa linha, receita e reservas na outra; computador: tudo numa linha */}
          <span className="min-w-0 flex-1 leading-snug">
            <span className="block lg:inline">
              <b className="font-mono font-semibold tabular-nums text-gray-900">{Math.round(ocupacao)}%</b> ocupado
            </span>
            <span className="hidden lg:inline"> · </span>
            <b className="whitespace-nowrap font-mono font-semibold tabular-nums text-gray-900">{formatarMoedaCurta(receita)}</b> ·{' '}
            <span className="whitespace-nowrap">
              <b className="font-mono font-semibold tabular-nums text-gray-900">{reservas}</b> {reservas === 1 ? 'reserva' : 'reservas'}
            </span>
          </span>
          <ChevronRight className="h-[18px] w-[18px] shrink-0 text-gray-400" aria-hidden="true" />
        </button>
        {temFeriados && (
          <button
            type="button"
            onClick={() => setFeriadosAberto(true)}
            className="flex min-h-11 max-w-[36%] shrink-0 items-center gap-1.5 rounded-2xl border border-warning-200 bg-warning-50 px-3 text-left text-xs font-semibold leading-tight text-warning-800 transition-colors hover:bg-warning-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-label={`${textoFeriados} no período: ver a lista`}
          >
            <CalendarHeart className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="grid">
              {linhasFeriados.map((l) => (
                <span key={l} className="whitespace-nowrap">
                  {l}
                </span>
              ))}
            </span>
          </button>
        )}
      </div>

      <FolhaDetalhes aberta={statsAberto} aoMudar={setStatsAberto} titulo="Ocupação do período" subtitulo={rotuloPeriodo} largura="lg">
        <dl className="grid grid-cols-3 gap-2">
          {[
            ['Ocupação', pct(ocupacao)],
            ['Receita', formatarMoedaSemCentavos(receita)],
            ['Reservas', String(reservas)],
          ].map(([r, v]) => (
            <div key={r} className="min-w-0 rounded-xl bg-gray-50 p-2.5">
              <dt className="text-xs text-gray-500">{r}</dt>
              <dd className="truncate font-mono text-sm font-semibold tabular-nums text-gray-900">{v}</dd>
            </div>
          ))}
        </dl>
        <ListaLinhas className="min-w-0">
          {[...stats]
            .sort((a, b) => b.occupancyRate - a.occupancyRate)
            .map((s) => (
              <LinhaLista
                key={s.propertyId}
                titulo={s.propertyName}
                subtitulo={`${pct(s.occupancyRate)} · ${s.occupiedDays} de ${s.totalDays} dias · ${s.reservationCount} ${s.reservationCount === 1 ? 'reserva' : 'reservas'}`}
                valor={formatarMoedaSemCentavos(s.totalRevenue)}
                legenda={`diária ${formatarMoedaSemCentavos(s.averageDailyRate)}`}
              />
            ))}
        </ListaLinhas>
      </FolhaDetalhes>

      <FolhaDetalhes
        aberta={feriadosAberto}
        aoMudar={setFeriadosAberto}
        titulo="Feriados e eventos"
        subtitulo={rotuloPeriodo}
        largura="lg"
        acoes={
          <Button asChild variant="outline">
            <Link to="/precificacao">Ver oportunidades de preço</Link>
          </Button>
        }
      >
        <FeriadosDoPeriodo relevantes={feriados.relevantes} semLocal={feriados.semLocal} />
      </FolhaDetalhes>
    </>
  );
};

export default ResumoDoPeriodo;
