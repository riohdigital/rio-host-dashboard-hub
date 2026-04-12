
CREATE OR REPLACE FUNCTION public.calculate_reservation_financials()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  property_commission_rate NUMERIC;
  property_cleaning_fee NUMERIC;
  calculated_base_revenue NUMERIC;
  calculated_commission NUMERIC;
  calculated_net_revenue NUMERIC;
BEGIN
  -- Para UPDATEs: se nenhum campo financeiro-chave mudou, preservar valores manuais
  IF TG_OP = 'UPDATE'
     AND OLD.total_revenue = NEW.total_revenue
     AND COALESCE(OLD.cleaning_fee, 0) = COALESCE(NEW.cleaning_fee, 0)
     AND OLD.cleaning_allocation IS NOT DISTINCT FROM NEW.cleaning_allocation
     AND OLD.property_id IS NOT DISTINCT FROM NEW.property_id
  THEN
    RETURN NEW;
  END IF;

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
    calculated_commission := calculated_commission + COALESCE(NEW.cleaning_fee, 0);
  ELSIF NEW.cleaning_allocation = 'proprietario' THEN
    calculated_net_revenue := calculated_net_revenue + COALESCE(NEW.cleaning_fee, 0);
  END IF;

  -- 5. Arredondar para 2 casas decimais
  NEW.base_revenue := ROUND(calculated_base_revenue, 2);
  NEW.commission_amount := ROUND(calculated_commission, 2);
  NEW.net_revenue := ROUND(calculated_net_revenue, 2);

  RETURN NEW;
END;
$function$;
