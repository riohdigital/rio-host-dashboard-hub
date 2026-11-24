
import React, { useState, useEffect } from 'react';
import PageHeader from '@/components/comum/PageHeader';
import JanelaResponsiva from '@/components/comum/JanelaResponsiva';
import { CartaoIndicador } from '@/components/comum/CartaoIndicador';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
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
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import FaixaResumo from '@/components/comum/FaixaResumo';
import { formatarMoedaSemCentavos } from '@/components/comum/formatos';
import { useEhCompacto } from '@/hooks/useMidia';
import { HistoricoInvestimentosCelular, PorImovelCelular, percentualROI } from '@/components/investments/InvestimentosCelular';
import { AJUDA_ROI_CARTEIRA, NOTA_ACUMULADO, resumirCarteira } from '@/components/investments/carteira';
import AjudaInfo from '@/components/comum/AjudaInfo';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';

const InvestmentsPage = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [formOpen, setFormOpen] = useEstadoPersistente<boolean>('investimentos.geral.form.aberto', false);
  const { investments, loading: investmentsLoading, createInvestment, deleteInvestment } = usePropertyInvestments();
  const { roiData, loading: roiLoading, refetch: refetchROI } = useROICalculations();
  const { hasPermission, getAccessibleProperties, loading: permissionsLoading } = useUserPermissions();
  const { selectedProperties } = useGlobalFilters();
  const { isVisible, shouldRefetch } = usePageVisibility();
  // Celular (abaixo de 1024px): desenho da T10 do plano; o computador não muda
  const compacto = useEhCompacto();

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

  // Ao voltar para a página depois de um tempo fora, recarrega os imóveis
  useEffect(() => {
    if (isVisible && shouldRefetch() && !permissionsLoading) {
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

      setPropertiesLoading(true);
      refetchProperties().finally(() => setPropertiesLoading(false));
    }
  }, [isVisible]);

  const handleCreateInvestment = async (investmentData: Parameters<typeof createInvestment>[0]) => {
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

  // Faixa de resumo: a mesma fonte das linhas por imóvel (useROICalculations).
  // Tudo acumulado; o período do filtro não entra (ver carteira.ts).
  const carteira = resumirCarteira(filteredROIData);
  const lucrativos = `${carteira.lucrativos} de ${carteira.imoveis}`;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const totalLoading = investmentsLoading || roiLoading || permissionsLoading || propertiesLoading;

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
        <div className="flex justify-between items-start max-lg:sr-only">
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

  const formulario = (
    <JanelaResponsiva aberta={formOpen} aoMudar={setFormOpen} titulo="Adicionar Investimento" largura="lg">
      <InvestmentForm
        properties={properties}
        onSubmit={handleCreateInvestment}
        loading={propertiesLoading}
      />
    </JanelaResponsiva>
  );

  if (compacto) {
    return (
      <div className="space-y-3">
        <h1 className="sr-only">Investimentos & ROI</h1>
        {formulario}
        <FaixaResumo
          rotulo="ROI da carteira"
          valor={percentualROI(carteira.roi)}
          tomValor={carteira.roi >= 0 ? 'neutro' : 'danger'}
          ajuda={AJUDA_ROI_CARTEIRA}
          acao={canCreateInvestments ? (
            <Button onClick={() => setFormOpen(true)} className="min-h-11 gap-1.5 rounded-full px-4">
              <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
              Novo
            </Button>
          ) : undefined}
          colunasApoio={2}
          apoio={[
            { rotulo: 'Investido', valor: formatarMoedaSemCentavos(carteira.investido) },
            { rotulo: 'Receita líq. acumulada', valor: formatarMoedaSemCentavos(carteira.receitaLiquida) },
            { rotulo: 'Retorno líquido', valor: formatarMoedaSemCentavos(carteira.retornoLiquido), tom: carteira.retornoLiquido >= 0 ? 'success' : 'danger' },
            { rotulo: 'Lucrativos', valor: lucrativos },
          ]}
        >
          <p className="mt-2.5 text-xs text-gray-500">{NOTA_ACUMULADO}</p>
        </FaixaResumo>
        <PorImovelCelular roiData={filteredROIData} podeGerenciar={canCreateInvestments} />
        <HistoricoInvestimentosCelular
          recolhido
          investments={filteredInvestments}
          onDelete={handleDeleteInvestment}
          podeExcluir={canCreateInvestments}
          mostrarImovel={selectedProperties.includes('todas')}
          loading={investmentsLoading}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
        <PageHeader
          titulo="Investimentos & ROI"
          descricao="Controle seus investimentos e acompanhe o retorno sobre investimento"
          acao={canCreateInvestments ? (
            <Button onClick={() => setFormOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Investimento
            </Button>
          ) : undefined}
        />

        {formulario}

        {/* Resumo: ROI da carteira em destaque; os mesmos números da faixa do celular */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4 2xl:grid-cols-5">
            <CartaoIndicador
              className="col-span-2 border-brand-200 bg-brand-50/60 lg:col-span-1"
              titulo={
                <span className="inline-flex items-center gap-1.5">
                  ROI da carteira
                  <AjudaInfo titulo="ROI da carteira" rotulo="Como o ROI da carteira é calculado">{AJUDA_ROI_CARTEIRA}</AjudaInfo>
                </span>
              }
              valor={percentualROI(carteira.roi)}
              icone={BarChart3}
              tom={carteira.roi >= 0 ? 'brand' : 'danger'}
              detalhe="Ponderado pelo valor investido"
            />
            <CartaoIndicador titulo="Investido" valor={formatCurrency(carteira.investido)} icone={DollarSign} tom="danger" />
            <CartaoIndicador titulo="Receita líquida acumulada" valor={formatCurrency(carteira.receitaLiquida)} icone={Receipt} tom="info" />
            <CartaoIndicador
              titulo="Retorno líquido"
              valor={formatCurrency(carteira.retornoLiquido)}
              icone={TrendingUp}
              tom={carteira.retornoLiquido >= 0 ? 'success' : 'danger'}
              detalhe="Receita líquida acumulada − investido"
            />
            <CartaoIndicador titulo="Lucrativos" valor={lucrativos} icone={TrendingUp} tom="neutro" detalhe="Imóveis que já recuperaram o investido" />
          </div>
          <p className="text-xs text-gray-500">{NOTA_ACUMULADO}</p>
        </div>

        {/* Resumo por Propriedade */}
        <PropertyInvestmentSummaryTable
          roiData={filteredROIData}
          loading={roiLoading}
        />

        {/* Histórico de Investimentos */}
        <div className="space-y-4">
          <h2 className="font-display text-lg font-bold text-ink sm:text-xl">
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
