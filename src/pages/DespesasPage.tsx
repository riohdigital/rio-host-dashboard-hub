
import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import { Property } from '@/types/property';
import { Expense } from '@/types/expense';

const DespesasPage = () => {
  const [expenses, setExpenses] = useState<(Expense & { property_name?: string; property_nickname?: string })[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [selectedProperty]);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('name');

      if (error) throw error;
      setProperties(data || []);
      
      // Selecionar primeira propriedade por padrão
      if (data && data.length > 0 && !selectedProperty) {
        setSelectedProperty(data[0].id);
      }
    } catch (error) {
      console.error('Erro ao buscar propriedades:', error);
    }
  };

  const fetchExpenses = async () => {
    if (!selectedProperty) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          properties (
            name,
            nickname
          )
        `)
        .eq('property_id', selectedProperty)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      
      const formattedData = (data || []).map(expense => ({
        ...expense,
        property_name: expense.properties?.name,
        property_nickname: expense.properties?.nickname
      }));
      
      setExpenses(formattedData);
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

  const handleDelete = async (expenseId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta despesa?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (error) throw error;

      setExpenses(expenses.filter(e => e.id !== expenseId));
      toast({
        title: "Sucesso",
        description: "Despesa excluída com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao excluir despesa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a despesa.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setEditingExpense(null);
    fetchExpenses();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const selectedPropertyName = properties.find(p => p.id === selectedProperty)?.nickname || 
                                properties.find(p => p.id === selectedProperty)?.name || '';

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-[#6A6DDF]">Controle de Despesas</h1>
          <Dialog open={isFormOpen} onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingExpense(null);
          }}>
            <DialogTrigger asChild>
              <Button className="bg-[#6A6DDF] hover:bg-[#5A5BCF] text-white">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Despesa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-[#6A6DDF]">
                  {editingExpense ? 'Editar Despesa' : 'Nova Despesa'}
                </DialogTitle>
              </DialogHeader>
              <ExpenseForm 
                expense={editingExpense} 
                selectedPropertyId={selectedProperty}
                onSuccess={handleFormSuccess}
                onCancel={() => setIsFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Filtro de Propriedade */}
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">
              Mostrando despesas para a propriedade:
            </span>
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Selecionar propriedade" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.nickname || property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabela de Despesas */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-[#6A6DDF] text-lg">Carregando despesas...</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      {selectedPropertyName 
                        ? `Nenhuma despesa cadastrada para ${selectedPropertyName}.`
                        : "Selecione uma propriedade para ver as despesas."
                      }
                    </TableCell>
                  </TableRow>
                ) : (
                  expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        {formatDate(expense.expense_date)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {expense.description}
                        </div>
                      </TableCell>
                      <TableCell>
                        {expense.category}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          expense.expense_type === 'Fixo' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {expense.expense_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-semibold text-red-600">
                          R$ {expense.amount.toFixed(2)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
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
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default DespesasPage;
