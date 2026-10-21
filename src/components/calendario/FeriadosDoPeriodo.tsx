import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarHeart, Flame, CheckCircle2, ArrowRight } from 'lucide-react';
import { Property } from '@/types/property';
import { LocalEvent } from '@/types/pricing';
import { CalendarReservation } from '@/types/calendar';
import { formatLocalDate } from '@/utils/dateUtils';
import { escopoDoEvento, eventoValeParaImovel, hojeLocal, imovelLocalizado, situacaoNoEvento } from '@/components/pricing/ocupacao';

interface Props {
  eventos: LocalEvent[];
  properties: Property[];
  reservations: CalendarReservation[];
}

/**
 * Feriados e eventos do período onde os imóveis estão, com quantos ainda estão livres. Livre em
 * data de alta demanda é oportunidade: o atalho leva às sugestões de preço da Precificação.
 */
export const FeriadosDoPeriodo: React.FC<Props> = ({ eventos, properties, reservations }) => {
  const relevantes = eventos
    .map(ev => {
      const imoveis = properties.filter(p => eventoValeParaImovel(ev, p));
      const livres = imoveis.filter(p => situacaoNoEvento(reservations.filter(r => r.property_id === p.id), ev).situacao !== 'reservado');
      return { ev, imoveis, livres };
    })
    .filter(x => x.imoveis.length > 0);

  const semLocal = properties.filter(p => !imovelLocalizado(p));
  const hoje = hojeLocal();
  if (!relevantes.length && !semLocal.length) return null;

  return (
    <div className="rounded-lg border bg-card px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold flex items-center gap-1.5">
          <CalendarHeart className="h-4 w-4 text-amber-500" /> Feriados e eventos no período
        </span>
        <Link to="/precificacao" className="text-xs font-semibold text-[#6A6DDF] hover:underline flex items-center gap-1">
          Ver oportunidades de preço <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {relevantes.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum feriado ou evento confirmado onde os imóveis estão, neste período.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {relevantes.map(({ ev, imoveis, livres }) => (
            <div key={ev.id} className="rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs">
              <div className="font-semibold text-foreground">{ev.name}</div>
              <div className="text-muted-foreground">
                {formatLocalDate(ev.start_date)} a {formatLocalDate(ev.end_date)} • {escopoDoEvento(ev)}
              </div>
              {ev.end_date <= hoje ? (
                // Já passou: livre não é mais oportunidade, só registro de ocupação.
                <div className="text-muted-foreground">
                  {imoveis.length - livres.length} de {imoveis.length} {imoveis.length > 1 ? 'imóveis reservados' : 'imóvel reservado'}
                </div>
              ) : livres.length === 0 ? (
                <div className="text-emerald-700 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> {imoveis.length > 1 ? 'Todos reservados' : 'Reservado'}
                </div>
              ) : (
                <div className="text-amber-700 font-medium flex items-center gap-1">
                  <Flame className="h-3 w-3" />
                  {imoveis.length > 1 ? `Livre em ${livres.length} de ${imoveis.length} imóveis` : 'Livre'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {semLocal.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Sem localização conferida (feriados não aparecem): {semLocal.map(p => p.nickname || p.name).join(', ')}. Ative a
          precificação automática ou corrija o endereço em Propriedades.
        </p>
      )}
    </div>
  );
};
