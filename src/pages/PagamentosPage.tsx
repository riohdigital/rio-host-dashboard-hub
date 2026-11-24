import React, { useEffect } from 'react';
import PageHeader from '@/components/comum/PageHeader';
import AbasRolaveis from '@/components/comum/AbasRolaveis';
import { useEhCelular, useEhCompacto } from '@/hooks/useMidia';
import FaixaResumo from '@/components/comum/FaixaResumo';
import BlocoRecolhivel from '@/components/comum/BlocoRecolhivel';
import { formatarMoeda, formatarMoedaSemCentavos } from '@/components/comum/formatos';
import { Navigate } from 'react-router-dom';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Users, Building2, CalendarDays, Info } from 'lucide-react';
import { usePaymentsDashboard } from '@/hooks/painel-gestor/usePaymentsDashboard';
import PaymentsKPICards from '@/components/pagamentos/PaymentsKPICards';
import CleanerPaymentsTab from '@/components/pagamentos/CleanerPaymentsTab';
import OwnerPaymentsTab from '@/components/pagamentos/OwnerPaymentsTab';
import RevenueScheduleTab from '@/components/pagamentos/RevenueScheduleTab';
import MonthYearSelector from '@/components/pagamentos/MonthYearSelector';
import PropertyMultiSelect from '@/components/dashboard/PropertyMultiSelect';
import { useProperties } from '@/hooks/useProperties';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';

