
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface MonthlyRevenueChartProps {
  reservations: any[];
}

const MonthlyRevenueChart = ({ reservations }: MonthlyRevenueChartProps) => {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const generateMonthlyData = (monthIndex: number) => {
    const monthKey = `${currentYear}-${(monthIndex + 1).toString().padStart(2, '0')}`;
    
    // Filtrar reservas do mês selecionado
    const monthReservations = reservations.filter(r => 
      r.check_in_date.startsWith(monthKey)
    );

    // Agrupar por semana do mês
    const weeklyData = [];
    const daysInMonth = new Date(currentYear, monthIndex + 1, 0).getDate();
    
    for (let week = 1; week <= 4; week++) {
      const weekStart = (week - 1) * 7 + 1;
      const weekEnd = Math.min(week * 7, daysInMonth);
      
      const weekRevenue = monthReservations
        .filter(r => {
          const day = parseInt(r.check_in_date.split('-')[2]);
          return day >= weekStart && day <= weekEnd;
        })
        .reduce((sum, r) => sum + (r.total_revenue || 0), 0);

      weeklyData.push({
        week: `Sem ${week}`,
        receita: weekRevenue
      });
    }

    return weeklyData;
  };

  const chartData = generateMonthlyData(selectedMonth);

  return (
    <Card className="bg-white">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-gradient-primary">Receita Mensal Detalhada</CardTitle>
        <Select 
          value={selectedMonth.toString()} 
          onValueChange={(value) => setSelectedMonth(parseInt(value))}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((month, index) => (
              <SelectItem key={index} value={index.toString()}>
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis />
            <Tooltip formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Receita']} />
            <Line 
              type="monotone" 
              dataKey="receita" 
              stroke="#6A6DDF" 
              strokeWidth={3}
              dot={{ fill: '#6A6DDF', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default MonthlyRevenueChart;
