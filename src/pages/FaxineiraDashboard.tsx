import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Users, Star } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const FaxineiraDashboard = () => {
  const { user } = useAuth();

  const { data: reservations, isLoading } = useQuery({
    queryKey: ['faxineira-reservations', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          properties (
            name,
            address
          )
        `)
        .eq('cleaner_user_id', user.id)
        .order('check_out_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Confirmada':
        return 'secondary';
      case 'Cancelada':
        return 'destructive';
      case 'Concluída':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'Pago':
        return 'secondary';
      case 'Pendente':
        return 'destructive';
      case 'Pagamento no Próximo Ciclo':
        return 'outline';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Minhas Faxinas</h1>
        <p className="text-muted-foreground">
          Reservas designadas para você ({reservations?.length || 0} total)
        </p>
      </div>

      {!reservations?.length ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhuma reserva encontrada</p>
              <p className="text-sm">Você não possui faxinas designadas no momento.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reservations.map((reservation: any) => (
            <Card key={reservation.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {reservation.properties?.name || 'Propriedade'}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground flex items-center mt-1">
                      <MapPin className="h-4 w-4 mr-1" />
                      {reservation.properties?.address || 'Endereço não informado'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={getStatusColor(reservation.reservation_status)}>
                      {reservation.reservation_status}
                    </Badge>
                    <Badge variant={getPaymentStatusColor(reservation.cleaning_payment_status)}>
                      {reservation.cleaning_payment_status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center text-sm">
                      <Calendar className="h-4 w-4 mr-2 text-primary" />
                      <span className="font-medium">Check-out:</span>
                      <span className="ml-1">
                        {format(new Date(reservation.check_out_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    
                    {reservation.number_of_guests && (
                      <div className="flex items-center text-sm">
                        <Users className="h-4 w-4 mr-2 text-primary" />
                        <span className="font-medium">Hóspedes:</span>
                        <span className="ml-1">{reservation.number_of_guests}</span>
                      </div>
                    )}

                    {reservation.cleaning_fee && (
                      <div className="flex items-center text-sm">
                        <span className="font-medium">Taxa de Limpeza:</span>
                        <span className="ml-1 text-green-600">
                          R$ {parseFloat(reservation.cleaning_fee).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {reservation.guest_name && (
                      <div className="text-sm">
                        <span className="font-medium">Hóspede:</span>
                        <span className="ml-1">{reservation.guest_name}</span>
                      </div>
                    )}

                    {reservation.cleaning_rating !== null && reservation.cleaning_rating > 0 && (
                      <div className="flex items-center text-sm">
                        <Star className="h-4 w-4 mr-2 text-yellow-500" />
                        <span className="font-medium">Avaliação:</span>
                        <span className="ml-1">{reservation.cleaning_rating}/5</span>
                      </div>
                    )}

                    {reservation.cleaning_allocation && (
                      <div className="text-sm">
                        <span className="font-medium">Alocação:</span>
                        <span className="ml-1">{reservation.cleaning_allocation}</span>
                      </div>
                    )}
                  </div>
                </div>

                {reservation.cleaning_notes && (
                  <div className="pt-2 border-t">
                    <p className="text-sm">
                      <span className="font-medium">Observações:</span>
                      <span className="ml-1 text-muted-foreground">{reservation.cleaning_notes}</span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FaxineiraDashboard;