import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Landmark, CheckCircle2, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import TooltipGrafico from '@/components/graficos/TooltipGrafico';
import { corDoCanalGrafico, eixoMoeda, moedaCompleta, PROPS_EIXO_X, PROPS_EIXO_Y, PROPS_GRADE, RAIO_BARRA } from '@/components/graficos/tema';

interface CashflowData {
  airbnbReceived: number;
  bookingReceived: number;
  diretoReceived: number;
  airbnbReceivable: number;
  bookingReceivable: number;
  diretoReceivable: number;
}

// CORREÇÃO 5: Formatação Consistente de Moeda
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

// CORREÇÃO 6: Verificação dos Status de Pagamento
const normalizePaymentStatus = (status: string | null | undefined) => {
  if (!status) return 'Pendente';
  const normalized = status.toLowerCase();
  if (normalized.includes('pago') || normalized.includes('paid')) return 'Pago';
  if (normalized.includes('pendente') || normalized.includes('pending')) return 'Pendente';
  return 'Pendente'; // default
};

// CORREÇÃO 7: Validação de Datas
const isValidDate = (dateString: string | null | undefined) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
};

// CORREÇÃO 8: Mapeamento de Plataformas
const getPlatformKey = (platform: string | null | undefined) => {
  if (!platform) return 'booking.com';
  const normalized = platform.toLowerCase();
  if (normalized.includes('airbnb')) return 'airbnb';
  if (normalized.includes('direto') || normalized.includes('direct')) return 'direto';
  return 'booking.com';
};

// CORREÇÃO 1: Função para calcular Cashflow (USE ESTA NO SEU DASHBOARD.tsx)
export const calculateCashflow = (reservations: any[]) => {
  return reservations.reduce((acc, res) => {
    let platform = 'booking.com'; // default
    
    if (res.platform?.toLowerCase().includes('airbnb')) {
      platform = 'airbnb';
    } else if (res.platform?.toLowerCase().includes('direto')) {
      platform = 'direto';
    }
    
    const netRevenue = res.net_revenue || 0;
    if (res.payment_status === 'Pago') {
      acc[`${platform}Received`] += netRevenue;
    } else {
      acc[`${platform}Receivable`] += netRevenue;
    }
    return acc;
  }, { 
    airbnbReceived: 0, 
    bookingReceived: 0, 
    diretoReceived: 0,
    airbnbReceivable: 0, 
    bookingReceivable: 0,
    diretoReceivable: 0
  });
};

// CORREÇÃO 3: Cálculo da Taxa de Ocupação (USE ESTA NO SEU DASHBOARD.tsx)
export const calculateOccupancyRate = (reservations: any[], properties: any[], startDate: Date, endDate: Date, propertyFilter?: any[]) => {
  const filteredPropertiesCount = propertyFilter ? propertyFilter.length : properties.length;
  
  if (filteredPropertiesCount === 0) return 0;
  
  const totalDaysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const totalAvailableDays = totalDaysInPeriod * filteredPropertiesCount;
  
  const totalBookedDays = reservations.reduce((sum, r) => {
    const checkIn = new Date(r.check_in_date);
    const checkOut = new Date(r.check_out_date);
    const days = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    return sum + days;
  }, 0);
  
  return Math.min(100, (totalBookedDays / totalAvailableDays) * 100);
};

// CORREÇÃO 4: Validação dos Campos de Receita (USE ESTAS NO SEU DASHBOARD.tsx)
export const calculateTotalRevenue = (reservations: any[]) => {
  return reservations.reduce((sum, r) => {
    // Use o campo correto da sua base de dados
    return sum + (r.total_revenue || r.valor_total || 0);
  }, 0);
};

export const calculateTotalNetRevenue = (reservations: any[]) => {
  return reservations.reduce((sum, r) => {
    // Use o campo correto da sua base de dados  
    return sum + (r.net_revenue || r.valor_proprietario || 0);
  }, 0);
};

export const calculateTotalCommission = (reservations: any[]) => {
  return reservations.reduce((sum, r) => {
    // Calcule a comissão como diferença entre total e líquido
    const total = r.total_revenue || r.valor_total || 0;
    const net = r.net_revenue || r.valor_proprietario || 0;
    return sum + (total - net);
  }, 0);
};

