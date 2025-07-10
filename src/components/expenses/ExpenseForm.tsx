
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Property } from '@/types/property';
import { Expense, ExpenseCategory } from '@/types/expense';

interface ExpenseFormProps {
  expense?: Expense | null;
  selectedPropertyId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const ExpenseForm = ({ expense, selectedPropertyId, onSuccess, onCancel }: ExpenseFormProps) => {
  const [formData, setFormData] = useState({
    property_id: selectedPropertyId || '',
    expense_date: expense?.expense_date || new Date().toISOString().split('T')[0],
    description: expense?.description || '',
    category: expense?.category || '',
    expense_type: expense?.expense_type || 'Variável',
    amount: expense?.amount.toString() || '',
  });
  
  const [properties, setProperties] = useState<Property[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchProperties();
    fetchCategories();
  }, []);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('name');

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error('Erro ao buscar propriedades:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const expenseData = {
        property_id: formData.property_id,
        expense_date: formData.expense_date,
        description: formData.description,
        category: formData.category,
        expense_type: formData.expense_type,
        amount: parseFloat(formData.amount),
      };

      if (expense) {
        const { error } = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', expense.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Despesa atualizada com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert([expenseData]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Despesa criada com sucesso.",
        });
      }

      onSuccess();
    } catch (error) {
      console.error('Erro ao salvar despesa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a despesa.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="property_id">Propriedade *</Label>
          <Select 
            value={formData.property_id} 
            onValueChange={(value) => handleInputChange('property_id', value)}
          >
            <SelectTrigger>
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

        <div className="space-y-2">
          <Label htmlFor="expense_date">Data da Despesa *</Label>
          <Input
            id="expense_date"
            type="date"
            value={formData.expense_date}
            onChange={(e) => handleInputChange('expense_date', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição *</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          placeholder="Ex: Taxa de limpeza, Reparo na torneira..."
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Categoria *</Label>
          <Select 
            value={formData.category} 
            onValueChange={(value) => handleInputChange('category', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar categoria" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.name}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="expense_type">Tipo *</Label>
          <Select 
            value={formData.expense_type} 
            onValueChange={(value) => handleInputChange('expense_type', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Fixo">Fixo</SelectItem>
              <SelectItem value="Variável">Variável</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Valor (R$) *</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          min="0"
          value={formData.amount}
          onChange={(e) => handleInputChange('amount', e.target.value)}
          placeholder="0,00"
          required
        />
      </div>

      <div className="flex gap-4 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button 
          type="submit" 
          disabled={loading}
          className="bg-[#6A6DDF] hover:bg-[#5A5BCF] text-white"
        >
          {loading ? 'Salvando...' : (expense ? 'Atualizar' : 'Salvar')} Despesa
        </Button>
      </div>
    </form>
  );
};

export default ExpenseForm;
