
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign } from 'lucide-react';

interface MonthlyRevenueKPIProps {
  reservations: any[];
}

const MonthlyRevenueKPI = ({ reservations }: MonthlyRevenueKPIProps) => {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const calculateMonthlyRevenue = (monthIndex: number) => {
    const monthKey = `${currentYear}-${(monthIndex + 1).toString().padStart(2, '0')}`;
    
    return reservations
      .filter(r => r.check_in_date.startsWith(monthKey))
      .reduce((sum, r) => sum + (r.total_revenue || 0), 0);
  };

  const monthlyRevenue = calculateMonthlyRevenue(selectedMonth);

  return (
    <Card className="bg-white card-elevated gradient-hover-card smooth-transition">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium text-gradient-primary">
            Receita Mensal
          </CardTitle>
          <Select 
            value={selectedMonth.toString()} 
            onValueChange={(value) => setSelectedMonth(parseInt(value))}
          >
            <SelectTrigger className="h-6 w-auto text-xs border-none shadow-none p-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month, index) => (
                <SelectItem key={index} value={index.toString()} className="text-xs">
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-[#6A6DDF]">
          <DollarSign className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gradient-success">
          R$ {monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {months[selectedMonth]} {currentYear}
        </div>
      </CardContent>
    </Card>
  );
};

export default MonthlyRevenueKPI;
