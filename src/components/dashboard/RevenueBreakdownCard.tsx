import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Minus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RevenueBreakdownCardProps {
  grossRevenue: number;
  baseRevenue: number;
  commission: number;
  netRevenue: number;
  expenses: number;
}

const RevenueBreakdownCard = ({ 
  grossRevenue, 
  baseRevenue, 
  commission, 
  netRevenue, 
  expenses 
}: RevenueBreakdownCardProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const cleaningFee = grossRevenue - baseRevenue;
  const finalProfit = netRevenue - expenses;
  
  // Percentuais para as barras
  const commissionPercent = baseRevenue > 0 ? (commission / baseRevenue) * 100 : 0;
  const netRevenuePercent = baseRevenue > 0 ? (netRevenue / baseRevenue) * 100 : 0;

  return (
    <Card className="bg-white card-elevated gradient-hover-card smooth-transition">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gradient-primary flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Breakdown de Receita
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Receita Bruta Total */}
        <div className="space-y-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">Receita Bruta Total</span>
                  <span className="text-base font-bold text-gray-900">{formatCurrency(grossRevenue)}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Valor total pago pelos hóspedes (inclui taxa de limpeza)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* Subcomponentes da Receita Bruta */}
          <div className="ml-4 space-y-1 text-xs text-gray-600">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1">
                <Minus className="h-3 w-3" />
                Base de Cálculo
              </span>
              <span>{formatCurrency(baseRevenue)}</span>
            </div>
            {cleaningFee > 0 && (
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1">
                  <Minus className="h-3 w-3" />
                  Taxa de Limpeza
                </span>
                <span>{formatCurrency(cleaningFee)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="border-t pt-3 space-y-3">
          {/* Comissão Co-Anfitrião */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-orange-700">Comissão Co-Anfitrião</span>
                    <span className="text-sm font-semibold text-orange-700">{formatCurrency(commission)}</span>
                  </div>
                  <Progress value={commissionPercent} className="h-2" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Percentual sobre a base de cálculo destinado ao co-anfitrião</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Receita Líquida Proprietário */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-green-700">Líquido Proprietário</span>
                    <span className="text-sm font-semibold text-green-700">{formatCurrency(netRevenue)}</span>
                  </div>
                  <Progress value={netRevenuePercent} className="h-2 bg-green-100" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Valor que o proprietário recebe após comissão</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="border-t pt-3 space-y-2">
          {/* Despesas */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-red-700">Despesas</span>
            <span className="text-sm font-semibold text-red-700">{formatCurrency(expenses)}</span>
          </div>

          {/* Lucro Líquido Final */}
          <div className="border-t pt-2 mt-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex justify-between items-center">
                    <span className="text-base font-bold text-gradient-primary">Lucro Líquido Final</span>
                    <span className={`text-lg font-bold ${finalProfit >= 0 ? 'text-gradient-success' : 'text-gradient-danger'}`}>
                      {formatCurrency(finalProfit)}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Receita líquida do proprietário menos despesas operacionais</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RevenueBreakdownCard;
