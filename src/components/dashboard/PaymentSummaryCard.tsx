
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface PaymentSummaryCardProps {
  totalPaidCount: number;
  totalPendingCount: number;
}

const PaymentSummaryCard = ({ totalPaidCount, totalPendingCount }: PaymentSummaryCardProps) => {
  const total = totalPaidCount + totalPendingCount;
  const paidPercentage = total > 0 ? (totalPaidCount / total) * 100 : 0;
  const pendingPercentage = total > 0 ? (totalPendingCount / total) * 100 : 0;

  const chartData = [
    { name: 'Pagas', value: totalPaidCount, color: '#10B981' },
    { name: 'Pendentes', value: totalPendingCount, color: '#F59E0B' }
  ];

  const formatTooltip = (value: number, name: string) => [
    `${value} reservas`,
    name
  ];

  return (
    <Card className="bg-white card-elevated gradient-hover-card smooth-transition">
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
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-gray-600">Pagas</span>
            </div>
            <div className="text-2xl font-bold text-green-600">{totalPaidCount}</div>
            <div className="text-xs text-gray-500">{paidPercentage.toFixed(1)}%</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-gray-600">Pendentes</span>
            </div>
            <div className="text-2xl font-bold text-yellow-600">{totalPendingCount}</div>
            <div className="text-xs text-gray-500">{pendingPercentage.toFixed(1)}%</div>
          </div>
        </div>
        
        {total > 0 && (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={20}
                  outerRadius={40}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={formatTooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        
        <div className="text-center">
          <span className="text-sm text-gray-600">Total de Reservas: </span>
          <span className="font-bold text-gray-800">{total}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentSummaryCard;
