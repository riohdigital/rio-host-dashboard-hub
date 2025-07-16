import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, User, MapPin, DollarSign } from 'lucide-react';

interface Reservation {
  id: string;
  guest_name: string;
  property_name: string;
  check_in_date: string;
  check_out_date: string;
  total_revenue: number;
  reservation_status: string;
}

interface RecentReservationsProps {
  reservations: Reservation[];
  loading: boolean;
}

const RecentReservations = ({ reservations, loading }: RecentReservationsProps) => {
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmada':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'ativa':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'finalizada':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'cancelada':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="text-gradient-primary">Últimas Reservas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => ( // Mostra 3 placeholders
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="text-gradient-primary flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Últimas Reservas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reservations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma reserva encontrada</p>
          </div>
        ) : (
          /* ETAPA 1: CONTÊINER DE ROLAGEM */
          /* Este div terá uma altura fixa e ativará a rolagem vertical quando o conteúdo for maior. */
          <div className="h-96 overflow-y-auto pr-4 custom-scrollbar"> 
            <div className="space-y-4">
              {reservations.map((reservation) => (
                <div 
                  key={reservation.id} 
                  className="p-4 border border-gray-200 rounded-lg bg-white hover:border-primary/50 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      <span className="font-medium text-gradient-primary">
                        {reservation.guest_name || 'Hóspede não informado'}
                      </span>
                    </div>
                    <span 
                      className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(reservation.reservation_status)}`}
                    >
                      {reservation.reservation_status || 'Confirmada'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3" />
                      <span>{reservation.property_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-3 w-3" />
                      <span className="text-gradient-accent font-medium">
                        R$ {reservation.total_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span>
                      Check-in: {new Date(reservation.check_in_date).toLocaleDateString('pt-BR')}
                    </span>
                    <span>
                      Check-out: {new Date(reservation.check_out_date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      {/* ETAPA 2: ESTILOS DA BARRA DE ROLAGEM */ }
      {/* Este bloco de CSS (usando a sintaxe do Next.js/Styled-JSX) estiliza a barra de rolagem. */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f8f9fa; /* Cor de fundo do seu app */
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #A5B4FC; /* Tom mais claro do seu púrpura */
          border-radius: 10px;
          border: 2px solid #f8f9fa; /* Pequena borda com a cor de fundo */
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #6A6DDF; /* Cor púrpura principal no hover */
        }
      `}</style>
    </Card>
  );
};

export default RecentReservations;
