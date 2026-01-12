import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, DollarSign, Calendar, Percent, Sparkles, AlertTriangle } from 'lucide-react';
import { GestorKPIs } from '@/types/painel-gestor';

interface CommissionKPICardsProps {
  kpis: GestorKPIs;
  loading?: boolean;
}

export const CommissionKPICards = ({ kpis, loading }: CommissionKPICardsProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const cards = [
    {
      title: 'Comissão Total',
      value: formatCurrency(kpis.totalCommission),
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: 'No período selecionado'
    },
    {
      title: 'Comissão Média',
      value: formatCurrency(kpis.avgCommission),
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: 'Por reserva'
    },
    {
      title: 'Total de Reservas',
      value: kpis.totalReservations.toString(),
      icon: Calendar,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      description: 'Confirmadas no período'
    },
    {
      title: 'Receita Gerada',
      value: formatCurrency(kpis.totalRevenue),
      icon: Sparkles,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      description: 'Total gerenciado'
    },
    {
      title: 'Taxa de Ocupação',
      value: `${kpis.occupancyRate.toFixed(1)}%`,
      icon: Percent,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
      description: 'No período'
    },
    {
      title: 'Faxinas Pendentes',
      value: kpis.pendingCleanings.toString(),
      icon: AlertTriangle,
      color: kpis.pendingCleanings > 0 ? 'text-red-600' : 'text-green-600',
      bgColor: kpis.pendingCleanings > 0 ? 'bg-red-50' : 'bg-green-50',
      description: kpis.pendingCleanings > 0 ? 'Requerem atenção' : 'Tudo em dia!'
    }
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-8 bg-muted rounded w-1/2 mb-1" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="card-elevated hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {card.title}
              </span>
              <div className={`p-1.5 rounded-full ${card.bgColor}`}>
                <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
              </div>
            </div>
            <div className={`text-2xl font-bold ${card.color}`}>
              {card.value}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
