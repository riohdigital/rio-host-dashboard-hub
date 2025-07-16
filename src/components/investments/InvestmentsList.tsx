import React, { useState } from 'react';
import { Trash2, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { PropertyInvestment } from '@/types/investment';

interface InvestmentsListProps {
  investments: PropertyInvestment[];
  onDelete: (id: string) => Promise<void>;
  loading: boolean;
  showPropertyColumn?: boolean;
}

const InvestmentsList = ({ investments, onDelete, loading, showPropertyColumn = true }: InvestmentsListProps) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { hasPermission } = useUserPermissions();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      await onDelete(id);
    } catch (error) {
      console.error('Erro ao deletar investimento:', error);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Carregando investimentos...</div>
        </CardContent>
      </Card>
    );
  }

  if (investments.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Nenhum investimento registrado ainda.</p>
            <p className="text-sm">Adicione o primeiro investimento para começar a acompanhar o ROI.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lista de Investimentos</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {showPropertyColumn && <TableHead>Propriedade</TableHead>}
              <TableHead>Categoria</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              {hasPermission('investments_create') && <TableHead className="text-center">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {investments.map((investment) => (
              <TableRow key={investment.id}>
                {showPropertyColumn && (
                  <TableCell>
                    <div className="font-medium">
                      {investment.property?.name}
                      {investment.property?.nickname && (
                        <div className="text-sm text-gray-500">
                          ({investment.property.nickname})
                        </div>
                      )}
                    </div>
                  </TableCell>
                )}
                <TableCell>
                  <span className="text-sm">
                    {investment.category?.name || 'N/A'}
                  </span>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{investment.description}</div>
                    {investment.notes && (
                      <div className="text-sm text-gray-500 mt-1">{investment.notes}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {formatDate(investment.investment_date)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(Number(investment.amount))}
                </TableCell>
                {hasPermission('investments_create') && (
                  <TableCell className="text-center">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir este investimento? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(investment.id)}
                            disabled={deletingId === investment.id}
                          >
                            {deletingId === investment.id ? 'Excluindo...' : 'Excluir'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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

export default InvestmentsList;