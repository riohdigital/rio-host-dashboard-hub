import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TabelaResponsiva from '@/components/comum/TabelaResponsiva';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PropertyPerformance } from '@/types/painel-gestor';

interface PropertyPerformanceTableProps {
  data: PropertyPerformance[];
  loading?: boolean;
}

export const PropertyPerformanceTable = ({ data, loading }: PropertyPerformanceTableProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  if (loading) {
    return (
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-lg">Performance por Propriedade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-lg">Performance por Propriedade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma propriedade encontrada para o período selecionado.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="text-lg">Performance por Propriedade</CardTitle>
      </CardHeader>
      <CardContent>
        <TabelaResponsiva
          itens={data}
          chaveItem={(p) => p.propertyId}
          colunas={[
            {
              chave: 'imovel', titulo: 'Propriedade', celula: (p) => (
                <div>
                  <p className="font-medium">{p.nickname || p.propertyName}</p>
                  {p.nickname && <p className="text-xs text-muted-foreground">{p.propertyName}</p>}
                </div>
              ),
            },
            { chave: 'reservas', titulo: 'Reservas', alinhar: 'centro', celula: (p) => <Badge variant="secondary" className="font-mono">{p.reservations}</Badge> },
            { chave: 'receita', titulo: 'Receita', alinhar: 'direita', celula: (p) => <span className="font-mono font-medium tabular-nums">{formatCurrency(p.totalRevenue)}</span> },
            { chave: 'comissao', titulo: 'Comissão', alinhar: 'direita', celula: (p) => <span className="font-mono font-medium tabular-nums text-success-600">{formatCurrency(p.commission)}</span> },
            { chave: 'taxa', titulo: 'Taxa', alinhar: 'centro', celula: (p) => <Badge variant="outline" className="font-mono">{p.commissionRate.toFixed(0)}%</Badge> },
            {
              chave: 'ocupacao', titulo: 'Ocupação', alinhar: 'centro', celula: (p) => (
                <div className="flex items-center gap-2">
                  <Progress value={p.occupancyRate} className="h-2 w-16" />
                  <span className="w-10 font-mono text-xs text-muted-foreground">{p.occupancyRate.toFixed(0)}%</span>
                </div>
              ),
            },
            {
              chave: 'faxinas', titulo: 'Faxinas', alinhar: 'centro', celula: (p) => (
                <div className="flex items-center justify-center gap-1 font-mono">
                  <span className="text-success-600">{p.completedCleanings}</span>
                  <span className="text-muted-foreground">/</span>
                  <span className={p.pendingCleanings > 0 ? 'text-warning-600' : 'text-muted-foreground'}>{p.pendingCleanings}</span>
                </div>
              ),
            },
          ]}
          cartao={(p) => (
            <div className="rounded-xl border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{p.nickname || p.propertyName}</p>
                  {p.nickname && <p className="truncate text-xs text-muted-foreground">{p.propertyName}</p>}
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-success-600">{formatCurrency(p.commission)}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-600">
                <div><div>Reservas</div><div className="font-mono text-sm text-ink">{p.reservations}</div></div>
                <div><div>Receita</div><div className="font-mono text-sm text-ink">{formatCurrency(p.totalRevenue)}</div></div>
                <div><div>Faxinas</div><div className="font-mono text-sm text-ink">{p.completedCleanings}/{p.pendingCleanings}</div></div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                Ocupação <Progress value={p.occupancyRate} className="h-2 flex-1" />
                <span className="font-mono">{p.occupancyRate.toFixed(0)}%</span>
                <span className="text-gray-400">· taxa {p.commissionRate.toFixed(0)}%</span>
              </div>
            </div>
          )}
        />
      </CardContent>
    </Card>
  );
};
