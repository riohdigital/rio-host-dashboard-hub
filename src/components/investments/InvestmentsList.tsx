import React, { useState } from 'react';
import { Trash2, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import TabelaResponsiva from '@/components/comum/TabelaResponsiva';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { PropertyInvestment } from '@/types/investment';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';

interface InvestmentsListProps {
  investments: PropertyInvestment[];
  onDelete: (id: string) => Promise<void>;
  loading: boolean;
  showPropertyColumn?: boolean;
}

const InvestmentsList = ({ investments, onDelete, loading, showPropertyColumn = true }: InvestmentsListProps) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // A pergunta de exclusão volta aberta depois de recarregar a página
  const [confirmandoId, setConfirmandoId] = useEstadoPersistente<string | null>('investimentos.excluir', null);
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

  const botaoExcluir = (id: string) => (
    <AlertDialog open={confirmandoId === id} onOpenChange={(aberto) => setConfirmandoId(aberto ? id : null)}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Excluir investimento">
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
          <AlertDialogAction onClick={() => handleDelete(id)} disabled={deletingId === id}>
            {deletingId === id ? 'Excluindo...' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lista de Investimentos</CardTitle>
      </CardHeader>
      <CardContent>
        <TabelaResponsiva
          itens={investments}
          chaveItem={(inv) => inv.id}
          colunas={[
            ...(showPropertyColumn ? [{
              chave: 'imovel', titulo: 'Propriedade', celula: (inv: typeof investments[number]) => (
                <div className="font-medium">
                  {inv.property?.name}
                  {inv.property?.nickname && <div className="text-sm text-gray-500">({inv.property.nickname})</div>}
                </div>
              ),
            }] : []),
            { chave: 'categoria', titulo: 'Categoria', celula: (inv) => <span className="text-sm">{inv.category?.name || 'N/A'}</span> },
            {
              chave: 'descricao', titulo: 'Descrição', celula: (inv) => (
                <div>
                  <div className="font-medium">{inv.description}</div>
                  {inv.notes && <div className="mt-1 text-sm text-gray-500">{inv.notes}</div>}
                </div>
              ),
            },
            { chave: 'data', titulo: 'Data', celula: (inv) => <span className="font-mono text-sm tabular-nums">{formatDate(inv.investment_date)}</span> },
            { chave: 'valor', titulo: 'Valor', alinhar: 'direita', celula: (inv) => <span className="font-mono font-medium tabular-nums">{formatCurrency(Number(inv.amount))}</span> },
            ...(hasPermission('investments_create') ? [{ chave: 'acoes', titulo: 'Ações', alinhar: 'centro' as const, celula: (inv: typeof investments[number]) => botaoExcluir(inv.id) }] : []),
          ]}
          cartao={(inv) => (
            <div className="flex items-start gap-3 rounded-xl border p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{inv.description}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {inv.category?.name || 'N/A'}
                  {showPropertyColumn && (inv.property?.nickname || inv.property?.name) ? ` · ${inv.property?.nickname || inv.property?.name}` : ''}
                </p>
                <p className="mt-1 font-mono text-xs tabular-nums text-gray-500">{formatDate(inv.investment_date)}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="font-mono font-semibold tabular-nums text-ink">{formatCurrency(Number(inv.amount))}</span>
                {hasPermission('investments_create') && botaoExcluir(inv.id)}
              </div>
            </div>
          )}
        />
      </CardContent>
    </Card>
  );
};

export default InvestmentsList;