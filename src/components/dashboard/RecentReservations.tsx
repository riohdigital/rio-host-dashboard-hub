
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, User, MapPin, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface UpcomingReservation {
  guest_name: string;
  property_name: string;
  check_in_date: string;
  payment_status: string;
}

const UpcomingReservations = ({ reservations, loading }: { reservations: UpcomingReservation[], loading: boolean }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    // Check if it's today or tomorrow
    if (date.toDateString() === today.toDateString()) {
      return { text: 'Hoje', color: 'text-red-600 font-bold' };
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return { text: 'Amanhã', color: 'text-orange-600 font-bold' };
    } else {
      return { 
        text: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }), 
        color: 'text-primary font-semibold' 
      };
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pago': return 'bg-green-100 text-green-800 border-green-200';
      case 'pendente': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getDaysUntilCheckIn = (dateString: string) => {
    const checkInDate = new Date(dateString + 'T00:00:00');
    const today = new Date();
    const diffTime = checkInDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Amanhã';
    if (diffDays < 0) return 'Atrasado';
    return `${diffDays} dias`;
  };

  return (
    <Card className="bg-white card-elevated h-full gradient-hover-card smooth-transition">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-medium text-gradient-primary flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Próximos Check-ins
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-pulse flex space-x-4 w-full">
                <div className="rounded-lg bg-gray-200 h-12 w-12"></div>
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ) : reservations.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Nenhum check-in programado</p>
              <p className="text-xs text-gray-400 mt-1">para os próximos dias</p>
            </div>
          ) : (
            reservations.map((res, index) => {
              const dateInfo = formatDate(res.check_in_date);
              const daysUntil = getDaysUntilCheckIn(res.check_in_date);
              
              return (
                <div key={index} className="flex items-center space-x-4 p-3 rounded-lg border border-gray-100 bg-gradient-to-r from-gray-50 to-white hover:from-blue-50 hover:to-white transition-all duration-200 hover:shadow-sm">
                  <div className="flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-primary/20 rounded-xl p-3 min-w-[4rem] border border-primary/20">
                    <span className={`text-sm font-bold ${dateInfo.color}`}>
                      {dateInfo.text}
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      {daysUntil}
                    </span>
                  </div>
                  
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <p className="font-semibold text-gray-800 truncate">{res.guest_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <p className="text-xs text-gray-500 truncate">{res.property_name}</p>
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0">
                    <Badge variant="outline" className={`text-xs ${getStatusColor(res.payment_status)}`}>
                      {res.payment_status}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {reservations.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center">
              Mostrando próximos {reservations.length} check-ins
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UpcomingReservations;
