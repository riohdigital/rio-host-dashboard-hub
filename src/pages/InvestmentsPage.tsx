
import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Plus, BarChart3 } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import InvestmentForm from '@/components/investments/InvestmentForm';
import InvestmentsList from '@/components/investments/InvestmentsList';
import ROICard from '@/components/investments/ROICard';
import { usePropertyInvestments } from '@/hooks/investments/usePropertyInvestments';
import { useROICalculations } from '@/hooks/investments/useROICalculations';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/types/property';

const InvestmentsPage = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const { investments, loading: investmentsLoading, createInvestment, deleteInvestment } = usePropertyInvestments();
  const { roiData, loading: roiLoading, refetch: refetchROI } = useROICalculations();

  // Carregar propriedades
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const { data, error } = await supabase
          .from('properties')
          .select('*')
          .order('name');

        if (error) throw error;
        setProperties(data || []);
      } catch (error) {
        console.error('Erro ao carregar propriedades:', error);
      } finally {
        setPropertiesLoading(false);
      }
    };

    fetchProperties();
  }, []);

  const handleCreateInvestment = async (investmentData: any) => {
    await createInvestment(investmentData);
    await refetchROI();
    setFormOpen(false);
  };

  const handleDeleteInvestment = async (id: string) => {
    await deleteInvestment(id);
    await refetchROI();
  };

  // Calcular estatísticas gerais
  const totalInvestment = investments.reduce((sum, inv) => sum + Number(inv.amount), 0);
  const totalROIValue = roiData.reduce((sum, roi) => sum + roi.net_revenue, 0);
  const averageROI = roiData.length > 0 
    ? roiData.reduce((sum, roi) => sum + roi.roi_percentage, 0) / roiData.length 
    : 0;
  const profitableProperties = roiData.filter(roi => roi.is_profitable).length;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gradient-primary">Investimentos & ROI</h1>
            <p className="text-gray-600 mt-2">
              Controle seus investimentos e acompanhe o retorno sobre investimento
            </p>
          </div>
          
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
        </div>

        {/* KPIs Gerais */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                <span className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalROIValue)}
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
                  {profitableProperties}/{roiData.length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="roi" className="space-y-6">
          <TabsList>
            <TabsTrigger value="roi">ROI por Propriedade</TabsTrigger>
            <TabsTrigger value="investments">Histórico de Investimentos</TabsTrigger>
          </TabsList>

          <TabsContent value="roi" className="space-y-6">
            {roiLoading ? (
              <div className="text-center py-8">
                <div className="text-lg">Calculando ROI...</div>
              </div>
            ) : roiData.length === 0 ? (
              <Card>
                <CardContent className="p-8">
                  <div className="text-center text-gray-500">
                    <BarChart3 className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium mb-2">Nenhum dado de ROI disponível</h3>
                    <p className="mb-4">Adicione investimentos para começar a acompanhar o ROI.</p>
                    <Button onClick={() => setFormOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Primeiro Investimento
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roiData.map((roi) => (
                  <ROICard key={roi.property_id} roi={roi} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="investments" className="space-y-6">
            <InvestmentsList
              investments={investments}
              onDelete={handleDeleteInvestment}
              loading={investmentsLoading}
            />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default InvestmentsPage;
