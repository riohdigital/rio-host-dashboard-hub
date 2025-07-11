import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, User, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface UpcomingReservation {
  guest_name: string;
  property_name: string;
  check_in_date: string;
  payment_status: string;
}

const UpcomingReservations = ({ reservations, loading }: { reservations: UpcomingReservation[], loading: boolean }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00'); // Trata como data local
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };
  
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pago': return 'bg-green-100 text-green-800';
      case 'pendente': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="bg-white card-elevated h-full">
      <CardHeader><CardTitle className="text-sm font-medium text-gradient-primary">Próximos Check-ins</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading ? (
            <p>Carregando...</p>
          ) : reservations.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Nenhum check-in nos próximos dias.</p>
          ) : (
            reservations.map((res, index) => (
              <div key={index} className="flex items-center space-x-4">
                <div className="flex flex-col items-center justify-center bg-primary/10 rounded-lg p-2 w-16">
                  <span className="font-bold text-primary">{formatDate(res.check_in_date)}</span>
                </div>
                <div className="flex-grow">
                  <p className="font-semibold text-gray-800">{res.guest_name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" />{res.property_name}</p>
                </div>
                <Badge className={getStatusColor(res.payment_status)}>{res.payment_status}</Badge>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default UpcomingReservations;
