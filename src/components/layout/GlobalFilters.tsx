
import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/types/property';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import PropertyMultiSelect from '@/components/dashboard/PropertyMultiSelect';
import { DatePicker } from '@/components/ui/date-picker';
import { CalendarDays } from 'lucide-react';
import { toast } from 'sonner';

const GlobalFilters = () => {
  const { 
    selectedProperties, 
    selectedPeriod, 
    selectedPlatform, 
    customStartDate, 
    customEndDate,
    setSelectedProperties, 
    setSelectedPeriod, 
    setSelectedPlatform,
    setCustomStartDate,
    setCustomEndDate
  } = useGlobalFilters();
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
      }
      setPropertiesLoading(false);
    };
    fetchProps();
  }, [permissionsLoading, isMaster, hasPermission, getAccessibleProperties]);

  // Separate effect to handle initial property selection
  useEffect(() => {
    if (properties.length > 0 && selectedProperties.includes('todas') && !isMaster() && !hasPermission('properties_view_all')) {
      setSelectedProperties(properties.map(p => p.id));
    }
  }, [properties, isMaster, hasPermission, setSelectedProperties]);

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
      { value: 'custom', label: 'Período Personalizado', group: 'Atual' },
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

  const handleStartDateChange = (date: Date | undefined) => {
    if (date && customEndDate && date > customEndDate) {
      toast.error('A data inicial não pode ser posterior à data final');
      return;
    }
    setCustomStartDate(date);
  };

  const handleEndDateChange = (date: Date | undefined) => {
    if (date && customStartDate && date < customStartDate) {
      toast.error('A data final não pode ser anterior à data inicial');
      return;
    }
    setCustomEndDate(date);
  };

  const getCustomPeriodLabel = () => {
    if (customStartDate && customEndDate) {
      return `${format(customStartDate, 'dd/MM/yyyy')} - ${format(customEndDate, 'dd/MM/yyyy')}`;
    }
    return 'Período Personalizado';
  };

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
            <SelectValue>
              {selectedPeriod === 'custom' && customStartDate && customEndDate 
                ? getCustomPeriodLabel()
                : periodOptions.find(o => o.value === selectedPeriod)?.label || 'Período'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {['Atual', 'Passado', 'Futuro'].map(group => (
              <div key={group}>
                <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider border-t mt-1 pt-2 first:mt-0 first:border-t-0">{group}</div>
                {periodOptions.filter(o => o.group === group).map(o => 
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.value === 'custom' && (
                      <div className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        <span>{o.label}</span>
                      </div>
                    )}
                    {o.value !== 'custom' && o.label}
                  </SelectItem>
                )}
              </div>
            ))}
          </SelectContent>
        </Select>

        {selectedPeriod === 'custom' && (
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
            <div className="space-y-1">
              <label className="text-xs font-medium">Data Inicial</label>
              <DatePicker 
                date={customStartDate} 
                onDateChange={handleStartDateChange}
                placeholder="Selecione a data inicial"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Data Final</label>
              <DatePicker 
                date={customEndDate} 
                onDateChange={handleEndDateChange}
                placeholder="Selecione a data final"
              />
            </div>
            {customStartDate && customEndDate && (
              <div className="text-xs text-muted-foreground text-center pt-1">
                {Math.ceil((customEndDate.getTime() - customStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1} dias selecionados
              </div>
            )}
          </div>
        )}
        
        <PropertyMultiSelect 
          properties={properties} 
          selectedProperties={selectedProperties} 
          onSelectionChange={setSelectedProperties} 
          isOpen={propertySelectOpen} 
          onToggle={() => setPropertySelectOpen(!propertySelectOpen)}
          compact={true}
        />

        <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Plataforma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Plataformas</SelectItem>
            <SelectItem value="Airbnb">Airbnb</SelectItem>
            <SelectItem value="Booking.com">Booking.com</SelectItem>
            <SelectItem value="Direto">Direto</SelectItem>
            <SelectItem value="VRBO">VRBO</SelectItem>
            <SelectItem value="Hospedagem.com">Hospedagem.com</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default GlobalFilters;
