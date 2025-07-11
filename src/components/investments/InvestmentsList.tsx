
import React, { useState } from 'react';
import { Edit, Trash2, FileText, Calendar, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { PropertyInvestment } from '@/types/investment';

interface InvestmentsListProps {
  investments: PropertyInvestment[];
  onEdit?: (investment: PropertyInvestment) => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}

const InvestmentsList = ({ investments, onEdit, onDelete, loading }: InvestmentsListProps) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const groupedInvestments = investments.reduce((acc, investment) => {
    const propertyName = investment.property?.name || 'Propriedade não encontrada';
    if (!acc[propertyName]) {
      acc[propertyName] = [];
    }
    acc[propertyName].push(investment);
    return acc;
  }, {} as Record<string, PropertyInvestment[]>);

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
    <div className="space-y-6">
      {Object.entries(groupedInvestments).map(([propertyName, propertyInvestments]) => {
        const totalInvestment = propertyInvestments.reduce((sum, inv) => sum + Number(inv.amount), 0);
        
        return (
          <Card key={propertyName}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{propertyName}</CardTitle>
                <Badge variant="secondary">
                  Total: {formatCurrency(totalInvestment)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {propertyInvestments.map((investment) => (
                  <div
                    key={investment.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant="outline">
                          {investment.category?.name || 'Categoria não encontrada'}
                        </Badge>
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Calendar className="h-3 w-3" />
                          {formatDate(investment.investment_date)}
                        </div>
                      </div>
                      
                      <h4 className="font-medium mb-1">{investment.description}</h4>
                      
                      <div className="flex items-center gap-1 text-lg font-semibold text-green-600">
                        <DollarSign className="h-4 w-4" />
                        {formatCurrency(Number(investment.amount))}
                      </div>
                      
                      {investment.notes && (
                        <p className="text-sm text-gray-600 mt-2">{investment.notes}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {onEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(investment)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      
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
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default InvestmentsList;
