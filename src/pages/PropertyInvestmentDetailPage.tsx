import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, DollarSign, TrendingUp, BarChart3, Calendar } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import InvestmentForm from '@/components/investments/InvestmentForm';
import InvestmentsList from '@/components/investments/InvestmentsList';
import { usePropertyInvestments } from '@/hooks/investments/usePropertyInvestments';
import { useROICalculations } from '@/hooks/investments/useROICalculations';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/types/property';
import { PropertyROI } from '@/types/investment';

const PropertyInvestmentDetailPage = () => {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const [property, setProperty] = useState<Property | null>(null);
  const [propertyLoading, setPropertyLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const { investments, loading: investmentsLoading, createInvestment, deleteInvestment } = usePropertyInvestments(propertyId);
  const { roiData, loading: roiLoading, refetch: refetchROI } = useROICalculations();

  // Encontrar os dados de ROI para esta propriedade específica
  const propertyROI = roiData.find(roi => roi.property_id === propertyId);

  // Carregar dados da propriedade
  useEffect(() => {
    const fetchProperty = async () => {
      if (!propertyId) return;
      
      try {
        const { data, error } = await supabase
          .from('properties')
          .select('*')
          .eq('id', propertyId)
          .single();

        if (error) throw error;
        setProperty(data);
      } catch (error) {
        console.error('Erro ao carregar propriedade:', error);
      } finally {
        setPropertyLoading(false);
      }
    };

    fetchProperty();
  }, [propertyId]);

  const handleCreateInvestment = async (investmentData: any) => {
    await createInvestment({ ...investmentData, property_id: propertyId });
    await refetchROI();
    setFormOpen(false);
  };

  const handleDeleteInvestment = async (id: string) => {
    await deleteInvestment(id);
    await refetchROI();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPaybackTime = (months: number) => {
    if (months === 0) return 'N/A';
    if (months < 12) return `${months} meses`;
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) return `${years} ano${years > 1 ? 's' : ''}`;
    return `${years}a ${remainingMonths}m`;
  };

  if (propertyLoading) {
    return (
      <MainLayout>
        <div className="text-center py-8">
          <div className="text-lg">Carregando...</div>
        </div>
      </MainLayout>
    );
  }

  if (!property) {
    return (
      <MainLayout>
        <div className="text-center py-8">
          <div className="text-lg text-red-600">Propriedade não encontrada</div>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => navigate('/investimentos')}
          >
            Voltar para Investimentos
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/investimentos')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gradient-primary">
                {property.name}
                {property.nickname && (
                  <span className="text-xl text-gray-500 ml-2">({property.nickname})</span>
                )}
              </h1>
              <p className="text-gray-600 mt-2">
                Gerenciamento de investimentos e análise de ROI
              </p>
            </div>
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
                <DialogTitle>Adicionar Investimento - {property.name}</DialogTitle>
              </DialogHeader>
              <InvestmentForm
                properties={[property]}
                onSubmit={handleCreateInvestment}
                loading={false}
                defaultPropertyId={propertyId}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* KPIs Específicos da Propriedade */}
        {propertyROI && (
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
                    {formatCurrency(propertyROI.total_investment)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Receita Líquida
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <span className="text-2xl font-bold text-green-600">
                    {formatCurrency(propertyROI.net_revenue)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  ROI
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  <span className={`text-2xl font-bold ${
                    propertyROI.roi_percentage >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {propertyROI.roi_percentage.toFixed(1)}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Payback
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-purple-500" />
                  <span className="text-2xl font-bold text-purple-600">
                    {formatPaybackTime(propertyROI.payback_months)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Lista de Investimentos */}
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Histórico de Investimentos</h2>
            <InvestmentsList
              investments={investments}
              onDelete={handleDeleteInvestment}
              loading={investmentsLoading}
              showPropertyColumn={false}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default PropertyInvestmentDetailPage;