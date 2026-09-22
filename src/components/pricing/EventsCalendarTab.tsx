import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Sparkles,
  Flame,
  CheckCircle2,
  Clock,
  MapPin,
  TrendingUp,
  Tag
} from 'lucide-react';
import { LocalEvent } from '@/types/pricing';
import { Property } from '@/types/property';

interface EventsCalendarTabProps {
  events: LocalEvent[];
  selectedProperty: Property | null;
  reservations: any[];
}

export const EventsCalendarTab: React.FC<EventsCalendarTabProps> = ({
  events,
  selectedProperty,
  reservations
}) => {
  const [filterImpact, setFilterImpact] = useState<string>('all');

  const filteredEvents = events.filter(e => {
    if (filterImpact === 'all') return true;
    return e.demand_impact === filterImpact;
  });

  const isBooked = (event: LocalEvent) => {
    if (!selectedProperty) return false;
    const evStart = new Date(event.start_date);
    const evEnd = new Date(event.end_date);

    return reservations.some(res => {
      if (res.property_id !== selectedProperty.id) return false;
      const resStart = new Date(res.check_in_date);
      const resEnd = new Date(res.check_out_date);
      return resStart < evEnd && resEnd > evStart;
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner com Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border shadow-xs">
        <div>
          <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#6A6DDF]" />
            Calendário de Eventos & Demanda Local
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Datas comemorativas, festivais, shows e feriados prolongados que influenciam a curva de ocupação
          </p>
        </div>

        {/* Filtro por Impacto */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['all', 'Crítico', 'Alto', 'Moderado'].map(impact => (
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

      {/* Grid de Eventos */}
      {filteredEvents.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-xl border p-8 space-y-2">
          <Calendar className="h-10 w-10 text-gray-400 mx-auto" />
          <h4 className="font-bold text-gray-800 text-base">Nenhum evento encontrado</h4>
          <p className="text-xs text-gray-500">Nenhum evento registrado com o filtro selecionado para os próximos 120 dias.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map(ev => {
            const booked = isBooked(ev);
            const isCritical = ev.demand_impact === 'Crítico';
            const isHigh = ev.demand_impact === 'Alto';

            return (
              <Card
                key={ev.id}
                className={`transition-shadow hover:shadow-md border-l-4 ${
                  isCritical
                    ? 'border-l-red-500'
                    : isHigh
                    ? 'border-l-purple-500'
                    : 'border-l-blue-500'
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
                    </div>

                    <Badge
                      className={`text-[10px] font-bold ${
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
                  </div>

                  {/* Datas do Evento */}
                  <div className="bg-gray-50 p-2.5 rounded-lg border text-xs text-gray-600 flex items-center justify-between">
                    <div>
                      <span className="text-gray-400 text-[10px] block">Período</span>
                      <span className="font-medium text-gray-800">
                        {new Date(ev.start_date).toLocaleDateString('pt-BR')} a{' '}
                        {new Date(ev.end_date).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-gray-400 text-[10px] block">Multiplicador</span>
                      <span className="font-bold text-[#6A6DDF]">
                        {ev.recommended_price_multiplier ? `${ev.recommended_price_multiplier}x base` : 'Padrão'}
                      </span>
                    </div>
                  </div>

                  {/* Recomendações e Status */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-gray-500">
                      <span className="text-[11px]">Estadia Mínima Recomendada:</span>
                      <span className="font-semibold text-gray-700">
                        {ev.recommended_min_nights || 1} noites
                      </span>
                    </div>

                    {selectedProperty && (
                      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                        <span className="text-[11px] text-gray-400">Ocupação no seu imóvel:</span>
                        {booked ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Confirmado
                          </span>
                        ) : (
                          <span className="text-amber-600 font-bold flex items-center gap-1 text-[11px]">
                            <Flame className="h-3.5 w-3.5" /> Disponível (Yield)
                          </span>
                        )}
                      </div>
                    )}
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
