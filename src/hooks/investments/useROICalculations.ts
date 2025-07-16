
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PropertyROI } from '@/types/investment';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';

export const useROICalculations = () => {
  const [roiData, setRoiData] = useState<PropertyROI[]>([]);
  const [loading, setLoading] = useState(true);
  const { isMaster, getAccessibleProperties, loading: permissionsLoading } = useUserPermissions();

  const calculateROI = async () => {
    if (permissionsLoading) return;
    
    try {
      setLoading(true);

      // Buscar propriedades baseado nas permissões
      let propertiesQuery = supabase
        .from('properties')
        .select('id, name, nickname');

      if (!isMaster()) {
        const accessibleProperties = getAccessibleProperties();
        if (accessibleProperties.length === 0) {
          setRoiData([]);
          setLoading(false);
          return;
        }
        propertiesQuery = propertiesQuery.in('id', accessibleProperties);
      }

      const { data: properties, error: propertiesError } = await propertiesQuery;

      if (propertiesError) throw propertiesError;

      const roiCalculations = await Promise.all(
        (properties || []).map(async (property) => {
          // Buscar investimentos da propriedade
          const { data: investments } = await supabase
            .from('property_investments')
            .select('amount')
            .eq('property_id', property.id);

          // Buscar receitas da propriedade
          const { data: reservations } = await supabase
            .from('reservations')
            .select('net_revenue, total_revenue')
            .eq('property_id', property.id)
            .not('net_revenue', 'is', null);

          // Buscar despesas da propriedade
          const { data: expenses } = await supabase
            .from('expenses')
            .select('amount')
            .eq('property_id', property.id);

          const totalInvestment = (investments || []).reduce((sum, inv) => sum + Number(inv.amount), 0);
          const totalRevenue = (reservations || []).reduce((sum, res) => sum + Number(res.total_revenue || 0), 0);
          const netRevenue = (reservations || []).reduce((sum, res) => sum + Number(res.net_revenue || 0), 0);
          const totalExpenses = (expenses || []).reduce((sum, exp) => sum + Number(exp.amount), 0);

          const finalNetRevenue = netRevenue - totalExpenses;
          const roiPercentage = totalInvestment > 0 ? (finalNetRevenue / totalInvestment) * 100 : 0;
          const investmentRecoveredPercentage = totalInvestment > 0 ? (finalNetRevenue / totalInvestment) * 100 : 0;
          const paybackMonths = totalInvestment > 0 && finalNetRevenue > 0 
            ? Math.ceil(totalInvestment / (finalNetRevenue / 12)) 
            : 0;

          // Calcular data de break-even (aproximada)
          let breakEvenDate: string | undefined;
          if (paybackMonths > 0 && paybackMonths < 120) { // Máximo 10 anos
            const breakEven = new Date();
            breakEven.setMonth(breakEven.getMonth() + paybackMonths);
            breakEvenDate = breakEven.toISOString().split('T')[0];
          }

          return {
            property_id: property.id,
            property_name: property.name,
            property_nickname: property.nickname,
            total_investment: totalInvestment,
            total_revenue: totalRevenue,
            total_expenses: totalExpenses,
            net_revenue: finalNetRevenue,
            roi_percentage: roiPercentage,
            payback_months: paybackMonths,
            break_even_date: breakEvenDate,
            is_profitable: finalNetRevenue > 0,
            investment_recovered_percentage: Math.min(investmentRecoveredPercentage, 100)
          } as PropertyROI;
        })
      );

      setRoiData(roiCalculations.filter(roi => roi.total_investment > 0));
    } catch (error) {
      console.error('Erro ao calcular ROI:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!permissionsLoading) {
      calculateROI();
    }
  }, [permissionsLoading]);

  return {
    roiData,
    loading,
    refetch: calculateROI
  };
};
