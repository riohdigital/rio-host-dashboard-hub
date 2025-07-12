import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2, Calendar, DollarSign } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const RecurrenceDetailModal = ({ isOpen, onClose, group, onDeleteAll, onDeleteSingle }) => {
  if (!group || group.expenses.length === 0) return null;

  const { description, amount, property_name, recurrence_group_id, expenses } = group;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-gradient-primary">Gerenciar Despesa Recorrente</DialogTitle>
          <DialogDescription>
            Você está gerenciando a despesa "{description}" de R$ {amount.toFixed(2)} para a propriedade "{property_name}".
          </DialogDescription>
        </DialogHeader>

        <div className="my-4">
          <h4 className="font-semibold mb-2">Próximas Ocorrências</h4>
          <ScrollArea className="h-72 pr-4">
            <div className="space-y-2">
              {expenses.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span>{new Date(exp.expense_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                    <DollarSign className="h-4 w-4 text-gray-500 ml-4" />
                    <span>R$ {exp.amount.toFixed(2)}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onDeleteSingle(exp.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex justify-between w-full">
          <Button variant="destructive" onClick={() => onDeleteAll(recurrence_group_id)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir Todas as Futuras
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecurrenceDetailModal;
