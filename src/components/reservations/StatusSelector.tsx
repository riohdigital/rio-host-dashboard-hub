import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface StatusSelectorProps {
  reservationId: string;
  currentStatus: string;
  statusType: 'reservation_status' | 'payment_status';
  onUpdate: () => void;
}

const StatusSelector = ({ reservationId, currentStatus, statusType, onUpdate }: StatusSelectorProps) => {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const options = statusType === 'reservation_status'
    ? ['Confirmada', 'Em andamento', 'Finalizada', 'Cancelada']
    : ['Pago', 'Pendente', 'Atrasado'];

  // ALTERAÇÃO PRINCIPAL: A função agora retorna a classe de gradiente do seu `index.css`
  const getGradientClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmada':
      case 'pago':
        return 'gradient-success'; // Usa a classe que você já definiu
      case 'em andamento':
        return 'gradient-info'; // Usa a classe que você já definiu
      case 'pendente':
        return 'gradient-warning'; // Usa a classe que você já definiu
      case 'finalizada':
        return 'bg-gray-600 text-white'; // Fundo cinza escuro com texto branco para melhor contraste
      case 'cancelada':
      case 'atrasado':
        return 'gradient-danger'; // Usa a classe que você já definiu
      default:
        return 'gradient-muted';
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
      onUpdate();
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
        {/* A classe de gradiente é aplicada aqui */}
        <SelectTrigger 
          className={`w-full h-9 text-xs font-semibold text-white border-none shadow-sm transition-all duration-300 hover:brightness-105 ${getGradientClass(status)}`}
        >
          {/* O SelectValue precisa estar dentro de um span para que o 'text-white' funcione bem */}
          <span><SelectValue /></span>
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {loading && <Loader2 className="h-4 w-4 animate-spin ml-2 text-primary" />}
    </div>
  );
};

export default StatusSelector;
