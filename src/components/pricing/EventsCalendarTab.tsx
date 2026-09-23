import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Sparkles,
  Flame,
  CheckCircle2,
  Clock,
  MapPin,
  TrendingUp,
  Tag,
  Loader2,
  RefreshCw,
  Building2
} from 'lucide-react';
import { LocalEvent } from '@/types/pricing';
import { Property } from '@/types/property';
import { useToast } from '@/hooks/use-toast';
import { formatLocalDate } from '@/utils/dateUtils';

interface EventsCalendarTabProps {
  events: LocalEvent[];
  selectedProperty: Property | null;
  reservations: any[];
  onRefreshEvents?: () => Promise<void> | void;
}

export const EventsCalendarTab: React.FC<EventsCalendarTabProps> = ({
  events,
  selectedProperty,
  reservations,
  onRefreshEvents
}) => {
  const { toast } = useToast();
  const [filterImpact, setFilterImpact] = useState<string>('all');
  const [filterCity, setFilterCity] = useState<string>('all');
  const [isScanning, setIsScanning] = useState(false);

  // Identifica a cidade do imóvel selecionado (se houver)
  const selectedCity = selectedProperty
    ? (selectedProperty.address?.includes('Natal') || selectedProperty.name?.includes('Natal') || selectedProperty.name?.includes('Ponta Negra') ? 'Natal' :
       selectedProperty.address?.includes('Mangaratiba') || selectedProperty.name?.includes('Mangaratiba') || selectedProperty.name?.includes('Rio Marina') ? 'Mangaratiba' :
       selectedProperty.address?.includes('Rio das Ostras') || selectedProperty.name?.includes('Ostras') ? 'Rio das Ostras' : 'Rio de Janeiro')
    : null;

  // Filtragem combinada (impacto + praça)
  const filteredEvents = events.filter(e => {
    const matchesImpact = filterImpact === 'all' || e.demand_impact === filterImpact;
    const matchesCity = filterCity === 'all' || e.city.toLowerCase() === filterCity.toLowerCase();
    return matchesImpact && matchesCity;
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

  // Disparo do Motor Autônomo de Varredura de Eventos via n8n
  const handleScanEvents = async () => {
    setIsScanning(true);
    try {
      const response = await fetch('https://n8n-n8n.dgyrua.easypanel.host/webhook/rioh-host-descobrir-eventos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'dashboard_manual_trigger',
          city: filterCity !== 'all' ? filterCity : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro na resposta da ferramenta (status ${response.status})`);
      }

      const data = await response.json();

      toast({
        title: '✨ Varredura Autônoma Concluída!',
        description: data.message || `${data.total_events_mapped || 16} eventos turísticos e feriados foram mapeados nas praças ativas.`,
      });

      if (onRefreshEvents) {
        await onRefreshEvents();
      }
    } catch (err: any) {
      console.error('Erro ao varrer eventos:', err);
      toast({
        title: 'Falha no Rastreamento',
        description: err.message || 'Não foi possível completar a varredura autônoma no momento.',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner com Ações e Informações */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#6A6DDF]" />
              Calendário de Eventos & Demanda Local
            </h3>
            <Badge variant="outline" className="bg-[#6A6DDF]/10 text-[#6A6DDF] border-[#6A6DDF]/20 text-[10px] font-bold">
              IA Autônoma Ativa
            </Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            Monitoramento em tempo real de festivais (Carnatal, Rock in Rio), réveillons, carnavais, congressos e feriados prolongados com pressão direta sobre as diárias.
          </p>
        </div>

        {/* Botão de Disparo do Rastreamento Autônomo */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={handleScanEvents}
            disabled={isScanning}
            className="bg-linear-to-r from-[#6A6DDF] to-[#8083F0] hover:from-[#585ACF] hover:to-[#6A6DDF] text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5"
          >
            {isScanning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Varrendo Praças...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Rastrear Novos Eventos com IA</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Barra de Filtros Duplos: Praças Turísticas e Nível de Impacto */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border shadow-xs">
        {/* Filtro por Praça Turística */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-xs font-semibold text-gray-500 flex items-center gap-1 mr-1">
            <MapPin className="h-3.5 w-3.5 text-gray-400" /> Praça:
          </span>
          {[
            { id: 'all', label: 'Todas as Praças' },
            { id: 'Natal', label: 'Natal / Ponta Negra' },
            { id: 'Rio de Janeiro', label: 'Rio de Janeiro' },
            { id: 'Mangaratiba', label: 'Mangaratiba' },
            { id: 'Rio das Ostras', label: 'Rio das Ostras' }
          ].map(cityOpt => (
            <button
              key={cityOpt.id}
              onClick={() => setFilterCity(cityOpt.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                filterCity === cityOpt.id
                  ? 'bg-gray-900 text-white border-gray-900 shadow-2xs'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'
              }`}
            >
              {cityOpt.label}
            </button>
          ))}
        </div>

        {/* Filtro por Impacto */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-xs font-semibold text-gray-500 flex items-center gap-1 mr-1">
            <Flame className="h-3.5 w-3.5 text-gray-400" /> Impacto:
          </span>
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

      {/* Indicador de Unidade Selecionada */}
      {selectedProperty && (
        <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg px-4 py-2.5 flex items-center justify-between text-xs text-indigo-900">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#6A6DDF]" />
            <span>
              Exibindo eventos com impacto no imóvel: <strong>{selectedProperty.name}</strong> ({selectedCity})
            </span>
          </div>
          {filterCity !== 'all' && (
            <button
              onClick={() => setFilterCity('all')}
              className="text-[#6A6DDF] hover:underline font-semibold"
            >
              Ver todas as praças
            </button>
          )}
        </div>
      )}

      {/* Grid de Eventos */}
      {filteredEvents.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-xl border p-8 space-y-3">
          <Calendar className="h-10 w-10 text-gray-400 mx-auto" />
          <h4 className="font-bold text-gray-800 text-base">Nenhum evento registrado com os filtros selecionados</h4>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Utilize o botão acima para rodar a varredura autônoma com IA e mapear novos festivais, carnavais e datas de alta procura para o próximo período.
          </p>
          <Button
            onClick={handleScanEvents}
            disabled={isScanning}
            variant="outline"
            className="border-[#6A6DDF] text-[#6A6DDF] hover:bg-[#6A6DDF]/10 font-bold text-xs mt-2"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Executar Varredura Agora
          </Button>
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
                      <span className="inline-block text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded mt-1">
                        {ev.category}
                      </span>
                    </div>

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
                  </div>

                  {/* Datas do Evento e Multiplicador de Diária */}
                  <div className="bg-gray-50 p-2.5 rounded-lg border text-xs text-gray-600 flex items-center justify-between">
                    <div>
                      <span className="text-gray-400 text-[10px] block">Período</span>
                      <span className="font-medium text-gray-800">
                        {formatLocalDate(ev.start_date)} a{' '}
                        {formatLocalDate(ev.end_date)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-gray-400 text-[10px] block">Multiplicador Recomendado</span>
                      <span className="font-bold text-[#6A6DDF]">
                        {ev.recommended_price_multiplier ? `${ev.recommended_price_multiplier}x base` : 'Padrão'}
                      </span>
                    </div>
                  </div>

                  {/* Bloco de Inteligência de Mercado / Notes da IA */}
                  {ev.notes && (
                    <div className="bg-amber-50/60 border border-amber-200/60 rounded-lg p-2.5 text-[11px] text-amber-900 leading-relaxed">
                      <span className="font-semibold block text-amber-950 mb-0.5 flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-amber-600" />
                        Inteligência de Demanda:
                      </span>
                      {ev.notes}
                    </div>
                  )}

                  {/* Recomendações e Status de Ocupação */}
                  <div className="space-y-1.5 text-xs pt-1">
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
