import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import MarcaIA from '@/components/comum/MarcaIA';
import { ABAS_ROLAVEIS } from '@/components/comum/classes';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { PricingAlert, LocalEvent, PropertyPricingKPIs, PricingRule } from '@/types/pricing';
import { Property } from '@/types/property';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CompetitorsRadarTab from './CompetitorsRadarTab';
import EventsCalendarTab from './EventsCalendarTab';
import ReservationsAuditTab from './ReservationsAuditTab';
import { formatLocalDate } from '@/utils/dateUtils';
import {
  ReservaParaOcupacao, NOME_DO_TIPO, ORIGEM_DA_REGRA, escopoDoEvento, eventoValeParaImovel, eventosFuturos, hojeLocal,
  imovelLocalizado, percentual, situacaoNoEvento, tipoDeData,
} from './ocupacao';
import ProntidaoPrecificacao from './ProntidaoPrecificacao';
import { fetchN8n } from '@/lib/n8n';
import { useEhCompacto } from '@/hooks/useMidia';
import AbasRolaveis from '@/components/comum/AbasRolaveis';
import BlocoRecolhivel from '@/components/comum/BlocoRecolhivel';
import VerTodos from '@/components/comum/VerTodos';
import { Etiqueta } from '@/components/comum/Etiquetas';
import { CartaoSugestao, FiltroSugestoes, IndicadoresPrecificacao, periodoCurto } from './PrecificacaoCelular';

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
  /** Imóveis sem diária base (fora da análise), para o aviso do celular */
  foraDaAnalise?: string[];
}

const reais = (v: number | string | null | undefined) =>
  v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? '—' : `R$ ${Number(v).toLocaleString('pt-BR')}`;

