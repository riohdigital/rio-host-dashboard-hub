-- Corrigir search_path da função calculate_payment_date
CREATE OR REPLACE FUNCTION calculate_payment_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.platform = 'Airbnb' THEN
    -- Airbnb paga D+1 do check-in
    NEW.payment_date := NEW.check_in_date + INTERVAL '1 day';
  ELSIF NEW.platform = 'Booking.com' THEN
    -- Booking paga no primeiro dia do mês seguinte ao checkout
    NEW.payment_date := DATE_TRUNC('month', NEW.check_out_date) + INTERVAL '1 month';
  ELSIF NEW.platform = 'Direto' THEN
    -- Direto paga no check-in
    NEW.payment_date := NEW.check_in_date;
  ELSE
    -- Default: check-in
    NEW.payment_date := NEW.check_in_date;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;