const PagamentosPage = () => {
  const { isMaster, isGestor, isOwner, loading: permissionsLoading } = useUserPermissions();

  const now = new Date();
  // Mês, imóveis e aba voltam depois de recarregar a página
  const [month, setMonth] = useEstadoPersistente<number>('pagamentos.mes', now.getMonth() + 1, {
    aceita: (v) => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 12,
  });
  const [year, setYear] = useEstadoPersistente<number>('pagamentos.ano', now.getFullYear(), {
    aceita: (v) => typeof v === 'number' && Number.isInteger(v) && v >= 2000 && v <= 2100,
  });
  const [aba, setAba] = useEstadoPersistente<string>('pagamentos.aba', 'faxineiras', { aceita: ['faxineiras', 'proprietarios', 'agenda'] });

  // Local property filter (independent of global sidebar filter)
  const [selectedProperties, setSelectedProperties] = useEstadoPersistente<string[]>('pagamentos.imoveis', ['todas'], {
    aceita: (v) => Array.isArray(v) && v.length > 0 && v.every((id) => typeof id === 'string'),
  });
  const [propertySelectOpen, setPropertySelectOpen] = useEstadoPersistente<boolean>('pagamentos.imoveis.aberto', false);
  const { properties, loading: carregandoImoveis } = useProperties();
  // Imóvel guardado que não existe mais (ou sem acesso) sai da seleção
  useEffect(() => {
    if (carregandoImoveis || selectedProperties.includes('todas')) return;
    const existentes = new Set(properties.map((p) => p.id));
    const validos = selectedProperties.filter((id) => existentes.has(id));
    if (validos.length !== selectedProperties.length) setSelectedProperties(validos.length > 0 ? validos : ['todas']);
  }, [carregandoImoveis, properties, selectedProperties, setSelectedProperties]);
  const celular = useEhCelular();
  const compacto = useEhCompacto();

  const {
    cleanerPayments,
    ownerPayments,
    schedule,
    kpis,
    loading,
    refetch
  } = usePaymentsDashboard(month, year, selectedProperties);

  if (!permissionsLoading && !isMaster() && !isGestor() && !isOwner()) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleMonthChange = (m: number, y: number) => {
    setMonth(m);
    setYear(y);
  };

  const hasPropertyFilter = selectedProperties.length > 0 && !selectedProperties.includes('todas');
  const showGuidanceBanner = !hasPropertyFilter;

  const abas = (
    <Tabs value={aba} onValueChange={setAba} className="space-y-4 max-lg:space-y-3">
      <AbasRolaveis
        rotulo="Pagamentos"
        itens={[
          { valor: 'faxineiras', rotulo: 'Faxineiras', icone: Users, contagem: !loading && cleanerPayments.length > 0 ? cleanerPayments.length : undefined },
          { valor: 'proprietarios', rotulo: 'Proprietários', icone: Building2, contagem: !loading && ownerPayments.length > 0 ? ownerPayments.length : undefined },
          { valor: 'agenda', rotulo: 'Agenda', icone: CalendarDays, contagem: !loading && schedule.length > 0 ? schedule.length : undefined },
        ]}
      />

      <TabsContent value="faxineiras">
        <CleanerPaymentsTab
          cleanerPayments={cleanerPayments}
          loading={loading}
          hasFilter={hasPropertyFilter}
        />
      </TabsContent>

      <TabsContent value="proprietarios">
        <OwnerPaymentsTab
          ownerPayments={ownerPayments}
          loading={loading}
          hasFilter={hasPropertyFilter}
        />
      </TabsContent>

      <TabsContent value="agenda">
        <RevenueScheduleTab schedule={schedule} loading={loading} />
      </TabsContent>
    </Tabs>
  );

  // Celular (plano T9): mês em largura total, faixa com os totais das faxinas do
  // mês, balanço recolhido e as três abas dividindo a largura
  if (compacto) {
    const comFaxinas = cleanerPayments.filter((c) => c.hasCleaningsThisMonth);
    const totalMes = comFaxinas.reduce((s, c) => s + c.total, 0);
    const proxCiclo = comFaxinas.reduce((s, c) => s + c.totalNextCycle, 0);
    const qtdFaxinas = comFaxinas.reduce((s, c) => s + c.cleanings.length, 0);
    return (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <PageHeader titulo="Gestão de Pagamentos" descricao="Balanço financeiro mensal — faxineiras, proprietários e agenda de recebimentos" />
        <MonthYearSelector month={month} year={year} onChange={handleMonthChange} />
        <PropertyMultiSelect
          properties={properties}
          selectedProperties={selectedProperties}
          onSelectionChange={setSelectedProperties}
          isOpen={propertySelectOpen}
          onToggle={() => setPropertySelectOpen((o) => !o)}
          fullWidth
        />
        {showGuidanceBanner && (
          <p className="-mt-1 px-1 text-xs text-gray-500">
            Escolha um ou mais imóveis para ver o balanço do mês e todas as faxineiras vinculadas.
          </p>
        )}
        <FaixaResumo
          rotulo={proxCiclo > 0 ? `Total do mês · ${qtdFaxinas} ${qtdFaxinas === 1 ? 'faxina' : 'faxinas'}` : 'Total do mês'}
          valor={loading ? '—' : formatarMoedaSemCentavos(totalMes)}
          ajuda="Faxinas com saída neste mês, somando todas as faxineiras: o que já foi pago, o que está pendente e o que fica para o próximo ciclo."
          apoio={[
            { rotulo: 'Pago', valor: formatarMoedaSemCentavos(kpis.totalCleaningsPaid), tom: 'success' },
            { rotulo: 'Pendente', valor: formatarMoedaSemCentavos(kpis.totalCleaningsPending), tom: 'warning' },
            ...(proxCiclo > 0 ? [{ rotulo: 'Próx. ciclo', valor: formatarMoedaSemCentavos(proxCiclo), tom: 'info' as const }] : []),
            ...(proxCiclo > 0 ? [] : [{ rotulo: 'Faxinas', valor: qtdFaxinas }]),
          ]}
        />
        {hasPropertyFilter && (
          <BlocoRecolhivel chave="pagamentos.balanco.aberto" titulo="Balanço do mês" resumo={`Saldo ${formatarMoeda(kpis.netBalance)} · comissão − faxinas − repasse`}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {[
                { rotulo: 'Comissão recebida', valor: kpis.totalCommissionReceived, classe: 'text-success-700' },
                { rotulo: 'Comissão a receber', valor: kpis.totalCommissionPending, classe: 'text-warning-700' },
                { rotulo: 'Faxinas pagas', valor: kpis.totalCleaningsPaid, classe: 'text-gray-900' },
                { rotulo: 'Repasse a proprietários', valor: kpis.totalOwnerTransfer, classe: 'text-gray-900' },
                { rotulo: 'Saldo do mês', valor: kpis.netBalance, classe: kpis.netBalance >= 0 ? 'text-brand-700' : 'text-danger-600' },
              ].map((c) => (
                <div key={c.rotulo} className="min-w-0">
                  <dt className="truncate text-xs text-gray-500">{c.rotulo}</dt>
                  <dd className={`truncate font-mono text-sm font-semibold tabular-nums ${c.classe}`}>{formatarMoeda(c.valor)}</dd>
                </div>
              ))}
            </dl>
          </BlocoRecolhivel>
        )}
        {abas}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        titulo="Gestão de Pagamentos"
        descricao="Balanço financeiro mensal — faxineiras, proprietários e agenda de recebimentos"
      />

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-4">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="hidden whitespace-nowrap text-sm font-medium text-muted-foreground sm:inline">Filtrar por:</span>
          <PropertyMultiSelect
            properties={properties}
            selectedProperties={selectedProperties}
            onSelectionChange={setSelectedProperties}
            isOpen={propertySelectOpen}
            onToggle={() => setPropertySelectOpen(o => !o)}
            fullWidth={celular}
          />
          <MonthYearSelector month={month} year={year} onChange={handleMonthChange} />
        </div>
        <Button variant="outline" size="sm" onClick={refetch} disabled={loading} className="h-10 sm:h-9">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Guidance Banner */}
      {showGuidanceBanner && (
        <Alert className="border-primary/20 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm text-foreground">
            <span className="font-medium">Selecione uma propriedade</span> no filtro acima para visualizar faxineiras, proprietários e agenda de recebimentos do mês.
          </AlertDescription>
        </Alert>
      )}

      {/* KPI Cards — only show when there's a filter */}
      {hasPropertyFilter && (
        <PaymentsKPICards kpis={kpis} loading={loading} />
      )}

      {/* Tabs */}
      {abas}
    </div>
  );
};

export default PagamentosPage;
