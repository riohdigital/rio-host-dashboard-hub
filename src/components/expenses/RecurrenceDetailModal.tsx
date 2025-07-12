import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2, Calendar, DollarSign, CheckCircle, Edit } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

const RecurrenceDetailModal = ({ isOpen, onClose, group, onEditGroup, onDeleteAll, onDeleteSingle, onMarkAsPaid }) => {
  if (!group || group.expenses.length === 0) return null;

  const { description, amount, property_name, recurrence_group_id, expenses } = group;

  const getStatusBadge = (status: string) => {
    if (status === 'Pago') {
      return <Badge className="bg-green-100 text-green-800">Pago</Badge>;
    }
    return <Badge variant="secondary">Pendente</Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-gradient-primary">Gerenciar Despesa Recorrente</DialogTitle>
          <DialogDescription>
            Você está gerenciando a despesa "{description}" de R$ {amount.toFixed(2)} para a propriedade "{property_name}".
          </DialogDescription>
        </DialogHeader>

        <div className="my-4">
          <h4 className="font-semibold mb-2">Próximas Ocorrências</h4>
          <ScrollArea className="h-72 pr-4 custom-scrollbar">
            <div className="space-y-2">
              {expenses.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span>{new Date(exp.expense_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    <DollarSign className="h-4 w-4 text-gray-500 ml-4" />
                    <span>R$ {exp.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(exp.payment_status)}
                    {exp.payment_status !== 'Pago' && (
                      <Button variant="outline" size="sm" onClick={() => onMarkAsPaid(exp.id)}>
                        <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                        Pagar
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => onDeleteSingle(exp.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex justify-between w-full">
          <div>
            <Button variant="outline" onClick={() => onEditGroup(group.expenses[0])}>
              <Edit className="h-4 w-4 mr-2" />
              Editar Grupo
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="destructive" onClick={() => onDeleteAll(recurrence_group_id)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Todas
            </Button>
            <Button onClick={onClose}>Fechar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecurrenceDetailModal;
