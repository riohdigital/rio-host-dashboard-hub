BEGIN;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS cleaner_user_id uuid,
  ADD COLUMN IF NOT EXISTS cleaning_payment_status text DEFAULT 'Pagamento no Próximo Ciclo',
  ADD COLUMN IF NOT EXISTS cleaning_rating integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cleaning_notes text,
  ADD COLUMN IF NOT EXISTS cleaning_fee numeric,
  ADD COLUMN IF NOT EXISTS cleaning_allocation text;

CREATE INDEX IF NOT EXISTS idx_reservations_cleaner_user_id ON public.reservations (cleaner_user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_cleaning_payment_status ON public.reservations (cleaning_payment_status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'reservations' 
      AND policyname = 'Cleaners can view assigned reservations'
  ) THEN
    EXECUTE 'CREATE POLICY "Cleaners can view assigned reservations" ON public.reservations FOR SELECT USING (cleaner_user_id = auth.uid())';
  END IF;
END$$;

COMMIT;