/** Feriados e eventos do período que valem para os imóveis do filtro (contas da etiqueta e da lista) */
import { Property } from '@/types/property';
import { LocalEvent } from '@/types/pricing';
import { CalendarReservation } from '@/types/calendar';
import { eventoValeParaImovel, imovelLocalizado, situacaoNoEvento, tipoDeData } from '@/components/pricing/ocupacao';

export interface FeriadoRelevante {
  ev: LocalEvent;
  imoveis: Property[];
  livres: Property[];
}

/** Eventos que valem para algum imóvel do filtro e os imóveis sem localização */
export function feriadosRelevantes(eventos: LocalEvent[], properties: Property[], reservations: CalendarReservation[]) {
  const relevantes: FeriadoRelevante[] = eventos
    .map((ev) => {
      const imoveis = properties.filter((p) => eventoValeParaImovel(ev, p));
      const livres = imoveis.filter((p) => situacaoNoEvento(reservations.filter((r) => r.property_id === p.id), ev).situacao !== 'reservado');
      return { ev, imoveis, livres };
    })
    .filter((x) => x.imoveis.length > 0);
  const semLocal = properties.filter((p) => !imovelLocalizado(p));
  const feriados = relevantes.filter((x) => tipoDeData(x.ev).startsWith('feriado')).length;
  return { relevantes, semLocal, feriados, eventos: relevantes.length - feriados };
}

/** "2 feriados e 14 eventos", "1 feriado", "3 eventos" */
export function rotuloFeriados(feriados: number, eventos: number): string {
  const f = feriados ? `${feriados} ${feriados > 1 ? 'feriados' : 'feriado'}` : '';
  const e = eventos ? `${eventos} ${eventos > 1 ? 'eventos' : 'evento'}` : '';
  return [f, e].filter(Boolean).join(' e ') || 'Feriados';
}

