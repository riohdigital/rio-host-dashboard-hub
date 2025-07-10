
-- Criar tabela para categorias de despesas
CREATE TABLE public.expense_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Inserir algumas categorias padrão
INSERT INTO public.expense_categories (name) VALUES 
  ('Limpeza'),
  ('Manutenção'),
  ('Utilities'),
  ('Decoração'),
  ('Marketing'),
  ('Taxas'),
  ('Seguros'),
  ('Outros');

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

-- Criar política para permitir que todos os usuários autenticados vejam todas as categorias
CREATE POLICY "Usuários autenticados podem visualizar categorias" 
  ON public.expense_categories 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Criar política para permitir que usuários autenticados criem categorias
CREATE POLICY "Usuários autenticados podem criar categorias" 
  ON public.expense_categories 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- Criar política para permitir que usuários autenticados excluam categorias
CREATE POLICY "Usuários autenticados podem excluir categorias" 
  ON public.expense_categories 
  FOR DELETE 
  TO authenticated 
  USING (true);
