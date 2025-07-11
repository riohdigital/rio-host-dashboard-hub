import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, User, MapPin, Badge as BadgeIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface RecentReservation {
  guest_name: string;
  property_name: string;
  check_in_date: string;
  platform: string;
  total_revenue: number;
  created_at: string;
}

interface RecentReservationsProps {
  reservations: RecentReservation[];
  loading: boolean;
}

const RecentReservations = ({ reservations, loading }: RecentReservationsProps) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: 'short',
      year: 'numeric'
    });
  };

  const getPlatformColor = (platform: string) => {
    switch (platform?.toLowerCase()) {
      case 'airbnb': return 'bg-red-100 text-red-800 border-red-200';
      case 'booking': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'direto': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card className="bg-white border shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Últimas Reservas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse flex items-center space-x-4 p-4 rounded-lg bg-gray-50">
                <div className="rounded-lg bg-gray-200 h-12 w-16 flex-shrink-0"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="h-6 bg-gray-200 rounded-full w-16"></div>
              </div>
            ))}
          </div>
        ) : reservations.length === 0 ? (
          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <Calendar className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="font-medium text-gray-900 mb-1">Nenhuma reserva recente</h3>
            <p className="text-sm text-gray-500">Não há reservas adicionadas recentemente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reservations.map((res, index) => (
              <div 
                key={index} 
                className="flex items-center space-x-4 p-4 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-gray-50 transition-colors"
              >
                {/* Date Badge */}
                <div className="flex flex-col items-center justify-center rounded-lg p-3 min-w-[4rem] border bg-primary/5 border-primary/20">
                  <span className="text-sm font-semibold text-primary">
                    {formatDate(res.check_in_date).split(' ')[0]}
                  </span>
                  <span className="text-xs text-gray-500 font-medium">
                    {formatDate(res.check_in_date).split(' ')[1]}
                  </span>
                </div>
                
                {/* Guest and Property Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <p className="font-medium text-gray-900 truncate">
                      {res.guest_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <p className="text-sm text-gray-600 truncate">
                      {res.property_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <BadgeIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className={`text-xs font-medium px-2 py-1 rounded-full border ${getPlatformColor(res.platform)}`}>
                      {res.platform}
                    </span>
                  </div>
                </div>
                
                {/* Revenue */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-semibold text-green-600">
                    R$ {res.total_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(res.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {reservations.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Calendar className="h-4 w-4" />
              <span>Últimas {reservations.length} reservas adicionadas</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentReservations;