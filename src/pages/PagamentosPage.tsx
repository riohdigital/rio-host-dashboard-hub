import React, { useState } from 'react';
import PageHeader from '@/components/comum/PageHeader';
import AbasRolaveis from '@/components/comum/AbasRolaveis';
import { useEhCelular } from '@/hooks/useMidia';
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

const PagamentosPage = () => {
  const { isMaster, isGestor, isOwner, loading: permissionsLoading } = useUserPermissions();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  // Local property filter (independent of global sidebar filter)
  const [selectedProperties, setSelectedProperties] = useState<string[]>(['todas']);
  const [propertySelectOpen, setPropertySelectOpen] = useState(false);
  const { properties } = useProperties();
  const celular = useEhCelular();

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
      <Tabs defaultValue="faxineiras" className="space-y-4">
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
    </div>
  );
};

export default PagamentosPage;
