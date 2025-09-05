import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EnhancedReportTemplateProps {
  report: {
    type: string;
    title: string;
    data: any;
    generatedAt: string | Date;
  };
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

export const EnhancedReportTemplate = ({ report }: EnhancedReportTemplateProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const formatPercentage = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return '0.0%';
    return `${value.toFixed(1)}%`;
  };

  const renderFinancialReport = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Receita Total</div>
            <div className="text-2xl font-bold text-primary">{formatCurrency(report.data.totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Despesas</div>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(report.data.totalExpenses)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Lucro Líquido</div>
            <div className="text-2xl font-bold text-primary">{formatCurrency(report.data.netProfit)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Margem</div>
            <div className="text-2xl font-bold">{formatPercentage(report.data.profitMargin)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Detalhes por Propriedade */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo por Propriedade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {report.data.properties?.map((property: any, index: number) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold">{property.name}</h4>
                  <Badge variant="outline">{property.totalReservations} reservas</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Receita Total</div>
                    <div className="font-medium text-primary">{formatCurrency(property.totalRevenue)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Recebido</div>
                    <div className="font-medium text-green-600">{formatCurrency(property.receivedAmount)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">A Receber</div>
                    <div className="font-medium text-orange-500">{formatCurrency(property.pendingAmount)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Ocupação</div>
                    <div className="font-medium">{formatPercentage(property.occupancyRate)}</div>
                  </div>
                </div>
                
                {/* Detalhes por Plataforma */}
                <div className="mt-3 pt-3 border-t">
                  <div className="text-sm font-medium mb-2">Por Plataforma:</div>
                  <div className="flex flex-wrap gap-2">
                    {property.platforms?.map((platform: any, pIndex: number) => (
                      <div key={pIndex} className="flex items-center gap-2 bg-muted rounded px-2 py-1 text-xs">
                        <span className="font-medium">{platform.name}:</span>
                        <span className="text-primary">{formatCurrency(platform.revenue)}</span>
                        <span className="text-muted-foreground">({platform.count} reservas)</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lista de Reservas */}
                {property.reservations && property.reservations.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="text-sm font-medium mb-2">Códigos das Reservas:</div>
                    <div className="flex flex-wrap gap-1">
                      {property.reservations.map((reservation: any, rIndex: number) => (
                        <Badge key={rIndex} variant="secondary" className="text-xs">
                          {reservation.code}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de Receita por Período */}
      <Card>
        <CardHeader>
          <CardTitle>Receita por Período</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={report.data.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="month" 
                className="text-xs"
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(value) => [formatCurrency(Number(value)), 'Receita']}
                labelFormatter={(label) => `Período: ${label}`}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Bar 
                dataKey="revenue" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Distribuição por Plataforma */}
      <Card>
        <CardHeader>
          <CardTitle>Receita por Plataforma</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={report.data.platformRevenue}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) => `${name}: ${formatCurrency(value)} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="revenue"
                >
                  {report.data.platformRevenue?.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="space-y-3">
              {report.data.platformRevenue?.map((platform: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="font-medium">{platform.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrency(platform.revenue)}</div>
                    <div className="text-sm text-muted-foreground">{platform.count} reservas</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status de Pagamentos */}
      <Card>
        <CardHeader>
          <CardTitle>Status dos Pagamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">{formatCurrency(report.data.receivedAmount || 0)}</div>
              <div className="text-sm text-muted-foreground">Já Recebido</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-orange-500">{formatCurrency(report.data.pendingAmount || 0)}</div>
              <div className="text-sm text-muted-foreground">A Receber</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-primary">{report.data.totalReservations || 0}</div>
              <div className="text-sm text-muted-foreground">Total de Reservas</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderOccupancyReport = () => {
    // Cálculos auxiliares a partir dos dados retornados
    const occupiedDays = report.data?.summary?.occupiedDays || 0;
    const reservations = report.data?.reservations || [];
    const totalRevenue = reservations.reduce((sum: number, r: any) => sum + (Number(r.net_revenue) || 0), 0);
    const adr = occupiedDays > 0 ? totalRevenue / occupiedDays : 0;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Taxa de Ocupação</div>
              <div className="text-2xl font-bold text-primary">{formatPercentage(report.data?.summary?.occupancyRate)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Diárias Vendidas</div>
              <div className="text-2xl font-bold">{occupiedDays}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Valor Médio Diária</div>
              <div className="text-2xl font-bold">{formatCurrency(adr)}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ocupação Diária</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={report.data?.charts?.dailyOccupancy || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="occupied" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderPropertyPerformanceReport = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Performance por Propriedade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Propriedade</th>
                  <th className="text-right p-2">Receita</th>
                  <th className="text-right p-2">Ocupação</th>
                  <th className="text-right p-2">ADR</th>
                  <th className="text-right p-2">RevPAR</th>
                </tr>
              </thead>
              <tbody>
                {report.data.properties?.map((property: any, index: number) => (
                  <tr key={index} className="border-b">
                    <td className="p-2 font-medium">{property.name}</td>
                    <td className="p-2 text-right">{formatCurrency(property.totalRevenue)}</td>
                    <td className="p-2 text-right">{formatPercentage(property.occupancy)}</td>
                    <td className="p-2 text-right">{formatCurrency(property.adr)}</td>
                    <td className="p-2 text-right">{formatCurrency(property.revpar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderExpensesReport = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total de Despesas</div>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(report.data?.summary?.totalExpenses)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Resultado (Lucro)</div>
            <div className="text-2xl font-bold text-primary">{formatCurrency(report.data?.summary?.profit)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Despesas por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={report.data.charts?.expensesByCategory}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="amount"
              >
                {report.data.charts?.expensesByCategory?.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );

  const renderPlatformReport = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Distribuição por Plataforma (Reservas)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={report.data.charts?.platformDistribution || []}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={80}
                dataKey="value"
              >
                {(report.data.charts?.platformDistribution || []).map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumo por Plataforma</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Plataforma</th>
                  <th className="text-right p-2">Reservas</th>
                  <th className="text-right p-2">Receita</th>
                  <th className="text-right p-2">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {(report.data.platforms || []).map((p: any, idx: number) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2 font-medium">{p.name}</td>
                    <td className="p-2 text-right">{p.reservations}</td>
                    <td className="p-2 text-right">{formatCurrency(p.revenue)}</td>
                    <td className="p-2 text-right">{formatCurrency(p.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderCheckinsReport = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Próximos Check-ins</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(report.data.upcomingCheckins || []).slice(0, 20).map((r: any, idx: number) => (
              <div key={idx} className="flex justify-between border rounded p-2 text-sm">
                <span>
                  {format(new Date(r.check_in_date), 'dd/MM/yyyy', { locale: ptBR })}
                  {' - '}
                  {r.properties?.nickname || r.properties?.name || 'Propriedade'}
                </span>
                <span className="text-muted-foreground">{r.guest_name || '-'}</span>
              </div>
            ))}
            {(!report.data.upcomingCheckins || report.data.upcomingCheckins.length === 0) && (
              <div className="text-muted-foreground">Sem dados para os próximos dias.</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Próximos Check-outs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(report.data.upcomingCheckouts || []).slice(0, 20).map((r: any, idx: number) => (
              <div key={idx} className="flex justify-between border rounded p-2 text-sm">
                <span>
                  {format(new Date(r.check_out_date), 'dd/MM/yyyy', { locale: ptBR })}
                  {' - '}
                  {r.properties?.nickname || r.properties?.name || 'Propriedade'}
                </span>
                <span className="text-muted-foreground">{r.guest_name || '-'}</span>
              </div>
            ))}
            {(!report.data.upcomingCheckouts || report.data.upcomingCheckouts.length === 0) && (
              <div className="text-muted-foreground">Sem dados para os próximos dias.</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Check-ins/Check-outs por Dia</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={report.data.charts?.checkinsByDay || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="checkins" stroke="hsl(var(--primary))" />
              <Line type="monotone" dataKey="checkouts" stroke="hsl(var(--chart-3))" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );

  const renderDefaultReport = () => (
    <Card>
      <CardContent className="p-6">
        <div className="text-center text-muted-foreground">
          <p>Dados do relatório disponíveis em formato estruturado</p>
          <pre className="mt-4 text-xs bg-muted p-4 rounded-lg text-left overflow-auto">
            {JSON.stringify(report.data, null, 2)}
          </pre>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">{report.title}</h2>
          <p className="text-muted-foreground">
            Gerado em {format(typeof report.generatedAt === 'string' ? new Date(report.generatedAt) : report.generatedAt, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
        <Badge variant="secondary" className="capitalize">
          {report.type.replace('_', ' ')}
        </Badge>
      </div>

      <Separator />

      {/* Report Content */}
      {(report.type === 'financial' || report.type === 'financial_owner' || report.type === 'financial_expenses') && renderFinancialReport()}
      {report.type === 'occupancy' && renderOccupancyReport()}
      {(report.type === 'property' || report.type === 'property_performance') && renderPropertyPerformanceReport()}
      {report.type === 'platform' && renderPlatformReport()}
      {report.type === 'expenses' && renderExpensesReport()}
      {report.type === 'checkins' && renderCheckinsReport()}
      {![
        'financial',
        'financial_owner',
        'financial_expenses',
        'occupancy',
        'property',
        'property_performance',
        'platform',
        'expenses',
        'checkins'
      ].includes(report.type) && renderDefaultReport()}
    </div>
  );
};