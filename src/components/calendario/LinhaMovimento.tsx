/**
 * LinhaMovimento — uma entrada, saída ou hospedagem num dia do Calendário
 * (lista do dia na visão Mês e a Agenda). Toque abre a folha da reserva.
 * Na saída, a etiqueta diz quem faz a faxina (ou avisa que falta faxineira).
 */
import React from 'react';
import { ArrowDownLeft, ArrowUpRight, BedDouble } from 'lucide-react';
import LinhaLista from '@/components/comum/LinhaLista';
import { Etiqueta, EtiquetaPlataforma } from '@/components/comum/Etiquetas';
import { nomeCurtoFaxineira } from '@/hooks/useFaxineirasDosImoveis';
import { CalendarReservation } from '@/types/calendar';
import { hora, rotuloDia } from './periodo';

export type TipoMovimento = 'entrada' | 'saida' | 'hospedado';

/** Quem faz a faxina da saída; "Sem faxineira" só para saídas de hoje em diante */
export const EtiquetaFaxina = ({
  reserva,
  faxineiras,
  hoje,
}: {
  reserva: CalendarReservation;
  faxineiras?: Map<string, string>;
  hoje: string;
}) => {
  if (reserva.cleaner_user_id) {
    const nome = faxineiras?.get(reserva.cleaner_user_id);
    return <Etiqueta tom="success">{nome ? nomeCurtoFaxineira(nome) : 'Faxineira'}</Etiqueta>;
  }
  const destino = (reserva.cleaning_allocation || '').toLowerCase();
  if (destino === 'co_anfitriao') return <Etiqueta tom="neutro">Anfitrião</Etiqueta>;
  if (destino === 'proprietario' || destino === 'proprietário') return <Etiqueta tom="neutro">Proprietário</Etiqueta>;
  if (reserva.check_out_date.slice(0, 10) >= hoje) return <Etiqueta tom="danger">Sem faxineira</Etiqueta>;
  return null;
};

interface Props {
  tipo: TipoMovimento;
  reserva: CalendarReservation;
  nomeImovel: string;
  faxineiras?: Map<string, string>;
  hoje: string;
  /** Mostra o canal na entrada (lista do dia) */
  mostrarCanal?: boolean;
  aoTocar: (r: CalendarReservation) => void;
}

const LinhaMovimento = ({ tipo, reserva: r, nomeImovel, faxineiras, hoje, mostrarCanal, aoTocar }: Props) => {
  const h = tipo === 'entrada' ? hora(r.checkin_time) : tipo === 'saida' ? hora(r.checkout_time) : '';
  const subtitulo =
    tipo === 'entrada'
      ? `Entrada${h ? ` ${h}` : ''} · ${nomeImovel}`
      : tipo === 'saida'
        ? `Saída${h ? ` ${h}` : ''} · ${nomeImovel}`
        : `Hospedado · ${nomeImovel} · até ${rotuloDia(r.check_out_date)}`;

  let etiqueta: React.ReactNode = null;
  if (tipo === 'saida') etiqueta = <EtiquetaFaxina reserva={r} faxineiras={faxineiras} hoje={hoje} />;
  else if (tipo === 'entrada' && mostrarCanal) etiqueta = <EtiquetaPlataforma plataforma={r.platform} />;

  return (
    <LinhaLista
      icone={tipo === 'entrada' ? ArrowDownLeft : tipo === 'saida' ? ArrowUpRight : BedDouble}
      tomIcone={tipo === 'entrada' ? 'success' : tipo === 'saida' ? 'warning' : 'brand'}
      titulo={r.guest_name || 'Hóspede não informado'}
      subtitulo={subtitulo}
      etiqueta={etiqueta || undefined}
      aoTocar={() => aoTocar(r)}
    />
  );
};

export default LinhaMovimento;
