import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
  DollarSign,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  RefreshCw,
  ArrowRight,
  Flame,
  Info,
  ShieldCheck,
  Zap,
  Filter,
  Layers,
  Building2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PricingAlert, LocalEvent, PropertyPricingKPIs } from '@/types/pricing';
import { Property } from '@/types/property';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CompetitorsRadarTab from './CompetitorsRadarTab';
import EventsCalendarTab from './EventsCalendarTab';
import ReservationsAuditTab from './ReservationsAuditTab';
import { formatLocalDate } from '@/utils/dateUtils';

interface PropertyPricingDashboardProps {
  propertyId: string;
  selectedPropertyIds?: string[];
  properties: Property[];
  dateRange?: {
    startDate?: Date;
    endDate?: Date;
    startDateString: string;
    endDateString: string;
    selectedPeriod: string;
  };
  onRefresh?: () => void;
}

export const PropertyPricingDashboard: React.FC<PropertyPricingDashboardProps> = ({
  propertyId,
  selectedPropertyIds,
  properties,
  dateRange,
  onRefresh
}) => {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<PricingAlert[]>([]);
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pendente' | 'Aprovado' | 'Rejeitado'>('Pendente');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const [isRadarRunning, setIsRadarRunning] = useState(false);

  // Property selecionada
  const selectedProperty = useMemo(() => {
    if (propertyId === 'todas') return null;
    return properties.find(p => p.id === propertyId) || null;
  }, [propertyId, properties]);

  const isRadarActiveForProperty = selectedProperty ? selectedProperty.status === 'Ativo' : true;

  // Busca dados do Supabase
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Alertas de precificação
      let alertsQuery = supabase
        .from('pricing_alerts')
        .select('*, properties:property_id (id, name, nickname)')
        .order('created_at', { ascending: false });

      if (propertyId !== 'todas') {
        alertsQuery = alertsQuery.eq('property_id', propertyId);
      } else if (selectedPropertyIds && selectedPropertyIds.length > 0 && !selectedPropertyIds.includes('todas')) {
        alertsQuery = alertsQuery.in('property_id', selectedPropertyIds);
      }

      // Aplica filtro de período se não for "Geral"
      if (dateRange && dateRange.selectedPeriod !== 'general' && dateRange.startDateString && dateRange.endDateString) {
        alertsQuery = alertsQuery
          .lte('target_start_date', dateRange.endDateString)
          .gte('target_end_date', dateRange.startDateString);
      }

      const { data: alertsData, error: alertsError } = await alertsQuery;
      if (alertsError) {
        console.error('Erro ao buscar pricing_alerts:', alertsError);
      } else {
        setAlerts((alertsData as any[]) || []);
      }

      // 2. Eventos locais vinculados ao período
      let eventsQuery = supabase
        .from('local_events')
        .select('*')
        .order('start_date', { ascending: true });

      if (dateRange && dateRange.selectedPeriod !== 'general' && dateRange.startDateString && dateRange.endDateString) {
        eventsQuery = eventsQuery
          .gte('end_date', dateRange.startDateString)
          .lte('start_date', dateRange.endDateString);
      } else {
        const todayIso = new Date().toISOString().split('T')[0];
        eventsQuery = eventsQuery.gte('end_date', todayIso);
      }

      const { data: eventsData, error: eventsError } = await eventsQuery;
      if (eventsError) {
        console.error('Erro ao buscar local_events:', eventsError);
      } else {
        setEvents((eventsData as any[]) || []);
      }

      // 3. Reservas ativas do imóvel no período
      let resQuery = supabase
        .from('reservations')
        .select('id, property_id, guest_name, check_in_date, check_out_date, reservation_status')
        .eq('reservation_status', 'Confirmada');

      if (propertyId !== 'todas') {
        resQuery = resQuery.eq('property_id', propertyId);
      } else if (selectedPropertyIds && selectedPropertyIds.length > 0 && !selectedPropertyIds.includes('todas')) {
        resQuery = resQuery.in('property_id', selectedPropertyIds);
      }

      if (dateRange && dateRange.selectedPeriod !== 'general' && dateRange.startDateString && dateRange.endDateString) {
        resQuery = resQuery
          .gte('check_out_date', dateRange.startDateString)
          .lte('check_in_date', dateRange.endDateString);
      } else {
        const todayIso = new Date().toISOString().split('T')[0];
        resQuery = resQuery.gte('check_out_date', todayIso);
      }

      const { data: resData } = await resQuery;
      setReservations(resData || []);
    } catch (err) {
      console.error('Erro geral ao buscar dados do dashboard:', err);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os alertas de precificação.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [
    propertyId,
    selectedPropertyIds?.join(','),
    dateRange?.startDateString,
    dateRange?.endDateString,
    dateRange?.selectedPeriod
  ]);

  // KPIs calculados
  const kpis: PropertyPricingKPIs = useMemo(() => {
    const pending = alerts.filter(a => a.status === 'Pendente');
    const critical = pending.filter(a => a.urgency === 'Crítica');
    const underpricing = pending.filter(a => a.alert_type !== 'overpricing_event');
    const overpricing = pending.filter(a => a.alert_type === 'overpricing_event');
    const revenueGain = underpricing.reduce((acc, curr) => acc + (curr.estimated_revenue_gain || 0), 0);
    const gaps = pending.filter(a => a.alert_type === 'orphan_night');

    return {
      pendingAlertsCount: pending.length,
      pendingUnderpricingCount: underpricing.length,
      pendingOverpricingCount: overpricing.length,
      criticalAlertsCount: critical.length,
      estimatedRevenueGain: revenueGain,
      orphanGapsCount: gaps.length,
      upcomingEventsCount: events.length,
      activeReservationsCount: reservations.length,
    };
  }, [alerts, events, reservations]);

  // Alertas filtrados por status e tipo (Abaixo do Mercado / Oportunidades vs Acima do Sugerido / Calibração)
  const underpricingAlerts = useMemo(() => {
    const list = alerts.filter(a => a.alert_type !== 'overpricing_event');
    if (statusFilter === 'all') return list;
    return list.filter(a => a.status === statusFilter);
  }, [alerts, statusFilter]);

  const overpricingAlerts = useMemo(() => {
    const list = alerts.filter(a => a.alert_type === 'overpricing_event');
    if (statusFilter === 'all') return list;
    return list.filter(a => a.status === statusFilter);
  }, [alerts, statusFilter]);

  // Ação de aprovar alerta (suporta aumento de yield, calibração para o mercado ou confirmação de tarifa premium)
  const handleApproveAlert = async (
    alert: PricingAlert,
    actionType: 'standard_raise' | 'adjust_to_market' | 'keep_premium' = 'standard_raise'
  ) => {
    setIsUpdatingStatus(alert.id);
    try {
      let actionTaken = 'Aprovado pelo gestor no Dashboard';
      let toastTitle = 'Tarifa Aprovada com Sucesso!';
      let toastDesc = `Oportunidade para ${formatLocalDate(alert.target_start_date)} aprovada.`;

      if (actionType === 'adjust_to_market') {
        actionTaken = `Tarifa calibrada para R$ ${alert.suggested_price}/noite (mediana do mercado)`;
        toastTitle = 'Tarifa Calibrada com o Mercado!';
        toastDesc = `Ajuste para R$ ${alert.suggested_price}/noite aprovado para mitigar risco de vacância.`;
      } else if (actionType === 'keep_premium') {
        actionTaken = `Mantida tarifa premium de R$ ${alert.current_price}/noite pelo gestor`;
        toastTitle = 'Estratégia Confirmada!';
        toastDesc = `Tarifa premium de R$ ${alert.current_price}/noite mantida no seu calendário.`;
      } else {
        toastDesc = `Oportunidade para ${formatLocalDate(alert.target_start_date)} aprovada. Ganho estimado: +R$ ${alert.estimated_revenue_gain || 0}.`;
      }

      const { error } = await supabase
        .from('pricing_alerts')
        .update({
          status: 'Aprovado',
          action_taken: actionTaken,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', alert.id);

      if (error) throw error;

      toast({
        title: toastTitle,
        description: toastDesc,
      });

      // Atualiza localmente
      setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, status: 'Aprovado', action_taken: actionTaken } : a));
    } catch (err: any) {
      toast({
        title: 'Erro ao aprovar alerta',
        description: err.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  // Ação de rejeitar alerta
  const handleRejectAlert = async (alert: PricingAlert) => {
    setIsUpdatingStatus(alert.id);
    try {
      const { error } = await supabase
        .from('pricing_alerts')
        .update({
          status: 'Rejeitado',
          action_taken: 'Rejeitado pelo gestor no Dashboard',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', alert.id);

      if (error) throw error;

      toast({
        title: 'Alerta Rejeitado',
        description: 'A sugestão foi arquivada.',
      });

      // Atualiza localmente
      setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, status: 'Rejeitado', action_taken: 'Rejeitado pelo gestor no Dashboard' } : a));
    } catch (err: any) {
      toast({
        title: 'Erro ao rejeitar alerta',
        description: err.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  // Ativar ou pausar propriedade no radar
  const handleTogglePropertyRadar = async (checked: boolean) => {
    if (!selectedProperty) return;
    const newStatus = checked ? 'Ativo' : 'Pausado';

    try {
      const { error } = await supabase
        .from('properties')
        .update({ status: newStatus })
        .eq('id', selectedProperty.id);

      if (error) throw error;

      toast({
        title: checked ? 'Imóvel Ativado no Radar' : 'Imóvel Pausado no Radar',
        description: checked
          ? `${selectedProperty.name} agora é monitorado pelo Radar de Yield.`
          : `${selectedProperty.name} foi pausado temporariamente das buscas de yield.`,
      });

      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast({
        title: 'Erro ao alterar status',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Disparo manual do radar com webhook real e recálculo
  const handleRunRadarManually = async () => {
    setIsRadarRunning(true);
    try {
      // 1. Atualiza propriedades pai para carregar qualquer alteração recente de base_nightly_price
      if (onRefresh) {
        await onRefresh();
      }

      // 2. Dispara webhook do n8n para reprocessar o radar com as tarifas e calendários atuais
      await fetch('https://n8n-n8n.dgyrua.easypanel.host/webhook/rioh-host-yield-radar-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          timestamp: new Date().toISOString()
        })
      });

      // 3. Aguarda 2.5 segundos para o workflow do n8n concluir o processamento e upsert no banco
      await new Promise(resolve => setTimeout(resolve, 2500));

      // 4. Busca os alertas e dados atualizados do banco
      await fetchData();
      if (onRefresh) {
        await onRefresh();
      }

      toast({
        title: 'Radar Sincronizado com Sucesso!',
        description: 'Os dados e alertas de precificação foram recalculados com as novas tarifas base e disponibilidade real.',
      });
    } catch (e) {
      console.error('Erro ao sincronizar radar:', e);
      toast({
        title: 'Erro ao sincronizar radar',
        description: 'Não foi possível sincronizar no momento.',
        variant: 'destructive',
      });
    } finally {
      setIsRadarRunning(false);
    }
  };

  // Helper para verificar se um evento coincide com reservas existentes
  const isPropertyBookedDuringEvent = (ev: LocalEvent) => {
    const evStart = new Date(ev.start_date).getTime();
    const evEnd = new Date(ev.end_date).getTime();

    return reservations.some(r => {
      if (propertyId !== 'todas' && r.property_id !== propertyId) return false;
      const rStart = new Date(r.check_in_date).getTime();
      const rEnd = new Date(r.check_out_date).getTime();
      return (rStart <= evEnd && rEnd >= evStart);
    });
  };

  // Helper para renderizar a coluna lateral com Eventos e Altas Demandas
  const renderEventsSidebar = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-[#6A6DDF]" />
          Grandes Eventos & Feriados
        </h3>
        <p className="text-xs text-gray-500">Mapeamento de datas com impacto direto na ocupação</p>
      </div>

      <Card className="shadow-xs">
        <CardContent className="p-4 space-y-3">
          {events.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">Nenhum evento mapeado no período.</p>
          ) : (
            events.map(ev => {
              const isBooked = isPropertyBookedDuringEvent(ev);
              const isCriticalImpact = ev.demand_impact === 'Crítico';

              return (
                <div
                  key={ev.id}
                  className="p-3 rounded-lg border bg-gray-50/50 hover:bg-white transition-colors space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-800">{ev.name}</span>
                    <Badge
                      variant="outline"
                      className={
                        isCriticalImpact
                          ? 'bg-red-50 text-red-700 border-red-200 text-[10px]'
                          : ev.demand_impact === 'Alto'
                          ? 'bg-amber-50 text-amber-700 border-amber-200 text-[10px]'
                          : 'bg-blue-50 text-blue-700 border-blue-200 text-[10px]'
                      }
                    >
                      {ev.demand_impact}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-gray-500 text-[11px]">
                    <span>
                      {formatLocalDate(ev.start_date)} a{' '}
                      {formatLocalDate(ev.end_date)}
                    </span>
                    <span className="font-medium text-[#6A6DDF]">
                      {ev.recommended_price_multiplier ? `${ev.recommended_price_multiplier}x diária` : 'Normal'}
                    </span>
                  </div>

                  {/* Status de Ocupação no Imóvel */}
                  <div className="pt-1 flex items-center justify-between border-t border-gray-100 text-[11px]">
                    <span className="text-gray-400">Status no imóvel:</span>
                    {isBooked ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Já Reservado
                      </span>
                    ) : (
                      <span className="text-amber-600 font-semibold flex items-center gap-1">
                        <Flame className="h-3 w-3" /> Disponível para Yield
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Card: Altas Demandas Mapeadas no Imóvel */}
      <Card className="shadow-xs border-t-2 border-t-amber-500">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-bold flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-gray-800">
              <Flame className="h-4 w-4 text-amber-500" />
              Altas Demandas do Imóvel
            </span>
            {selectedProperty && (
              <Badge variant="outline" className="text-[10px] font-medium border-amber-200 text-amber-700 bg-amber-50">
                {selectedProperty.nickname || selectedProperty.name}
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-[11px]">
            {selectedProperty
              ? 'Picos sazonais configurados no banco de dados para este imóvel'
              : 'Selecione um imóvel no topo para visualizar seu calendário específico de alta demanda'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-1 space-y-2">
          {selectedProperty?.high_demand_events && selectedProperty.high_demand_events.length > 0 ? (
            selectedProperty.high_demand_events.map((hde, idx) => (
              <div key={idx} className="p-2.5 rounded-lg border bg-amber-50/40 border-amber-200/60 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-800">{hde.event_name}</span>
                  <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">
                    {hde.recommended_multiplier ? `${hde.recommended_multiplier}x` : 'Alta'}
                  </Badge>
                </div>
                {hde.period_description && (
                  <p className="text-[11px] text-gray-500">{hde.period_description}</p>
                )}
                {hde.notes && (
                  <p className="text-[11px] text-gray-600 italic">{hde.notes}</p>
                )}
              </div>
            ))
          ) : selectedProperty ? (
            <p className="text-xs text-gray-400 py-3 text-center">Nenhum evento customizado cadastrado diretamente neste imóvel.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-gray-500">
                Exemplos de altas demandas ativas por praça:
              </p>
              <div className="p-2 rounded-lg bg-gray-50 border text-[11px] space-y-1">
                <div className="font-semibold text-gray-700">🎪 Natal / Ponta Negra:</div>
                <div className="text-gray-600">Carnatal (2.2x), Réveillon (3.2x), Férias de Verão (1.7x)</div>
              </div>
              <div className="p-2 rounded-lg bg-gray-50 border text-[11px] space-y-1">
                <div className="font-semibold text-gray-700">🏖️ Rio de Janeiro:</div>
                <div className="text-gray-600">Réveillon Copacabana (3.5x), Carnaval (3.2x), Rock in Rio (2.4x)</div>
              </div>
              <div className="p-2 rounded-lg bg-gray-50 border text-[11px] space-y-1">
                <div className="font-semibold text-gray-700">⛵ Mangaratiba & Região dos Lagos:</div>
                <div className="text-gray-600">Temporada Náutica (1.9x), Jazz & Blues Rio das Ostras (2.1x)</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6 pb-24">
      {/* Banner / Card do Imóvel Selecionado */}
      <Card className="border border-indigo-100 bg-gradient-to-r from-white via-indigo-50/20 to-purple-50/30 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-[#6A6DDF]/10 text-[#6A6DDF]">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    {selectedProperty ? selectedProperty.name : 'Visão Consolidada de Todos os Imóveis'}
                  </h2>
                  <p className="text-sm text-gray-500 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-gray-400" />
                    {selectedProperty
                      ? `${(selectedProperty.address || 'Endereço não informado').replace('Riode Janeiro', 'Rio de Janeiro')} • Diária Base: R$ ${selectedProperty.base_nightly_price || 380}`
                      : `${properties.length} propriedades ativas sob monitoramento contínuo`}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              {selectedProperty && (
                <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg border shadow-xs">
                  <Switch
                    id="radar-switch"
                    checked={isRadarActiveForProperty}
                    onCheckedChange={handleTogglePropertyRadar}
                  />
                  <Label htmlFor="radar-switch" className="text-xs font-medium cursor-pointer">
                    {isRadarActiveForProperty ? 'Monitorando no Radar' : 'Radar Pausado'}
                  </Label>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleRunRadarManually}
                disabled={isRadarRunning || loading}
                className="gap-2 border-[#6A6DDF]/30 text-[#6A6DDF] hover:bg-[#6A6DDF]/10"
              >
                <RefreshCw className={`h-4 w-4 ${isRadarRunning ? 'animate-spin' : ''}`} />
                {isRadarRunning ? 'Analisando...' : 'Sincronizar Radar'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid de KPIs Rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Alertas Críticos */}
        <Card className="border-l-4 border-l-red-500 shadow-xs hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Urgência Crítica</p>
                <h3 className="text-2xl font-bold text-red-600 mt-1">{kpis.criticalAlertsCount}</h3>
                <p className="text-xs text-gray-500 mt-1">Impacto crítico na diária e receita</p>
              </div>
              <div className="p-2.5 rounded-full bg-red-50 text-red-600 animate-pulse">
                <Flame className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ganho Estimado em Aberto (Abaixo do Mercado) */}
        <Card className="border-l-4 border-l-emerald-500 shadow-xs hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ganho em Aberto</p>
                <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                  +R$ {kpis.estimatedRevenueGain.toLocaleString('pt-BR')}
                </h3>
                <p className="text-xs text-gray-500 mt-1">{(kpis.pendingUnderpricingCount ?? 0)} oportunidade(s) abaixo do mercado</p>
              </div>
              <div className="p-2.5 rounded-full bg-emerald-50 text-emerald-600">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tarifas Acima do Mercado (Calibração) */}
        <Card className="border-l-4 border-l-purple-500 shadow-xs hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Acima do Mercado</p>
                <h3 className="text-2xl font-bold text-purple-600 mt-1">{(kpis.pendingOverpricingCount ?? 0)}</h3>
                <p className="text-xs text-gray-500 mt-1">Calibração & risco de vacância</p>
              </div>
              <div className="p-2.5 rounded-full bg-purple-50 text-purple-600">
                <TrendingDown className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Eventos Mapeados */}
        <Card className="border-l-4 border-l-[#6A6DDF] shadow-xs hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Eventos na Região</p>
                <h3 className="text-2xl font-bold text-[#6A6DDF] mt-1">{kpis.upcomingEventsCount}</h3>
                <p className="text-xs text-gray-500 mt-1">Mapeados nos próximos 365 dias</p>
              </div>
              <div className="p-2.5 rounded-full bg-[#6A6DDF]/10 text-[#6A6DDF]">
                <Calendar className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navegação por Abas de Inteligência de Precificação */}
      <Tabs defaultValue="underpricing" className="w-full space-y-6">
        <TabsList className="bg-white border p-1 rounded-xl shadow-xs inline-flex h-11 w-full sm:w-auto gap-1">
          <TabsTrigger
            value="underpricing"
            className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white gap-2 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
          >
            <TrendingUp className="h-4 w-4" />
            <span>Oportunidades (+Yield)</span>
            {(kpis.pendingUnderpricingCount ?? 0) > 0 && (
              <Badge className="ml-1 bg-amber-500 text-white text-[10px] px-1.5 py-0 rounded-full">
                {kpis.pendingUnderpricingCount}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="overpricing"
            className="data-[state=active]:bg-[#6A6DDF] data-[state=active]:text-white gap-2 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
          >
            <TrendingDown className="h-4 w-4" />
            <span>Calibração (-Risco)</span>
            {(kpis.pendingOverpricingCount ?? 0) > 0 && (
              <Badge className="ml-1 bg-purple-500 text-white text-[10px] px-1.5 py-0 rounded-full">
                {kpis.pendingOverpricingCount}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="competitors"
            className="data-[state=active]:bg-[#6A6DDF] data-[state=active]:text-white gap-2 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
          >
            <Layers className="h-4 w-4" />
            <span>CompSet Concorrência</span>
          </TabsTrigger>

          <TabsTrigger
            value="events"
            className="data-[state=active]:bg-[#6A6DDF] data-[state=active]:text-white gap-2 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
          >
            <Calendar className="h-4 w-4" />
            <span>Eventos & Feriados</span>
            <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 border-gray-300">
              {events.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="audit"
            className="data-[state=active]:bg-[#6A6DDF] data-[state=active]:text-white gap-2 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Auditoria IA</span>
          </TabsTrigger>
        </TabsList>

        {/* Aba 1: Abaixo do Mercado (Oportunidades de Ganho & Yield) */}
        <TabsContent value="underpricing" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                    Oportunidades de Yield & Ganho (Abaixo do Mercado)
                  </h3>
                  <p className="text-xs text-gray-500">Períodos onde seu calendário ou diária base estão abaixo da recomendação de mercado / alta demanda</p>
                </div>

                {/* Filtros de Status */}
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                  <Button
                    variant={statusFilter === 'Pendente' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('Pendente')}
                    className={`h-7 text-xs ${statusFilter === 'Pendente' ? 'bg-emerald-600 text-white' : 'text-gray-600'}`}
                  >
                    Pendentes ({underpricingAlerts.filter(a => a.status === 'Pendente').length})
                  </Button>
                  <Button
                    variant={statusFilter === 'Aprovado' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('Aprovado')}
                    className={`h-7 text-xs ${statusFilter === 'Aprovado' ? 'bg-emerald-700 text-white' : 'text-gray-600'}`}
                  >
                    Aprovados
                  </Button>
                  <Button
                    variant={statusFilter === 'Rejeitado' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('Rejeitado')}
                    className={`h-7 text-xs ${statusFilter === 'Rejeitado' ? 'bg-gray-600 text-white' : 'text-gray-600'}`}
                  >
                    Rejeitados
                  </Button>
                  <Button
                    variant={statusFilter === 'all' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('all')}
                    className={`h-7 text-xs ${statusFilter === 'all' ? 'bg-gray-800 text-white' : 'text-gray-600'}`}
                  >
                    Todos
                  </Button>
                </div>
              </div>

              {/* Lista de Alertas de Underpricing */}
              {loading ? (
                <div className="py-12 text-center text-gray-500 bg-white rounded-lg border">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-[#6A6DDF] mb-2" />
                  Carregando oportunidades de precificação...
                </div>
              ) : underpricingAlerts.length === 0 ? (
                <div className="py-12 text-center text-gray-500 bg-white rounded-lg border p-6">
                  <ShieldCheck className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                  <p className="font-medium text-gray-700">Nenhum alerta com status "{statusFilter}" no momento.</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Todas as janelas de oportunidades de aumento deste imóvel estão calibradas com a melhor rentabilidade.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {underpricingAlerts.map(alert => {
                    const isUnderpricing = alert.alert_type === 'underpricing_event';
                    const isCritical = alert.urgency === 'Crítica';
                    const isApproved = alert.status === 'Aprovado';
                    const isRejected = alert.status === 'Rejeitado';

                    const propJoined = (alert as any).properties;
                    const propFromList = properties.find(p => p.id === alert.property_id);
                    const propObj = propJoined || propFromList;
                    const propertyDisplayName = propObj
                      ? (propObj.nickname ? `${propObj.name} (${propObj.nickname})` : propObj.name)
                      : (alert.property_name || 'Propriedade');

                    return (
                      <Card
                        key={alert.id}
                        className={`transition-all border-l-4 ${
                          isApproved
                            ? 'border-l-emerald-500 bg-emerald-50/10'
                            : isRejected
                            ? 'border-l-gray-400 opacity-60'
                            : isCritical
                            ? 'border-l-red-500 shadow-xs'
                            : 'border-l-amber-500 shadow-xs'
                        }`}
                      >
                        <CardContent className="p-5">
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              {/* Badges de Imóvel, Tipo e Urgência */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className="bg-slate-100 text-slate-800 border-slate-300 font-bold text-xs flex items-center gap-1.5 shadow-2xs"
                                >
                                  <Building2 className="h-3.5 w-3.5 text-[#6A6DDF]" />
                                  {propertyDisplayName}
                                </Badge>

                                <Badge
                                  variant="outline"
                                  className={
                                    isCritical
                                      ? 'bg-red-50 text-red-700 border-red-200 font-bold animate-pulse'
                                      : alert.urgency === 'Alta'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-blue-50 text-blue-700 border-blue-200'
                                  }
                                >
                                  Urgência {alert.urgency}
                                </Badge>

                                <Badge variant="secondary" className="text-xs">
                                  {isUnderpricing ? 'Evento de Alta Demanda' : 'Preenchimento de Noite Órfã'}
                                </Badge>

                                <span className="text-xs text-gray-500 ml-auto flex items-center gap-1 font-medium">
                                  <Calendar className="h-3 w-3 text-[#6A6DDF]" />
                                  {formatLocalDate(alert.target_start_date)} a{' '}
                                  {formatLocalDate(alert.target_end_date)}
                                </span>
                              </div>

                              {/* Justificativa Básica */}
                              <p className="text-sm text-gray-700 font-medium leading-relaxed">
                                {alert.reason}
                              </p>

                              {/* Raciocínio Analítico & Dados de Comprovação da IA */}
                              <div className="bg-[#6A6DDF]/5 border border-[#6A6DDF]/20 rounded-xl p-3.5 space-y-2.5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#6A6DDF]">
                                    <Sparkles className="h-3.5 w-3.5 text-[#6A6DDF]" />
                                    <span>Raciocínio da Sugestão & Dados Comprobatórios</span>
                                  </div>
                                  {alert.supporting_data?.calculation_formula && (
                                    <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-700 font-medium shadow-xs">
                                      {alert.supporting_data.calculation_formula}
                                    </span>
                                  )}
                                </div>

                                {alert.rationale && (
                                  <p className="text-xs text-gray-700 leading-relaxed font-normal">
                                    {alert.rationale}
                                  </p>
                                )}

                                {alert.supporting_data && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                                    {alert.supporting_data.market_evidence && (
                                      <div className="bg-white p-2 rounded-lg border border-gray-100 flex items-start gap-2 shadow-xs">
                                        <Layers className="h-3.5 w-3.5 text-[#6A6DDF] shrink-0 mt-0.5" />
                                        <div>
                                          <span className="font-semibold text-gray-800 block">Comprovação de Mercado:</span>
                                          <span className="text-gray-600">{alert.supporting_data.market_evidence}</span>
                                        </div>
                                      </div>
                                    )}
                                    {alert.supporting_data.calendar_protection && (
                                      <div className="bg-white p-2 rounded-lg border border-gray-100 flex items-start gap-2 shadow-xs">
                                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                        <div>
                                          <span className="font-semibold text-gray-800 block">Proteção de Calendário:</span>
                                          <span className="text-gray-600">{alert.supporting_data.calendar_protection}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Caixa Comparativa de Valores */}
                              <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg border text-xs">
                                <div>
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-gray-600 font-medium">Tarifa Atual</span>
                                    {alert.supporting_data?.is_from_real_calendar ? (
                                      <Badge
                                        variant="outline"
                                        className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold py-0 px-1.5 shadow-2xs"
                                      >
                                        Seu Calendário
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant="outline"
                                        className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] font-normal py-0 px-1.5"
                                      >
                                        Diária Base
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="font-semibold text-gray-800 text-sm">
                                    R$ {alert.current_price || 380}/noite
                                  </span>
                                </div>

                                <ArrowRight className="h-4 w-4 text-gray-400 mt-2" />

                                <div>
                                  <span className="text-gray-600 font-medium block">Tarifa Sugerida</span>
                                  <span className="font-bold text-[#6A6DDF] text-sm">
                                    R$ {alert.suggested_price}/noite
                                  </span>
                                </div>

                                <div className="border-l pl-4">
                                  <span className="text-gray-600 font-medium block">Estadia Mínima</span>
                                  <span className="font-semibold text-gray-700 text-sm">
                                    {alert.suggested_min_nights || 1} noites
                                  </span>
                                </div>

                                <div className="border-l pl-4 ml-auto text-right">
                                  <span className="text-emerald-700 font-semibold block">Ganho Estimado</span>
                                  <span className="font-bold text-emerald-600 text-sm">
                                    +R$ {alert.estimated_revenue_gain?.toLocaleString('pt-BR') || 0}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Botões de Ação */}
                            <div className="flex md:flex-col gap-2 min-w-[130px] justify-end">
                              {alert.status === 'Pendente' ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleApproveAlert(alert, 'standard_raise')}
                                    disabled={isUpdatingStatus === alert.id}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8 text-xs font-semibold"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Aprovar Aumento
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRejectAlert(alert)}
                                    disabled={isUpdatingStatus === alert.id}
                                    className="text-gray-600 hover:bg-gray-100 gap-1.5 h-8 text-xs"
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                    Rejeitar
                                  </Button>
                                </>
                              ) : (
                                <Badge
                                  className={`justify-center py-1.5 ${
                                    isApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {alert.action_taken || alert.status}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Coluna Lateral: Calendário de Eventos & Demanda */}
            {renderEventsSidebar()}
          </div>
        </TabsContent>

        {/* Aba 2: Acima do Sugerido (Calibração de Tarifa & Risco de Vacância) */}
        <TabsContent value="overpricing" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-purple-600" />
                    Calibração de Tarifas & Risco de Vacância (Acima do Mercado)
                  </h3>
                  <p className="text-xs text-gray-500">Períodos onde sua diária no calendário está acima da mediana do CompSet. Escolha se deseja calibrar para acelerar reservas ou manter sua tarifa premium.</p>
                </div>

                {/* Filtros de Status */}
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                  <Button
                    variant={statusFilter === 'Pendente' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('Pendente')}
                    className={`h-7 text-xs ${statusFilter === 'Pendente' ? 'bg-[#6A6DDF] text-white' : 'text-gray-600'}`}
                  >
                    Pendentes ({overpricingAlerts.filter(a => a.status === 'Pendente').length})
                  </Button>
                  <Button
                    variant={statusFilter === 'Aprovado' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('Aprovado')}
                    className={`h-7 text-xs ${statusFilter === 'Aprovado' ? 'bg-emerald-600 text-white' : 'text-gray-600'}`}
                  >
                    Aprovados
                  </Button>
                  <Button
                    variant={statusFilter === 'Rejeitado' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('Rejeitado')}
                    className={`h-7 text-xs ${statusFilter === 'Rejeitado' ? 'bg-gray-600 text-white' : 'text-gray-600'}`}
                  >
                    Rejeitados
                  </Button>
                  <Button
                    variant={statusFilter === 'all' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('all')}
                    className={`h-7 text-xs ${statusFilter === 'all' ? 'bg-gray-800 text-white' : 'text-gray-600'}`}
                  >
                    Todos
                  </Button>
                </div>
              </div>

              {/* Lista de Alertas de Overpricing */}
              {loading ? (
                <div className="py-12 text-center text-gray-500 bg-white rounded-lg border">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-[#6A6DDF] mb-2" />
                  Carregando alertas de calibração...
                </div>
              ) : overpricingAlerts.length === 0 ? (
                <div className="py-12 text-center text-gray-500 bg-white rounded-lg border p-6">
                  <ShieldCheck className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                  <p className="font-medium text-gray-700">Nenhum alerta de sobrepreço com status "{statusFilter}" no momento.</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Seu calendário não possui tarifas acima da concorrência com risco de vacância identificado.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {overpricingAlerts.map(alert => {
                    const isCritical = alert.urgency === 'Crítica';
                    const isApproved = alert.status === 'Aprovado';
                    const isRejected = alert.status === 'Rejeitado';

                    const propJoined = (alert as any).properties;
                    const propFromList = properties.find(p => p.id === alert.property_id);
                    const propObj = propJoined || propFromList;
                    const propertyDisplayName = propObj
                      ? (propObj.nickname ? `${propObj.name} (${propObj.nickname})` : propObj.name)
                      : (alert.property_name || 'Propriedade');

                    const diffPct = alert.supporting_data?.price_diff_pct ?? (
                      alert.current_price && alert.suggested_price && alert.suggested_price > 0
                        ? Math.round(((alert.current_price - alert.suggested_price) / alert.suggested_price) * 100)
                        : 0
                    );

                    return (
                      <Card
                        key={alert.id}
                        className={`transition-all border-l-4 ${
                          isApproved
                            ? 'border-l-emerald-500 bg-emerald-50/10'
                            : isRejected
                            ? 'border-l-gray-400 opacity-60'
                            : isCritical
                            ? 'border-l-purple-600 shadow-xs'
                            : 'border-l-[#6A6DDF] shadow-xs'
                        }`}
                      >
                        <CardContent className="p-5">
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              {/* Badges de Imóvel, Posição de Mercado e Urgência */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className="bg-slate-100 text-slate-800 border-slate-300 font-bold text-xs flex items-center gap-1.5 shadow-2xs"
                                >
                                  <Building2 className="h-3.5 w-3.5 text-[#6A6DDF]" />
                                  {propertyDisplayName}
                                </Badge>

                                <Badge
                                  variant="outline"
                                  className="bg-purple-50 text-purple-700 border-purple-200 font-bold text-xs flex items-center gap-1"
                                >
                                  <TrendingDown className="h-3 w-3" />
                                  +{diffPct}% Acima do CompSet
                                </Badge>

                                <Badge
                                  variant="outline"
                                  className={
                                    isCritical
                                      ? 'bg-red-50 text-red-700 border-red-200 font-bold'
                                      : 'bg-blue-50 text-blue-700 border-blue-200'
                                  }
                                >
                                  Urgência {alert.urgency}
                                </Badge>

                                <span className="text-xs text-gray-500 ml-auto flex items-center gap-1 font-medium">
                                  <Calendar className="h-3 w-3 text-[#6A6DDF]" />
                                  {formatLocalDate(alert.target_start_date)} a{' '}
                                  {formatLocalDate(alert.target_end_date)}
                                </span>
                              </div>

                              {/* Justificativa Básica */}
                              <p className="text-sm text-gray-700 font-medium leading-relaxed">
                                {alert.reason}
                              </p>

                              {/* Raciocínio de Mercado & Análise de Risco */}
                              <div className="bg-purple-50/50 border border-purple-200/60 rounded-xl p-3.5 space-y-2.5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-800">
                                    <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                                    <span>Raciocínio de Mercado & Análise de Risco</span>
                                  </div>
                                  {alert.supporting_data?.calculation_formula && (
                                    <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-purple-200 text-purple-800 font-medium shadow-xs">
                                      {alert.supporting_data.calculation_formula}
                                    </span>
                                  )}
                                </div>

                                {alert.rationale && (
                                  <p className="text-xs text-gray-700 leading-relaxed font-normal">
                                    {alert.rationale}
                                  </p>
                                )}

                                {alert.supporting_data && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                                    {alert.supporting_data.market_evidence && (
                                      <div className="bg-white p-2 rounded-lg border border-purple-100 flex items-start gap-2 shadow-xs">
                                        <Layers className="h-3.5 w-3.5 text-purple-600 shrink-0 mt-0.5" />
                                        <div>
                                          <span className="font-semibold text-gray-800 block">Comprovação de Mercado:</span>
                                          <span className="text-gray-600">{alert.supporting_data.market_evidence}</span>
                                        </div>
                                      </div>
                                    )}
                                    {alert.supporting_data.risk_analysis && (
                                      <div className="bg-white p-2 rounded-lg border border-amber-200 flex items-start gap-2 shadow-xs">
                                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                                        <div>
                                          <span className="font-semibold text-gray-800 block">Análise de Risco de Vacância:</span>
                                          <span className="text-amber-700">{alert.supporting_data.risk_analysis}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Caixa Comparativa de Valores */}
                              <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg border text-xs">
                                <div>
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-gray-600 font-medium">Sua Diária Atual</span>
                                    <Badge
                                      variant="outline"
                                      className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-semibold py-0 px-1.5 shadow-2xs"
                                    >
                                      Seu Calendário
                                    </Badge>
                                  </div>
                                  <span className="font-bold text-gray-900 text-sm">
                                    R$ {alert.current_price}/noite
                                  </span>
                                </div>

                                <ArrowRight className="h-4 w-4 text-gray-400 mt-2" />

                                <div>
                                  <span className="text-gray-600 font-medium block">Mediana CompSet (Sugerida)</span>
                                  <span className="font-bold text-[#6A6DDF] text-sm">
                                    R$ {alert.suggested_price}/noite
                                  </span>
                                </div>

                                <div className="border-l pl-4">
                                  <span className="text-gray-600 font-medium block">Estadia Mínima</span>
                                  <span className="font-semibold text-gray-700 text-sm">
                                    {alert.suggested_min_nights || 1} noites
                                  </span>
                                </div>

                                <div className="border-l pl-4 ml-auto text-right">
                                  <span className="text-purple-700 font-medium block">Posicionamento</span>
                                  <span className="font-bold text-purple-700 text-sm">
                                    Tarifa Premium (+{diffPct}%)
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Botões de Ação para Overpricing */}
                            <div className="flex md:flex-col gap-2 min-w-[170px] justify-end">
                              {alert.status === 'Pendente' ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleApproveAlert(alert, 'adjust_to_market')}
                                    disabled={isUpdatingStatus === alert.id}
                                    className="bg-[#6A6DDF] hover:bg-[#585ac7] text-white gap-1.5 h-8 text-xs font-semibold shadow-xs"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Calibrar p/ R$ {alert.suggested_price}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleApproveAlert(alert, 'keep_premium')}
                                    disabled={isUpdatingStatus === alert.id}
                                    className="border-purple-300 text-purple-700 hover:bg-purple-50 gap-1.5 h-8 text-xs font-semibold"
                                  >
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    Manter R$ {alert.current_price}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRejectAlert(alert)}
                                    disabled={isUpdatingStatus === alert.id}
                                    className="text-gray-500 hover:bg-gray-100 gap-1.5 h-7 text-xs"
                                  >
                                    <XCircle className="h-3 w-3" />
                                    Rejeitar
                                  </Button>
                                </>
                              ) : (
                                <Badge
                                  className={`justify-center py-1.5 ${
                                    isApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {alert.action_taken || alert.status}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Coluna Lateral: Calendário de Eventos & Demanda */}
            {renderEventsSidebar()}
          </div>
        </TabsContent>

    {/* Aba 2: Radar de Concorrência (CompSet) */}
    <TabsContent value="competitors" className="mt-0">
      <CompetitorsRadarTab
        propertyId={propertyId}
        properties={properties}
        selectedProperty={selectedProperty}
        selectedPropertyIds={selectedPropertyIds}
        dateRange={dateRange}
      />
    </TabsContent>

    {/* Aba 3: Eventos Locais & Demanda Expandida */}
    <TabsContent value="events" className="mt-0">
      <EventsCalendarTab
        events={events}
        selectedProperty={selectedProperty}
        reservations={reservations}
        onRefreshEvents={fetchData}
      />
    </TabsContent>

    {/* Aba 4: Auditoria de Reservas & Calendário Real */}
    <TabsContent value="audit" className="mt-0">
      <ReservationsAuditTab
        propertyId={propertyId}
        selectedProperty={selectedProperty}
        selectedPropertyIds={selectedPropertyIds}
        dateRange={dateRange}
      />
    </TabsContent>
  </Tabs>
</div>

  );
};

export default PropertyPricingDashboard;
