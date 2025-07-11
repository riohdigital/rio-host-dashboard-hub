
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Landmark, CheckCircle2, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface CashflowData {
  airbnbReceived: number;
  bookingReceived: number;
  diretoReceived: number;
  airbnbReceivable: number;
  bookingReceivable: number;
  diretoReceivable: number;
}

const CashflowCard = ({ data }: { data: CashflowData }) => {
  const totalReceived = data.airbnbReceived + data.bookingReceived + data.diretoReceived;
  const totalReceivable = data.airbnbReceivable + data.bookingReceivable + data.diretoReceivable;

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatTooltip = (value: number) => [formatCurrency(value), ''];

  const receivedData = [
    { name: 'Airbnb', value: data.airbnbReceived, color: '#10B981' },
    { name: 'Booking', value: data.bookingReceived, color: '#059669' },
    { name: 'Direto', value: data.diretoReceived, color: '#0891B2' }
  ].filter(item => item.value > 0);

  const receivableData = [
    { name: 'Airbnb', value: data.airbnbReceivable, color: '#F59E0B' },
    { name: 'Booking', value: data.bookingReceivable, color: '#D97706' },
    { name: 'Direto', value: data.diretoReceivable, color: '#0284C7' }
  ].filter(item => item.value > 0);

  return (
    <Card className="bg-white card-elevated h-full gradient-hover-card smooth-transition">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-gradient-primary flex items-center gap-2">
          <Landmark className="h-4 w-4" />
          Fluxo de Caixa por Plataforma
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Resumo Visual */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-r from-green-50 to-green-100 p-3 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-800">Recebido</span>
            </div>
            <div className="text-lg font-bold text-green-700">{formatCurrency(totalReceived)}</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-green-600" />
              <span className="text-xs text-green-600">Entrada confirmada</span>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 p-3 rounded-lg border border-yellow-200">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-xs font-medium text-yellow-800">A Receber</span>
            </div>
            <div className="text-lg font-bold text-yellow-700">{formatCurrency(totalReceivable)}</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingDown className="h-3 w-3 text-yellow-600" />
              <span className="text-xs text-yellow-600">Entrada prevista</span>
            </div>
          </div>
        </div>

        {/* Gráficos de Barras */}
        <div className="space-y-4">
          {receivedData.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Valores Recebidos
              </h4>
              <div className="h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={receivedData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={formatTooltip}
                      labelStyle={{ color: '#374151' }}
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {receivedData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {receivableData.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                Valores a Receber
              </h4>
              <div className="h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={receivableData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={formatTooltip}
                      labelStyle={{ color: '#374151' }}
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {receivableData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Detalhamento por Plataforma */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-1">Airbnb</div>
            <div className="font-semibold text-sm text-gray-800">
              {formatCurrency(data.airbnbReceived + data.airbnbReceivable)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-1">Booking</div>
            <div className="font-semibold text-sm text-gray-800">
              {formatCurrency(data.bookingReceived + data.bookingReceivable)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-1">Direto</div>
            <div className="font-semibold text-sm text-gray-800">
              {formatCurrency(data.diretoReceived + data.diretoReceivable)}
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
};

export default CashflowCard;
