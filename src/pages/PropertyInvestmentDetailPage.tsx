import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, DollarSign, TrendingUp, BarChart3, Calendar } from 'lucide-react';
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
import JanelaResponsiva from '@/components/comum/JanelaResponsiva';
import FaixaResumo from '@/components/comum/FaixaResumo';
import { formatarMoedaSemCentavos } from '@/components/comum/formatos';
import { useEhCompacto } from '@/hooks/useMidia';
import { HistoricoInvestimentosCelular, percentualROI } from '@/components/investments/InvestimentosCelular';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';

const PropertyInvestmentDetailPage = () => {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const [property, setProperty] = useState<Property | null>(null);
  const [propertyLoading, setPropertyLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  // Celular (abaixo de 1024px): faixa de resumo + histórico em linhas; o computador não muda
  const compacto = useEhCompacto();
  const { hasPermission } = useUserPermissions();

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
      <>
        <div className="text-center py-8">
          <div className="text-lg">Carregando...</div>
        </div>
      </>
    );
  }

  if (!property) {
    return (
      <>
        <div className="text-center py-8">
          <div className="text-lg text-danger-600">Propriedade não encontrada</div>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => navigate('/investimentos')}
          >
            Voltar para Investimentos
          </Button>
        </div>
      </>
    );
  }

  if (compacto) {
    return (
      <div className="space-y-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/investimentos')}
            aria-label="Voltar para Investimentos"
            className="-ml-2 h-11 w-11 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="min-w-0 truncate font-display text-base font-bold text-gray-900">
            {property.nickname || property.name}
          </h1>
        </div>

        <JanelaResponsiva aberta={formOpen} aoMudar={setFormOpen} titulo={`Adicionar investimento · ${property.nickname || property.name}`} largura="lg">
          <InvestmentForm
            properties={[property]}
            onSubmit={handleCreateInvestment}
            loading={false}
            defaultPropertyId={propertyId}
          />
        </JanelaResponsiva>

        <FaixaResumo
          rotulo="ROI"
          valor={propertyROI ? percentualROI(propertyROI.roi_percentage) : '—'}
          tomValor={propertyROI && propertyROI.roi_percentage < 0 ? 'danger' : 'neutro'}
          acao={
            <Button onClick={() => setFormOpen(true)} className="min-h-11 gap-1.5 rounded-full px-4">
              <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
              Novo
            </Button>
          }
          apoio={propertyROI ? [
            { rotulo: 'Investido', valor: formatarMoedaSemCentavos(propertyROI.total_investment) },
            { rotulo: 'Receita líq.', valor: formatarMoedaSemCentavos(propertyROI.net_revenue), tom: propertyROI.net_revenue >= 0 ? 'success' : 'danger' },
            { rotulo: 'Payback', valor: formatPaybackTime(propertyROI.payback_months) },
          ] : []}
        />

        <HistoricoInvestimentosCelular
          investments={investments}
          onDelete={handleDeleteInvestment}
          podeExcluir={hasPermission('investments_create')}
          mostrarImovel={false}
          loading={investmentsLoading}
        />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/investimentos')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-extrabold text-gradient-primary sm:text-3xl">
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6 [&>*]:min-w-0">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Investimento Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-danger-500" />
                  <span className="break-words font-mono text-lg font-semibold tabular-nums sm:text-xl text-danger-600">
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
                  <TrendingUp className="h-5 w-5 text-success-500" />
                  <span className="break-words font-mono text-lg font-semibold tabular-nums sm:text-xl text-success-600">
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
                  <BarChart3 className="h-5 w-5 text-info-500" />
                  <span className={`break-words font-mono text-lg font-semibold tabular-nums sm:text-xl ${
                    propertyROI.roi_percentage >= 0 ? 'text-success-600' : 'text-danger-600'
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
                  <Calendar className="h-5 w-5 text-brand-500" />
                  <span className="break-words font-mono text-lg font-semibold tabular-nums sm:text-xl text-brand-600">
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
    </>
  );
};

export default PropertyInvestmentDetailPage;