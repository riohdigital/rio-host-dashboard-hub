import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, TrendingUp, DollarSign, Calendar } from 'lucide-react';
import { OccupancyStats } from '@/hooks/useOccupancyStats';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface OccupancyStatsCardProps {
  stats: OccupancyStats[];
}

export const OccupancyStatsCard: React.FC<OccupancyStatsCardProps> = ({ stats }) => {
  const [isOpen, setIsOpen] = useState(false); // Começa fechado por padrão

  // Dados para o gráfico
  const chartData = stats.map(stat => ({
    name: stat.propertyName,
    occupancyRate: stat.occupancyRate,
    revenue: stat.totalRevenue,
  }));

  // Calcular totais
  const totalRevenue = stats.reduce((sum, s) => sum + s.totalRevenue, 0);
  const averageOccupancy = stats.length > 0 
    ? stats.reduce((sum, s) => sum + s.occupancyRate, 0) / stats.length 
    : 0;
  const totalReservations = stats.reduce((sum, s) => sum + s.reservationCount, 0);

  // Cores para as barras baseadas na taxa de ocupação
  const getBarColor = (rate: number) => {
    if (rate >= 80) return 'hsl(142, 76%, 36%)'; // verde
    if (rate >= 60) return 'hsl(48, 96%, 53%)'; // amarelo
    return 'hsl(0, 84%, 60%)'; // vermelho
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Estatísticas de Ocupação
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Resumo sempre visível */}
              <div className="flex items-center gap-4 text-sm mr-4">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-primary">
                    {averageOccupancy.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-primary">
                    R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="secondary">{totalReservations}</Badge>
                </div>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isOpen ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Ocultar
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Detalhes
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-6 pt-2">

            {/* Gráfico de Barras */}
            {chartData.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                  Taxa de Ocupação por Propriedade
                </h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      domain={[0, 100]}
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
                              <p className="font-semibold mb-1">{data.name}</p>
                              <p className="text-muted-foreground">
                                Ocupação: <span className="font-medium text-foreground">{data.occupancyRate.toFixed(1)}%</span>
                              </p>
                              <p className="text-muted-foreground">
                                Receita: <span className="font-medium text-foreground">
                                  {data.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="occupancyRate" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getBarColor(entry.occupancyRate)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tabela Detalhada */}
            <div>
              <h4 className="text-sm font-medium mb-3 text-muted-foreground">Detalhes por Propriedade</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Propriedade</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Ocupação</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Dias</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Reservas</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Receita</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Diária Média</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((stat) => (
                      <tr key={stat.propertyId} className="border-b last:border-0">
                        <td className="py-2 px-2 font-medium">{stat.propertyName}</td>
                        <td className="py-2 px-2 text-right">
                          <span className={`font-semibold ${
                            stat.occupancyRate >= 80 ? 'text-green-600 dark:text-green-400' :
                            stat.occupancyRate >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {stat.occupancyRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right text-muted-foreground">
                          {stat.occupiedDays}/{stat.totalDays}
                        </td>
                        <td className="py-2 px-2 text-right">{stat.reservationCount}</td>
                        <td className="py-2 px-2 text-right font-medium">
                          {stat.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-2 px-2 text-right text-muted-foreground">
                          {stat.averageDailyRate.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
