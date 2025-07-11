import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Landmark, CheckCircle2, Clock } from 'lucide-react';

interface CashflowData {
  airbnbReceived: number;
  bookingReceived: number;
  airbnbReceivable: number;
  bookingReceivable: number;
}

const CashflowCard = ({ data }: { data: CashflowData }) => {
  const totalReceived = data.airbnbReceived + data.bookingReceived;
  const totalReceivable = data.airbnbReceivable + data.bookingReceivable;

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <Card className="bg-white card-elevated h-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-gradient-primary flex items-center gap-2">
          <Landmark className="h-4 w-4" />
          Fluxo de Caixa por Plataforma
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        
        {/* Coluna de Valores Recebidos */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <h4 className="font-semibold text-gray-700">Valores Recebidos</h4>
          </div>
          <div className="text-sm space-y-2 pl-2 border-l-2 border-green-200">
            <div className="flex justify-between">
              <span className="text-gray-600">Airbnb:</span>
              <span className="font-medium text-gray-800">{formatCurrency(data.airbnbReceived)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Booking:</span>
              <span className="font-medium text-gray-800">{formatCurrency(data.bookingReceived)}</span>
            </div>
          </div>
          <div className="border-t border-dashed mt-2 pt-2">
            <div className="flex justify-between font-bold text-base">
              <span className="text-gray-800">Total Recebido:</span>
              <span className="text-green-600">{formatCurrency(totalReceived)}</span>
            </div>
          </div>
        </div>

        {/* Coluna de Valores a Receber */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-500" />
            <h4 className="font-semibold text-gray-700">Valores a Receber</h4>
          </div>
          <div className="text-sm space-y-2 pl-2 border-l-2 border-yellow-200">
            <div className="flex justify-between">
              <span className="text-gray-600">Airbnb:</span>
              <span className="font-medium text-gray-800">{formatCurrency(data.airbnbReceivable)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Booking:</span>
              <span className="font-medium text-gray-800">{formatCurrency(data.bookingReceivable)}</span>
            </div>
          </div>
          <div className="border-t border-dashed mt-2 pt-2">
            <div className="flex justify-between font-bold text-base">
              <span className="text-gray-800">Total a Receber:</span>
              <span className="text-yellow-600">{formatCurrency(totalReceivable)}</span>
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
};

export default CashflowCard;
