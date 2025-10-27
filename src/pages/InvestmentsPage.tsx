
import React, { useState, useEffect } from 'react';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useDateRange } from '@/hooks/dashboard/useDateRange';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { TrendingUp, DollarSign, Plus, BarChart3, AlertTriangle, Receipt } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import InvestmentForm from '@/components/investments/InvestmentForm';
import InvestmentsList from '@/components/investments/InvestmentsList';
import PropertyInvestmentSummaryTable from '@/components/investments/PropertyInvestmentSummaryTable';
import PropertySelector from '@/components/investments/PropertySelector';
import { usePropertyInvestments } from '@/hooks/investments/usePropertyInvestments';
import { useROICalculations } from '@/hooks/investments/useROICalculations';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/types/property';
import { Reservation } from '@/types/reservation';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

const InvestmentsPage = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [reservationsLoading, setReservationsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const { investments, loading: investmentsLoading, createInvestment, deleteInvestment } = usePropertyInvestments();
  const { roiData, loading: roiLoading, refetch: refetchROI } = useROICalculations();
  const { hasPermission, getAccessibleProperties, loading: permissionsLoading } = useUserPermissions();
  const { selectedProperties, selectedPeriod, customStartDate, customEndDate } = useGlobalFilters();
  const { startDateString, endDateString } = useDateRange(selectedPeriod, customStartDate, customEndDate);
  const { isVisible, shouldRefetch } = usePageVisibility();

  // Carregar propriedades
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const accessibleProperties = getAccessibleProperties();
        
        let query = supabase
          .from('properties')
          .select('*')
          .order('name');

        // Apply filters based on permissions
        if (accessibleProperties.length > 0) {
          query = query.in('id', accessibleProperties);
        }

        const { data, error } = await query;

        if (error) throw error;
        setProperties(data || []);
      } catch (error) {
        console.error('Erro ao carregar propriedades:', error);
      } finally {
        setPropertiesLoading(false);
      }
    };

    if (!permissionsLoading) {
      fetchProperties();
    }
  }, [permissionsLoading, getAccessibleProperties]);

  // Effect para refetch quando página volta a ficar visível
  useEffect(() => {
    if (isVisible && shouldRefetch() && !permissionsLoading) {
      // Re-fetch data when page becomes visible after being hidden
      const accessibleProperties = getAccessibleProperties();
      
      const refetchProperties = async () => {
        try {
          let query = supabase
            .from('properties')
            .select('*')
            .order('name');

          if (accessibleProperties.length > 0) {
            query = query.in('id', accessibleProperties);
          }

          const { data, error } = await query;
          if (error) throw error;
          setProperties(data || []);
        } catch (error) {
          console.error('Erro ao carregar propriedades:', error);
        }
      };

      const refetchReservations = async () => {
        try {
          let query = supabase
            .from('reservations')
            .select('*')
            .order('check_in_date', { ascending: false });

          if (selectedPeriod !== 'general') {
            query = query
              .gte('check_in_date', startDateString)
              .lte('check_out_date', endDateString);
          }

          if (accessibleProperties.length > 0) {
            query = query.in('property_id', accessibleProperties);
          }

          const { data, error } = await query;
          if (error) throw error;
          setReservations(data || []);
        } catch (error) {
          console.error('Erro ao carregar reservations:', error);
        }
      };

      setPropertiesLoading(true);
      setReservationsLoading(true);
      Promise.all([refetchProperties(), refetchReservations()]).finally(() => {
        setPropertiesLoading(false);
        setReservationsLoading(false);
      });
    }
  }, [isVisible]);

// Carregar reservations
useEffect(() => {
  const fetchReservations = async () => {
    try {
      const accessibleProperties = getAccessibleProperties();
      let query = supabase
        .from('reservations')
        .select('*')
        .order('check_in_date', { ascending: false });

      if (selectedPeriod !== 'general') {
        query = query
          .gte('check_in_date', startDateString)
          .lte('check_out_date', endDateString);
      }

      if (accessibleProperties.length > 0) {
        query = query.in('property_id', accessibleProperties);
      }

      const { data, error } = await query;
      if (error) throw error;
      setReservations(data || []);
    } catch (error) {
      console.error('Erro ao carregar reservations:', error);
    } finally {
      setReservationsLoading(false);
    }
  };

  if (!permissionsLoading) {
    fetchReservations();
  }
}, [permissionsLoading, getAccessibleProperties]);

