import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useReservationStatusUpdate } from '@/hooks/useReservationStatusUpdate';
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
  const { updateStatus } = useReservationStatusUpdate();

  const options = statusType === 'reservation_status'
    ? ['Confirmada', 'Em Andamento', 'Finalizada', 'Cancelada']
    : ['Pago', 'Pendente', 'Atrasado'];

  const getGradientClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmada':
      case 'pago':
        return 'gradient-success';
      case 'em andamento':
        return 'gradient-info';
      case 'pendente':
        return 'gradient-warning';
      case 'finalizada':
        return 'bg-gray-600 text-white';
      case 'cancelada':
      case 'atrasado':
        return 'gradient-danger';
      default:
        return 'gradient-muted';
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === status) return;
    setLoading(true);
    
    const success = await updateStatus({
      reservationId,
      statusType,
      newStatus,
      onUpdate
    });
    
    if (success) {
      setStatus(newStatus);
    }
    
    setLoading(false);
  };

  return (
    <div className="flex items-center">
      <Select value={status} onValueChange={handleStatusChange} disabled={loading}>
        <SelectTrigger 
          className={`w-full h-9 text-xs font-semibold text-white border-none shadow-sm transition-all duration-300 hover:brightness-105 ${getGradientClass(status)}`}
        >
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
