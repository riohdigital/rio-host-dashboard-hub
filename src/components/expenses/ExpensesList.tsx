'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useDateRange } from '@/hooks/dashboard/useDateRange';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, DollarSign, Tag, Trash2, Edit, RefreshCw, Layers, Receipt, CheckCircle, Clock, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
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
  const [filterOnlyPendingReimbursements, setFilterOnlyPendingReimbursements] = useState(false);
  const { toast } = useToast();
  const { hasPermission, getAccessibleProperties } = useUserPermissions();
  const { selectedProperties, selectedPeriod } = useGlobalFilters();
  const { startDate, endDate } = useDateRange(selectedPeriod);
  const { isVisible, shouldRefetch } = usePageVisibility();

  useEffect(() => {
    fetchExpenses();
  }, [selectedProperties, selectedPeriod, startDate, endDate]);

  // Effect para refetch quando página volta a ficar visível (com intervalo maior)
  useEffect(() => {
    if (isVisible && shouldRefetch()) {
      fetchExpenses();
    }
  }, [isVisible]);

  // Real-time subscription for expenses
  useRealtimeSubscription({
    table: 'expenses',
    queryKeys: [['expenses']],
    showToasts: true
  });

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('expenses')
        .select(`*, properties(name, nickname)`)
        .order('expense_date', { ascending: false });

      // Apply date filter
      if (startDate && endDate) {
        query = query
          .gte('expense_date', startDate.toISOString().split('T')[0])
          .lte('expense_date', endDate.toISOString().split('T')[0]);
      }

      // Apply property filter if not "todas"
      if (!selectedProperties.includes('todas')) {
        const accessibleProperties = getAccessibleProperties();
        const targetIds = accessibleProperties.length > 0
          ? selectedProperties.filter(id => accessibleProperties.includes(id))
          : selectedProperties;
        if (targetIds.length > 0) {
          query = query.in('property_id', targetIds);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setExpenses(data || []);
    } catch (error: any) {
      toast({ title: "Erro", description: `Não foi possível carregar as despesas: ${error.message}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const pendingReimbursements = useMemo(() => {
    return expenses.filter(exp => 
      exp.payment_status === 'Reembolso Pendente' || 
      (exp.description && exp.description.toLowerCase().includes('[reembolso faxineira]') && exp.payment_status !== 'Pago')
    );
  }, [expenses]);

  const totalPendingReimbursements = useMemo(() => {
    return pendingReimbursements.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  }, [pendingReimbursements]);

  const groupedExpenses = useMemo(() => {
    const recurrentGroups: { [key: string]: any } = {};
    const singleExpenses: Expense[] = [];

    expenses.forEach(exp => {
      if (filterOnlyPendingReimbursements) {
        const isPendingReimbursement = exp.payment_status === 'Reembolso Pendente' || 
          (exp.description && exp.description.toLowerCase().includes('[reembolso faxineira]') && exp.payment_status !== 'Pago');
        if (!isPendingReimbursement) return;
      }

      if (exp.is_recurrent && exp.recurrence_group_id && !filterOnlyPendingReimbursements) {
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
  }, [expenses, filterOnlyPendingReimbursements]);

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

  const handleMarkAsPaid = async (expenseId: string) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ payment_status: 'Pago' })
        .eq('id', expenseId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Despesa marcada como paga/reembolsada." });
      fetchExpenses();
    } catch (error: any) {
      toast({ title: "Erro", description: `Não foi possível atualizar o status: ${error.message}`, variant: "destructive" });
    }
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* Topo e Card de Reembolsos Pendentes */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gradient-primary">Minhas Despesas</h2>
          <p className="text-gray-600 mt-1">Gerencie despesas fixas, variáveis e notas fiscais a reembolsar.</p>
        </div>
        {hasPermission('expenses_create') && (
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
        )}
      </div>

      {/* Card Destaque: Reembolsos a Pagar */}
      <Card className="border-amber-200 bg-gradient-to-r from-amber-50/70 via-orange-50/40 to-background shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
              <Receipt className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">Reembolsos a Pagar</h3>
                {pendingReimbursements.length > 0 && (
                  <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-xs">
                    {pendingReimbursements.length} pendente{pendingReimbursements.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Notas fiscais e comprovantes enviados por faxineiras ou gestores via chat da IA
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 self-end sm:self-center">
            <div className="text-right">
              <span className="text-xs text-muted-foreground block">Total a Reembolsar</span>
              <span className="text-xl font-bold text-amber-600">
                R$ {totalPendingReimbursements.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <Button
              variant={filterOnlyPendingReimbursements ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterOnlyPendingReimbursements(!filterOnlyPendingReimbursements)}
              className={filterOnlyPendingReimbursements ? "bg-amber-600 hover:bg-amber-700 text-white text-xs" : "border-amber-300 text-amber-800 hover:bg-amber-50 text-xs"}
            >
              <Filter className="h-3.5 w-3.5 mr-1" />
              {filterOnlyPendingReimbursements ? "Ver Todas" : "Filtrar Reembolsos"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!filterOnlyPendingReimbursements && groupedExpenses.recurrent.length > 0 && (
        <>
          <h3 className="font-semibold text-gray-700">Despesas Recorrentes</h3>
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
        </>
      )}
      
      <h3 className="font-semibold text-gray-700 mt-6">
        {filterOnlyPendingReimbursements ? "Reembolsos Pendentes" : "Despesas Variáveis e Comprovantes"}
      </h3>
      <div className="grid gap-4">
        {groupedExpenses.single.length === 0 ? (
          <Card className="bg-muted/20 border-dashed">
            <CardContent className="p-8 text-center text-muted-foreground">
              {filterOnlyPendingReimbursements ? "Nenhum reembolso pendente encontrado." : "Nenhuma despesa encontrada para o período."}
            </CardContent>
          </Card>
        ) : (
          groupedExpenses.single.map((expense) => {
            const isReimbursement = expense.payment_status === 'Reembolso Pendente' || 
              (expense.description && expense.description.toLowerCase().includes('[reembolso faxineira]'));
            const isPending = expense.payment_status === 'Reembolso Pendente' || 
              (isReimbursement && expense.payment_status !== 'Pago');

            return (
              <Card key={expense.id} className={`bg-white hover:shadow-md transition-shadow ${isPending ? 'border-amber-300 ring-1 ring-amber-200' : ''}`}>
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-gray-800">{expense.description}</h4>
                      {isPending ? (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs flex items-center gap-1">
                          <Clock className="h-3 w-3 text-amber-600" />
                          Reembolso Pendente
                        </Badge>
                      ) : isReimbursement ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-emerald-600" />
                          Reembolsado
                        </Badge>
                      ) : expense.payment_status === 'Pago' ? (
                        <Badge variant="outline" className="text-xs text-muted-foreground border-emerald-200 bg-emerald-50/50">
                          Pago
                        </Badge>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-1">
                      <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{new Date(expense.expense_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                      <span className="flex items-center gap-1"><DollarSign className="h-4 w-4" />R$ {expense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      <Badge variant="outline" className="text-xs">{expense.category}</Badge>
                      <span className="font-medium text-foreground">{expense.properties?.nickname || expense.properties?.name}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    {isPending && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex items-center gap-1 shadow-sm"
                        onClick={() => handleMarkAsPaid(expense.id)}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Marcar como Reembolsado
                      </Button>
                    )}
                    {hasPermission('expenses_edit') && <Button variant="ghost" size="icon" onClick={() => handleEdit(expense)}><Edit className="h-4 w-4" /></Button>}
                    {hasPermission('expenses_edit') && <Button variant="ghost" size="icon" onClick={() => handleDeleteSingle(expense.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <RecurrenceDetailModal 
        isOpen={detailModalOpen} 
        onClose={() => setDetailModalOpen(false)} 
        group={selectedGroup} 
        onEditGroup={(expense) => {
          setEditingExpense(expense);
          setDetailModalOpen(false);
          setDialogOpen(true);
        }} 
        onDeleteAll={handleDeleteAllRecurrent} 
        onDeleteSingle={(id) => handleDeleteSingle(id, true)}
        onMarkAsPaid={(id) => handleMarkAsPaid(id)}
      />
    </div>
  );
};

export default ExpensesList;
