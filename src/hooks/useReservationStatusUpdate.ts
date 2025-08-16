import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UpdateReservationStatusParams {
  reservationId: string;
  statusType: 'reservation_status' | 'payment_status';
  newStatus: string;
  onUpdate: () => void;
}

export const useReservationStatusUpdate = () => {
  const { toast } = useToast();

  const updateStatus = async ({ reservationId, statusType, newStatus, onUpdate }: UpdateReservationStatusParams) => {
    try {
      // Buscar dados atuais da reserva para recálculos
      const { data: currentReservation, error: fetchError } = await supabase
        .from('reservations')
        .select('*, properties(*)')
        .eq('id', reservationId)
        .single();

      if (fetchError) throw fetchError;

      // Preparar dados para atualização
      const updateData: any = { [statusType]: newStatus };

      // Se mudando status da reserva para "Finalizada", aplicar lógica de recálculo
      if (statusType === 'reservation_status' && newStatus === 'Finalizada') {
        const property = currentReservation.properties;
        const totalRevenue = currentReservation.total_revenue || 0;
        
        if (property && totalRevenue > 0) {
          const commissionRate = property.commission_rate || 0;
          const cleaningFee = currentReservation.cleaning_fee || property.cleaning_fee || 0;
          const baseRevenue = totalRevenue - cleaningFee;
          const commissionAmount = baseRevenue * commissionRate;
          
          // Aplicar lógica de destino da limpeza
          let finalCommission = commissionAmount;
          let finalNetRevenue = baseRevenue - commissionAmount;

          if (currentReservation.cleaning_allocation === 'co_anfitriao') {
            finalCommission += cleaningFee;
          } else if (currentReservation.cleaning_allocation === 'proprietario') {
            finalNetRevenue += cleaningFee;
          }

          updateData.base_revenue = Number(baseRevenue.toFixed(2));
          updateData.commission_amount = Number(finalCommission.toFixed(2));
          updateData.net_revenue = Number(finalNetRevenue.toFixed(2));
        }
      }

      // Atualizar no banco
      const { error } = await supabase
        .from('reservations')
        .update(updateData)
        .eq('id', reservationId);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: `Status atualizado para ${newStatus}.`,
      });
      
      onUpdate();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  return { updateStatus };
};