
-- Criar tabela de categorias de investimento
CREATE TABLE public.investment_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir categorias padrão
INSERT INTO public.investment_categories (name, description) VALUES
  ('Aquisição', 'Compra do imóvel ou contrato de administração'),
  ('Reforma', 'Obras de renovação e melhorias estruturais'),
  ('Mobiliário', 'Móveis e equipamentos para o imóvel'),
  ('Decoração', 'Itens decorativos e ambientação'),
  ('Eletrodomésticos', 'Aparelhos eletrônicos e eletrodomésticos'),
  ('Marketing', 'Investimentos em divulgação e marketing'),
  ('Legal', 'Documentação, taxas e custos legais'),
  ('Outros', 'Outros tipos de investimento');

-- Criar tabela de investimentos por propriedade
CREATE TABLE public.property_investments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.investment_categories(id),
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  investment_date DATE NOT NULL,
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.investment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_investments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para investment_categories (todas as operações permitidas para usuários autenticados)
CREATE POLICY "Usuários autenticados podem visualizar categorias de investimento" 
  ON public.investment_categories 
  FOR SELECT 
  USING (true);

CREATE POLICY "Usuários autenticados podem criar categorias de investimento" 
  ON public.investment_categories 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar categorias de investimento" 
  ON public.investment_categories 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Usuários autenticados podem excluir categorias de investimento" 
  ON public.investment_categories 
  FOR DELETE 
  USING (true);

-- Políticas RLS para property_investments (todas as operações permitidas para usuários autenticados)
CREATE POLICY "Usuários autenticados podem visualizar investimentos" 
  ON public.property_investments 
  FOR SELECT 
  USING (true);

CREATE POLICY "Usuários autenticados podem criar investimentos" 
  ON public.property_investments 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar investimentos" 
  ON public.property_investments 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Usuários autenticados podem excluir investimentos" 
  ON public.property_investments 
  FOR DELETE 
  USING (true);

-- Criar índices para melhor performance
CREATE INDEX idx_property_investments_property_id ON public.property_investments(property_id);
CREATE INDEX idx_property_investments_category_id ON public.property_investments(category_id);
CREATE INDEX idx_property_investments_date ON public.property_investments(investment_date);
