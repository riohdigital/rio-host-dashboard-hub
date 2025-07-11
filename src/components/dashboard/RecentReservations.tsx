
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, User, MapPin, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
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
    
    if (date.toDateString() === today.toDateString()) {
      return { text: 'Hoje', color: 'text-red-600 font-bold', bgColor: 'bg-red-50 border-red-200' };
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return { text: 'Amanhã', color: 'text-orange-600 font-bold', bgColor: 'bg-orange-50 border-orange-200' };
    } else {
      return { 
        text: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }), 
        color: 'text-primary font-semibold',
        bgColor: 'bg-blue-50 border-blue-200'
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

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pago': return <CheckCircle2 className="h-3 w-3" />;
      case 'pendente': return <AlertCircle className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  return (
    <Card className="bg-gradient-to-br from-white to-gray-50/30 border border-gray-200/60 shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-sm">
      <CardHeader className="pb-4 bg-gradient-to-r from-blue-600/5 to-purple-600/5 rounded-t-lg">
        <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
          <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg shadow-md">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          Próximos Check-ins
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex items-center space-x-4 p-4 rounded-xl bg-gray-100/50">
                <div className="rounded-xl bg-gray-200 h-16 w-16"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="h-6 bg-gray-200 rounded-full w-16"></div>
              </div>
            ))}
          </div>
        ) : reservations.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-4">
              <Clock className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-600 mb-2">Nenhum check-in programado</h3>
            <p className="text-sm text-gray-500">Não há reservas com check-in nos próximos dias</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {reservations.map((res, index) => {
              const dateInfo = formatDate(res.check_in_date);
              
              return (
                <div 
                  key={index} 
                  className="group relative overflow-hidden rounded-xl border border-gray-200/60 bg-gradient-to-r from-white via-white to-gray-50/30 hover:from-blue-50/30 hover:via-white hover:to-purple-50/30 transition-all duration-300 hover:shadow-md hover:scale-[1.02] hover:border-primary/20"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  <div className="relative flex items-center space-x-4 p-4">
                    {/* Date Badge */}
                    <div className={`flex flex-col items-center justify-center rounded-xl p-3 min-w-[4.5rem] border shadow-sm ${dateInfo.bgColor} transition-all duration-200 group-hover:shadow-md`}>
                      <span className={`text-sm font-bold ${dateInfo.color}`}>
                        {dateInfo.text}
                      </span>
                      <span className="text-xs text-gray-500 mt-1 font-medium">
                        Check-in
                      </span>
                    </div>
                    
                    {/* Guest and Property Info */}
                    <div className="flex-grow min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-100 rounded-lg">
                          <User className="h-3.5 w-3.5 text-blue-600" />
                        </div>
                        <p className="font-semibold text-gray-800 truncate group-hover:text-primary transition-colors duration-200">
                          {res.guest_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-green-100 rounded-lg">
                          <MapPin className="h-3.5 w-3.5 text-green-600" />
                        </div>
                        <p className="text-sm text-gray-600 truncate">
                          {res.property_name}
                        </p>
                      </div>
                    </div>
                    
                    {/* Status Badge */}
                    <div className="flex-shrink-0">
                      <Badge 
                        variant="outline" 
                        className={`text-xs font-medium shadow-sm transition-all duration-200 group-hover:shadow-md ${getStatusColor(res.payment_status)} flex items-center gap-1`}
                      >
                        {getStatusIcon(res.payment_status)}
                        {res.payment_status}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {reservations.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200/60">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Calendar className="h-4 w-4" />
              <span>Próximos {reservations.length} check-ins programados</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UpcomingReservations;
