
-- Atualizar a tabela reservations com as novas colunas
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS guest_name TEXT,
ADD COLUMN IF NOT EXISTS number_of_guests INTEGER,
ADD COLUMN IF NOT EXISTS base_revenue NUMERIC,
ADD COLUMN IF NOT EXISTS commission_amount NUMERIC,
ADD COLUMN IF NOT EXISTS net_revenue NUMERIC;

-- Atualizar a coluna platform para ser obrigatória
ALTER TABLE reservations 
ALTER COLUMN platform SET NOT NULL,
ALTER COLUMN platform SET DEFAULT 'Direto';

-- Atualizar a coluna reservation_code para ser obrigatória  
ALTER TABLE reservations 
ALTER COLUMN reservation_code SET NOT NULL;

-- Atualizar a coluna reservation_status para ter um valor padrão
ALTER TABLE reservations 
ALTER COLUMN reservation_status SET DEFAULT 'Confirmada';
