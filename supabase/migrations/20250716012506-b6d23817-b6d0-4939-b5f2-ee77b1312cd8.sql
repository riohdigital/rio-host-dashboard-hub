-- Adicionar horário padrão de check-in às propriedades
ALTER TABLE public.properties 
ADD COLUMN default_checkin_time TIME DEFAULT '15:00:00',
ADD COLUMN default_checkout_time TIME DEFAULT '11:00:00';

-- Adicionar novos campos às reservas
ALTER TABLE public.reservations 
ADD COLUMN checkin_time TIME,
ADD COLUMN checkout_time TIME,
ADD COLUMN is_communicated BOOLEAN DEFAULT false,
ADD COLUMN receipt_sent BOOLEAN DEFAULT false;

-- Atualizar reservas existentes com horários padrão
UPDATE public.reservations 
SET checkin_time = '15:00:00', checkout_time = '11:00:00' 
WHERE checkin_time IS NULL;