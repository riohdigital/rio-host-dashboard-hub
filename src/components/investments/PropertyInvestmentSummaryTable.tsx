import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Settings, Eye } from 'lucide-react';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { PropertyROI } from '@/types/investment';
import { useNavigate } from 'react-router-dom';

interface PropertyInvestmentSummaryTableProps {
  roiData: PropertyROI[];
  loading: boolean;
}

const PropertyInvestmentSummaryTable = ({ roiData, loading }: PropertyInvestmentSummaryTableProps) => {
  const navigate = useNavigate();
  const { hasPermission } = useUserPermissions();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getROIBadgeVariant = (percentage: number) => {
    if (percentage >= 20) return 'default';
    if (percentage >= 10) return 'secondary';
    return 'destructive';
  };

  const handleManageInvestments = (propertyId: string) => {
    navigate(`/investimentos/${propertyId}`);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resumo por Propriedade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-lg">Carregando dados...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (roiData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resumo por Propriedade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Settings className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">Nenhuma propriedade com investimentos</h3>
            <p>Adicione investimentos às suas propriedades para ver o resumo aqui.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumo por Propriedade</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Propriedade</TableHead>
              <TableHead className="text-right">Receita Bruta</TableHead>
              <TableHead className="text-right">Investimento</TableHead>
              <TableHead className="text-right">Receita Líquida</TableHead>
              <TableHead className="text-center">ROI</TableHead>
              <TableHead className="text-center">Recuperação</TableHead>
              {hasPermission('investments_create') && <TableHead className="text-center">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {roiData.map((roi) => (
              <TableRow key={roi.property_id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{roi.property_name}</div>
                    {roi.property_nickname && (
                      <div className="text-sm text-gray-500">{roi.property_nickname}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium text-blue-600">
                  {formatCurrency(roi.total_revenue)}
                </TableCell>
                <TableCell className="text-right font-medium text-red-600">
                  {formatCurrency(roi.total_investment)}
                </TableCell>
                <TableCell className="text-right font-medium text-green-600">
                  {formatCurrency(roi.net_revenue)}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={getROIBadgeVariant(roi.roi_percentage)}>
                    {roi.is_profitable ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {roi.roi_percentage.toFixed(1)}%
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <div className="space-y-1">
                    <Progress 
                      value={Math.min(roi.investment_recovered_percentage, 100)} 
                      className="h-2 w-16 mx-auto"
                    />
                    <div className="text-xs text-gray-600">
                      {Math.min(roi.investment_recovered_percentage, 100).toFixed(0)}%
                    </div>
                  </div>
                </TableCell>
                {hasPermission('investments_create') && (
                  <TableCell className="text-center">
                    <div className="flex gap-2 justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleManageInvestments(roi.property_id)}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Gerenciar
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default PropertyInvestmentSummaryTable;