import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, Home, AlertTriangle, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { Property } from '@/types/property';
import PropertyPricingDashboard from '@/components/pricing/PropertyPricingDashboard';

const PrecificacaoPage: React.FC = () => {
  const { hasPermission, canAccessProperty, getAccessibleProperties, isMaster, loading: permissionsLoading } = useUserPermissions();
  const { selectedProperties } = useGlobalFilters();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('todas');

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

      // Sincroniza com filtro global se houver apenas um selecionado
      if (selectedProperties && selectedProperties.length === 1 && selectedProperties[0] !== 'todas') {
        setSelectedPropertyId(selectedProperties[0]);
      }
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

  return (
    <div className="p-6 space-y-6 bg-[#F8F9FA] min-h-screen">
      {/* Header com Título e Seletor de Imóvel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gradient-primary flex items-center gap-2.5">
            <Sparkles className="h-7 w-7 text-[#6A6DDF]" />
            Precificação & Yield Estratégico
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            Monitore a demanda de mercado por imóvel, aprove sugestões de tarifa e maximize a receita.
          </p>
        </div>

        {/* Seletor de Imóvel */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">Propriedade:</span>
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger className="w-[260px] bg-white border shadow-xs h-9 text-xs">
              <SelectValue placeholder="Selecione o imóvel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">
                <span className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-[#6A6DDF]" />
                  Visão Geral (Todos os Imóveis)
                </span>
              </SelectItem>
              {properties.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex items-center gap-2">
                    <Home className="h-3.5 w-3.5 text-gray-500" />
                    {p.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Carrossel / Pills Rápidos dos Imóveis */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedPropertyId('todas')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap border ${
            selectedPropertyId === 'todas'
              ? 'bg-[#6A6DDF] text-white border-[#6A6DDF] shadow-xs'
              : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'
          }`}
        >
          Todos ({properties.length})
        </button>

        {properties.map(p => {
          const isSelected = selectedPropertyId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setSelectedPropertyId(p.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 border ${
                isSelected
                  ? 'bg-[#6A6DDF] text-white border-[#6A6DDF] shadow-xs'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'
              }`}
            >
              <span>{p.name}</span>
              {p.status === 'Ativo' ? (
                <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-emerald-500'}`} />
              ) : (
                <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-gray-300' : 'bg-gray-400'}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Componente Individual de Precificação */}
      <PropertyPricingDashboard
        propertyId={selectedPropertyId}
        properties={properties}
        onRefresh={fetchProperties}
      />
    </div>
  );
};

export default PrecificacaoPage;
