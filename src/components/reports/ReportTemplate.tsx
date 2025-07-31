import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReportTemplateProps {
  report: {
    type: string;
    title: string;
    data: any;
    generatedAt: string | Date;
  };
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export const ReportTemplate = ({ report }: ReportTemplateProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
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

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Receita Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={report.data.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Platform Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição por Plataforma</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={report.data.platformRevenue}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
        </CardContent>
      </Card>
    </div>
  );

  const renderOccupancyReport = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Taxa de Ocupação</div>
            <div className="text-2xl font-bold text-primary">{formatPercentage(report.data.occupancyRate)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Diárias Vendidas</div>
            <div className="text-2xl font-bold">{report.data.totalNights}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Valor Médio Diária</div>
            <div className="text-2xl font-bold">{formatCurrency(report.data.avgDailyRate)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ocupação por Propriedade</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={report.data.propertyOccupancy}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="property" />
              <YAxis />
              <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
              <Bar dataKey="occupancy" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );

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
                    <td className="p-2 text-right">{formatCurrency(property.revenue)}</td>
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
            <div className="text-2xl font-bold text-destructive">{formatCurrency(report.data.totalExpenses)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Receita Líquida</div>
            <div className="text-2xl font-bold text-primary">{formatCurrency(report.data.netRevenue)}</div>
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
                data={report.data.expensesByCategory}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="amount"
              >
                {report.data.expensesByCategory?.map((entry: any, index: number) => (
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
      {report.type === 'financial' && renderFinancialReport()}
      {report.type === 'occupancy' && renderOccupancyReport()}
      {report.type === 'property_performance' && renderPropertyPerformanceReport()}
      {report.type === 'expenses' && renderExpensesReport()}
      {!['financial', 'occupancy', 'property_performance', 'expenses'].includes(report.type) && renderDefaultReport()}
    </div>
  );
};