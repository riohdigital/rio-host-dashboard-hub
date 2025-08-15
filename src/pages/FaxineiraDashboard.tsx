import React from 'react'; // 'useEffect' foi removido pois não era mais necessário no componente principal
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, MapPin, Users, Star, CheckCircle, Hand, Loader2 } from 'lucide-react';
import { format, isPast, addDays } from 'date-fns'; // 'startOfToday' foi removido por não ser mais usado diretamente na filtragem
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

// Tipagem para as reservas, incluindo a nova coluna 'cleaning_status'
type ReservationWithProperty = Awaited<ReturnType<typeof fetchAssignedReservations>>[0] & { cleaning_status?: string };

// Busca as reservas que já foram atribuídas à faxineira
const fetchAssignedReservations = async (userId: string) => {
    const { data, error } = await supabase
        .from('reservations')
        .select(`*, properties (name, address, default_checkin_time)`)
        .eq('cleaner_user_id', userId)
        .order('check_out_date', { ascending: true });
    if (error) throw error;
    return data || [];
};

// Busca as faxinas disponíveis nas propriedades da faxineira
const fetchAvailableReservations = async (userId: string) => {
    const { data: accessibleProperties, error: accessError } = await supabase
        .from('cleaner_properties')
        .select('property_id')
        .eq('user_id', userId);
    if (accessError) throw accessError;
    const propertyIds = accessibleProperties.map(p => p.property_id);
    if (propertyIds.length === 0) return [];

    const today = new Date().toISOString();
    const twoWeeksFromNow = addDays(new Date(), 14).toISOString();

    const { data, error } = await supabase
        .from('reservations')
        .select(`*, properties (name, address, default_checkin_time)`)
        .in('property_id', propertyIds)
        .is('cleaner_user_id', null)
        .gte('check_out_date', today)
        .lte('check_out_date', twoWeeksFromNow)
        .in('reservation_status', ['Confirmada', 'Em Andamento'])
        .order('check_out_date', { ascending: true });
    if (error) throw error;
    return data || [];
};


