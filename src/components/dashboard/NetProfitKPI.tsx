
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp } from 'lucide-react';

interface NetProfitKPIProps {
  totalRevenue: number;
  totalExpenses: number;
  totalCommission: number;
}

const NetProfitKPI = ({ totalRevenue, totalExpenses, totalCommission }: NetProfitKPIProps) => {
  const [viewType, setViewType] = useState<'net' | 'commission' | 'combined'>('net');

  const netProfit = totalRevenue - totalExpenses - totalCommission;
  
  const getValue = () => {
    switch (viewType) {
      case 'net':
        return `R$ ${netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      case 'commission':
        return `R$ ${totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      case 'combined':
        return `R$ ${(netProfit + totalCommission).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      default:
        return `R$ ${netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }
  };

  const getLabel = () => {
    switch (viewType) {
      case 'net':
        return 'Total Líquido do Proprietário';
      case 'commission':
        return 'Comissão Co-Anfitrião';
      case 'combined':
        return 'Receita Total';
      default:
        return 'Total Líquido do Proprietário';
    }
  };

  return (
    <Card className="bg-white card-elevated gradient-hover-card smooth-transition">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium text-gradient-primary">
            Lucro Líquido
          </CardTitle>
          <Select value={viewType} onValueChange={(value: 'net' | 'commission' | 'combined') => setViewType(value)}>
            <SelectTrigger className="h-6 w-auto text-xs border-none shadow-none p-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="net" className="text-xs">Proprietário</SelectItem>
              <SelectItem value="commission" className="text-xs">Comissão</SelectItem>
              <SelectItem value="combined" className="text-xs">Combinado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-[#6A6DDF]">
          <TrendingUp className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gradient-success">
          {getValue()}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {getLabel()}
        </div>
      </CardContent>
    </Card>
  );
};

export default NetProfitKPI;
