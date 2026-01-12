import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
          <CardTitle className="text-lg">📋 Performance por Propriedade</CardTitle>
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
        <CardTitle className="text-lg">📋 Performance por Propriedade</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propriedade</TableHead>
                <TableHead className="text-center">Reservas</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead className="text-center">Taxa</TableHead>
                <TableHead className="text-center">Ocupação</TableHead>
                <TableHead className="text-center">Faxinas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((property) => (
                <TableRow key={property.propertyId}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{property.nickname || property.propertyName}</p>
                      {property.nickname && (
                        <p className="text-xs text-muted-foreground">{property.propertyName}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{property.reservations}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(property.totalRevenue)}
                  </TableCell>
                  <TableCell className="text-right font-medium text-green-600">
                    {formatCurrency(property.commission)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{property.commissionRate.toFixed(0)}%</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={property.occupancyRate} 
                        className="h-2 w-16"
                      />
                      <span className="text-xs text-muted-foreground w-10">
                        {property.occupancyRate.toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-green-600">{property.completedCleanings}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className={property.pendingCleanings > 0 ? 'text-amber-600' : 'text-muted-foreground'}>
                        {property.pendingCleanings}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
