/**
 * Um dia na grade do Mês no computador: número, ocupação ("5/7"), pontos de
 * entrada (verde) e saída (laranja) e até 3 reservas do dia. Dia fora do
 * período fica apagado e sem toque. Clicar no dia abre a lista do dia abaixo
 * do mês; clicar numa reserva abre a reserva.
 */
import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { corDoCanal } from '@/components/comum/cores';
import { cn } from '@/lib/utils';
import { CalendarReservation } from '@/types/calendar';
import { nomeDoImovel, primeiroNome, rotuloDia } from './periodo';

interface DayCellProps {
  /** 'AAAA-MM-DD' */
  dia: string;
  /** Reservas com noite neste dia */
  reservations: CalendarReservation[];
  nomesImoveis: Map<string, string>;
  foraDoPeriodo?: boolean;
  hoje?: boolean;
  selecionado?: boolean;
  /** "5/7" */
  ocupacao?: string;
  entradas?: number;
  saidas?: number;
  onReservationClick: (reservation: CalendarReservation) => void;
  onDayClick?: () => void;
}

const ItemReserva = ({ r, nomesImoveis, onClick }: { r: CalendarReservation; nomesImoveis: Map<string, string>; onClick: () => void }) => (
  <button
    type="button"
    title={`${r.guest_name || 'Sem nome'} · ${nomeDoImovel(r, nomesImoveis)} · ${r.platform}`}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className="flex w-full min-w-0 items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-left text-xs text-gray-800 transition-colors hover:bg-gray-200"
  >
    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', corDoCanal(r.platform).ponto)} aria-hidden="true" />
    <span className="truncate font-medium">{nomeDoImovel(r, nomesImoveis)}</span>
    <span className="hidden truncate text-gray-500 2xl:inline">· {primeiroNome(r.guest_name)}</span>
  </button>
);

export const DayCell: React.FC<DayCellProps> = ({
  dia,
  reservations,
  nomesImoveis,
  foraDoPeriodo,
  hoje,
  selecionado,
  ocupacao,
  entradas = 0,
  saidas = 0,
  onReservationClick,
  onDayClick,
}) => {
  const maxVisible = 3;
  const visiveis = reservations.slice(0, maxVisible);
  const escondidas = reservations.slice(maxVisible);

  return (
    <div
      role={onDayClick ? 'button' : undefined}
      tabIndex={onDayClick ? 0 : undefined}
      aria-pressed={onDayClick ? !!selecionado : undefined}
      aria-label={onDayClick ? `${rotuloDia(dia, true)}${ocupacao ? `, ${ocupacao} ocupados` : ''}` : undefined}
      onClick={onDayClick}
      onKeyDown={(e) => {
        if (onDayClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onDayClick();
        }
      }}
      className={cn(
        'relative min-h-[112px] min-w-0 overflow-hidden p-2 transition-colors',
        foraDoPeriodo ? 'bg-gray-50/60 opacity-40' : 'cursor-pointer hover:bg-brand-50/60',
        hoje && 'bg-brand-50/50',
        selecionado && 'outline outline-2 -outline-offset-2 outline-gray-900',
        'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand',
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-1">
        <span
          className={cn(
            'inline-flex h-6 min-w-6 items-center justify-center rounded-full text-sm font-medium',
            hoje && 'bg-brand-accent px-1.5 text-white',
          )}
        >
          {Number(dia.slice(8, 10))}
        </span>
        <span className="flex items-center gap-1">
          {entradas > 0 && <span className="h-1.5 w-1.5 rounded-full bg-success-500" title="Entrada" />}
          {saidas > 0 && <span className="h-1.5 w-1.5 rounded-full bg-warning-500" title="Saída" />}
          {ocupacao && <span className="font-mono text-[11px] tabular-nums text-gray-500">{ocupacao}</span>}
        </span>
      </div>

      <div className="space-y-1">
        {visiveis.map((r) => (
          <ItemReserva key={r.id} r={r} nomesImoveis={nomesImoveis} onClick={() => onReservationClick(r)} />
        ))}

        {escondidas.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="w-full px-1.5 py-0.5 text-left text-xs text-gray-500 transition-colors hover:text-gray-900"
                onClick={(e) => e.stopPropagation()}
              >
                +{escondidas.length} mais
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
              <div className="space-y-1">
                {escondidas.map((r) => (
                  <ItemReserva key={r.id} r={r} nomesImoveis={nomesImoveis} onClick={() => onReservationClick(r)} />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
};
