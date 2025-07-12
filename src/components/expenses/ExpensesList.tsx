'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, DollarSign, Tag, Trash2, Edit, RefreshCw, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ExpenseForm from './ExpenseForm';
import { Expense } from '@/types/expense';
import RecurrenceDetailModal from './RecurrenceDetailModal';

const ExpensesList = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
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
      toast({ title: "Erro", description: `Não foi possível carregar as despesas: ${error.message}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const groupedExpenses = useMemo(() => {
    const recurrentGroups: { [key: string]: any } = {};
    const singleExpenses: Expense[] = [];

    expenses.forEach(exp => {
      if (exp.is_recurrent && exp.recurrence_group_id) {
        if (!recurrentGroups[exp.recurrence_group_id]) {
          recurrentGroups[exp.recurrence_group_id] = {
            recurrence_group_id: exp.recurrence_group_id,
            description: exp.description,
            amount: exp.amount,
            property_name: exp.properties?.nickname || exp.properties?.name,
            category: exp.category,
            count: 0,
            expenses: []
          };
        }
        recurrentGroups[exp.recurrence_group_id].count++;
        recurrentGroups[exp.recurrence_group_id].expenses.push(exp);
      } else {
        singleExpenses.push(exp);
      }
    });

    return { recurrent: Object.values(recurrentGroups), single: singleExpenses };
  }, [expenses]);

  const handleSuccess = () => {
    fetchExpenses();
    setDialogOpen(false);
    setEditingExpense(null);
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setDialogOpen(true);
  };

  const handleDeleteSingle = async (expenseId: string, fromModal = false) => {
    if (!confirm('Tem certeza que deseja excluir esta despesa?')) return;
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Despesa excluída." });
      if (fromModal) {
        setDetailModalOpen(false);
      }
      fetchExpenses();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteAllRecurrent = async (groupId: string) => {
    if (!confirm('Tem certeza que deseja excluir TODAS as ocorrências futuras desta despesa?')) return;
    try {
      const { error } = await supabase.from('expenses').delete().eq('recurrence_group_id', groupId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Todas as despesas recorrentes foram excluídas." });
      setDetailModalOpen(false);
      fetchExpenses();
    } catch (error: any) {
      toast({ title: "Erro", description: `Não foi possível excluir o grupo: ${error.message}`, variant: "destructive" });
    }
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gradient-primary">Minhas Despesas</h2>
          <p className="text-gray-600 mt-1">Gerencie despesas fixas e variáveis.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
                <Button onClick={() => setEditingExpense(null)} className="bg-primary hover:bg-primary/90 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Despesa
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{editingExpense ? 'Editar' : 'Nova'} Despesa</DialogTitle>
                </DialogHeader>
                <ExpenseForm expense={editingExpense} onSuccess={handleSuccess} onCancel={() => setDialogOpen(false)} />
            </DialogContent>
        </Dialog>
      </div>

      {groupedExpenses.recurrent.length > 0 && <h3 className="font-semibold text-gray-700">Despesas Recorrentes</h3>}
      <div className="grid gap-4">
        {groupedExpenses.recurrent.map(group => (
          <Card key={group.recurrence_group_id} className="bg-white hover:shadow-lg transition-shadow cursor-pointer" onClick={() => { setSelectedGroup(group); setDetailModalOpen(true); }}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg"><RefreshCw className="h-6 w-6 text-blue-600" /></div>
                <div>
                  <h4 className="font-bold text-gradient-primary">{group.description}</h4>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                    <span className="flex items-center gap-1"><DollarSign className="h-4 w-4" />R$ {group.amount.toFixed(2)}/mês</span>
                    <span className="flex items-center gap-1"><Layers className="h-4 w-4" />{group.count} ocorrências</span>
                  </div>
                </div>
              </div>
              <Badge variant="secondary">{group.property_name}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {groupedExpenses.single.length > 0 && <h3 className="font-semibold text-gray-700 mt-6">Despesas Variáveis</h3>}
      <div className="grid gap-4">
        {groupedExpenses.single.map((expense) => (
          <Card key={expense.id} className="bg-white hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-800">{expense.description}</h4>
                <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                  <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{new Date(expense.expense_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                  <span className="flex items-center gap-1"><DollarSign className="h-4 w-4" />R$ {expense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  <span className="font-medium">{expense.properties?.nickname || expense.properties?.name}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(expense)}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteSingle(expense.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <RecurrenceDetailModal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} group={selectedGroup} onDeleteAll={handleDeleteAllRecurrent} onDeleteSingle={(id) => handleDeleteSingle(id, true)} />
    </div>
  );
};

export default ExpensesList;
