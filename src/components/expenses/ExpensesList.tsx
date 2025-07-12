import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, DollarSign, Tag, Trash2, Edit, RefreshCw, Layers } from 'lucide-react';
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
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`*, properties(name, nickname)`)
        .order('expense_date', { ascending: false });
      if (error) throw error;
      setExpenses(data || []);
    } catch (error: any) {
      toast({ title: "Erro", description: "Não foi possível carregar as despesas.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE AGRUPAMENTO DE DESPESAS ---
  const groupedExpenses = useMemo(() => {
    const recurrentGroups: { [key: string]: Expense[] } = {};
    const singleExpenses: Expense[] = [];

    expenses.forEach(expense => {
      if (expense.is_recurrent && expense.recurrence_group_id) {
        if (!recurrentGroups[expense.recurrence_group_id]) {
          recurrentGroups[expense.recurrence_group_id] = [];
        }
        recurrentGroups[expense.recurrence_group_id].push(expense);
      } else {
        singleExpenses.push(expense);
      }
    });

    // Ordena os grupos pela data da primeira despesa
    const sortedGroups = Object.values(recurrentGroups).sort((a, b) => 
      new Date(b[0].expense_date).getTime() - new Date(a[0].expense_date).getTime()
    );

    return { single: singleExpenses, recurrent: sortedGroups };
  }, [expenses]);

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setDialogOpen(true);
  };

  const handleDeleteSingle = async (expenseId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta despesa?')) return;
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Despesa excluída." });
      fetchExpenses();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteRecurrence = async (groupId: string) => {
    if (!confirm('Tem certeza que deseja excluir TODAS as despesas desta recorrência?')) return;
    try {
      const { error } = await supabase.from('expenses').delete().eq('recurrence_group_id', groupId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Despesas recorrentes excluídas." });
      fetchExpenses();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleSuccess = () => {
    fetchExpenses();
    setDialogOpen(false);
    setEditingExpense(null);
  };

  const getTypeColor = (type: string) => type === 'Fixo' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gradient-primary">Minhas Despesas</h2>
          <p className="text-gray-600 mt-1">Gerencie todas as despesas das suas propriedades</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingExpense(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingExpense(null)} className="bg-[#6A6DDF] hover:bg-[#5A5BCF] text-white">
              <Plus className="h-4 w-4 mr-2" /> Nova Despesa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-gradient-primary">{editingExpense ? 'Editar Despesa' : 'Nova Despesa'}</DialogTitle></DialogHeader>
            <ExpenseForm expense={editingExpense} onSuccess={handleSuccess} onCancel={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {expenses.length === 0 ? (
        <Card className="bg-white text-center p-12"><DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-400" /><h3 className="text-lg font-medium mb-2">Nenhuma despesa cadastrada</h3><Button onClick={() => setDialogOpen(true)} className="bg-[#6A6DDF]"><Plus className="h-4 w-4 mr-2" /> Adicionar Despesa</Button></Card>
      ) : (
        <div className="space-y-4">
          {/* Renderiza Grupos de Despesas Recorrentes */}
          {groupedExpenses.recurrent.map(group => {
            const first = group[0];
            return (
              <Card key={first.recurrence_group_id} className="bg-white hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-xl text-gradient-primary">{first.description}</h3>
                        <Badge className="bg-purple-100 text-purple-800"><RefreshCw className="h-3 w-3 mr-1.5" />Recorrente</Badge>
                        <Badge variant="outline"><Tag className="h-3 w-3 mr-1" />{first.category}</Badge>
                      </div>
                      <div className="flex items-center gap-6 text-sm text-gray-600">
                        <div className="flex items-center"><DollarSign className="h-4 w-4 mr-2" /><span className="text-gradient-danger font-medium text-lg">R$ {first.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / mês</span></div>
                        <div className="flex items-center"><Layers className="h-4 w-4 mr-2" />{first.properties?.nickname || first.properties?.name}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Ação para excluir a recorrência inteira */}
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteRecurrence(first.recurrence_group_id!)}><Trash2 className="h-4 w-4 mr-2" /> Excluir Série</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {/* Renderiza Despesas Únicas */}
          {groupedExpenses.single.map(expense => (
            <Card key={expense.id} className="bg-white hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gradient-primary">{expense.description}</h3>
                      <Badge className={getTypeColor(expense.expense_type || 'Variável')}>{expense.expense_type || 'Variável'}</Badge>
                      {expense.category && <Badge variant="outline"><Tag className="h-3 w-3 mr-1" />{expense.category}</Badge>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center text-gray-600"><Calendar className="h-4 w-4 mr-2" />{new Date(expense.expense_date + 'T00:00:00').toLocaleDateString('pt-BR')}</div>
                      <div className="flex items-center text-gray-600"><DollarSign className="h-4 w-4 mr-2" /><span className="text-gradient-danger font-medium">R$ {expense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                      <div className="text-gray-600">{expense.properties?.nickname || expense.properties?.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(expense)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteSingle(expense.id)} className="text-red-600 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
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
