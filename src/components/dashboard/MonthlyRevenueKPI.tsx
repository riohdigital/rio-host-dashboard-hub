
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from 'lucide-react';

interface MonthlyRevenueKPIProps {
  totalRevenue: number;
  selectedPeriod: string;
  subtitle?: string;
}

const MonthlyRevenueKPI = ({ totalRevenue, selectedPeriod, subtitle }: MonthlyRevenueKPIProps) => {
  return (
    <Card className="bg-white card-elevated gradient-hover-card smooth-transition">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gradient-primary">
          {subtitle || 'Receita Total'}
        </CardTitle>
        <div className="text-[#6A6DDF]">
          <DollarSign className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gradient-success">
          R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {selectedPeriod}
        </div>
      </CardContent>
    </Card>
  );
};

export default MonthlyRevenueKPI;
