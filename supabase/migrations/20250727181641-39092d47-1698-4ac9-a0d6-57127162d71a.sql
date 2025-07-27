-- Adicionar campo telefone na tabela reservations
ALTER TABLE public.reservations 
ADD COLUMN guest_phone TEXT;