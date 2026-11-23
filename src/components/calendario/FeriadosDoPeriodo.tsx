/**
 * Feriados e eventos do período onde os imóveis estão, com quantos ainda estão
 * livres. Livre em data de alta demanda é oportunidade: o atalho leva às
 * sugestões de preço da Precificação. Abre na folha da etiqueta
 * "N feriados no período" do topo do Calendário; o aviso dos imóveis sem
 * localização fica aqui dentro.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarHeart } from 'lucide-react';
import LinhaLista from '@/components/comum/LinhaLista';
import { ListaLinhas } from '@/components/comum/GrupoLista';
import { Etiqueta } from '@/components/comum/Etiquetas';
import { Property } from '@/types/property';
import { formatLocalDate } from '@/utils/dateUtils';
import { escopoDoEvento, hojeLocal } from '@/components/pricing/ocupacao';
import { FeriadoRelevante } from './feriados';

interface Props {
  relevantes: FeriadoRelevante[];
  semLocal: Property[];
}

export const FeriadosDoPeriodo: React.FC<Props> = ({ relevantes, semLocal }) => {
  const hoje = hojeLocal();
  return (
    <div className="grid min-w-0 gap-3">
      {relevantes.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum feriado ou evento confirmado onde os imóveis estão, neste período.</p>
      ) : (
        <ListaLinhas className="min-w-0">
          {relevantes.map(({ ev, imoveis, livres }) => {
            let etiqueta: React.ReactNode;
            if (ev.end_date <= hoje) {
              // Já passou: livre não é mais oportunidade, só registro de ocupação.
              etiqueta = (
                <Etiqueta tom="neutro">
                  {imoveis.length - livres.length} de {imoveis.length} reservados
                </Etiqueta>
              );
            } else if (livres.length === 0) {
              etiqueta = <Etiqueta tom="success">{imoveis.length > 1 ? 'Todos reservados' : 'Reservado'}</Etiqueta>;
            } else {
              etiqueta = <Etiqueta tom="warning">{imoveis.length > 1 ? `Livre em ${livres.length} de ${imoveis.length}` : 'Livre'}</Etiqueta>;
            }
            return (
              <LinhaLista
                key={ev.id}
                icone={CalendarHeart}
                tomIcone="warning"
                titulo={ev.name}
                subtitulo={`${formatLocalDate(ev.start_date)} a ${formatLocalDate(ev.end_date)} · ${escopoDoEvento(ev)}`}
                etiqueta={etiqueta}
              />
            );
          })}
        </ListaLinhas>
      )}
      {semLocal.length > 0 && (
        <p className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
          Sem localização conferida (feriados não aparecem): {semLocal.map((p) => p.nickname || p.name).join(', ')}. Ative a precificação automática ou
          corrija o endereço em <Link to="/propriedades" className="font-semibold text-brand-700 underline-offset-2 hover:underline">Propriedades</Link>.
        </p>
      )}
    </div>
  );
};
