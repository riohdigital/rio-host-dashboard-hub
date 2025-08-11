-- Add cleaner-related fields to reservations and allow cleaners to view their assigned reservations
BEGIN;

-- Add new columns if they don't exist
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS cleaner_user_id uuid,
  ADD COLUMN IF NOT EXISTS cleaning_payment_status text DEFAULT 'Pagamento no Próximo Ciclo',
  ADD COLUMN IF NOT EXISTS cleaning_rating integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cleaning_notes text,
  ADD COLUMN IF NOT EXISTS cleaning_fee numeric,
  ADD COLUMN IF NOT EXISTS cleaning_allocation text; -- valores esperados: 'co_anfitriao' | 'proprietario'

-- Create index to speed up queries by cleaner
CREATE INDEX IF NOT EXISTS idx_reservations_cleaner_user_id ON public.reservations (cleaner_user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_cleaning_payment_status ON public.reservations (cleaning_payment_status);

-- Add permissive policy for cleaners to view their assigned reservations
CREATE POLICY IF NOT EXISTS "Cleaners can view assigned reservations"
ON public.reservations
FOR SELECT
USING (cleaner_user_id = auth.uid());

COMMIT;