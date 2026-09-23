import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  TrendingUp,
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
  Layers
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PricingAlert, LocalEvent, PropertyPricingKPIs } from '@/types/pricing';
import { Property } from '@/types/property';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CompetitorsRadarTab from './CompetitorsRadarTab';
import EventsCalendarTab from './EventsCalendarTab';
import ReservationsAuditTab from './ReservationsAuditTab';


interface PropertyPricingDashboardProps {
  propertyId: string;
  properties: Property[];
  onRefresh?: () => void;
}

export const PropertyPricingDashboard: React.FC<PropertyPricingDashboardProps> = ({
  propertyId,
  properties,
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
        .select('*')
        .order('created_at', { ascending: false });

      if (propertyId !== 'todas') {
        alertsQuery = alertsQuery.eq('property_id', propertyId);
      }

      const { data: alertsData, error: alertsError } = await alertsQuery;
      if (alertsError) {
        console.error('Erro ao buscar pricing_alerts:', alertsError);
      } else {
        setAlerts((alertsData as any[]) || []);
      }

      // 2. Eventos locais (próximos 120 dias)
      const todayIso = new Date().toISOString().split('T')[0];
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 120);
      const maxDateIso = maxDate.toISOString().split('T')[0];

      const { data: eventsData, error: eventsError } = await supabase
        .from('local_events')
        .select('*')
        .gte('end_date', todayIso)
        .lte('start_date', maxDateIso)
        .order('start_date', { ascending: true });

      if (eventsError) {
        console.error('Erro ao buscar local_events:', eventsError);
      } else {
        setEvents((eventsData as any[]) || []);
      }

      // 3. Reservas ativas do imóvel
      let resQuery = supabase
        .from('reservations')
        .select('id, property_id, guest_name, check_in_date, check_out_date, reservation_status')
        .eq('reservation_status', 'Confirmada')
        .gte('check_out_date', todayIso);

      if (propertyId !== 'todas') {
        resQuery = resQuery.eq('property_id', propertyId);
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
  }, [propertyId]);

  // KPIs calculados
  const kpis: PropertyPricingKPIs = useMemo(() => {
    const pending = alerts.filter(a => a.status === 'Pendente');
    const critical = pending.filter(a => a.urgency === 'Crítica');
    const revenueGain = pending.reduce((acc, curr) => acc + (curr.estimated_revenue_gain || 0), 0);
    const gaps = pending.filter(a => a.alert_type === 'orphan_night');

    return {
      pendingAlertsCount: pending.length,
      criticalAlertsCount: critical.length,
      estimatedRevenueGain: revenueGain,
      orphanGapsCount: gaps.length,
      upcomingEventsCount: events.length,
      activeReservationsCount: reservations.length,
    };
  }, [alerts, events, reservations]);

  // Alertas filtrados por status
  const filteredAlerts = useMemo(() => {
    if (statusFilter === 'all') return alerts;
    return alerts.filter(a => a.status === statusFilter);
  }, [alerts, statusFilter]);

  // Ação de aprovar alerta
  const handleApproveAlert = async (alert: PricingAlert) => {
    setIsUpdatingStatus(alert.id);
    try {
      const { error } = await supabase
        .from('pricing_alerts')
        .update({
          status: 'Aprovado',
          action_taken: 'Aprovado pelo gestor no Dashboard',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', alert.id);

      if (error) throw error;

      toast({
        title: 'Tarifa Aprovada com Sucesso!',
        description: `Oportunidade para ${new Date(alert.target_start_date).toLocaleDateString('pt-BR')} aprovada. Ganho estimado: +R$ ${alert.estimated_revenue_gain || 0}.`,
      });

      // Atualiza localmente
      setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, status: 'Aprovado', action_taken: 'Aprovado pelo gestor no Dashboard' } : a));
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

  // Disparo manual do radar
  const handleRunRadarManually = async () => {
    setIsRadarRunning(true);
    try {
      // Dispara webhook do N8N ou recarrega dados frescos
      await fetchData();
      toast({
        title: 'Radar Executado!',
        description: 'Os dados e alertas de oportunidades foram atualizados.',
      });
    } catch (e) {
      toast({
        title: 'Erro ao executar radar',
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

  return (
    <div className="space-y-6">
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
                      ? `${selectedProperty.address || 'Endereço não informado'} • Diária Base: R$ ${selectedProperty.base_nightly_price || 380}`
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
                <p className="text-xs text-gray-500 mt-1">Datas a menos de 30 dias</p>
              </div>
              <div className="p-2.5 rounded-full bg-red-50 text-red-600 animate-pulse">
                <Flame className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ganho Estimado em Aberto */}
        <Card className="border-l-4 border-l-emerald-500 shadow-xs hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ganho em Aberto</p>
                <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                  +R$ {kpis.estimatedRevenueGain.toLocaleString('pt-BR')}
                </h3>
                <p className="text-xs text-gray-500 mt-1">{kpis.pendingAlertsCount} oportunidade(s) pendente(s)</p>
              </div>
              <div className="p-2.5 rounded-full bg-emerald-50 text-emerald-600">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Noites Órfãs (Gaps) */}
        <Card className="border-l-4 border-l-amber-500 shadow-xs hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Noites Órfãs (Gaps)</p>
                <h3 className="text-2xl font-bold text-amber-600 mt-1">{kpis.orphanGapsCount}</h3>
                <p className="text-xs text-gray-500 mt-1">Buracos de 1 a 2 noites</p>
              </div>
              <div className="p-2.5 rounded-full bg-amber-50 text-amber-600">
                <Clock className="h-5 w-5" />
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
                <p className="text-xs text-gray-500 mt-1">Nos próximos 120 dias</p>
              </div>
              <div className="p-2.5 rounded-full bg-[#6A6DDF]/10 text-[#6A6DDF]">
                <Calendar className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navegação por Abas de Inteligência de Precificação */}
      <Tabs defaultValue="alerts" className="w-full space-y-6">
        <TabsList className="bg-white border p-1 rounded-xl shadow-xs inline-flex h-11 w-full sm:w-auto gap-1">
          <TabsTrigger
            value="alerts"
            className="data-[state=active]:bg-[#6A6DDF] data-[state=active]:text-white gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all"
          >
            <Zap className="h-4 w-4" />
            Alertas & Yield
            {kpis.pendingAlertsCount > 0 && (
              <Badge className="ml-1 bg-amber-500 text-white text-[10px] px-1.5 py-0 rounded-full">
                {kpis.pendingAlertsCount}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="competitors"
            className="data-[state=active]:bg-[#6A6DDF] data-[state=active]:text-white gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all"
          >
            <Layers className="h-4 w-4" />
            Radar de Concorrência (CompSet)
          </TabsTrigger>

          <TabsTrigger
            value="events"
            className="data-[state=active]:bg-[#6A6DDF] data-[state=active]:text-white gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all"
          >
            <Calendar className="h-4 w-4" />
            Eventos Locais & Demanda
            <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 border-gray-300">
              {events.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="audit"
            className="data-[state=active]:bg-[#6A6DDF] data-[state=active]:text-white gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-all"
          >
            <ShieldCheck className="h-4 w-4" />
            Auditoria de Reservas & IA
          </TabsTrigger>
        </TabsList>

        {/* Aba 1: Alertas Acionáveis de Pricing */}
        <TabsContent value="alerts" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-500" />
                    Alertas de Oportunidades de Yield & Tarifa
                  </h3>
                  <p className="text-xs text-gray-500">Sugestões dinâmicas geradas pela IA e cruzamento de demanda</p>
                </div>


            {/* Filtros de Status */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              <Button
                variant={statusFilter === 'Pendente' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter('Pendente')}
                className={`h-7 text-xs ${statusFilter === 'Pendente' ? 'bg-[#6A6DDF] text-white' : 'text-gray-600'}`}
              >
                Pendentes ({alerts.filter(a => a.status === 'Pendente').length})
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

          {/* Lista de Alertas */}
          {loading ? (
            <div className="py-12 text-center text-gray-500 bg-white rounded-lg border">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-[#6A6DDF] mb-2" />
              Carregando inteligência de precificação...
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="py-12 text-center text-gray-500 bg-white rounded-lg border p-6">
              <ShieldCheck className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
              <p className="font-medium text-gray-700">Nenhum alerta com status "{statusFilter}" no momento.</p>
              <p className="text-xs text-gray-400 mt-1">
                Todas as janelas de eventos e gaps deste imóvel estão calibradas com a melhor rentabilidade.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAlerts.map(alert => {
                const isUnderpricing = alert.alert_type === 'underpricing_event';
                const isCritical = alert.urgency === 'Crítica';
                const isApproved = alert.status === 'Aprovado';
                const isRejected = alert.status === 'Rejeitado';

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
                          {/* Badges de Tipo e Urgência */}
                          <div className="flex items-center gap-2 flex-wrap">
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

                            {propertyId === 'todas' && alert.property_name && (
                              <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                {alert.property_name}
                              </span>
                            )}

                            <span className="text-xs text-gray-400 ml-auto flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(alert.target_start_date).toLocaleDateString('pt-BR')} a{' '}
                              {new Date(alert.target_end_date).toLocaleDateString('pt-BR')}
                            </span>
                          </div>

                          {/* Justificativa da IA */}
                          <p className="text-sm text-gray-700 font-medium leading-relaxed">
                            {alert.reason}
                          </p>

                          {/* Caixa Comparativa de Valores */}
                          <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg border text-xs">
                            <div>
                              <span className="text-gray-400 block">Tarifa Atual</span>
                              <span className="font-semibold text-gray-700 text-sm">
                                R$ {alert.current_price || 380}/noite
                              </span>
                            </div>

                            <ArrowRight className="h-4 w-4 text-gray-400 mt-2" />

                            <div>
                              <span className="text-gray-400 block">Tarifa Sugerida</span>
                              <span className="font-bold text-[#6A6DDF] text-sm">
                                R$ {alert.suggested_price}/noite
                              </span>
                            </div>

                            <div className="border-l pl-4">
                              <span className="text-gray-400 block">Estadia Mínima</span>
                              <span className="font-semibold text-gray-700 text-sm">
                                {alert.suggested_min_nights || 1} noites
                              </span>
                            </div>

                            <div className="border-l pl-4 ml-auto text-right">
                              <span className="text-gray-400 block">Ganho Estimado</span>
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
                                onClick={() => handleApproveAlert(alert)}
                                disabled={isUpdatingStatus === alert.id}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8 text-xs font-semibold"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Aprovar
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
                              {alert.status}
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
                          {new Date(ev.start_date).toLocaleDateString('pt-BR')} a{' '}
                          {new Date(ev.end_date).toLocaleDateString('pt-BR')}
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
        </div>
      </div>
    </TabsContent>

    {/* Aba 2: Radar de Concorrência (CompSet) */}
    <TabsContent value="competitors" className="mt-0">
      <CompetitorsRadarTab
        propertyId={propertyId}
        properties={properties}
        selectedProperty={selectedProperty}
      />
    </TabsContent>

    {/* Aba 3: Eventos Locais & Demanda Expandida */}
    <TabsContent value="events" className="mt-0">
      <EventsCalendarTab
        events={events}
        selectedProperty={selectedProperty}
        reservations={reservations}
      />
    </TabsContent>

    {/* Aba 4: Auditoria de Reservas & Calendário Real */}
    <TabsContent value="audit" className="mt-0">
      <ReservationsAuditTab
        propertyId={propertyId}
        selectedProperty={selectedProperty}
      />
    </TabsContent>
  </Tabs>
</div>

  );
};

export default PropertyPricingDashboard;
