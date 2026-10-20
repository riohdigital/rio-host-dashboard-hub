import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, Home, Layers, Sparkles } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useDateRange } from '@/hooks/dashboard/useDateRange';
import { Property } from '@/types/property';
import { PricingOverview, ConcorrentesEmReconstrucao } from '@/components/pricing/PricingOverview';
import { ReservationsAuditTab } from '@/components/pricing/ReservationsAuditTab';
import { formatLocalDate } from '@/utils/dateUtils';

/**
 * Precificação sobre dados reais de cada usuário: reservas, cadastro e eventos da cidade
 * dos imóveis. Multi-inquilino: nada fixo no código (regra P0). Histórico da reconstrução
 * (20/10/2026) em n8n-manager/projects/rioh-host/docs/DIAGNOSTICO_PRECIFICACAO_2026-10-20.md.
 */
const PrecificacaoPage: React.FC = () => {
  const { hasPermission, getAccessibleProperties, isMaster, loading: permissionsLoading } = useUserPermissions();
  const { selectedProperties, selectedPeriod, customStartDate, customEndDate } = useGlobalFilters();
  const { startDateString, endDateString } = useDateRange(selectedPeriod, customStartDate, customEndDate);

  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('properties').select('*').order('name', { ascending: true });
      if (error) {
        console.error('Erro ao buscar propriedades na PrecificacaoPage:', error);
        return;
      }
      let lista = (data as Property[]) || [];
      if (!isMaster() && !hasPermission('properties_view_all')) {
        const acessiveis = getAccessibleProperties();
        lista = lista.filter((p) => acessiveis.includes(p.id));
      }
      setProperties(lista);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seleção do filtro global: todas, um imóvel ou um subconjunto.
  const todas = !selectedProperties || selectedProperties.length === 0 || selectedProperties.includes('todas');
  const selecionados = useMemo(
    () => (todas ? properties : properties.filter((p) => selectedProperties.includes(p.id))),
    [todas, properties, selectedProperties],
  );
  // Sem diária base cadastrada não há o que precificar: o imóvel fica fora da análise.
  const analisados = useMemo(() => selecionados.filter((p) => Number(p.base_nightly_price) > 0), [selecionados]);
  const foraDaAnalise = selecionados.filter((p) => !(Number(p.base_nightly_price) > 0));
  const unico = selecionados.length === 1 ? selecionados[0] : null;

  if (permissionsLoading && properties.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center text-gray-500">Carregando permissões...</div>
      </div>
    );
  }

  const podeAcessar = hasPermission('properties_view_all') || hasPermission('properties_view_assigned') || isMaster();
  if (!podeAcessar) {
    return (
      <div className="min-h-screen space-y-6 bg-[#F8F9FA] p-6">
        <h1 className="text-3xl font-bold text-gradient-primary">Precificação</h1>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Você não tem permissão para ver a Precificação. Fale com o administrador.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const rotuloPeriodo = () => {
    if (selectedPeriod === 'current_year') return `Ano atual (${new Date().getFullYear()})`;
    if (selectedPeriod === 'current_month') return 'Mês atual';
    if (selectedPeriod === 'general') return 'Todo o histórico';
    return `${formatLocalDate(startDateString)} a ${formatLocalDate(endDateString)}`;
  };

  return (
    <div className="min-h-screen space-y-6 bg-[#F8F9FA] p-4 sm:p-6">
      <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-gradient-primary sm:text-3xl">
            <Sparkles className="h-6 w-6 text-[#6A6DDF]" />
            Precificação
          </h1>
          <p className="mt-1 text-sm text-gray-600">Ocupação, diárias e datas de oportunidade dos seus imóveis, com dados reais de reservas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1.5 border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700">
            {unico ? <Home className="h-3.5 w-3.5 text-[#6A6DDF]" /> : <Layers className="h-3.5 w-3.5 text-[#6A6DDF]" />}
            {unico ? nomeDoImovel(unico) : todas ? `Todos os imóveis (${analisados.length})` : `${analisados.length} imóveis selecionados`}
          </Badge>
          {foraDaAnalise.length > 0 && (
            <Badge variant="outline" className="border-gray-200 bg-white px-3 py-1.5 text-xs font-normal text-gray-500">
              Fora da análise, sem diária base: {foraDaAnalise.map(nomeDoImovel).join(', ')}
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="visao" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-white p-1 shadow-none ring-1 ring-gray-200">
          <TabsTrigger value="visao" className="data-[state=active]:bg-[#6A6DDF] data-[state=active]:text-white">
            Visão geral
          </TabsTrigger>
          <TabsTrigger value="concorrentes" className="data-[state=active]:bg-[#6A6DDF] data-[state=active]:text-white">
            Concorrentes
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="data-[state=active]:bg-[#6A6DDF] data-[state=active]:text-white">
            Auditoria de reservas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="mt-0">
          <PricingOverview properties={analisados} />
        </TabsContent>

        <TabsContent value="concorrentes" className="mt-0">
          <ConcorrentesEmReconstrucao />
        </TabsContent>

        <TabsContent value="auditoria" className="mt-0 space-y-2">
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar className="h-3.5 w-3.5" /> Período do filtro: {rotuloPeriodo()}
          </p>
          <ReservationsAuditTab
            propertyId={unico ? unico.id : 'todas'}
            selectedProperty={unico}
            selectedPropertyIds={selectedProperties}
            dateRange={{ startDateString, endDateString, selectedPeriod }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

function nomeDoImovel(p: Property) {
  return p.nickname || p.name;
}

export default PrecificacaoPage;
