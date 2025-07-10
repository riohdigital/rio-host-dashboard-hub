import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MonthlyData {
  month: string;
  current: number;
  previous: number;
}

interface YearlyData {
  year: string;
  revenue: number;
}

interface AnnualGrowthChartProps {
  monthlyData: MonthlyData[];
  yearlyData: YearlyData[];
  loading: boolean;
}

const AnnualGrowthChart = ({ monthlyData, yearlyData, loading }: AnnualGrowthChartProps) => {
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  // --- LÓGICA DE CÁLCULO DE CRESCIMENTO ANUAL (JÁ CORRIGIDA) ---
  const calculateTotalGrowth = () => {
    if (yearlyData.length < 2) return { value: 0, text: 'N/A' };
    const currentYearRevenue = yearlyData[yearlyData.length - 1]?.revenue || 0;
    const previousYearRevenue = yearlyData[yearlyData.length - 2]?.revenue || 0;
    if (previousYearRevenue > 0) {
      const growth = ((currentYearRevenue - previousYearRevenue) / previousYearRevenue) * 100;
      return { value: growth, text: `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%` };
    }
    if (previousYearRevenue === 0 && currentYearRevenue > 0) return { value: 100, text: 'Novo' };
    return { value: 0, text: '+0.0%' };
  };

  const totalGrowthInfo = calculateTotalGrowth();

  // --- NOVA LÓGICA: CÁLCULO DE CRESCIMENTO MÉDIO MÊS A MÊS (MoM) ---
  const calculateAverageMoMGrowth = (data: MonthlyData[]) => {
    const monthlyGrowths: number[] = [];
    // Filtra para pegar apenas os meses com dados para não distorcer a média
    const relevantMonths = data.filter(m => m.current > 0 || m.previous > 0).slice(0, new Date().getMonth() + 1);

    for (let i = 1; i < relevantMonths.length; i++) {
      const currentMonthRevenue = relevantMonths[i].current;
      const previousMonthRevenue = relevantMonths[i - 1].current;

      if (previousMonthRevenue > 0) {
        const growth = ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100;
        monthlyGrowths.push(growth);
      } else if (currentMonthRevenue > 0) {
        monthlyGrowths.push(100.0); // Crescimento a partir do zero
      }
    }

    if (monthlyGrowths.length === 0) return 0;
    
    const average = monthlyGrowths.reduce((sum, g) => sum + g, 0) / monthlyGrowths.length;
    return average;
  };

  const avgMonthlyGrowth = calculateAverageMoMGrowth(monthlyData);
  // --- FIM DA NOVA LÓGICA ---

  if (loading) {
    // ... (código de loading permanece o mesmo)
    return <Card className="bg-white col-span-2"><CardHeader><CardTitle>Crescimento Anual</CardTitle></CardHeader><CardContent><div className="h-80 flex items-center justify-center">Carregando...</div></CardContent></Card>;
  }

  return (
    <Card className="bg-white col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-gradient-primary flex items-center gap-2">
            {totalGrowthInfo.value >= 0 ? <TrendingUp className="h-5 w-5 text-green-500" /> : <TrendingDown className="h-5 w-5 text-red-500" />}
            Crescimento Anual
          </CardTitle>
          <div className="flex items-center gap-4 mt-2">
            <span className={`text-2xl font-bold ${totalGrowthInfo.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalGrowthInfo.text}
            </span>
            {/* --- ALTERAÇÃO DE TEXTO NA UI --- */}
            <span className="text-sm text-gray-500">
              Crescimento anual • Média Mês a Mês (MoM): {avgMonthlyGrowth >= 0 ? '+' : ''}{avgMonthlyGrowth.toFixed(1)}%
            </span>
          </div>
        </div>
        
        <Select value={viewMode} onValueChange={(value) => setViewMode(value as 'monthly' | 'yearly')}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Mensal</SelectItem>
            <SelectItem value="yearly">Anual</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      
      <CardContent>
        {/* O restante do código para os gráficos permanece o mesmo */}
        {viewMode === 'monthly' ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                  name === 'current' ? `${currentYear}` : name === 'previous' ? `${previousYear}` : 'Crescimento'
                ]}
                labelFormatter={(label) => `Mês: ${label}`}
              />
              <Line type="monotone" dataKey="previous" stroke="#94A3B8" strokeWidth={2} dot={{ fill: '#94A3B8', strokeWidth: 2 }} name={`${previousYear}`} />
              <Line type="monotone" dataKey="current" stroke="#6A6DDF" strokeWidth={3} dot={{ fill: '#6A6DDF', strokeWidth: 2 }} name={`${currentYear}`} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={yearlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Receita']} />
              <Bar dataKey="revenue" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default AnnualGrowthChart;
