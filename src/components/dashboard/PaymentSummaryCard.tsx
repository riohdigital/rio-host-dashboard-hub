
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import GraficoProporcao from '@/components/graficos/GraficoProporcao';

interface PaymentSummaryCardProps {
  totalPaidCount: number;
  totalPendingCount: number;
}

const PaymentSummaryCard = ({ totalPaidCount, totalPendingCount }: PaymentSummaryCardProps) => {
  const total = totalPaidCount + totalPendingCount;
  const paidPercentage = total > 0 ? (totalPaidCount / total) * 100 : 0;
  const pendingPercentage = total > 0 ? (totalPendingCount / total) * 100 : 0;

  const chartData = [
    { name: 'Pagas', value: totalPaidCount, color: 'hsl(var(--success))' },
    { name: 'Pendentes', value: totalPendingCount, color: 'hsl(var(--warning))' }
  ];

  return (
    <Card className="bg-white card-elevated smooth-transition">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-gradient-primary flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Status Geral de Pagamentos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-success-500" />
              <span className="text-sm text-gray-600">Pagas</span>
            </div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-success-600">{totalPaidCount}</div>
            <div className="text-xs text-gray-500">{paidPercentage.toFixed(1)}%</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-warning-500" />
              <span className="text-sm text-gray-600">Pendentes</span>
            </div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-warning-600">{totalPendingCount}</div>
            <div className="text-xs text-gray-500">{pendingPercentage.toFixed(1)}%</div>
          </div>
        </div>
        
        {total > 0 && (
          <div className="h-48">
            <GraficoProporcao
              fatias={chartData.map((c) => ({ nome: c.name, valor: c.value, cor: c.color }))}
              altura={192}
              formatar={(v) => `${v} ${v === 1 ? 'reserva' : 'reservas'}`}
              formatarTotal={(v) => `${v}`}
              rotuloTotal="Reservas"
            />
          </div>
        )}
        
        <div className="text-center">
          <span className="text-sm text-gray-600">Total de Reservas: </span>
          <span className="font-mono font-semibold tabular-nums text-gray-800">{total}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentSummaryCard;
