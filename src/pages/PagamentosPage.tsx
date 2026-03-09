import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RefreshCw, Users, Building2, CalendarDays } from 'lucide-react';
import { usePaymentsDashboard } from '@/hooks/painel-gestor/usePaymentsDashboard';
import PaymentsKPICards from '@/components/pagamentos/PaymentsKPICards';
import CleanerPaymentsTab from '@/components/pagamentos/CleanerPaymentsTab';
import OwnerPaymentsTab from '@/components/pagamentos/OwnerPaymentsTab';
import RevenueScheduleTab from '@/components/pagamentos/RevenueScheduleTab';
import MonthYearSelector from '@/components/pagamentos/MonthYearSelector';

const PagamentosPage = () => {
  const { isMaster, isGestor, isOwner, loading: permissionsLoading } = useUserPermissions();
  
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { 
    cleanerPayments, 
    ownerPayments, 
    schedule, 
    kpis, 
    loading, 
    refetch 
  } = usePaymentsDashboard(month, year);

  if (!permissionsLoading && !isMaster() && !isGestor() && !isOwner()) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleMonthChange = (m: number, y: number) => {
    setMonth(m);
    setYear(y);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient-primary">💰 Gestão de Pagamentos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Balanço financeiro mensal — faxineiras, proprietários e agenda de recebimentos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <MonthYearSelector month={month} year={year} onChange={handleMonthChange} />
          <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <PaymentsKPICards kpis={kpis} loading={loading} />

      {/* Tabs */}
      <Tabs defaultValue="faxineiras" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="faxineiras" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Faxineiras
            {!loading && cleanerPayments.length > 0 && (
              <span className="ml-1 bg-primary/20 text-primary rounded-full px-1.5 py-0.5 text-xs font-medium">
                {cleanerPayments.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="proprietarios" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Proprietários
            {!loading && ownerPayments.length > 0 && (
              <span className="ml-1 bg-primary/20 text-primary rounded-full px-1.5 py-0.5 text-xs font-medium">
                {ownerPayments.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="agenda" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Agenda
            {!loading && schedule.length > 0 && (
              <span className="ml-1 bg-primary/20 text-primary rounded-full px-1.5 py-0.5 text-xs font-medium">
                {schedule.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="faxineiras">
          <CleanerPaymentsTab cleanerPayments={cleanerPayments} loading={loading} />
        </TabsContent>

        <TabsContent value="proprietarios">
          <OwnerPaymentsTab ownerPayments={ownerPayments} loading={loading} />
        </TabsContent>

        <TabsContent value="agenda">
          <RevenueScheduleTab schedule={schedule} loading={loading} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PagamentosPage;
