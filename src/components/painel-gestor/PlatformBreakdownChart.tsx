import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { PlatformBreakdown } from '@/types/painel-gestor';

interface PlatformBreakdownChartProps {
  data: PlatformBreakdown[];
  loading?: boolean;
}

const PLATFORM_COLORS: Record<string, string> = {
  'Airbnb': '#FF5A5F',
  'Booking': '#003580',
  'Booking.com': '#003580',
  'Direto': '#10B981',
  'Direct': '#10B981',
  'VRBO': '#0071C2',
  'Expedia': '#FDDB32'
};

export const PlatformBreakdownChart = ({ data, loading }: PlatformBreakdownChartProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getColor = (platform: string) => {
    return PLATFORM_COLORS[platform] || 'hsl(var(--muted-foreground))';
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg shadow-lg p-3">
          <p className="font-semibold text-sm mb-2">{data.platform}</p>
          <div className="space-y-1">
            <p className="text-sm">
              Comissão: <span className="font-medium text-green-600">{formatCurrency(data.commission)}</span>
            </p>
            <p className="text-sm">
              Reservas: <span className="font-medium">{data.reservations}</span>
            </p>
            <p className="text-sm">
              Receita: <span className="font-medium">{formatCurrency(data.revenue)}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-lg">Distribuição por Plataforma</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Carregando...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-lg">🥧 Distribuição por Plataforma</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] flex items-center justify-center text-muted-foreground">
            Nenhum dado para exibir.
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalCommission = data.reduce((sum, d) => sum + d.commission, 0);

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="text-lg">🥧 Distribuição por Plataforma</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="commission"
                nameKey="platform"
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={getColor(entry.platform)}
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value, entry: any) => {
                  const percentage = totalCommission > 0 
                    ? ((entry.payload.commission / totalCommission) * 100).toFixed(0)
                    : 0;
                  return <span className="text-sm">{value} ({percentage}%)</span>;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
