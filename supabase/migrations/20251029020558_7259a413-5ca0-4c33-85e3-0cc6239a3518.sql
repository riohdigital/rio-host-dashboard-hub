-- Função para calcular data de pagamento baseado na plataforma
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
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS set_payment_date_trigger ON reservations;
CREATE TRIGGER set_payment_date_trigger
  BEFORE INSERT OR UPDATE OF check_in_date, check_out_date, platform
  ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION calculate_payment_date();

-- Backfill: atualizar reservas existentes
UPDATE reservations
SET payment_date = CASE
  WHEN platform = 'Airbnb' THEN check_in_date + INTERVAL '1 day'
  WHEN platform = 'Booking.com' THEN DATE_TRUNC('month', check_out_date) + INTERVAL '1 month'
  WHEN platform = 'Direto' THEN check_in_date
  ELSE check_in_date
END
WHERE payment_date IS NULL;