// Refetch automático ao alterar período global
useEffect(() => {
  if (!permissionsLoading) {
    (async () => {
      try {
        setReservationsLoading(true);
        const accessibleProperties = getAccessibleProperties();
        let query = supabase
          .from('reservations')
          .select('*')
          .order('check_in_date', { ascending: false });
        if (selectedPeriod !== 'general') {
          query = query
            .gte('check_in_date', startDateString)
            .lte('check_out_date', endDateString);
        }
        if (accessibleProperties.length > 0) {
          query = query.in('property_id', accessibleProperties);
        }
        const { data, error } = await query;
        if (error) throw error;
        setReservations(data || []);
      } catch (error) {
        console.error('Erro ao recarregar reservations:', error);
      } finally {
        setReservationsLoading(false);
      }
    })();
  }
}, [selectedPeriod, startDateString, endDateString, permissionsLoading, getAccessibleProperties, customStartDate, customEndDate]);

  const handleCreateInvestment = async (investmentData: any) => {
    await createInvestment(investmentData);
    await refetchROI();
    setFormOpen(false);
  };

  const handleDeleteInvestment = async (id: string) => {
    await deleteInvestment(id);
    await refetchROI();
  };

  // Filtrar dados por propriedades globais selecionadas
  const filteredROIData = selectedProperties.includes('todas')
    ? roiData
    : roiData.filter(roi => selectedProperties.includes(roi.property_id));

  const filteredInvestments = selectedProperties.includes('todas')
    ? investments
    : investments.filter(inv => selectedProperties.includes(inv.property_id));

  const filteredReservations = selectedProperties.includes('todas')
    ? reservations
    : reservations.filter(res => selectedProperties.includes(res.property_id || ''));

  // Calcular estatísticas gerais (baseadas nos dados filtrados)
  const totalGrossRevenue = filteredReservations.reduce((sum, res) => sum + (res.net_revenue || 0), 0);
  const totalInvestment = filteredInvestments.reduce((sum, inv) => sum + Number(inv.amount), 0);
  const totalNetRevenue = totalGrossRevenue - totalInvestment;
  const averageROI = filteredROIData.length > 0 
    ? filteredROIData.reduce((sum, roi) => sum + roi.roi_percentage, 0) / filteredROIData.length 
    : 0;
  const profitableProperties = filteredROIData.filter(roi => roi.is_profitable).length;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const totalLoading = investmentsLoading || roiLoading || permissionsLoading || propertiesLoading || reservationsLoading;

  if (totalLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">Carregando permissões...</div>
      </div>
    );
  }

  const canViewInvestments = hasPermission('investments_view');
  const canCreateInvestments = hasPermission('investments_create');

  if (!canViewInvestments) {
    return (
      <div className="space-y-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gradient-primary">Investimentos & ROI</h1>
            <p className="text-gray-600 mt-2">
              Controle seus investimentos e acompanhe o retorno sobre investimento
            </p>
          </div>
        </div>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Você não tem permissão para acessar esta seção. Entre em contato com o administrador para solicitar acesso.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gradient-primary">Investimentos & ROI</h1>
            <p className="text-gray-600 mt-2">
              Controle seus investimentos e acompanhe o retorno sobre investimento
            </p>
          </div>
          
          <div className="flex gap-3 items-center">            
            {canCreateInvestments && (
              <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Investimento
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Adicionar Investimento</DialogTitle>
                  </DialogHeader>
                  <InvestmentForm
                    properties={properties}
                    onSubmit={handleCreateInvestment}
                    loading={propertiesLoading}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* KPIs Gerais */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Receita Bruta Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold text-blue-600">
                  {formatCurrency(totalGrossRevenue)}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Investimento Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-red-500" />
                <span className="text-2xl font-bold text-red-600">
                  {formatCurrency(totalInvestment)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Receita Líquida Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <span className={`text-2xl font-bold ${totalNetRevenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalNetRevenue)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                ROI Médio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold text-blue-600">
                  {averageROI.toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Propriedades Lucrativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold">
                  {profitableProperties}/{filteredROIData.length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Resumo por Propriedade */}
        <PropertyInvestmentSummaryTable
          roiData={filteredROIData}
          loading={roiLoading}
        />

        {/* Histórico de Investimentos */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">
            Histórico de Investimentos
          </h2>
          
          <InvestmentsList
            investments={filteredInvestments}
            onDelete={handleDeleteInvestment}
            loading={investmentsLoading}
            showPropertyColumn={selectedProperties.includes('todas')}
          />
        </div>
      </div>
  );
};

export default InvestmentsPage;
