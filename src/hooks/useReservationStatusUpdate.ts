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
      // Preparar dados para atualização
      const updateData: any = { [statusType]: newStatus };

      // Trigger no banco calcula automaticamente base_revenue, commission_amount e net_revenue

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