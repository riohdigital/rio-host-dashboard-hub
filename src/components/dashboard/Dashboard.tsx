
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import KPICard from './KPICard';
import { TrendingUp, DollarSign, TrendingDown, Calendar } from 'lucide-react';

const Dashboard = () => {
  const [selectedProperty, setSelectedProperty] = useState('todas');
  const [selectedPeriod, setSelectedPeriod] = useState('12meses');

  // Dados de exemplo para os gráficos
  const monthlyData = [
    { month: 'Jan', receita: 4000 },
    { month: 'Fev', receita: 3000 },
    { month: 'Mar', receita: 5000 },
    { month: 'Abr', receita: 4500 },
    { month: 'Mai', receita: 6000 },
    { month: 'Jun', receita: 5500 },
  ];

  const yearlyData = [
    { year: '2021', receita: 45000 },
    { year: '2022', receita: 52000 },
    { year: '2023', receita: 68000 },
    { year: '2024', receita: 75000 },
  ];

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-[#6A6DDF]">Dashboard Analítico</h1>
        <div className="flex gap-4">
          <Select value={selectedProperty} onValueChange={setSelectedProperty}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Selecionar Propriedade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as Propriedades</SelectItem>
              <SelectItem value="casa1">Casa da Praia</SelectItem>
              <SelectItem value="apto1">Apartamento Centro</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3meses">3 Meses</SelectItem>
              <SelectItem value="6meses">6 Meses</SelectItem>
              <SelectItem value="12meses">12 Meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Receita Bruta"
          value="R$ 32.500"
          isPositive={true}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <KPICard
          title="Despesas Totais"
          value="R$ 8.750"
          isPositive={false}
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <KPICard
          title="Lucro Líquido"
          value="R$ 23.750"
          isPositive={true}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KPICard
          title="Taxa de Ocupação"
          value="78%"
          isPositive={true}
          icon={<Calendar className="h-4 w-4" />}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-[#374151]">Crescimento Mensal da Receita</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => [`R$ ${value}`, 'Receita']} />
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

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-[#374151]">Crescimento Anual da Receita</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={yearlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip formatter={(value) => [`R$ ${value}`, 'Receita']} />
                <Bar dataKey="receita" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
