import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock } from 'lucide-react';

interface PaymentStatusCardProps {
  paidCount: number;
  pendingCount: number;
}

const PaymentStatusCard = ({ paidCount, pendingCount }: PaymentStatusCardProps) => {
  return (
    <Card className="bg-white card-elevated">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-gradient-primary">Status de Pagamentos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className="text-gray-600">Reservas Pagas</span>
          </div>
          <span className="font-bold text-lg text-green-600">{paidCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-500" />
            <span className="text-gray-600">Pagamentos Pendentes</span>
          </div>
          <span className="font-bold text-lg text-yellow-600">{pendingCount}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentStatusCard;
