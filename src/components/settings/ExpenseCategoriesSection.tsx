
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ExpenseCategory } from '@/types/expense';

const ExpenseCategoriesSection = () => {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchCategories();
  }, []);

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

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('expense_categories')
        .insert([{ name: newCategory.trim() }]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Categoria adicionada com sucesso.",
      });

      setNewCategory('');
      fetchCategories();
    } catch (error) {
      console.error('Erro ao adicionar categoria:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a categoria.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta categoria?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('expense_categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Categoria excluída com sucesso.",
      });

      setCategories(categories.filter(c => c.id !== categoryId));
    } catch (error) {
      console.error('Erro ao excluir categoria:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a categoria.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#6A6DDF] mb-2">Gerenciar Categorias de Despesas</h2>
        <p className="text-gray-600">Adicione ou remova categorias para organizar suas despesas.</p>
      </div>

      {/* Adicionar Nova Categoria */}
      <form onSubmit={handleAddCategory} className="flex gap-2">
        <div className="flex-1">
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Nome da nova categoria"
          />
        </div>
        <Button 
          type="submit" 
          disabled={loading || !newCategory.trim()}
          className="bg-[#6A6DDF] hover:bg-[#5A5BCF] text-white"
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar
        </Button>
      </form>

      {/* Lista de Categorias */}
      <div className="space-y-2">
        <Label>Categorias Existentes</Label>
        <div className="border rounded-lg">
          {categories.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              Nenhuma categoria encontrada.
            </div>
          ) : (
            categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between p-3 border-b last:border-b-0">
                <span className="font-medium">{category.name}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteCategory(category.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ExpenseCategoriesSection;
