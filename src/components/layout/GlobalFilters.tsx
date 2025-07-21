
import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/types/property';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import PropertyMultiSelect from '@/components/dashboard/PropertyMultiSelect';

const GlobalFilters = () => {
  const { selectedProperties, selectedPeriod, setSelectedProperties, setSelectedPeriod } = useGlobalFilters();
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertySelectOpen, setPropertySelectOpen] = useState(false);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const { hasPermission, getAccessibleProperties, isMaster, loading: permissionsLoading } = useUserPermissions();

  useEffect(() => {
    const fetchProps = async () => {
      if (permissionsLoading) return;
      
      setPropertiesLoading(true);
      const { data, error } = await supabase.from('properties').select('*').order('name');
      if (error) {
        console.error("Erro ao carregar propriedades", error);
      } else {
        let filteredProperties = data || [];
        if (!isMaster() && !hasPermission('properties_view_all')) {
          const accessiblePropertyIds = getAccessibleProperties();
          filteredProperties = data?.filter(property => 
            accessiblePropertyIds.includes(property.id)
          ) || [];
        }
        
        setProperties(filteredProperties);
        if (filteredProperties.length > 0 && selectedProperties.includes('todas')) {
          setSelectedProperties(
            !isMaster() && !hasPermission('properties_view_all')
              ? filteredProperties.map(p => p.id) 
              : ['todas']
          );
        }
      }
      setPropertiesLoading(false);
    };
    fetchProps();
  }, [permissionsLoading, isMaster, hasPermission, getAccessibleProperties, selectedProperties, setSelectedProperties]);

  const generatePeriodOptions = () => {
    const now = new Date();
    const currentMonth = format(now, 'MMMM', { locale: ptBR });
    const currentYear = now.getFullYear();
    
    const lastMonth = format(subMonths(now, 1), 'MMMM', { locale: ptBR });
    const nextMonth = format(addMonths(now, 1), 'MMMM', { locale: ptBR });
    
    const last3Months = Array.from({ length: 3 }, (_, i) => 
      format(subMonths(now, i + 1), 'MMM', { locale: ptBR })
    ).join('/');
    
    const last6Start = format(subMonths(now, 6), 'MMM', { locale: ptBR });
    const last6End = format(subMonths(now, 1), 'MMM', { locale: ptBR });
    
    const next3Months = Array.from({ length: 3 }, (_, i) => 
      format(addMonths(now, i + 1), 'MMM', { locale: ptBR })
    ).join('/');
    
    const next6Start = format(addMonths(now, 1), 'MMM', { locale: ptBR });
    const next6End = format(addMonths(now, 6), 'MMM', { locale: ptBR });
    
    const next12Start = format(addMonths(now, 1), 'MMM', { locale: ptBR });
    const next12End = format(addMonths(now, 12), 'MMM', { locale: ptBR });

    return [
      { value: 'current_month', label: `Mês Atual (${currentMonth})`, group: 'Atual' },
      { value: 'current_year', label: `Ano Atual (${currentYear})`, group: 'Atual' },
      { value: 'general', label: 'Geral (Todo Histórico)', group: 'Atual' },
      { value: 'last_month', label: `Último Mês (${lastMonth})`, group: 'Passado' },
      { value: 'last_3_months', label: `Últimos 3 Meses (${last3Months})`, group: 'Passado' },
      { value: 'last_6_months', label: `Últimos 6 Meses (${last6Start}-${last6End})`, group: 'Passado' },
      { value: 'last_year', label: `Ano Passado (${currentYear - 1})`, group: 'Passado' },
      { value: 'next_month', label: `Próximo Mês (${nextMonth})`, group: 'Futuro' },
      { value: 'next_3_months', label: `Próximos 3 Meses (${next3Months})`, group: 'Futuro' },
      { value: 'next_6_months', label: `Próximos 6 Meses (${next6Start}-${next6End})`, group: 'Futuro' },
      { value: 'next_12_months', label: `Próximos 12 Meses (${next12Start}-${next12End})`, group: 'Futuro' }
    ];
  };

  const periodOptions = generatePeriodOptions();

  if (propertiesLoading || permissionsLoading) {
    return (
      <div className="px-4 py-2 space-y-3">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Filtros</div>
        <div className="space-y-2">
          <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-2 space-y-3">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Filtros</div>
      <div className="space-y-2">
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            {['Atual', 'Passado', 'Futuro'].map(group => (
              <div key={group}>
                <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider border-t mt-1 pt-2 first:mt-0 first:border-t-0">{group}</div>
                {periodOptions.filter(o => o.group === group).map(o => 
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                )}
              </div>
            ))}
          </SelectContent>
        </Select>
        
        <PropertyMultiSelect 
          properties={properties} 
          selectedProperties={selectedProperties} 
          onSelectionChange={setSelectedProperties} 
          isOpen={propertySelectOpen} 
          onToggle={() => setPropertySelectOpen(!propertySelectOpen)}
          compact={true}
        />
      </div>
    </div>
  );
};

export default GlobalFilters;
