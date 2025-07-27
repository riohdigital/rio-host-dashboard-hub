-- Habilitar RLS nas tabelas restantes
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;