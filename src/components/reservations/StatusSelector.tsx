import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface StatusSelectorProps {
  reservationId: string;
  currentStatus: string;
  statusType: 'reservation_status' | 'payment_status';
  onUpdate: () => void; // Para recarregar os dados na página principal
}

const StatusSelector = ({ reservationId, currentStatus, statusType, onUpdate }: StatusSelectorProps) => {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const options = statusType === 'reservation_status'
    ? ['Confirmada', 'Em andamento', 'Finalizada', 'Cancelada']
    : ['Pago', 'Pendente', 'Atrasado'];

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmada':
      case 'pago':
        return 'bg-green-100 text-green-800';
      case 'em andamento':
        return 'bg-blue-100 text-blue-800';
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800';
      case 'finalizada':
        return 'bg-gray-100 text-gray-800';
      case 'cancelada':
      case 'atrasado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === status) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ [statusType]: newStatus })
        .eq('id', reservationId);

      if (error) throw error;

      setStatus(newStatus);
      toast({
        title: "Sucesso!",
        description: `Status atualizado para ${newStatus}.`,
      });
      onUpdate(); // Avisa o componente pai para recarregar os dados
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center">
      <Select value={status} onValueChange={handleStatusChange} disabled={loading}>
        <SelectTrigger className={`w-full h-8 text-xs border-none shadow-none ${getStatusColor(status)}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
    </div>
  );
};

export default StatusSelector;