const FaxineiraDashboard = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const assignedKey = ['faxineira-reservations', user?.id];
    const availableKey = ['available-cleanings', user?.id];

    const { data: assignedReservations, isLoading: isLoadingAssigned } = useQuery({
        queryKey: assignedKey,
        queryFn: () => fetchAssignedReservations(user!.id),
        enabled: !!user,
    });

    const { data: availableReservations, isLoading: isLoadingAvailable } = useQuery({
        queryKey: availableKey,
        queryFn: () => fetchAvailableReservations(user!.id),
        enabled: !!user,
    });

    const handleSignUpForCleaning = async (reservationId: string) => {
        if (!user) return;
        console.log(`LOG: Usuário ${user.id} tentando assinar a faxina ${reservationId}.`);
        try {
            const { error } = await supabase
                .from('reservations')
                .update({ cleaner_user_id: user.id })
                .eq('id', reservationId)
                .is('cleaner_user_id', null);
            if (error) throw error;
            toast({ title: "Sucesso!", description: "Você assinou esta faxina. Ela foi movida para 'Próximas'." });
            console.log("LOG: Faxina assinada com sucesso. Invalidando queries...");
            await queryClient.invalidateQueries({ queryKey: assignedKey });
            await queryClient.invalidateQueries({ queryKey: availableKey });
        } catch (error: any) {
            console.error("LOG: Erro ao assinar a faxina:", error);
            toast({ title: "Erro", description: error.message || "Não foi possível assinar a faxina.", variant: "destructive" });
        }
    };

    // VERSÃO FINAL: Função de marcar como concluída com o diálogo de confirmação
    const handleMarkAsComplete = async (reservationId: string) => {
        const confirmed = window.confirm(
            "⚠️ Tem certeza que deseja marcar esta faxina como 'Realizada'?\n\nEsta ação moverá o card para o seu histórico e não poderá ser desfeita facilmente."
        );

        if (confirmed) {
            console.log(`LOG: Usuário confirmou. Marcando a faxina ${reservationId} como 'Realizada'.`);
            try {
                const { error } = await supabase
                    .from('reservations')
                    .update({ cleaning_status: 'Realizada' })
                    .eq('id', reservationId);
                if (error) throw error;
                toast({ title: "Sucesso!", description: "Faxina marcada como concluída e movida para o histórico." });
                console.log("LOG: Faxina concluída. Invalidando queries...");
                await queryClient.invalidateQueries({ queryKey: assignedKey });
            } catch (error: any) {
                console.error("LOG: Erro ao marcar faxina como concluída:", error);
                toast({ title: "Erro", description: error.message || "Não foi possível atualizar o status.", variant: "destructive" });
            }
        } else {
            console.log(`LOG: Ação para marcar faxina ${reservationId} como concluída foi cancelada pelo usuário.`);
        }
    };

    const upcomingReservations = assignedReservations?.filter(r => r.cleaning_status !== 'Realizada' && !isPast(new Date(r.check_out_date))) ?? [];
    const pastReservations = assignedReservations?.filter(r => r.cleaning_status === 'Realizada' || isPast(new Date(r.check_out_date))) ?? [];

    if (isLoadingAssigned || isLoadingAvailable) {
        return (
            <div className="p-6 flex justify-center items-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Minhas Faxinas</h1>
                <p className="text-muted-foreground">Visualize e gerencie as limpezas designadas para você.</p>
            </div>
            <Tabs defaultValue="proximas" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="proximas">Próximas ({upcomingReservations.length})</TabsTrigger>
                    <TabsTrigger value="disponiveis">Disponíveis ({availableReservations?.length || 0})</TabsTrigger>
                    <TabsTrigger value="historico">Histórico ({pastReservations.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="proximas">
                    <ReservationList reservations={upcomingReservations} onMarkAsComplete={handleMarkAsComplete} isUpcoming={true} />
                </TabsContent>
                <TabsContent value="disponiveis">
                    <AvailableCleaningsList reservations={availableReservations || []} onSignUp={handleSignUpForCleaning} />
                </TabsContent>
                <TabsContent value="historico">
                    <ReservationList reservations={pastReservations} isUpcoming={false} />
                </TabsContent>
            </Tabs>
        </div>
    );
};

// Função auxiliar para definir a cor do Badge de status da reserva
const getStatusVariant = (status: string | null): 'success' | 'destructive' | 'default' | 'secondary' => {
    switch (status) {
        case 'Confirmada':
            return 'success';
        case 'Cancelada':
            return 'destructive';
        case 'Finalizada':
            return 'default';
        default:
            return 'secondary';
    }
};

const ReservationList = ({ reservations, onMarkAsComplete, isUpcoming }: { reservations: ReservationWithProperty[], onMarkAsComplete?: (id: string) => void, isUpcoming: boolean }) => {
    if (reservations.length === 0) {
        return (
            <Card className="mt-4">
                <CardContent className="pt-6 text-center text-muted-foreground">
                    <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>Nenhuma reserva encontrada</p>
                    <p className="text-sm">{isUpcoming ? "Você não possui faxinas futuras agendadas." : "Nenhuma faxina no seu histórico."}</p>
                </CardContent>
            </Card>
        );
    }
    return (
        <div className="grid gap-4 mt-4">
            {reservations.map(reservation => (
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
                                <Badge variant={getStatusVariant(reservation.reservation_status)}>{reservation.reservation_status}</Badge>
                                <Badge variant={reservation.cleaning_payment_status === 'Paga' ? 'default' : 'destructive'}>{reservation.cleaning_payment_status}</Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-muted p-3 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="text-center sm:text-left">
                                <p className="text-sm font-medium text-muted-foreground">DATA DA FAXINA</p>
                                <p className="text-xl font-bold text-primary">{format(new Date(`${reservation.check_out_date}T00:00:00`), "dd 'de' MMMM, yyyy", { locale: ptBR })}</p>
                            </div>
                            <div className="text-center sm:text-left">
                                <p className="text-sm font-medium text-muted-foreground">JANELA DE TRABALHO</p>
                                <p className="text-lg font-semibold">
                                    Saída às {reservation.checkout_time?.slice(0, 5) ?? 'N/A'}
                                    <span className="text-muted-foreground mx-1">até</span>
                                    Entrada às {reservation.properties?.default_checkin_time?.slice(0, 5) ?? 'N/A'}
                                </p>
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            {reservation.guest_name && (<p><span className="font-medium">Hóspede Anterior:</span> {reservation.guest_name}</p>)}
                            {reservation.number_of_guests && (<p className="flex items-center"><Users className="h-4 w-4 mr-1.5" />{reservation.number_of_guests} Hóspedes</p>)}
                            {reservation.cleaning_fee && (<p><span className="font-medium">Sua Taxa:</span> <span className="text-green-600 font-semibold">R$ {parseFloat(String(reservation.cleaning_fee)).toFixed(2)}</span></p>)}
                            {reservation.cleaning_rating > 0 && (<p className="flex items-center"><Star className="h-4 w-4 mr-1.5 text-yellow-500" />Sua Avaliação: {reservation.cleaning_rating}/5</p>)}
                        </div>
                        {reservation.cleaning_notes && (
                            <div className="pt-2 border-t">
                                <p className="text-sm"><span className="font-medium">Observações:</span> <span className="text-muted-foreground">{reservation.cleaning_notes}</span></p>
                            </div>
                        )}
                        {isUpcoming && reservation.cleaning_status !== 'Realizada' && onMarkAsComplete && (
                            <div className="pt-4 border-t flex justify-end">
                                <Button onClick={() => onMarkAsComplete(reservation.id)}><CheckCircle className="h-4 w-4 mr-2" />Marcar como Concluída</Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};

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
                        <div className="bg-muted p-3 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="text-center sm:text-left">
                                <p className="text-sm font-medium text-muted-foreground">DATA DA FAXINA</p>
                                <p className="text-xl font-bold text-primary">{format(new Date(`${reservation.check_out_date}T00:00:00`), "dd 'de' MMMM, yyyy", { locale: ptBR })}</p>
                            </div>
                            <div className="text-center sm:text-left">
                                <p className="text-sm font-medium text-muted-foreground">JANELA DE TRABALHO</p>
                                <p className="text-lg font-semibold">
                                    Saída às {reservation.checkout_time?.slice(0, 5) ?? 'N/A'}
                                    <span className="text-muted-foreground mx-1">até</span>
                                    Entrada às {reservation.properties?.default_checkin_time?.slice(0, 5) ?? 'N/A'}
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-between items-center bg-white p-3 rounded-lg">
                            <div>
                                <p className="text-sm font-medium">Sua Taxa</p>
                                <p className="text-lg font-bold text-green-600">R$ {parseFloat(String(reservation.cleaning_fee || 0)).toFixed(2)}</p>
                            </div>
                            <Button onClick={() => onSignUp(reservation.id)}><Hand className="h-4 w-4 mr-2" />Assinar Faxina</Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};

export default FaxineiraDashboard;
