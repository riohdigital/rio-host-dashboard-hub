
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock, Calendar } from 'lucide-react';
import { Progress } from "@/components/ui/progress";

interface PaymentStatusCardProps {
  paidCount: number;
  pendingCount: number;
}

const PaymentStatusCard = ({ paidCount, pendingCount }: PaymentStatusCardProps) => {
  const total = paidCount + pendingCount;
  const paidPercentage = total > 0 ? (paidCount / total) * 100 : 0;

  return (
    <Card className="bg-white card-elevated gradient-hover-card smooth-transition">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-gradient-primary flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Status de Pagamentos no Período
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-800">Reservas Pagas</span>
            </div>
            <div className="text-3xl font-bold text-green-700">{paidCount}</div>
          </div>
          
          <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 p-4 rounded-lg border border-yellow-200">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">Pagamentos Pendentes</span>
            </div>
            <div className="text-3xl font-bold text-yellow-700">{pendingCount}</div>
          </div>
        </div>

        {total > 0 && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Taxa de Pagamento</span>
              <span className="font-semibold">{paidPercentage.toFixed(1)}%</span>
            </div>
            <Progress 
              value={paidPercentage} 
              className="h-3 bg-gray-200"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{paidCount} de {total} reservas</span>
              <span>{pendingCount} pendentes</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PaymentStatusCard;
