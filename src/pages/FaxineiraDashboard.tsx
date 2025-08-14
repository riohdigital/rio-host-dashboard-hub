import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, MapPin, Users, Star, CheckCircle } from 'lucide-react';
import { format, isPast, startOfToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

const FaxineiraDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queryKey = ['faxineira-reservations', user?.id];

  const { data: reservations, isLoading } = useQuery({
    queryKey: queryKey,
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('reservations')
        .select(`*, properties (name, address, default_checkin_time)`)
        .eq('cleaner_user_id', user.id)
        .order('check_out_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Lógica para marcar uma faxina como concluída
  const handleMarkAsComplete = async (reservationId: string) => {
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ reservation_status: 'Finalizada' }) // Assumindo que 'Finalizada' é o status de concluído
        .eq('id', reservationId);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Faxina marcada como concluída.",
      });

      // Invalida a query para forçar a busca de novos dados e atualizar a UI
      await queryClient.invalidateQueries({ queryKey });

    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar o status da faxina.",
        variant: "destructive",
      });
    }
  };

  // Separa as reservas em "próximas" e "passadas"
  const today = startOfToday();
  const upcomingReservations = reservations?.filter(r => !isPast(new Date(r.check_out_date)) || format(new Date(r.check_out_date), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) ?? [];
  const pastReservations = reservations?.filter(r => isPast(new Date(r.check_out_date)) && format(new Date(r.check_out_date), 'yyyy-MM-dd') !== format(today, 'yyyy-MM-dd')) ?? [];

  const getStatusColor = (status: string) => { /* ... (sem alterações) ... */ };
  const getPaymentStatusColor = (status: string) => { /* ... (sem alterações) ... */ };

  if (isLoading) { /* ... (skeleton loader sem alterações) ... */ }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Minhas Faxinas</h1>
        <p className="text-muted-foreground">
          Visualize e gerencie as limpezas designadas para você.
        </p>
      </div>

      <Tabs defaultValue="proximas" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="proximas">Próximas ({upcomingReservations.length})</TabsTrigger>
          <TabsTrigger value="historico">Histórico ({pastReservations.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="proximas">
          <ReservationList 
            reservations={upcomingReservations} 
            onMarkAsComplete={handleMarkAsComplete}
            isUpcoming={true}
          />
        </TabsContent>
        <TabsContent value="historico">
          <ReservationList 
            reservations={pastReservations}
            isUpcoming={false}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Componente auxiliar para renderizar as listas de reservas
const ReservationList = ({ reservations, onMarkAsComplete, isUpcoming }: { reservations: any[], onMarkAsComplete?: (id: string) => void, isUpcoming: boolean }) => {
  if (reservations.length === 0) {
    return (
      <Card className="mt-4">
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Nenhuma reserva encontrada</p>
            <p className="text-sm">
              {isUpcoming ? "Você não possui faxinas futuras agendadas." : "Nenhuma faxina no seu histórico."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 mt-4">
      {reservations.map((reservation: any) => (
        <Card key={reservation.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
              <div>
                <CardTitle className="text-lg">{reservation.properties?.name || 'Propriedade'}</CardTitle>
                <p className="text-sm text-muted-foreground flex items-center mt-1">
                  <MapPin className="h-4 w-4 mr-1.5 flex-shrink-0" />
                  {reservation.properties?.address || 'Endereço não informado'}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Badge variant={reservation.reservation_status === 'Finalizada' ? 'default' : 'secondary'}>
                  {reservation.reservation_status}
                </Badge>
                <Badge variant={reservation.cleaning_payment_status === 'Paga' ? 'default' : 'destructive'}>
                  {reservation.cleaning_payment_status}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="bg-muted p-3 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                  <p className="text-sm font-medium text-muted-foreground">DATA DA FAXINA</p>
                  <p className="text-xl font-bold text-primary">
                    {format(new Date(reservation.check_out_date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                  </p>
              </div>
              <div className="text-center sm:text-left">
                  <p className="text-sm font-medium text-muted-foreground">JANELA DE TRABALHO</p>
                  <p className="text-lg font-semibold">
                    Saída às {reservation.checkout_time?.slice(0,5) ?? 'N/A'}
                    <span className="text-muted-foreground mx-1">até</span>
                    Entrada às {reservation.properties?.default_checkin_time?.slice(0,5) ?? 'N/A'}
                  </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {reservation.guest_name && (
                <p><span className="font-medium">Hóspede Anterior:</span> {reservation.guest_name}</p>
              )}
              {reservation.number_of_guests && (
                  <p className="flex items-center"><Users className="h-4 w-4 mr-1.5" />{reservation.number_of_guests} Hóspedes</p>
              )}
              {reservation.cleaning_fee && (
                <p><span className="font-medium">Sua Taxa:</span> <span className="text-green-600 font-semibold">R$ {parseFloat(reservation.cleaning_fee).toFixed(2)}</span></p>
              )}
              {reservation.cleaning_rating > 0 && (
                <p className="flex items-center"><Star className="h-4 w-4 mr-1.5 text-yellow-500" />Sua Avaliação: {reservation.cleaning_rating}/5</p>
              )}
            </div>

            {reservation.cleaning_notes && (
              <div className="pt-2 border-t">
                <p className="text-sm"><span className="font-medium">Observações:</span> <span className="text-muted-foreground">{reservation.cleaning_notes}</span></p>
              </div>
            )}
            
            {isUpcoming && reservation.reservation_status !== 'Finalizada' && onMarkAsComplete && (
              <div className="pt-4 border-t flex justify-end">
                <Button onClick={() => onMarkAsComplete(reservation.id)}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Marcar como Concluída
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};


// Deixe estas funções aqui ou mova para um arquivo de utilitários
const getStatusColor = (status: string) => { /* ... */ };
const getPaymentStatusColor = (status: string) => { /* ... */ };

export default FaxineiraDashboard;
