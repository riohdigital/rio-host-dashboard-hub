
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, DollarSign, Tag, Trash2, Edit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ExpenseForm from './ExpenseForm';
import { Expense } from '@/types/expense';

const ExpensesList = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          properties(name, nickname)
        `)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Erro ao buscar despesas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as despesas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    fetchExpenses();
    setDialogOpen(false);
    setEditingExpense(null);
  };

  const handleCancel = () => {
    setDialogOpen(false);
    setEditingExpense(null);
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setDialogOpen(true);
  };

  const handleDelete = async (expenseId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta despesa?')) return;

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Despesa excluída com sucesso.",
      });
      
      fetchExpenses();
    } catch (error) {
      console.error('Erro ao excluir despesa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a despesa.",
        variant: "destructive",
      });
    }
  };

  const getTypeColor = (type: string) => {
    return type === 'Fixo' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gradient-primary">Minhas Despesas</h2>
          <p className="text-gray-600 mt-1">Gerencie todas as despesas das suas propriedades</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-[#6A6DDF] hover:bg-[#5A5BCF] text-white"
              onClick={() => setEditingExpense(null)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Despesa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-gradient-primary">
                {editingExpense ? 'Editar Despesa' : 'Nova Despesa'}
              </DialogTitle>
            </DialogHeader>
            <ExpenseForm
              expense={editingExpense}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          </DialogContent>
        </Dialog>
      </div>

      {expenses.length === 0 ? (
        <Card className="bg-white">
          <CardContent className="p-12 text-center">
            <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma despesa cadastrada</h3>
            <p className="text-gray-500 mb-4">Comece adicionando sua primeira despesa.</p>
            <Button 
              onClick={() => setDialogOpen(true)}
              className="bg-[#6A6DDF] hover:bg-[#5A5BCF] text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Despesa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {expenses.map((expense) => (
            <Card key={expense.id} className="bg-white hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gradient-primary">{expense.description}</h3>
                      <Badge className={getTypeColor(expense.expense_type || 'Variável')}>
                        {expense.expense_type || 'Variável'}
                      </Badge>
                      {expense.category && (
                        <Badge variant="outline" className="text-gradient-accent">
                          <Tag className="h-3 w-3 mr-1" />
                          {expense.category}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center text-gray-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        {new Date(expense.expense_date).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="flex items-center text-gray-600">
                        <DollarSign className="h-4 w-4 mr-2" />
                        <span className="text-gradient-danger font-medium">
                          R$ {expense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="text-gray-600">
                        {expense.properties?.nickname || expense.properties?.name || 'Propriedade não informada'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(expense)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(expense.id)}
                      className="text-red-600 hover:text-red-700 hover:border-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExpensesList;
