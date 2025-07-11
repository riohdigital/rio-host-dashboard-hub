import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, User, MapPin, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
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
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    if (date.getTime() === today.getTime()) {
      return { text: 'Hoje', color: 'text-red-600', bgColor: 'bg-red-50 border-red-200' };
    } else if (date.getTime() === tomorrow.getTime()) {
      return { text: 'Amanhã', color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200' };
    } else {
      return { 
        text: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }), 
        color: 'text-blue-600',
        bgColor: 'bg-blue-50 border-blue-200'
      };
    }
  };
  
  const getStatusVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pago': return 'default';
      case 'pendente': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pago': return <CheckCircle2 className="h-3 w-3 text-green-600" />;
      case 'pendente': return <AlertCircle className="h-3 w-3 text-yellow-600" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  return (
    <Card className="bg-white border shadow-sm h-full flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Próximos Check-ins
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex items-center space-x-4 p-4 rounded-lg bg-gray-50">
                <div className="rounded-lg bg-gray-200 h-12 w-16 flex-shrink-0"></div>
                <div className="flex-1 space-y-2"><div className="h-4 bg-gray-200 rounded w-3/4"></div><div className="h-3 bg-gray-200 rounded w-1/2"></div></div>
                <div className="h-6 bg-gray-200 rounded-full w-16"></div>
              </div>
            ))}
          </div>
        ) : reservations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3"><Clock className="h-8 w-8 text-gray-400" /></div>
            <h3 className="font-medium text-gray-900 mb-1">Nenhum check-in programado</h3>
            <p className="text-sm text-gray-500">Não há reservas com check-in nos próximos dias</p>
          </div>
        ) : (
          // --- MELHORIA APLICADA AQUI ---
          <div className="h-96 overflow-y-auto pr-3 custom-scrollbar">
            <div className="space-y-3">
              {reservations.map((res, index) => {
                const dateInfo = formatDate(res.check_in_date);
                return (
                  <div key={index} className="flex items-center space-x-4 p-4 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                    <div className={`flex flex-col items-center justify-center rounded-lg p-3 min-w-[4rem] border ${dateInfo.bgColor}`}>
                      <span className={`text-sm font-semibold ${dateInfo.color}`}>{dateInfo.text}</span>
                      <span className="text-xs text-gray-500 font-medium">Check-in</span>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2"><User className="h-4 w-4 text-gray-400 flex-shrink-0" /><p className="font-medium text-gray-900 truncate">{res.guest_name}</p></div>
                      <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" /><p className="text-sm text-gray-600 truncate">{res.property_name}</p></div>
                    </div>
                    <div className="flex-shrink-0">
                      <Badge variant={getStatusVariant(res.payment_status)} className="text-xs font-medium flex items-center gap-1">
                        {getStatusIcon(res.payment_status)}
                        {res.payment_status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
      {/* Estilos para a barra de rolagem customizada */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #A5B4FC; /* Tom mais claro do púrpura */
          border-radius: 10px;
          border: 2px solid #FFFFFF; /* Cor de fundo do card */
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #6A6DDF; /* Cor púrpura principal no hover */
        }
      `}</style>
    </Card>
  );
};

export default UpcomingReservations;
