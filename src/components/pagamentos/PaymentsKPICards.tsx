import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Wrench, Wallet, DollarSign, ArrowUpDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { PaymentsKPIs } from '@/hooks/painel-gestor/usePaymentsDashboard';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface PaymentsKPICardsProps {
  kpis: PaymentsKPIs;
  loading: boolean;
}

const KPICard = ({
  title, value, sub, icon, colorClass, loading
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  colorClass: string;
  loading: boolean;
}) => (
  <Card className="border-0 shadow-md overflow-hidden">
    <CardContent className="p-0">
      <div className={`p-4 ${colorClass}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-white/80 uppercase tracking-wider">{title}</span>
          <div className="text-white/80">{icon}</div>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-32 bg-white/20" />
        ) : (
          <div className="text-2xl font-bold text-white">{value}</div>
        )}
        {sub && !loading && (
          <div className="text-xs text-white/70 mt-1">{sub}</div>
        )}
      </div>
    </CardContent>
  </Card>
);

const PaymentsKPICards = ({ kpis, loading }: PaymentsKPICardsProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KPICard
        title="Comissão Recebida"
        value={fmt(kpis.totalCommissionReceived)}
        sub={`A receber: ${fmt(kpis.totalCommissionPending)}`}
        icon={<TrendingUp className="h-5 w-5" />}
        colorClass="bg-gradient-to-br from-emerald-500 to-emerald-600"
        loading={loading}
      />
      <KPICard
        title="Faxinas Pagas"
        value={fmt(kpis.totalCleaningsPaid)}
        sub={`Pendente: ${fmt(kpis.totalCleaningsPending)}`}
        icon={<Wrench className="h-5 w-5" />}
        colorClass="bg-gradient-to-br from-blue-500 to-blue-600"
        loading={loading}
      />
      <KPICard
        title="Repasse a Proprietários"
        value={fmt(kpis.totalOwnerTransfer)}
        sub="Líquido após investimentos"
        icon={<DollarSign className="h-5 w-5" />}
        colorClass="bg-gradient-to-br from-amber-500 to-orange-500"
        loading={loading}
      />
      <KPICard
        title="Saldo do Mês"
        value={fmt(kpis.netBalance)}
        sub="Comissão - Faxinas - Repasse"
        icon={<Wallet className="h-5 w-5" />}
        colorClass={kpis.netBalance >= 0
          ? 'bg-gradient-to-br from-purple-600 to-purple-700'
          : 'bg-gradient-to-br from-red-500 to-red-600'
        }
        loading={loading}
      />
    </div>
  );
};

export default PaymentsKPICards;
