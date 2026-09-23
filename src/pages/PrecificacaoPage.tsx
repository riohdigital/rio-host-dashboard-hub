import React, { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, Home, AlertTriangle, Layers, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useDateRange } from '@/hooks/dashboard/useDateRange';
import { Property } from '@/types/property';
import PropertyPricingDashboard from '@/components/pricing/PropertyPricingDashboard';
import { formatLocalDate } from '@/utils/dateUtils';

const PrecificacaoPage: React.FC = () => {
  const { hasPermission, getAccessibleProperties, isMaster, loading: permissionsLoading } = useUserPermissions();
  const { selectedProperties, selectedPeriod, customStartDate, customEndDate } = useGlobalFilters();
  const { startDate, endDate, startDateString, endDateString } = useDateRange(selectedPeriod, customStartDate, customEndDate);
  
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  // Busca lista de propriedades acessíveis
  const fetchProperties = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      let filtered = (data as Property[]) || [];
      if (!isMaster() && !hasPermission('properties_view_all')) {
        const accessible = getAccessibleProperties();
        filtered = filtered.filter(p => accessible.includes(p.id));
      }

      setProperties(filtered);
    } catch (e) {
      console.error('Erro ao buscar propriedades na PrecificacaoPage:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  if (permissionsLoading && properties.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-gray-500">Carregando permissões...</div>
      </div>
    );
  }

  const canAccess = hasPermission('properties_view_all') || hasPermission('properties_view_assigned') || isMaster();

  if (!canAccess) {
    return (
      <div className="p-6 space-y-6 bg-[#F8F9FA] min-h-screen">
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-3xl font-bold text-gradient-primary">Precificação & Yield</h1>
          <p className="text-gray-600 mt-2">Inteligência de mercado e rentabilidade de tarifas</p>
        </div>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Você não tem permissão para visualizar o Radar de Precificação. Entre em contato com o administrador.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Resolução do imóvel selecionado via seletor global
  const isAllSelected = !selectedProperties || selectedProperties.length === 0 || selectedProperties.includes('todas');
  const isSingleProperty = !isAllSelected && selectedProperties.length === 1;
  const selectedPropertyId = isSingleProperty ? selectedProperties[0] : 'todas';
  const selectedProperty = isSingleProperty ? properties.find(p => p.id === selectedPropertyId) : null;

  // Rótulo amigável do período ativo
  const getPeriodBadgeLabel = () => {
    if (selectedPeriod === 'current_year') return `Ano Atual (${new Date().getFullYear()})`;
    if (selectedPeriod === 'current_month') return 'Mês Atual';
    if (selectedPeriod === 'general') return 'Geral (Todo Histórico)';
    if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
      return `${formatLocalDate(startDateString)} a ${formatLocalDate(endDateString)}`;
    }
    return `${formatLocalDate(startDateString)} a ${formatLocalDate(endDateString)}`;
  };

  return (
    <div className="p-6 space-y-6 bg-[#F8F9FA] min-h-screen">
      {/* Header com Título e Badges Informativos do Filtro Global */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gradient-primary flex items-center gap-2.5">
            <Sparkles className="h-7 w-7 text-[#6A6DDF]" />
            Precificação & Yield Estratégico
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            Inteligência de mercado, oportunidades de receita e mitigação de risco sincronizadas com os filtros globais.
          </p>
        </div>

        {/* Badges de Contexto Ativo (Controlados pelo Menu Lateral) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Badge do Imóvel Selecionado */}
          {isAllSelected ? (
            <Badge variant="outline" className="bg-white border-gray-200 text-gray-700 py-1.5 px-3 flex items-center gap-1.5 shadow-2xs text-xs font-medium">
              <Layers className="h-3.5 w-3.5 text-[#6A6DDF]" />
              <span>Visão Geral ({properties.length} Imóveis)</span>
            </Badge>
          ) : isSingleProperty && selectedProperty ? (
            <Badge variant="outline" className="bg-white border-emerald-200 text-gray-800 py-1.5 px-3 flex items-center gap-2 shadow-2xs text-xs font-semibold">
              <span className={`w-2 h-2 rounded-full ${selectedProperty.status === 'Ativo' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              <Home className="h-3.5 w-3.5 text-[#6A6DDF]" />
              <span>{selectedProperty.name}</span>
              {selectedProperty.nickname && (
                <span className="text-gray-500 font-normal">({selectedProperty.nickname})</span>
              )}
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-white border-indigo-200 text-gray-800 py-1.5 px-3 flex items-center gap-1.5 shadow-2xs text-xs font-medium">
              <Home className="h-3.5 w-3.5 text-[#6A6DDF]" />
              <span>{selectedProperties.length} Imóveis Selecionados</span>
            </Badge>
          )}

          {/* Badge do Período Ativo */}
          <Badge variant="outline" className="bg-[#6A6DDF]/5 border-[#6A6DDF]/20 text-[#6A6DDF] py-1.5 px-3 flex items-center gap-1.5 shadow-2xs text-xs font-medium">
            <Calendar className="h-3.5 w-3.5 text-[#6A6DDF]" />
            <span>{getPeriodBadgeLabel()}</span>
          </Badge>
        </div>
      </div>

      {/* Componente Individual de Precificação com Dados Filtrados */}
      <PropertyPricingDashboard
        propertyId={selectedPropertyId}
        selectedPropertyIds={selectedProperties}
        properties={properties}
        dateRange={{
          startDate,
          endDate,
          startDateString,
          endDateString,
          selectedPeriod
        }}
        onRefresh={fetchProperties}
      />
    </div>
  );
};

export default PrecificacaoPage;

