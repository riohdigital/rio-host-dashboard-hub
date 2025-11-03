-- Remove a versão antiga da função fn_get_all_cleaner_reservations (sem parâmetros)
-- Isso garante que apenas a versão com parâmetros (start_date, end_date, property_ids) seja usada
-- A versão com parâmetros filtra corretamente por check_out_date

DROP FUNCTION IF EXISTS public.fn_get_all_cleaner_reservations();