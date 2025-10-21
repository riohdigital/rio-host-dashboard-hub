-- Função para calcular valores financeiros das reservas automaticamente
CREATE OR REPLACE FUNCTION public.calculate_reservation_financials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  property_commission_rate NUMERIC;
  property_cleaning_fee NUMERIC;
  calculated_base_revenue NUMERIC;
  calculated_commission NUMERIC;
  calculated_net_revenue NUMERIC;
BEGIN
  -- Buscar dados da propriedade
  SELECT 
    COALESCE(commission_rate, 0),
    COALESCE(cleaning_fee, 0)
  INTO 
    property_commission_rate,
    property_cleaning_fee
  FROM properties
  WHERE id = NEW.property_id;

  -- Se cleaning_fee da reserva for NULL, usar da propriedade
  IF NEW.cleaning_fee IS NULL THEN
    NEW.cleaning_fee := property_cleaning_fee;
  END IF;

  -- 1. Calcular base_revenue (total - limpeza)
  calculated_base_revenue := NEW.total_revenue - COALESCE(NEW.cleaning_fee, 0);
  
  -- 2. Calcular comissão sobre a base
  calculated_commission := calculated_base_revenue * property_commission_rate;
  
  -- 3. Calcular receita líquida inicial
  calculated_net_revenue := calculated_base_revenue - calculated_commission;
  
  -- 4. Aplicar lógica de cleaning_allocation
  IF NEW.cleaning_allocation = 'co_anfitriao' THEN
    -- Taxa de limpeza vai para a comissão
    calculated_commission := calculated_commission + COALESCE(NEW.cleaning_fee, 0);
  ELSIF NEW.cleaning_allocation = 'proprietario' THEN
    -- Taxa de limpeza vai para o proprietário
    calculated_net_revenue := calculated_net_revenue + COALESCE(NEW.cleaning_fee, 0);
  END IF;
  -- Se for NULL ou UUID (faxineira), não adiciona a nenhum dos dois

  -- 5. Arredondar para 2 casas decimais (como no frontend)
  NEW.base_revenue := ROUND(calculated_base_revenue, 2);
  NEW.commission_amount := ROUND(calculated_commission, 2);
  NEW.net_revenue := ROUND(calculated_net_revenue, 2);

  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_calculate_reservation_financials ON public.reservations;

CREATE TRIGGER trigger_calculate_reservation_financials
  BEFORE INSERT OR UPDATE OF total_revenue, cleaning_fee, cleaning_allocation, property_id
  ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_reservation_financials();

-- Comentário explicativo
COMMENT ON FUNCTION public.calculate_reservation_financials() IS 
'Calcula automaticamente base_revenue, commission_amount e net_revenue para reservas. Replica exatamente a lógica do frontend com COALESCE, ROUND e cleaning_allocation.';

-- Recalcular reservas existentes com valores NULL (opcional)
UPDATE reservations
SET total_revenue = total_revenue
WHERE base_revenue IS NULL 
   OR commission_amount IS NULL 
   OR net_revenue IS NULL;