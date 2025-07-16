import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp } from 'lucide-react';

interface NetProfitKPIProps {
  reservations: any[];
}

const NetProfitKPI = ({ reservations }: NetProfitKPIProps) => {
  const [viewType, setViewType] = useState<'net' | 'commission' | 'combined'>('net');

  const totalNetRevenue = reservations.reduce((sum, r) => {
    return sum + (r.net_revenue || 0);
  }, 0);

  // --- CORREÇÃO APLICADA AQUI ---
  // A comissão total agora é a soma de 'commission_amount'.
  const totalCommission = reservations.reduce((sum, r) => {
    return sum + (r.commission_amount || 0);
  }, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const getValue = () => {
    switch (viewType) {
      case 'net':
        return formatCurrency(totalNetRevenue);
      case 'commission':
        return formatCurrency(totalCommission);
      case 'combined':
        return formatCurrency(totalNetRevenue + totalCommission);
      default:
        return formatCurrency(totalNetRevenue);
    }
  };

  const getLabel = () => {
    switch (viewType) {
      case 'net':
        return 'Total Líquido do Proprietário';
      case 'commission':
        return 'Comissão Co-Anfitrião';
      case 'combined':
        return 'Base de Cálculo'; // Alterado para ser mais preciso
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
              <SelectItem value="combined" className="text-xs">Base de Cálculo</SelectItem>
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
