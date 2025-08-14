import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, MapPin, Users, Star, CheckCircle, Hand } from 'lucide-react';
import { format, isPast, startOfToday, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

const FaxineiraDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const assignedReservationsKey = ['faxineira-reservations', user?.id];
  const availableReservationsKey = ['available-cleanings', user?.id];

  // Query para buscar as faxinas JÁ ATRIBUÍDAS à faxineira logada
  const { data: assignedReservations, isLoading: isLoadingAssigned } = useQuery({
    queryKey: assignedReservationsKey,
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

  // NOVA QUERY: para buscar faxinas DISPONÍVEIS nas propriedades que a faxineira tem acesso
  const { data: availableReservations, isLoading: isLoadingAvailable } = useQuery({
    queryKey: availableReservationsKey,
    queryFn: async () => {
        if (!user) return [];

        // 1. Encontrar as propriedades que a faxineira tem acesso
        const { data: accessibleProperties, error: accessError } = await supabase
            .from('cleaner_properties')
            .select('property_id')
            .eq('user_id', user.id);
        if (accessError) throw accessError;
        const propertyIds = accessibleProperties.map(p => p.property_id);
        if (propertyIds.length === 0) return [];

        // 2. Buscar reservas nessas propriedades que estão em aberto e nas próximas 2 semanas
        const today = new Date().toISOString();
        const twoWeeksFromNow = addDays(new Date(), 14).toISOString();

        const { data, error } = await supabase
            .from('reservations')
            .select(`*, properties (name, address)`)
            .in('property_id', propertyIds)
            .is('cleaner_user_id', null) // A faxina está "em aberto"
            .gte('check_out_date', today) // A partir de hoje
            .lte('check_out_date', twoWeeksFromNow) // Até duas semanas no futuro
            .order('check_out_date', { ascending: true });
        
        if (error) throw error;
        return data || [];
    },
    enabled: !!user,
  });

  // NOVA LÓGICA: para a faxineira "assinar" uma limpeza
  const handleSignUpForCleaning = async (reservationId: string) => {
    if (!user) return;
    try {
        const { error } = await supabase
            .from('reservations')
            .update({ cleaner_user_id: user.id })
            .eq('id', reservationId)
            .is('cleaner_user_id', null); // Garante que só pode assinar se ainda estiver vaga

        if (error) throw error;

        toast({ title: "Sucesso!", description: "Você assinou esta faxina." });

        // Invalida AMBAS as queries para atualizar todas as listas
        await queryClient.invalidateQueries({ queryKey: assignedReservationsKey });
        await queryClient.invalidateQueries({ queryKey: availableReservationsKey });

    } catch (error: any) {
        toast({ title: "Erro", description: error.message || "Não foi possível assinar a faxina.", variant: "destructive" });
    }
  };

  const handleMarkAsComplete = async (reservationId: string) => { /* ... (sem alterações) ... */ };
  
  const today = startOfToday();
  const upcomingReservations = assignedReservations?.filter(r => !isPast(new Date(r.check_out_date)) || format(new Date(r.check_out_date), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) ?? [];
  const pastReservations = assignedReservations?.filter(r => isPast(new Date(r.check_out_date)) && format(new Date(r.check_out_date), 'yyyy-MM-dd') !== format(today, 'yyyy-MM-dd')) ?? [];

  if (isLoadingAssigned || isLoadingAvailable) { /* ... (skeleton loader sem alterações) ... */ }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Minhas Faxinas</h1>
        <p className="text-muted-foreground">Visualize e gerencie as limpezas designadas para você.</p>
      </div>

      <Tabs defaultValue="proximas" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="proximas">Próximas ({upcomingReservations.length})</TabsTrigger>
          {/* NOVA ABA */}
          <TabsTrigger value="disponiveis">Disponíveis ({availableReservations?.length || 0})</TabsTrigger>
          <TabsTrigger value="historico">Histórico ({pastReservations.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="proximas">
          <ReservationList 
            reservations={upcomingReservations} 
            onMarkAsComplete={handleMarkAsComplete}
            isUpcoming={true}
          />
        </TabsContent>
        
        {/* NOVO CONTEÚDO DA ABA */}
        <TabsContent value="disponiveis">
            <AvailableCleaningsList 
                reservations={availableReservations || []}
                onSignUp={handleSignUpForCleaning}
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


// NOVO COMPONENTE: para listar as faxinas disponíveis
const AvailableCleaningsList = ({ reservations, onSignUp }: { reservations: any[], onSignUp: (id: string) => void }) => {
    if (reservations.length === 0) {
        return (
            <Card className="mt-4">
                <CardContent className="pt-6 text-center text-muted-foreground">
                    <CheckCircle className="mx-auto h-12 w-12 mb-4 opacity-50 text-green-500" />
                    <p>Nenhuma oportunidade no momento</p>
                    <p className="text-sm">Não há faxinas disponíveis nas suas propriedades para as próximas duas semanas.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid gap-4 mt-4">
            {reservations.map((reservation: any) => (
                <Card key={reservation.id} className="bg-blue-50 border-blue-200">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg text-blue-800">{reservation.properties?.name || 'Propriedade'}</CardTitle>
                        <p className="text-sm text-blue-600 flex items-center mt-1">
                            <MapPin className="h-4 w-4 mr-1.5 flex-shrink-0" />
                            {reservation.properties?.address || 'Endereço não informado'}
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="text-center">
                            <p className="text-sm font-medium text-muted-foreground">DATA DA FAXINA</p>
                            <p className="text-xl font-bold text-primary">
                                {format(new Date(reservation.check_out_date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                            </p>
                        </div>
                        <div className="flex justify-between items-center bg-white p-3 rounded-lg">
                            <div>
                                <p className="text-sm font-medium">Sua Taxa</p>
                                <p className="text-lg font-bold text-green-600">
                                    R$ {parseFloat(reservation.cleaning_fee || 0).toFixed(2)}
                                </p>
                            </div>
                            <Button onClick={() => onSignUp(reservation.id)}>
                                <Hand className="h-4 w-4 mr-2"/>
                                Assinar Faxina
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};


// O componente ReservationList e as funções de cor permanecem os mesmos
const ReservationList = ({ reservations, onMarkAsComplete, isUpcoming }: { reservations: any[], onMarkAsComplete?: (id: string) => void, isUpcoming: boolean }) => { /* ...código anterior... */ };
const getStatusColor = (status: string) => { /* ...código anterior... */ };
const getPaymentStatusColor = (status: string) => { /* ...código anterior... */ };

export default FaxineiraDashboard;
