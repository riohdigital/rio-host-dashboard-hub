import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useRascunhoFormulario } from '@/hooks/useRascunhoFormulario';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { Property } from '@/types/property';
import { Expense, ExpenseCategory } from '@/types/expense';
import RecurrenceSettings from './RecurrenceSettings';

// Schema de validação com Zod
const expenseSchema = z.object({
  property_id: z.string().min(1, 'Propriedade é obrigatória'),
  expense_date: z.string().min(1, 'Data é obrigatória'),
  description: z.string().min(3, 'Descrição é obrigatória'),
  category: z.string().min(1, 'Categoria é obrigatória'),
  expense_type: z.string(),
  amount: z.number().min(0.01, 'O valor deve ser maior que zero'),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

interface ExpenseFormProps {
  expense?: Expense | null;
  selectedPropertyId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

/** Chave do rascunho deste formulário (por despesa; "nova" no cadastro) */
const chaveRascunhoDespesa = (id?: string | null) => `despesas.form.${id ?? 'nova'}`;

const ExpenseForm = ({ expense, selectedPropertyId, onSuccess, onCancel }: ExpenseFormProps) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { hasPermission, getAccessibleProperties, isMaster } = useUserPermissions();

  // Rascunho: o que foi digitado volta depois de recarregar (cadastro e edição)
  const formKey = chaveRascunhoDespesa(expense?.id);
  const [recurrenceType, setRecurrenceType] = useEstadoPersistente(`${formKey}.recorrencia.tipo`, 'monthly');
  const [recurrenceDuration, setRecurrenceDuration] = useEstadoPersistente(`${formKey}.recorrencia.duracao`, 12);
  const [recurrenceStartDate, setRecurrenceStartDate] = useEstadoPersistente(`${formKey}.recorrencia.inicio`, () => new Date().toISOString().split('T')[0]);

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      property_id: expense?.property_id || selectedPropertyId || '',
      expense_date: expense?.expense_date || new Date().toISOString().split('T')[0],
      description: expense?.description || '',
      category: expense?.category || '',
      expense_type: expense?.expense_type || 'Variável',
      amount: expense?.amount || undefined,
    }
  });

  const expenseType = watch('expense_type');
  const watchedValues = watch();
  
  const rascunho = useRascunhoFormulario({ chave: formKey, valores: watchedValues, setValue, edicao: !!expense });
  useEffect(() => {
    rascunho.restaurar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma vez, ao abrir
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const [propsRes, catRes] = await Promise.all([
        supabase.from('properties').select('*').order('name'),
        supabase.from('expense_categories').select('*').order('name')
      ]);
      if (propsRes.error) throw propsRes.error;
      if (catRes.error) throw catRes.error;
      
      // Filter properties based on user permissions
      let filteredProperties = propsRes.data || [];
      if (!isMaster() && !hasPermission('properties_view_all')) {
        const accessiblePropertyIds = getAccessibleProperties();
        filteredProperties = propsRes.data?.filter(property => 
          accessiblePropertyIds.includes(property.id)
        ) || [];
        
        // When editing, ensure the expense's property is available even if not in accessible list
        if (expense && expense.property_id) {
          const expenseProperty = propsRes.data?.find(p => p.id === expense.property_id);
          if (expenseProperty && !filteredProperties.find(p => p.id === expense.property_id)) {
            filteredProperties.push(expenseProperty);
          }
        }
      }
      
      setProperties(filteredProperties);
      setCategories(catRes.data || []);
    };
    fetchData().catch(console.error);
  }, [isMaster, hasPermission, getAccessibleProperties, expense]);

  const generateRecurrentExpenses = (baseExpense: Omit<ExpenseFormData, 'expense_date'>) => {
    const expenses = [];
    const startDate = new Date(recurrenceStartDate + 'T00:00:00');
    const recurrenceGroupId = crypto.randomUUID();
    
    for (let i = 0; i < recurrenceDuration; i++) {
      const expenseDate = new Date(startDate);
      if (recurrenceType === 'monthly') expenseDate.setMonth(startDate.getMonth() + i);
      else if (recurrenceType === 'quarterly') expenseDate.setMonth(startDate.getMonth() + (i * 3));
      else if (recurrenceType === 'annually') expenseDate.setFullYear(startDate.getFullYear() + i);

      expenses.push({
        ...baseExpense,
        expense_date: expenseDate.toISOString().split('T')[0],
        recurrence_group_id: recurrenceGroupId,
        is_recurrent: true
      });
    }
    return expenses;
  };

  const onSubmit = async (data: ExpenseFormData) => {
    setLoading(true);
    try {
      if (expense) {
        // Editando despesa existente
        const { error } = await supabase.from('expenses').update(data).eq('id', expense.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Despesa atualizada com sucesso." });
      } else {
        // Criando nova despesa
        if (data.expense_type === 'Fixo') {
          const recurrentExpenses = generateRecurrentExpenses(data);
          const { error } = await supabase.from('expenses').insert(recurrentExpenses);
          if (error) throw error;
          toast({ title: "Sucesso", description: `${recurrentExpenses.length} despesas recorrentes criadas.` });
        } else {
          const { error } = await supabase.from('expenses').insert([{
            property_id: data.property_id,
            expense_date: data.expense_date,
            description: data.description,
            category: data.category,
            expense_type: data.expense_type,
            amount: Number(data.amount),
            is_recurrent: false
          }]);
          if (error) throw error;
          toast({ title: "Sucesso", description: "Despesa criada com sucesso." });
        }
      }
      
      // Limpar dados salvos após sucesso
      rascunho.limpar();
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao salvar despesa:', error);
      toast({
        title: "Erro",
        // CORREÇÃO: Tratamento de erro mais seguro
        description: `Não foi possível salvar a despesa: ${error?.message || 'Erro desconhecido.'}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const showRecurrenceSettings = expenseType === 'Fixo' && !expense;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Controller name="property_id" control={control} render={({ field }) => (
            <div className="space-y-2">
              <Label>Propriedade *</Label>
              <Select onValueChange={(v) => { if (v) field.onChange(v); }} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Selecionar propriedade" /></SelectTrigger>
                <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.nickname || p.name}</SelectItem>)}</SelectContent>
              </Select>
              {errors.property_id && <p className="text-sm text-danger-600">{errors.property_id.message}</p>}
            </div>
          )} />
          <div className="space-y-2">
            <Label>Data da Despesa *</Label>
            <Input type="date" {...register('expense_date')} />
            {errors.expense_date && <p className="text-sm text-danger-600">{errors.expense_date.message}</p>}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Descrição *</Label>
          <Input placeholder="Ex: Taxa de limpeza, Reparo..." {...register('description')} />
          {errors.description && <p className="text-sm text-danger-600">{errors.description.message}</p>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Controller name="category" control={control} render={({ field }) => (
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select onValueChange={(v) => { if (v) field.onChange(v); }} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Selecionar categoria" /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              {errors.category && <p className="text-sm text-danger-600">{errors.category.message}</p>}
            </div>
          )} />
          <Controller name="expense_type" control={control} render={({ field }) => (
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select onValueChange={(v) => { if (v) field.onChange(v); }} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Selecionar tipo" /></SelectTrigger>
                <SelectContent><SelectItem value="Fixo">Fixo</SelectItem><SelectItem value="Variável">Variável</SelectItem></SelectContent>
              </Select>
            </div>
          )} />
        </div>
        <div className="space-y-2">
          <Label>Valor (R$) *</Label>
          <Input type="number" step="0.01" min="0" placeholder="0.00" {...register('amount', { valueAsNumber: true })} />
          {errors.amount && <p className="text-sm text-danger-600">{errors.amount.message}</p>}
        </div>
        
        {showRecurrenceSettings && (
          <RecurrenceSettings
            isVisible={showRecurrenceSettings}
            recurrenceType={recurrenceType}
            recurrenceDuration={recurrenceDuration}
            startDate={recurrenceStartDate}
            onRecurrenceTypeChange={setRecurrenceType}
            onRecurrenceDurationChange={setRecurrenceDuration}
            onStartDateChange={setRecurrenceStartDate}
          />
        )}
        
        <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end sm:gap-3">
          <Button type="button" variant="outline" onClick={() => { rascunho.limpar(); onCancel(); }}>Cancelar</Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Salvando...' : (expense ? 'Atualizar' : 'Salvar')}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ExpenseForm;
