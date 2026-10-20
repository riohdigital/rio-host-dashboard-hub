import React, { useMemo, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Sparkles,
  Flame,
  CheckCircle2,
  MapPin,
  Building2,
  Info
} from 'lucide-react';
import { LocalEvent } from '@/types/pricing';
import { Property } from '@/types/property';
import { formatLocalDate } from '@/utils/dateUtils';
import { ReservaParaOcupacao, cidadeDoImovel, situacaoNoEvento } from './ocupacao';

interface EventsCalendarTabProps {
  /** Eventos futuros já filtrados para as cidades dos imóveis da seleção. */
  events: LocalEvent[];
  /** Imóveis da seleção (todos, um ou um subconjunto). */
  properties: Property[];
  selectedProperty: Property | null;
  reservations: ReservaParaOcupacao[];
}

const IMPACTOS = ['Crítico', 'Alto', 'Moderado'];

export const EventsCalendarTab: React.FC<EventsCalendarTabProps> = ({
  events,
  properties,
  selectedProperty,
  reservations
}) => {
  const [filterImpact, setFilterImpact] = useState<string>('all');
  const [filterCity, setFilterCity] = useState<string>('all');

  // Cidades vêm dos próprios eventos (multi-inquilino: nada fixo no código).
  const cidades = useMemo(() => [...new Set(events.map(e => e.city).filter(Boolean))].sort(), [events]);
  const selectedCity = selectedProperty ? cidadeDoImovel(selectedProperty.address, cidades) : null;

  const filteredEvents = events.filter(e => {
    const matchesImpact = filterImpact === 'all' || e.demand_impact === filterImpact;
    const matchesCity = filterCity === 'all' || e.city === filterCity;
    return matchesImpact && matchesCity;
  });

  /** Imóveis da seleção na cidade do evento, cada um com a situação nas noites do evento. */
  const situacoes = (ev: LocalEvent) =>
    properties
      .filter(p => !ev.city || cidadeDoImovel(p.address, cidades) === ev.city)
      .map(p => ({ p, ...situacaoNoEvento(reservations.filter(r => r.property_id === p.id), ev) }));

  return (
    <div className="space-y-6">
      {/* Top Banner com Informações */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#6A6DDF]" />
              Calendário de Eventos & Demanda Local
            </h3>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold">
              Lista em revisão
            </Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            Feriados, festivais e eventos nas cidades dos seus imóveis, a partir de hoje, com a ocupação de cada imóvel nessas datas.
          </p>
        </div>
      </div>

      {/* Barra de Filtros: Cidade e Nível de Impacto */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-xs font-semibold text-gray-500 flex items-center gap-1 mr-1">
            <MapPin className="h-3.5 w-3.5 text-gray-400" /> Cidade:
          </span>
          {['all', ...cidades].map(cidade => (
            <button
              key={cidade}
              onClick={() => setFilterCity(cidade)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border whitespace-nowrap ${
                filterCity === cidade
                  ? 'bg-gray-900 text-white border-gray-900 shadow-2xs'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'
              }`}
            >
              {cidade === 'all' ? 'Todas as cidades' : cidade}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-xs font-semibold text-gray-500 flex items-center gap-1 mr-1">
            <Flame className="h-3.5 w-3.5 text-gray-400" /> Impacto:
          </span>
          {['all', ...IMPACTOS].map(impact => (
            <button
              key={impact}
              onClick={() => setFilterImpact(impact)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                filterImpact === impact
                  ? 'bg-[#6A6DDF] text-white border-[#6A6DDF]'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'
              }`}
            >
              {impact === 'all' ? 'Todos' : impact}
            </button>
          ))}
        </div>
      </div>

      {/* Indicador de Unidade Selecionada */}
      {selectedProperty && (
        <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg px-4 py-2.5 flex items-center justify-between text-xs text-indigo-900">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#6A6DDF]" />
            <span>
              Exibindo eventos com impacto no imóvel: <strong>{selectedProperty.nickname || selectedProperty.name}</strong>
              {selectedCity ? ` (${selectedCity})` : ' (cidade não identificada no endereço)'}
            </span>
          </div>
          {filterCity !== 'all' && (
            <button onClick={() => setFilterCity('all')} className="text-[#6A6DDF] hover:underline font-semibold">
              Ver todas as cidades
            </button>
          )}
        </div>
      )}

      {/* Grid de Eventos */}
      {filteredEvents.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-xl border p-8 space-y-3">
          <Calendar className="h-10 w-10 text-gray-400 mx-auto" />
          <h4 className="font-bold text-gray-800 text-base">Nenhum evento nas cidades dos imóveis com estes filtros</h4>
          <p className="text-xs text-gray-500 max-w-md mx-auto flex items-start gap-1.5 justify-center">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            A cidade de cada imóvel é lida do endereço cadastrado em Propriedades.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map(ev => {
            const isCritical = ev.demand_impact === 'Crítico';
            const isHigh = ev.demand_impact === 'Alto';
            const imoveis = situacoes(ev);

            return (
              <Card
                key={ev.id}
                className={`transition-shadow hover:shadow-md border-l-4 ${
                  isCritical ? 'border-l-red-500' : isHigh ? 'border-l-purple-500' : 'border-l-blue-500'
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-semibold text-gray-400 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {ev.city} {ev.neighborhood ? `• ${ev.neighborhood}` : ''}
                      </span>
                      <h4 className="font-bold text-gray-900 text-sm mt-0.5">{ev.name}</h4>
                      {ev.category && (
                        <span className="inline-block text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded mt-1">
                          {ev.category}
                        </span>
                      )}
                    </div>

                    {ev.demand_impact && (
                      <Badge
                        className={`text-[10px] font-bold shrink-0 ${
                          isCritical
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : isHigh
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                        variant="outline"
                      >
                        Impacto {ev.demand_impact}
                      </Badge>
                    )}
                  </div>

                  {/* Datas do Evento e Multiplicador de Diária */}
                  <div className="bg-gray-50 p-2.5 rounded-lg border text-xs text-gray-600 flex items-center justify-between">
                    <div>
                      <span className="text-gray-400 text-[10px] block">Período</span>
                      <span className="font-medium text-gray-800">
                        {formatLocalDate(ev.start_date)} a {formatLocalDate(ev.end_date)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-400 text-[10px] block">Multiplicador do evento</span>
                      <span className="font-bold text-[#6A6DDF]">
                        {ev.recommended_price_multiplier ? `${ev.recommended_price_multiplier}x base` : 'Não informado'}
                      </span>
                    </div>
                  </div>

                  {ev.notes && (
                    <div className="bg-amber-50/60 border border-amber-200/60 rounded-lg p-2.5 text-[11px] text-amber-900 leading-relaxed">
                      <span className="font-semibold text-amber-950 mb-0.5 flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-amber-600" />
                        Observações do evento:
                      </span>
                      {ev.notes}
                    </div>
                  )}

                  {/* Recomendações e Ocupação por Imóvel */}
                  <div className="space-y-1.5 text-xs pt-1">
                    <div className="flex items-center justify-between text-gray-500">
                      <span className="text-[11px]">Estadia mínima do evento:</span>
                      <span className="font-semibold text-gray-700">
                        {ev.recommended_min_nights ? `${ev.recommended_min_nights} noites` : 'Não informada'}
                      </span>
                    </div>

                    {imoveis.map(({ p, situacao, noitesLivres, noitesDoEvento }) => (
                      <div key={p.id} className="flex items-center justify-between pt-1 border-t border-gray-100 gap-2">
                        <span className="text-[11px] text-gray-500 truncate">{p.nickname || p.name}</span>
                        {situacao === 'reservado' ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px] shrink-0">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Reservado
                          </span>
                        ) : situacao === 'parcial' ? (
                          <span className="text-amber-600 font-bold flex items-center gap-1 text-[11px] shrink-0">
                            <Flame className="h-3.5 w-3.5" /> {noitesLivres} de {noitesDoEvento} noites livres
                          </span>
                        ) : (
                          <span className="text-amber-600 font-bold flex items-center gap-1 text-[11px] shrink-0">
                            <Flame className="h-3.5 w-3.5" /> Disponível (Yield)
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EventsCalendarTab;