export const PropertyPricingDashboard: React.FC<PropertyPricingDashboardProps> = ({
  propertyId,
  selectedPropertyIds,
  properties,
  dateRange,
  onRefresh,
  foraDaAnalise = [],
}) => {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<PricingAlert[]>([]);
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [reservations, setReservations] = useState<ReservaParaOcupacao[]>([]);
  const [regras, setRegras] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pendente' | 'Aprovado' | 'Rejeitado'>('Pendente');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const [isRadarRunning, setIsRadarRunning] = useState(false);
  // Celular (abaixo de 1024px): o desenho da T8 do plano; o computador não muda.
  const compacto = useEhCompacto();
  const [aba, setAba] = useState('underpricing');
  const [verTodasSugestoes, setVerTodasSugestoes] = useState(false);

  // Property selecionada
  const selectedProperty = useMemo(() => {
    if (propertyId === 'todas') return null;
    return properties.find(p => p.id === propertyId) || null;
  }, [propertyId, properties]);

  // Seleção de um subconjunto de imóveis (2 ou mais específicos) no filtro global.
  const isSubsetSelection = useMemo(() => {
    return (
      !selectedProperty &&
      Boolean(
        selectedPropertyIds &&
        selectedPropertyIds.length > 0 &&
        !selectedPropertyIds.includes('todas') &&
        selectedPropertyIds.length < properties.length
      )
    );
  }, [selectedProperty, selectedPropertyIds, properties.length]);

  const activeSelectedProperties = useMemo(() => {
    if (selectedProperty) return [selectedProperty];
    if (isSubsetSelection && selectedPropertyIds) {
      return properties.filter(p => selectedPropertyIds.includes(p.id));
    }
    return properties;
  }, [selectedProperty, isSubsetSelection, selectedPropertyIds, properties]);

  const subsetSubtitle = useMemo(() => {
    if (!isSubsetSelection) return `${properties.length} imóveis com diária base cadastrada`;
    if (activeSelectedProperties.length <= 3) {
      const names = activeSelectedProperties.map(p => p.nickname || p.name).join(', ');
      return `${names} • ${activeSelectedProperties.length} imóveis selecionados`;
    }
    return `${activeSelectedProperties.length} imóveis selecionados`;
  }, [isSubsetSelection, activeSelectedProperties, properties.length]);

  // Busca dados do Supabase
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Alertas de precificação
      let alertsQuery = supabase
        .from('pricing_alerts')
        .select('*, properties:property_id (id, name, nickname)')
        .neq('status', 'Arquivado')
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
        setAlerts((alertsData as unknown as PricingAlert[]) || []);
      }

      // 2. Eventos locais vinculados ao período
      let eventsQuery = supabase
        .from('local_events')
        .select('*')
        .eq('is_active', true)
        .eq('is_confirmed', true)
        .order('start_date', { ascending: true });

      const hoje = hojeLocal();
      eventsQuery = eventsQuery.gte('end_date', hoje);
      if (dateRange && dateRange.selectedPeriod !== 'general' && dateRange.endDateString) {
        eventsQuery = eventsQuery.lte('start_date', dateRange.endDateString);
      }

      const { data: eventsData, error: eventsError } = await eventsQuery;
      if (eventsError) {
        console.error('Erro ao buscar local_events:', eventsError);
      } else {
        // Sem passados nem repetidos (mesmo nome no mesmo período).
        setEvents(eventosFuturos((eventsData as LocalEvent[]) || [], hoje) as LocalEvent[]);
      }

      // 3. Reservas ativas do imóvel no período
      let resQuery = supabase
        .from('reservations')
        .select('id, property_id, guest_name, check_in_date, check_out_date, reservation_status, total_revenue, cleaning_fee')
        .not('reservation_status', 'ilike', '%cancel%');

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
        resQuery = resQuery.gte('check_out_date', hojeLocal());
      }

      const { data: resData } = await resQuery;
      setReservations((resData as ReservaParaOcupacao[]) || []);

      // 4. Regras de preço vigentes de cada imóvel (aprendidas pela esteira: manual > mercado > histórico)
      const idsDaSelecao = activeSelectedProperties.map(p => p.id);
      if (idsDaSelecao.length) {
        const { data: regrasData, error: regrasError } = await supabase
          .from('property_pricing_rules_vigentes')
          .select('*')
          .in('property_id', idsDaSelecao);
        if (regrasError) console.error('Erro ao buscar regras de preço:', regrasError);
        setRegras((regrasData as unknown as PricingRule[]) || []);
      } else {
        setRegras([]);
      }
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
    properties.map(p => p.id).join(','),
    dateRange?.startDateString,
    dateRange?.endDateString,
    dateRange?.selectedPeriod
  ]);

  // O evento vale pelo escopo (país, estado ou cidade) contra a localização de cada imóvel.
  const relevantEvents = useMemo(
    () => events.filter(ev => activeSelectedProperties.some(p => eventoValeParaImovel(ev, p))),
    [events, activeSelectedProperties],
  );
  const semLocalizacao = activeSelectedProperties.filter(p => !imovelLocalizado(p));

  const regraDe = (propertyId: string, tipo: string) => regras.find(r => r.property_id === propertyId && r.tipo_data === tipo) || null;

  /** Situação de cada imóvel da seleção (onde o evento vale) nas noites do evento. */
  const situacoesNoEvento = (ev: LocalEvent) =>
    activeSelectedProperties
      .filter(p => eventoValeParaImovel(ev, p))
      .map(p => ({ p, ...situacaoNoEvento(reservations.filter(r => r.property_id === p.id), ev) }));

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
      upcomingEventsCount: relevantEvents.length,
      activeReservationsCount: reservations.length,
    };
  }, [alerts, relevantEvents, reservations]);

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
    } catch (err) {
      toast({
        title: 'Erro ao aprovar alerta',
        description: err instanceof Error ? err.message : 'Tente novamente.',
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
    } catch (err) {
      toast({
        title: 'Erro ao rejeitar alerta',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingStatus(null);
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
      await fetchN8n('rioh-host-yield-radar-manual', {
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

  // Quanto a diária sobe em cada tipo de data, por imóvel (regras aprendidas das reservas).
  // No celular, sem as caixinhas coloridas: linhas com fio, dentro do bloco recolhido.
  const renderRegrasAprendidas = (celular = false) => (
    <>
          {activeSelectedProperties.map(p => {
            const minhas = regras.filter(r => r.property_id === p.id);
            if (!selectedProperty && minhas.length === 0) return null;
            return (
              <div key={p.id} className={celular ? 'space-y-1.5 py-2.5 text-xs' : 'p-2.5 rounded-lg border bg-warning-50/40 border-warning-200/60 space-y-1.5 text-xs'}>
                {!selectedProperty && <div className="font-semibold text-gray-700">{p.nickname || p.name}</div>}
                {minhas.length === 0 ? (
                  <p className="text-[11px] text-gray-500">
                    {p.pricing_activated_at
                      ? 'Ainda sem reservas suficientes para aprender (mínimo de 15 noites comuns e 4 noites em cada tipo de data).'
                      : 'Ative a precificação automática para o sistema aprender com as reservas deste imóvel.'}
                  </p>
                ) : (
                  minhas
                    .sort((a, b) => Number(b.fator) - Number(a.fator))
                    .map(r => {
                      const d = (r.detalhe || {}) as { mediana_tipo?: number; mediana_comum?: number };
                      return (
                        <div key={r.tipo_data} className="flex items-center justify-between gap-2">
                          <span className="text-gray-700">{NOME_DO_TIPO[r.tipo_data] || r.tipo_data}</span>
                          <span className="text-right">
                            <span className={`font-bold ${Number(r.fator) > 1.03 ? 'text-warning-700' : 'text-gray-500'}`}>{percentual(Number(r.fator))}</span>
                            <span className="block text-[10px] text-gray-400">
                              {d.mediana_tipo && d.mediana_comum
                                ? `${reais(Math.round(d.mediana_tipo))} vs ${reais(Math.round(d.mediana_comum))} • ${r.amostras ?? 0} noites`
                                : ORIGEM_DA_REGRA[r.origem] || r.origem}
                            </span>
                          </span>
                        </div>
                      );
                    })
                )}
              </div>
            );
          })}
          {!selectedProperty && regras.length === 0 && (
            <p className="text-xs text-gray-400 py-3 text-center">Nenhum imóvel da seleção tem regras aprendidas ainda.</p>
          )}
    </>
  );

  // Helper para renderizar a coluna lateral com Eventos e Altas Demandas
  const renderEventsSidebar = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-brand" />
          Grandes Eventos & Feriados
        </h3>
        <p className="text-xs text-gray-500">Mapeamento de datas com impacto direto na ocupação</p>
      </div>

      <Card className="shadow-xs">
        <CardContent className="p-4 space-y-3">
          {relevantEvents.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">
              {semLocalizacao.length === activeSelectedProperties.length
                ? 'Os imóveis ainda não foram localizados. Ative a precificação automática acima.'
                : 'Nenhum feriado ou evento onde os imóveis estão, no período.'}
            </p>
          ) : (
            relevantEvents.map(ev => {
              const sits = situacoesNoEvento(ev);
              const livres = sits.filter(s => s.situacao !== 'reservado');
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
                          ? 'bg-danger-50 text-danger-700 border-danger-200 text-[10px]'
                          : ev.demand_impact === 'Alto'
                          ? 'bg-warning-50 text-warning-700 border-warning-200 text-[10px]'
                          : 'bg-info-50 text-info-700 border-info-200 text-[10px]'
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
                    {(() => {
                      // O quanto subir vem da regra aprendida do imóvel, não do evento.
                      const r = sits.length === 1 ? regraDe(sits[0].p.id, tipoDeData(ev)) : null;
                      return r ? (
                        <span className="font-medium text-brand" title={`Regra ${ORIGEM_DA_REGRA[r.origem] || r.origem}`}>
                          {percentual(Number(r.fator))} na diária
                        </span>
                      ) : (
                        <span className="text-gray-400">{escopoDoEvento(ev)}</span>
                      );
                    })()}
                  </div>

                  {/* Status de Ocupação no Imóvel */}
                  <div className="pt-1 flex items-center justify-between border-t border-gray-100 text-[11px]">
                    <span className="text-gray-400 truncate">{sits.length > 1 ? 'Status nos imóveis:' : sits[0] ? `${sits[0].p.nickname || sits[0].p.name}:` : 'Status no imóvel:'}</span>
                    {livres.length === 0 ? (
                      <span className="text-success-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> {sits.length > 1 ? 'Todos reservados' : 'Já Reservado'}
                      </span>
                    ) : sits.length > 1 ? (
                      <span className="text-warning-600 font-semibold flex items-center gap-1">
                        <Flame className="h-3 w-3" /> Livre em {livres.length} de {sits.length} imóveis
                      </span>
                    ) : sits[0].situacao === 'parcial' ? (
                      <span className="text-warning-600 font-semibold flex items-center gap-1">
                        <Flame className="h-3 w-3" /> {sits[0].noitesLivres} de {sits[0].noitesDoEvento} noites livres
                      </span>
                    ) : (
                      <span className="text-warning-600 font-semibold flex items-center gap-1">
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

      {/* Card: Regras de preço aprendidas por imóvel */}
      <Card className="shadow-xs border-t-2 border-t-warning-500">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-bold flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-gray-800">
              <Flame className="h-4 w-4 text-warning-500" />
              Quanto a diária sobe
            </span>
            {selectedProperty && (
              <Badge variant="outline" className="text-[10px] font-medium border-warning-200 text-warning-700 bg-warning-50">
                {selectedProperty.nickname || selectedProperty.name}
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-[11px]">
            Aprendido das reservas de cada imóvel: diária em cada tipo de data comparada às noites comuns
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-1 space-y-2">
          {renderRegrasAprendidas()}
        </CardContent>
      </Card>
    </div>
  );

  /* ── Celular (T8 do plano) ─────────────────────────────── */

  const nomeDoImovel = (alert: PricingAlert) => {
    const propJoined = (alert as PricingAlert & { properties?: Property | null }).properties;
    const prop = propJoined || properties.find(p => p.id === alert.property_id);
    return prop ? (prop.nickname || prop.name) : (alert.property_name || 'Imóvel');
  };

  /** O que abre o cartão: o evento, o nome entre colchetes do motivo ou o tipo da sugestão. */
  const tituloDaSugestao = (alert: PricingAlert) => {
    const ev = alert.event_id ? events.find(e => e.id === alert.event_id) : null;
    if (ev?.name) return ev.name;
    const doMotivo = alert.reason?.match(/^\s*\[([^\]]+)\]/)?.[1];
    if (doMotivo) return doMotivo;
    if (alert.alert_type === 'orphan_night') return 'Noite órfã';
    if (alert.alert_type === 'overpricing_event') return 'Acima do mercado';
    return NOME_DO_TIPO[alert.supporting_data?.regra_tipo || ''] || 'Feriado ou evento';
  };

  /** A explicação completa (o que o computador mostra no cartão) vai para o "i". */
  const explicacaoDaSugestao = (alert: PricingAlert, diffPct?: number) => {
    const d = alert.supporting_data;
    return (
      <div className="space-y-2 text-[13px]">
        <p className="font-medium text-gray-800">{alert.reason}</p>
        {alert.rationale && <p>{alert.rationale}</p>}
        <ul className="space-y-1 text-xs text-gray-600">
          <li>Urgência {alert.urgency}{d?.confianca ? ` · confiança ${d.confianca}` : ''}</li>
          <li>Estadia mínima: {alert.suggested_min_nights || 1} noites</li>
          {alert.alert_type !== 'overpricing_event' && (
            <li>Diária atual: {d?.fonte_diaria_atual === 'calendario_coletado' ? 'lida do calendário do anúncio' : 'diária base do cadastro'}</li>
          )}
          {d?.regra_fator ? (
            <li>
              Regra do imóvel: {percentual(Number(d.regra_fator))}, aprendida de {ORIGEM_DA_REGRA[d.regra_origem || ''] || d.regra_origem}
              {d.regra_amostras ? ` (${d.regra_amostras} noites)` : ''}
              {d.compset_amostras ? `; ${d.compset_amostras} diárias de concorrentes` : ''}
            </li>
          ) : null}
          {d?.base_desatualizada ? (
            <li className="text-warning-800">
              Confira a diária base: ela está longe do que o imóvel vende em noite comum
              {d.mediana_comum_vendida ? ` (${reais(Math.round(d.mediana_comum_vendida))})` : ''}.
            </li>
          ) : null}
          {diffPct !== undefined && <li>Sua diária está {diffPct}% acima da mediana dos concorrentes</li>}
          {d?.calculation_formula && <li className="font-mono">{d.calculation_formula}</li>}
          {d?.market_evidence && <li>Comprovação de mercado: {d.market_evidence}</li>}
          {d?.risk_analysis && <li className="text-warning-800">Risco de vacância: {d.risk_analysis}</li>}
        </ul>
      </div>
    );
  };

  const cartaoDaSugestao = (alert: PricingAlert) => {
    const acima = alert.alert_type === 'overpricing_event';
    const pendente = alert.status === 'Pendente';
    const aprovado = alert.status === 'Aprovado';
    const diffPct = acima
      ? alert.supporting_data?.price_diff_pct ?? (
        alert.current_price && alert.suggested_price && alert.suggested_price > 0
          ? Math.round(((alert.current_price - alert.suggested_price) / alert.suggested_price) * 100)
          : 0
      )
      : undefined;
    const lacuna = alert.alert_type === 'orphan_night' ? alert.supporting_data?.noites_lacuna : undefined;
    const sugeridaMaior = Number(alert.suggested_price) >= Number(alert.current_price);

    return (
      <CartaoSugestao
        key={alert.id}
        titulo={tituloDaSugestao(alert)}
        subtitulo={[
          nomeDoImovel(alert),
          periodoCurto(alert.target_start_date, alert.target_end_date),
          lacuna ? `${lacuna} ${lacuna === 1 ? 'noite' : 'noites'} entre reservas` : null,
        ].filter(Boolean).join(' · ')}
        etiqueta={pendente && alert.urgency === 'Crítica' ? <Etiqueta tom="danger">Crítica</Etiqueta> : undefined}
        valores={acima ? [
          { rotulo: 'Diária atual', valor: reais(alert.current_price) },
          { rotulo: 'Mercado', valor: reais(alert.suggested_price), tom: 'brand' },
          { rotulo: 'Acima', valor: `+${diffPct}%`, tom: 'warning' },
        ] : [
          { rotulo: 'Diária atual', valor: reais(alert.current_price) },
          { rotulo: 'Sugerida', valor: reais(alert.suggested_price), tom: sugeridaMaior ? 'success' : 'warning' },
          { rotulo: 'Ganho', valor: `+${reais(alert.estimated_revenue_gain || 0)}`, tom: 'success' },
        ]}
        explicacao={explicacaoDaSugestao(alert, diffPct)}
        ocupado={isUpdatingStatus === alert.id}
        apagado={alert.status === 'Rejeitado'}
        acoes={!pendente ? undefined : acima ? [
          { rotulo: 'Calibrar', aoTocar: () => handleApproveAlert(alert, 'adjust_to_market') },
          { rotulo: 'Manter', aoTocar: () => handleApproveAlert(alert, 'keep_premium') },
          { rotulo: 'Rejeitar', aoTocar: () => handleRejectAlert(alert) },
        ] : [
          { rotulo: 'Aprovar', aoTocar: () => handleApproveAlert(alert, 'standard_raise') },
          { rotulo: 'Rejeitar', aoTocar: () => handleRejectAlert(alert) },
        ]}
        desfecho={alert.action_taken || alert.status}
        tomDesfecho={aprovado ? 'success' : 'neutro'}
      />
    );
  };

  /** A lista de uma aba (Oportunidades ou Calibração) no celular: 5 por vez + "Ver todas". */
  const sugestoesNoCelular = (lista: PricingAlert[], pendentes: number, vazio: string) => {
    const visiveis = verTodasSugestoes ? lista : lista.slice(0, 5);
    return (
      <div className="space-y-3">
        <FiltroSugestoes
          valor={statusFilter}
          aoMudar={(v) => { setStatusFilter(v); setVerTodasSugestoes(false); }}
          pendentes={pendentes}
          total={lista.length}
          aoSincronizar={handleRunRadarManually}
          sincronizando={isRadarRunning}
          desabilitado={loading}
        />
        {loading ? (
          <div className="flex min-h-24 items-center justify-center gap-2 rounded-2xl border bg-card text-sm text-gray-500">
            <RefreshCw className="h-4 w-4 animate-spin text-brand" aria-hidden="true" />
            Carregando sugestões…
          </div>
        ) : lista.length === 0 ? (
          <div className="rounded-2xl border bg-card p-4 text-center text-sm text-gray-600">
            <ShieldCheck className="mx-auto mb-1.5 h-6 w-6 text-success-500" aria-hidden="true" />
            {vazio}
          </div>
        ) : (
          <>
            {visiveis.map(cartaoDaSugestao)}
            {lista.length > 5 && (
              <VerTodos
                semFio
                total={lista.length}
                rotulo={`Ver todas (${lista.length})`}
                expandido={verTodasSugestoes}
                aoClicar={() => setVerTodasSugestoes(v => !v)}
                className="rounded-2xl border bg-card"
              />
            )}
          </>
        )}
        <BlocoRecolhivel titulo="Como a diária é calculada" resumo="Regras aprendidas de cada imóvel">
          <div className="divide-y divide-gray-100">{renderRegrasAprendidas(true)}</div>
        </BlocoRecolhivel>
      </div>
    );
  };

  const nomeDoStatus = statusFilter === 'Pendente' ? 'pendente' : statusFilter === 'Aprovado' ? 'aprovada' : statusFilter === 'Rejeitado' ? 'rejeitada' : '';

  if (compacto) {
    return (
      <div className="space-y-3">
        <IndicadoresPrecificacao
          itens={[
            { rotulo: 'Urgência crítica', valor: kpis.criticalAlertsCount, tom: kpis.criticalAlertsCount > 0 ? 'danger' : 'neutro', ajuda: 'Sugestões pendentes com impacto crítico na diária e na receita.' },
            { rotulo: 'Ganho em aberto', valor: `+${reais(kpis.estimatedRevenueGain)}`, tom: 'success', ajuda: `${kpis.pendingUnderpricingCount ?? 0} oportunidade(s) pendentes em feriados, eventos e noites órfãs.` },
            { rotulo: 'Acima do mercado', valor: kpis.pendingOverpricingCount ?? 0, ajuda: 'Datas livres com a sua diária mais de 25% acima dos anúncios parecidos.' },
            { rotulo: 'Eventos na região', valor: kpis.upcomingEventsCount, tom: 'brand', ajuda: 'Feriados e eventos onde os imóveis estão, a partir de hoje.' },
          ]}
        />

        <ProntidaoPrecificacao modo="linha" properties={activeSelectedProperties} regras={regras} onAtualizado={fetchData} />
        {foraDaAnalise.length > 0 && (
          <p className="truncate px-1 text-xs text-gray-500">Fora da análise, sem diária base: {foraDaAnalise.join(', ')}</p>
        )}

        <Tabs value={aba} onValueChange={(v) => { setAba(v); setVerTodasSugestoes(false); }} className="w-full space-y-3">
          <AbasRolaveis
            sangrar
            rotulo="Seções da precificação"
            itens={[
              { valor: 'underpricing', rotulo: 'Oportunidades', contagem: kpis.pendingUnderpricingCount || undefined },
              { valor: 'overpricing', rotulo: 'Calibração', contagem: kpis.pendingOverpricingCount || undefined },
              { valor: 'competitors', rotulo: 'Concorrentes' },
              { valor: 'events', rotulo: 'Eventos', contagem: relevantEvents.length },
              { valor: 'audit', rotulo: 'Auditoria' },
            ]}
          />
          <TabsContent value="underpricing" className="mt-0">
            {sugestoesNoCelular(
              underpricingAlerts,
              alerts.filter(a => a.alert_type !== 'overpricing_event' && a.status === 'Pendente').length,
              `Nenhuma oportunidade ${nomeDoStatus} no momento.`,
            )}
          </TabsContent>
          <TabsContent value="overpricing" className="mt-0">
            {sugestoesNoCelular(
              overpricingAlerts,
              alerts.filter(a => a.alert_type === 'overpricing_event' && a.status === 'Pendente').length,
              `Nenhuma diária ${nomeDoStatus} acima do mercado. A calibração aparece quando a sua diária fica mais de 25% acima dos concorrentes parecidos nas mesmas noites.`,
            )}
          </TabsContent>
          <TabsContent value="competitors" className="mt-0">
            <CompetitorsRadarTab
              propertyId={propertyId}
              properties={properties}
              selectedProperty={selectedProperty}
              selectedPropertyIds={selectedPropertyIds}
              regras={regras}
            />
          </TabsContent>
          <TabsContent value="events" className="mt-0">
            <EventsCalendarTab
              events={relevantEvents}
              properties={activeSelectedProperties}
              selectedProperty={selectedProperty}
              reservations={reservations}
              regras={regras}
            />
          </TabsContent>
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
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Banner / Card do Imóvel Selecionado */}
      <Card className="border border-brand-100 bg-gradient-to-r from-white via-brand-50/20 to-brand-50/30 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-brand/10 text-brand">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    {selectedProperty
                      ? selectedProperty.name
                      : isSubsetSelection
                        ? `Visão Consolidada (${activeSelectedProperties.length} Imóveis Selecionados)`
                        : 'Visão Consolidada de Todos os Imóveis'}
                  </h2>
                  <p className="text-sm text-gray-500 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-gray-400" />
                    {selectedProperty
                      ? `${selectedProperty.address || 'Endereço não informado'} • Diária Base: ${selectedProperty.base_nightly_price ? `R$ ${selectedProperty.base_nightly_price}` : 'não cadastrada'}`
                      : subsetSubtitle}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunRadarManually}
                disabled={isRadarRunning || loading}
                className="gap-2 border-brand/30 text-brand hover:bg-brand/10"
              >
                <RefreshCw className={`h-4 w-4 ${isRadarRunning ? 'animate-spin' : ''}`} />
                {isRadarRunning ? 'Analisando...' : 'Sincronizar Radar'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prontidão e ativação da precificação automática */}
      <ProntidaoPrecificacao properties={activeSelectedProperties} regras={regras} onAtualizado={fetchData} />

      {/* Grid de KPIs Rápidos */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {/* Alertas Críticos */}
        <Card className="border-l-4 border-l-danger-500 shadow-xs hover:shadow-md transition-shadow">
          <CardContent className="p-3.5 sm:p-5">
            <div className="flex justify-between items-start gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 sm:text-xs">Urgência Crítica</p>
                <h3 className="mt-1 break-words font-mono text-xl font-semibold tabular-nums text-danger-600 sm:text-2xl">{kpis.criticalAlertsCount}</h3>
                <p className="text-xs text-gray-500 mt-1">Impacto crítico na diária e receita</p>
              </div>
              <div className="hidden shrink-0 rounded-full bg-danger-50 p-2.5 text-danger-600 sm:block">
                <Flame className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ganho Estimado em Aberto (Abaixo do Mercado) */}
        <Card className="border-l-4 border-l-success-500 shadow-xs hover:shadow-md transition-shadow">
          <CardContent className="p-3.5 sm:p-5">
            <div className="flex justify-between items-start gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 sm:text-xs">Ganho em Aberto</p>
                <h3 className="mt-1 break-words font-mono text-xl font-semibold tabular-nums text-success-600 sm:text-2xl">
                  +R$ {kpis.estimatedRevenueGain.toLocaleString('pt-BR')}
                </h3>
                <p className="text-xs text-gray-500 mt-1">{(kpis.pendingUnderpricingCount ?? 0)} oportunidade(s) em feriados, eventos e noites órfãs</p>
              </div>
              <div className="hidden shrink-0 rounded-full p-2.5 bg-success-50 text-success-600 sm:block">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tarifas Acima do Mercado (Calibração) */}
        <Card className="border-l-4 border-l-brand-500 shadow-xs hover:shadow-md transition-shadow">
          <CardContent className="p-3.5 sm:p-5">
            <div className="flex justify-between items-start gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 sm:text-xs">Acima do Mercado</p>
                <h3 className="mt-1 break-words font-mono text-xl font-semibold tabular-nums text-brand-600 sm:text-2xl">{(kpis.pendingOverpricingCount ?? 0)}</h3>
                <p className="text-xs text-gray-500 mt-1">Datas livres com sua diária mais de 25% acima dos parecidos</p>
              </div>
              <div className="hidden shrink-0 rounded-full p-2.5 bg-brand-50 text-brand-600 sm:block">
                <TrendingDown className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Eventos Mapeados */}
        <Card className="border-l-4 border-l-brand shadow-xs hover:shadow-md transition-shadow">
          <CardContent className="p-3.5 sm:p-5">
            <div className="flex justify-between items-start gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 sm:text-xs">Eventos na Região</p>
                <h3 className="mt-1 break-words font-mono text-xl font-semibold tabular-nums text-brand sm:text-2xl">{kpis.upcomingEventsCount}</h3>
                <p className="text-xs text-gray-500 mt-1">Feriados e eventos onde os imóveis estão, a partir de hoje</p>
              </div>
              <div className="hidden shrink-0 rounded-full p-2.5 bg-brand/10 text-brand sm:block">
                <Calendar className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navegação por Abas de Inteligência de Precificação */}
      <Tabs defaultValue="underpricing" className="w-full space-y-6">
        <TabsList className={cn(ABAS_ROLAVEIS, "gap-1 rounded-xl border bg-white p-1 shadow-xs sm:w-fit sm:max-w-full")}>
          <TabsTrigger
            value="underpricing"
            className="data-[state=active]:bg-success-600 data-[state=active]:text-white gap-2 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
          >
            <TrendingUp className="h-4 w-4" />
            <span>Oportunidades (+Yield)</span>
            {(kpis.pendingUnderpricingCount ?? 0) > 0 && (
              <Badge className="ml-1 bg-warning-500 text-white text-[10px] px-1.5 py-0 rounded-full">
                {kpis.pendingUnderpricingCount}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="overpricing"
            className="data-[state=active]:bg-brand data-[state=active]:text-white gap-2 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
          >
            <TrendingDown className="h-4 w-4" />
            <span>Calibração (-Risco)</span>
            {(kpis.pendingOverpricingCount ?? 0) > 0 && (
              <Badge className="ml-1 bg-brand-500 text-white text-[10px] px-1.5 py-0 rounded-full">
                {kpis.pendingOverpricingCount}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="competitors"
            className="data-[state=active]:bg-brand data-[state=active]:text-white gap-2 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
          >
            <Layers className="h-4 w-4" />
            <span>CompSet Concorrência</span>
          </TabsTrigger>

          <TabsTrigger
            value="events"
            className="data-[state=active]:bg-brand data-[state=active]:text-white gap-2 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
          >
            <Calendar className="h-4 w-4" />
            <span>Eventos & Feriados</span>
            <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 border-gray-300">
              {relevantEvents.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="audit"
            className="data-[state=active]:bg-brand data-[state=active]:text-white gap-2 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Auditoria</span>
            <MarcaIA />
          </TabsTrigger>
        </TabsList>

        {/* Aba 1: Abaixo do Mercado (Oportunidades de Ganho & Yield) */}
        <TabsContent value="underpricing" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-success-600" />
                    Oportunidades de Yield & Ganho
                  </h3>
                  <p className="text-xs text-gray-500">Feriados e eventos sem reserva com diária abaixo do preço do evento, e noites órfãs entre reservas</p>
                </div>

                {/* Filtros de Status (no celular, a faixa rola de lado sem passar da tela) */}
                <div className="no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1 [&>button]:shrink-0">
                  <Button
                    variant={statusFilter === 'Pendente' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('Pendente')}
                    className={`h-7 text-xs ${statusFilter === 'Pendente' ? 'bg-success-600 text-white' : 'text-gray-600'}`}
                  >
                    Pendentes ({underpricingAlerts.filter(a => a.status === 'Pendente').length})
                  </Button>
                  <Button
                    variant={statusFilter === 'Aprovado' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('Aprovado')}
                    className={`h-7 text-xs ${statusFilter === 'Aprovado' ? 'bg-success-700 text-white' : 'text-gray-600'}`}
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
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-brand mb-2" />
                  Carregando oportunidades de precificação...
                </div>
              ) : underpricingAlerts.length === 0 ? (
                <div className="py-12 text-center text-gray-500 bg-white rounded-lg border p-6">
                  <ShieldCheck className="h-10 w-10 text-success-500 mx-auto mb-2" />
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

                    const propJoined = (alert as PricingAlert & { properties?: Property | null }).properties;
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
                            ? 'border-l-success-500 bg-success-50/10'
                            : isRejected
                            ? 'border-l-gray-400 opacity-60'
                            : isCritical
                            ? 'border-l-danger-500 shadow-xs'
                            : 'border-l-warning-500 shadow-xs'
                        }`}
                      >
                        <CardContent className="p-5">
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              {/* Badges de Imóvel, Tipo e Urgência */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className="bg-gray-100 text-gray-800 border-gray-300 font-bold text-xs flex items-center gap-1.5 shadow-2xs"
                                >
                                  <Building2 className="h-3.5 w-3.5 text-brand" />
                                  {propertyDisplayName}
                                </Badge>

                                <Badge
                                  variant="outline"
                                  className={
                                    isCritical
                                      ? 'bg-danger-50 text-danger-700 border-danger-200 font-bold animate-pulse'
                                      : alert.urgency === 'Alta'
                                      ? 'bg-warning-50 text-warning-700 border-warning-200'
                                      : 'bg-info-50 text-info-700 border-info-200'
                                  }
                                >
                                  Urgência {alert.urgency}
                                </Badge>

                                <Badge variant="secondary" className="text-xs">
                                  {isUnderpricing
                                    ? (NOME_DO_TIPO[alert.supporting_data?.regra_tipo || ''] || 'Feriado ou evento')
                                    : 'Preenchimento de Noite Órfã'}
                                </Badge>

                                <span className="text-xs text-gray-500 ml-auto flex items-center gap-1 font-medium">
                                  <Calendar className="h-3 w-3 text-brand" />
                                  {formatLocalDate(alert.target_start_date)} a{' '}
                                  {formatLocalDate(alert.target_end_date)}
                                </span>
                              </div>

                              {/* Justificativa Básica */}
                              <p className="text-sm text-gray-700 font-medium leading-relaxed">
                                {alert.reason}
                              </p>

                              {/* Raciocínio Analítico & Dados de Comprovação da IA */}
                              <div className="bg-brand/5 border border-brand/20 rounded-xl p-3.5 space-y-2.5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-brand">
                                    <Sparkles className="h-3.5 w-3.5 text-brand" />
                                    <span>Raciocínio da Sugestão & Dados Comprobatórios</span>
                                  </div>
                                  {alert.supporting_data?.confianca && (
                                    <span className={`text-[11px] px-2 py-0.5 rounded border font-medium shadow-xs ${
                                      alert.supporting_data.confianca === 'alta'
                                        ? 'bg-success-50 text-success-700 border-success-200'
                                        : 'bg-warning-50 text-warning-700 border-warning-200'
                                    }`}>
                                      Confiança {alert.supporting_data.confianca}
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
                                    {alert.supporting_data.regra_fator ? (
                                      <div className="bg-white p-2 rounded-lg border border-gray-100 flex items-start gap-2 shadow-xs">
                                        <Layers className="h-3.5 w-3.5 text-brand shrink-0 mt-0.5" />
                                        <div>
                                          <span className="font-semibold text-gray-800 block">
                                            Regra do imóvel: {percentual(Number(alert.supporting_data.regra_fator))}
                                          </span>
                                          <span className="text-gray-600">
                                            Aprendida de {ORIGEM_DA_REGRA[alert.supporting_data.regra_origem || ''] || alert.supporting_data.regra_origem}
                                            {alert.supporting_data.regra_amostras ? ` (${alert.supporting_data.regra_amostras} noites)` : ''}
                                            {alert.supporting_data.compset_amostras ? `; ${alert.supporting_data.compset_amostras} diárias de concorrentes` : ''}
                                          </span>
                                        </div>
                                      </div>
                                    ) : null}
                                    {alert.supporting_data.base_desatualizada ? (
                                      <div className="bg-warning-50/70 p-2 rounded-lg border border-warning-200 flex items-start gap-2 shadow-xs">
                                        <AlertTriangle className="h-3.5 w-3.5 text-warning-600 shrink-0 mt-0.5" />
                                        <div>
                                          <span className="font-semibold text-warning-900 block">Confira a diária base</span>
                                          <span className="text-warning-800">
                                            Ela está longe do que o imóvel vende em noite comum
                                            {alert.supporting_data.mediana_comum_vendida ? ` (${reais(Math.round(alert.supporting_data.mediana_comum_vendida))})` : ''}.
                                          </span>
                                        </div>
                                      </div>
                                    ) : alert.supporting_data.fonte_diaria_atual === 'calendario_coletado' ? (
                                      <div className="bg-white p-2 rounded-lg border border-gray-100 flex items-start gap-2 shadow-xs">
                                        <ShieldCheck className="h-3.5 w-3.5 text-success-600 shrink-0 mt-0.5" />
                                        <div>
                                          <span className="font-semibold text-gray-800 block">Tarifa conferida</span>
                                          <span className="text-gray-600">Diária atual lida do calendário do anúncio.</span>
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                )}
                              </div>

                              {/* Caixa Comparativa de Valores */}
                              <div className="grid grid-cols-2 gap-3 rounded-xl border bg-gray-50 p-3 text-xs sm:flex sm:items-center sm:gap-4">
                                <div>
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-gray-600 font-medium">Tarifa Atual</span>
                                    {alert.supporting_data?.fonte_diaria_atual === 'calendario_coletado' ? (
                                      <Badge
                                        variant="outline"
                                        className="bg-success-50 text-success-700 border-success-200 text-[10px] font-semibold py-0 px-1.5 shadow-2xs"
                                      >
                                        Seu Calendário
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant="outline"
                                        className="bg-gray-100 text-gray-600 border-gray-200 text-[10px] font-normal py-0 px-1.5"
                                      >
                                        Diária Base
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="font-mono text-sm font-semibold tabular-nums text-gray-800">
                                    {reais(alert.current_price)}/noite
                                  </span>
                                </div>

                                <ArrowRight className="mt-2 hidden h-4 w-4 text-gray-400 sm:block" />

                                <div>
                                  <span className="flex items-center gap-1.5 font-medium text-gray-600">Tarifa Sugerida <MarcaIA /></span>
                                  <span className="font-mono text-sm font-semibold tabular-nums text-brand">
                                    {reais(alert.suggested_price)}/noite
                                  </span>
                                </div>

                                <div className="sm:border-l sm:pl-4">
                                  <span className="text-gray-600 font-medium block">Estadia Mínima</span>
                                  <span className="font-semibold text-gray-700 text-sm">
                                    {alert.suggested_min_nights || 1} noites
                                  </span>
                                </div>

                                <div className="text-right sm:ml-auto sm:border-l sm:pl-4">
                                  <span className="text-success-700 font-semibold block">Ganho Estimado</span>
                                  <span className="font-bold text-success-600 text-sm">
                                    +{reais(alert.estimated_revenue_gain || 0)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Botões de Ação */}
                            <div className="flex w-full flex-wrap justify-end gap-2 md:w-auto md:min-w-[130px] md:flex-col [&>button]:flex-1 md:[&>button]:flex-none">
                              {alert.status === 'Pendente' ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleApproveAlert(alert, 'standard_raise')}
                                    disabled={isUpdatingStatus === alert.id}
                                    className="bg-success-600 hover:bg-success-700 text-white gap-1.5 h-8 text-xs font-semibold"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    {alert.alert_type === 'orphan_night' ? 'Aprovar Sugestão' : 'Aprovar Aumento'}
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
                                    isApproved ? 'bg-success-100 text-success-800' : 'bg-gray-100 text-gray-800'
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
                    <TrendingDown className="h-5 w-5 text-brand-600" />
                    Calibração de Tarifas & Risco de Vacância (Acima do Mercado)
                  </h3>
                  <p className="text-xs text-gray-500">Períodos onde sua diária no calendário está acima da mediana do CompSet. Escolha se deseja calibrar para acelerar reservas ou manter sua tarifa premium.</p>
                </div>

                {/* Filtros de Status (no celular, a faixa rola de lado sem passar da tela) */}
                <div className="no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1 [&>button]:shrink-0">
                  <Button
                    variant={statusFilter === 'Pendente' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('Pendente')}
                    className={`h-7 text-xs ${statusFilter === 'Pendente' ? 'bg-brand text-white' : 'text-gray-600'}`}
                  >
                    Pendentes ({overpricingAlerts.filter(a => a.status === 'Pendente').length})
                  </Button>
                  <Button
                    variant={statusFilter === 'Aprovado' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter('Aprovado')}
                    className={`h-7 text-xs ${statusFilter === 'Aprovado' ? 'bg-success-600 text-white' : 'text-gray-600'}`}
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
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-brand mb-2" />
                  Carregando alertas de calibração...
                </div>
              ) : overpricingAlerts.length === 0 ? (
                <div className="py-12 text-center text-gray-500 bg-white rounded-lg border p-6">
                  <ShieldCheck className="h-10 w-10 text-success-500 mx-auto mb-2" />
                  <p className="font-medium text-gray-700">Nenhum alerta de sobrepreço com status "{statusFilter}" no momento.</p>
                  <p className="text-xs text-gray-400 mt-1">
                    A calibração compara a diária do seu calendário com a dos concorrentes parecidos nas mesmas noites (datas livres, a partir de 3 dias). Aparece aqui quando a sua ficar mais de 25% acima deles.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {overpricingAlerts.map(alert => {
                    const isCritical = alert.urgency === 'Crítica';
                    const isApproved = alert.status === 'Aprovado';
                    const isRejected = alert.status === 'Rejeitado';

                    const propJoined = (alert as PricingAlert & { properties?: Property | null }).properties;
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
                            ? 'border-l-success-500 bg-success-50/10'
                            : isRejected
                            ? 'border-l-gray-400 opacity-60'
                            : isCritical
                            ? 'border-l-brand-600 shadow-xs'
                            : 'border-l-brand shadow-xs'
                        }`}
                      >
                        <CardContent className="p-5">
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              {/* Badges de Imóvel, Posição de Mercado e Urgência */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className="bg-gray-100 text-gray-800 border-gray-300 font-bold text-xs flex items-center gap-1.5 shadow-2xs"
                                >
                                  <Building2 className="h-3.5 w-3.5 text-brand" />
                                  {propertyDisplayName}
                                </Badge>

                                <Badge
                                  variant="outline"
                                  className="bg-brand-50 text-brand-700 border-brand-200 font-bold text-xs flex items-center gap-1"
                                >
                                  <TrendingDown className="h-3 w-3" />
                                  +{diffPct}% Acima do CompSet
                                </Badge>

                                <Badge
                                  variant="outline"
                                  className={
                                    isCritical
                                      ? 'bg-danger-50 text-danger-700 border-danger-200 font-bold'
                                      : 'bg-info-50 text-info-700 border-info-200'
                                  }
                                >
                                  Urgência {alert.urgency}
                                </Badge>

                                <span className="text-xs text-gray-500 ml-auto flex items-center gap-1 font-medium">
                                  <Calendar className="h-3 w-3 text-brand" />
                                  {formatLocalDate(alert.target_start_date)} a{' '}
                                  {formatLocalDate(alert.target_end_date)}
                                </span>
                              </div>

                              {/* Justificativa Básica */}
                              <p className="text-sm text-gray-700 font-medium leading-relaxed">
                                {alert.reason}
                              </p>

                              {/* Raciocínio de Mercado & Análise de Risco */}
                              <div className="bg-brand-50/50 border border-brand-200/60 rounded-xl p-3.5 space-y-2.5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-brand-800">
                                    <Sparkles className="h-3.5 w-3.5 text-brand-600" />
                                    <span>Raciocínio de Mercado & Análise de Risco</span>
                                  </div>
                                  {alert.supporting_data?.calculation_formula && (
                                    <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-brand-200 text-brand-800 font-medium shadow-xs">
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
                                      <div className="bg-white p-2 rounded-lg border border-brand-100 flex items-start gap-2 shadow-xs">
                                        <Layers className="h-3.5 w-3.5 text-brand-600 shrink-0 mt-0.5" />
                                        <div>
                                          <span className="font-semibold text-gray-800 block">Comprovação de Mercado:</span>
                                          <span className="text-gray-600">{alert.supporting_data.market_evidence}</span>
                                        </div>
                                      </div>
                                    )}
                                    {alert.supporting_data.risk_analysis && (
                                      <div className="bg-white p-2 rounded-lg border border-warning-200 flex items-start gap-2 shadow-xs">
                                        <AlertTriangle className="h-3.5 w-3.5 text-warning-600 shrink-0 mt-0.5" />
                                        <div>
                                          <span className="font-semibold text-gray-800 block">Análise de Risco de Vacância:</span>
                                          <span className="text-warning-700">{alert.supporting_data.risk_analysis}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Caixa Comparativa de Valores */}
                              <div className="grid grid-cols-2 gap-3 rounded-xl border bg-gray-50 p-3 text-xs sm:flex sm:items-center sm:gap-4">
                                <div>
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-gray-600 font-medium">Sua Diária Atual</span>
                                    <Badge
                                      variant="outline"
                                      className="bg-brand-50 text-brand-700 border-brand-200 text-[10px] font-semibold py-0 px-1.5 shadow-2xs"
                                    >
                                      Seu Calendário
                                    </Badge>
                                  </div>
                                  <span className="font-mono text-sm font-semibold tabular-nums text-gray-900">
                                    {reais(alert.current_price)}/noite
                                  </span>
                                </div>

                                <ArrowRight className="mt-2 hidden h-4 w-4 text-gray-400 sm:block" />

                                <div>
                                  <span className="flex flex-wrap items-center gap-1.5 font-medium text-gray-600">Mediana CompSet (Sugerida) <MarcaIA /></span>
                                  <span className="font-mono text-sm font-semibold tabular-nums text-brand">
                                    {reais(alert.suggested_price)}/noite
                                  </span>
                                </div>

                                <div className="sm:border-l sm:pl-4">
                                  <span className="text-gray-600 font-medium block">Estadia Mínima</span>
                                  <span className="font-semibold text-gray-700 text-sm">
                                    {alert.suggested_min_nights || 1} noites
                                  </span>
                                </div>

                                <div className="text-right sm:ml-auto sm:border-l sm:pl-4">
                                  <span className="text-brand-700 font-medium block">Posicionamento</span>
                                  <span className="font-bold text-brand-700 text-sm">
                                    Tarifa Premium (+{diffPct}%)
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Botões de Ação para Overpricing */}
                            <div className="flex w-full flex-wrap justify-end gap-2 md:w-auto md:min-w-[170px] md:flex-col [&>button]:flex-1 md:[&>button]:flex-none">
                              {alert.status === 'Pendente' ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleApproveAlert(alert, 'adjust_to_market')}
                                    disabled={isUpdatingStatus === alert.id}
                                    className="bg-brand hover:bg-brand-hover text-white gap-1.5 h-8 text-xs font-semibold shadow-xs"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Calibrar p/ {reais(alert.suggested_price)}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleApproveAlert(alert, 'keep_premium')}
                                    disabled={isUpdatingStatus === alert.id}
                                    className="border-brand-300 text-brand-700 hover:bg-brand-50 gap-1.5 h-8 text-xs font-semibold"
                                  >
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    Manter {reais(alert.current_price)}
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
                                    isApproved ? 'bg-success-100 text-success-800' : 'bg-gray-100 text-gray-800'
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
        regras={regras}
      />
    </TabsContent>

    {/* Aba 3: Eventos Locais & Demanda Expandida */}
    <TabsContent value="events" className="mt-0">
      <EventsCalendarTab
        events={relevantEvents}
        properties={activeSelectedProperties}
        selectedProperty={selectedProperty}
        reservations={reservations}
        regras={regras}
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