const CashflowCard = ({ data }: { data: CashflowData }) => {
  const totalReceived = data.airbnbReceived + data.bookingReceived + data.diretoReceived;
  const totalReceivable = data.airbnbReceivable + data.bookingReceivable + data.diretoReceivable;

  // Um gráfico só: por canal, recebido (cor cheia) e a receber (cor clara) lado a lado
  const porCanal = [
    { canal: 'Airbnb', recebido: data.airbnbReceived, aReceber: data.airbnbReceivable },
    { canal: 'Booking', recebido: data.bookingReceived, aReceber: data.bookingReceivable },
    { canal: 'Direto', recebido: data.diretoReceived, aReceber: data.diretoReceivable },
  ].filter((c) => c.recebido > 0 || c.aReceber > 0);

  return (
    <Card className="bg-white card-elevated h-full smooth-transition">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-gradient-primary flex items-center gap-2">
          <Landmark className="h-4 w-4" />
          Fluxo de Caixa por Plataforma
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Resumo Visual */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="bg-gradient-to-r from-success-50 to-success-100 p-3 rounded-xl border border-success-200">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-success-600" />
              <span className="text-xs font-medium text-success-800">Recebido</span>
            </div>
            <div className="font-mono text-base font-semibold tabular-nums text-success-700 sm:text-lg">{formatCurrency(totalReceived)}</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-success-600" />
              <span className="text-xs text-success-600">Entrada confirmada</span>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-warning-50 to-warning-100 p-3 rounded-xl border border-warning-200">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-warning-600" />
              <span className="text-xs font-medium text-warning-800">A Receber</span>
            </div>
            <div className="font-mono text-base font-semibold tabular-nums text-warning-700 sm:text-lg">{formatCurrency(totalReceivable)}</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingDown className="h-3 w-3 text-warning-600" />
              <span className="text-xs text-warning-600">Entrada prevista</span>
            </div>
          </div>
        </div>

        {/* Gráfico: recebido x a receber por canal */}
        {porCanal.length > 0 && (
          <div>
            <div className="h-[220px] md:h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porCanal} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4} barCategoryGap="28%">
                  <CartesianGrid {...PROPS_GRADE} />
                  <XAxis dataKey="canal" {...PROPS_EIXO_X} />
                  <YAxis {...PROPS_EIXO_Y} tickFormatter={eixoMoeda} />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--chart-grid))' }}
                    content={<TooltipGrafico formatar={moedaCompleta} />}
                  />
                  <Bar dataKey="recebido" name="Recebido" radius={RAIO_BARRA} maxBarSize={44}>
                    {porCanal.map((c) => (
                      <Cell key={c.canal} fill={corDoCanalGrafico(c.canal)} />
                    ))}
                  </Bar>
                  <Bar dataKey="aReceber" name="A receber" radius={RAIO_BARRA} maxBarSize={44}>
                    {porCanal.map((c) => (
                      <Cell key={c.canal} fill={corDoCanalGrafico(c.canal)} fillOpacity={0.35} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-3 text-xs text-gray-600">
              <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-gray-600" aria-hidden="true" />Recebido (cor cheia)</li>
              <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-gray-600/35" aria-hidden="true" />A receber (cor clara)</li>
            </ul>
          </div>
        )}

        {/* Detalhamento por Plataforma */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
          <div className="text-center">
            <div className="mb-1 flex items-center justify-center gap-1.5 text-xs text-gray-500"><span className="h-2 w-2 rounded-full" style={{ background: corDoCanalGrafico('Airbnb') }} aria-hidden="true" />Airbnb</div>
            <div className="font-mono text-xs font-semibold tabular-nums text-gray-800 sm:text-sm">
              {formatCurrency(data.airbnbReceived + data.airbnbReceivable)}
            </div>
          </div>
          <div className="text-center">
            <div className="mb-1 flex items-center justify-center gap-1.5 text-xs text-gray-500"><span className="h-2 w-2 rounded-full" style={{ background: corDoCanalGrafico('Booking') }} aria-hidden="true" />Booking</div>
            <div className="font-mono text-xs font-semibold tabular-nums text-gray-800 sm:text-sm">
              {formatCurrency(data.bookingReceived + data.bookingReceivable)}
            </div>
          </div>
          <div className="text-center">
            <div className="mb-1 flex items-center justify-center gap-1.5 text-xs text-gray-500"><span className="h-2 w-2 rounded-full" style={{ background: corDoCanalGrafico('Direto') }} aria-hidden="true" />Direto</div>
            <div className="font-mono text-xs font-semibold tabular-nums text-gray-800 sm:text-sm">
              {formatCurrency(data.diretoReceived + data.diretoReceivable)}
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
};

export default CashflowCard;
