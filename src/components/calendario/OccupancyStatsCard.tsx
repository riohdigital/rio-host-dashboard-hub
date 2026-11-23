import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, TrendingUp, DollarSign, Calendar } from 'lucide-react';
import { OccupancyStats } from '@/hooks/useOccupancyStats';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PROPS_EIXO_X, PROPS_GRADE, RAIO_BARRA_H } from '@/components/graficos/tema';

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
    if (rate >= 80) return 'hsl(var(--success))';
    if (rate >= 60) return 'hsl(var(--warning))';
    return 'hsl(var(--danger))';
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Estatísticas de Ocupação
            </CardTitle>
            <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
              {/* Resumo sempre visível */}
              <div className="flex items-center gap-3 font-mono text-sm tabular-nums sm:mr-4 sm:gap-4">
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
                <ResponsiveContainer width="100%" height={Math.max(120, chartData.length * 36 + 24)}>
                  <BarChart
                    data={[...chartData].sort((a, b) => b.occupancyRate - a.occupancyRate)}
                    layout="vertical"
                    margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
                    barCategoryGap={8}
                  >
                    <CartesianGrid {...PROPS_GRADE} vertical horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} {...PROPS_EIXO_X} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" {...PROPS_EIXO_X} width={110} />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--chart-grid))' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-xl border bg-popover px-3 py-2 text-sm shadow-lg">
                              <p className="mb-1 font-semibold text-ink">{data.name}</p>
                              <p className="text-gray-600">
                                Ocupação: <span className="font-mono font-medium tabular-nums text-ink">{data.occupancyRate.toFixed(1)}%</span>
                              </p>
                              <p className="text-gray-600">
                                Receita: <span className="font-mono font-medium tabular-nums text-ink">
                                  {data.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="occupancyRate" radius={RAIO_BARRA_H} maxBarSize={22} label={{ position: 'right', fontSize: 11, fill: 'hsl(var(--ink))', formatter: (v: number) => `${Math.round(v)}%` }}>
                      {[...chartData].sort((a, b) => b.occupancyRate - a.occupancyRate).map((entry, index) => (
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
                            stat.occupancyRate >= 80 ? 'text-success-600 dark:text-success-400' :
                            stat.occupancyRate >= 60 ? 'text-warning-600 dark:text-warning-400' :
                            'text-danger-600 dark:text-danger-400'
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
