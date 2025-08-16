import React, { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, MapPin, Users, Star, CheckCircle, Hand, Loader2, LogOut, AlertTriangle } from 'lucide-react';
import { format, isPast, addDays, addHours, differenceInHours, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Tipagem atualizada para incluir os novos campos da função RPC e a flag de urgência
type ReservationWithProperty = Awaited<ReturnType<typeof fetchAssignedReservations>>[0] & { 
    next_check_in_date?: string,
    next_checkin_time?: string,
    is_urgent?: boolean
};

// Busca as reservas atribuídas chamando a função RPC que criamos no banco de dados
const fetchAssignedReservations = async (userId: string) => {
    const { data, error } = await supabase.rpc('fn_get_cleaner_reservations', {
        cleaner_id: userId
    });
    if (error) {
        console.error("Erro ao buscar reservas da função RPC:", error);
        throw error;
    }
    // O RPC retorna 'properties' como JSON, precisamos parsear
    return (data || []).map(r => ({...r, properties: typeof r.properties === 'string' ? JSON.parse(r.properties) : r.properties}));
};

// Busca as faxinas disponíveis (oportunidades)
const fetchAvailableReservations = async (userId: string) => {
    const { data: accessibleProperties, error: accessError } = await (supabase as any)
        .from('cleaner_properties')
        .select('property_id')
        .eq('user_id', userId);
    if (accessError) throw accessError;
    const propertyIds = accessibleProperties.map((p: any) => p.property_id);
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
    const [activeTab, setActiveTab] = useState('dashboard');

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
        try {
            const { error } = await supabase
                .from('reservations')
                .update({ cleaner_user_id: user.id })
                .eq('id', reservationId)
                .is('cleaner_user_id', null);
            if (error) throw error;
            toast({ title: "Sucesso!", description: "Você assinou esta faxina. Ela foi movida para 'Próximas'." });
            await queryClient.invalidateQueries({ queryKey: assignedKey });
            await queryClient.invalidateQueries({ queryKey: availableKey });
        } catch (error: any) {
            toast({ title: "Erro", description: error.message || "Não foi possível assinar a faxina.", variant: "destructive" });
        }
    };

    const handleMarkAsComplete = async (reservationId: string) => {
        const confirmed = window.confirm(
            "⚠️ Tem certeza que deseja marcar esta faxina como 'Realizada'?\n\nEsta ação moverá o card para o seu histórico e não poderá ser desfeita facilmente."
        );

        if (confirmed) {
            try {
                const { error } = await supabase
                    .from('reservations')
                    .update({ cleaning_status: 'Realizada' })
                    .eq('id', reservationId);
                if (error) throw error;
                toast({ title: "Sucesso!", description: "Faxina marcada como concluída e movida para o histórico." });
                await queryClient.invalidateQueries({ queryKey: assignedKey });
            } catch (error: any) {
                toast({ title: "Erro", description: error.message || "Não foi possível atualizar o status.", variant: "destructive" });
            }
        }
    };

    const upcomingReservations = useMemo(() => {
        const now = new Date();
        const reservations = assignedReservations?.filter(r => r.cleaning_status !== 'Realizada' && !isPast(new Date(r.check_out_date))) ?? [];
        
        const withUrgency = reservations.map(r => {
            const checkoutDateTime = parseISO(`${r.check_out_date}T${r.checkout_time}`);
            const deadline = addHours(checkoutDateTime, 24);
            const hoursToDeadline = differenceInHours(deadline, now);
            const isUrgent = hoursToDeadline <= 6;
            return { ...r, is_urgent: isUrgent };
        });

        return withUrgency.sort((a, b) => {
            if (a.is_urgent && !b.is_urgent) return -1;
            if (!a.is_urgent && b.is_urgent) return 1;
            return new Date(a.check_out_date).getTime() - new Date(b.check_out_date).getTime();
        });
    }, [assignedReservations]);
    
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
            <header className="flex justify-between items-center pb-4 border-b">
                <nav className="flex items-center gap-4">
                    <Button variant={activeTab === 'dashboard' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('dashboard')}>Dashboard</Button>
                    <Button variant={activeTab === 'ganhos' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('ganhos')}>Meus Ganhos</Button>
                    <Button variant={activeTab === 'configuracao' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('configuracao')}>Configuração</Button>
                </nav>
                <Button variant="outline" size="sm">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair
                </Button>
            </header>

            <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Minhas Faxinas</h1>
                    <p className="text-muted-foreground">Visualize e gerencie as limpezas designadas para você.</p>
                </div>
                <Tabs defaultValue="proximas" className="w-full mt-4">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="proximas">Próximas ({upcomingReservations.length})</TabsTrigger>
                        <TabsTrigger value="oportunidades">Oportunidades ({availableReservations?.length || 0})</TabsTrigger>
                        <TabsTrigger value="historico">Histórico ({pastReservations.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="proximas">
                        <ReservationList reservations={upcomingReservations} onMarkAsComplete={handleMarkAsComplete} isUpcoming={true} />
                    </TabsContent>
                    <TabsContent value="oportunidades">
                        <AvailableCleaningsList reservations={availableReservations || []} onSignUp={handleSignUpForCleaning} />
                    </TabsContent>
                    <TabsContent value="historico">
                        <ReservationList reservations={pastReservations} isUpcoming={false} />
                    </TabsContent>
                </Tabs>
            </div>
            
            <div style={{ display: activeTab === 'ganhos' ? 'block' : 'none' }}>
                 <h1 className="text-2xl font-bold text-foreground">Meus Ganhos</h1>
                 <p className="text-muted-foreground">Acompanhe seus recebimentos. (Página em construção)</p>
            </div>
            
            <div style={{ display: activeTab === 'configuracao' ? 'block' : 'none' }}>
                 <h1 className="text-2xl font-bold text-foreground">Configuração da Conta</h1>
                 <p className="text-muted-foreground mb-6">Altere seus dados pessoais e de segurança.</p>
                 
                 <Card>
                    <CardHeader><CardTitle>Dados Pessoais</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <Label htmlFor="fullName">Nome Completo</Label>
                                <Input id="fullName" placeholder="Seu nome completo" defaultValue={user?.user_metadata.full_name || ''} />
                            </div>
                            <div>
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" type="email" placeholder="Seu email" defaultValue={user?.email || ''} disabled />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="phone">Telefone</Label>
                            <Input id="phone" placeholder="(XX) XXXXX-XXXX" defaultValue={user?.user_metadata.phone || ''} />
                        </div>
                         <div className="flex justify-end"><Button>Salvar Alterações</Button></div>
                    </CardContent>
                 </Card>

                 <Card className="mt-6">
                    <CardHeader><CardTitle>Alterar Senha</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="currentPassword">Senha Atual</Label>
                            <Input id="currentPassword" type="password" />
                        </div>
                        <div>
                            <Label htmlFor="newPassword">Nova Senha</Label>
                            <Input id="newPassword" type="password" />
                        </div>
                         <div className="flex justify-end"><Button>Alterar Senha</Button></div>
                    </CardContent>
                 </Card>

                 <Card className="mt-6 border-red-500">
                    <CardHeader><CardTitle className="text-red-700">Zona de Perigo</CardTitle></CardHeader>
                    <CardContent>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h3 className="font-semibold">Excluir sua conta</h3>
                                <p className="text-sm text-muted-foreground">Esta ação é permanente e removerá todos os seus dados. <br /> Para criar um novo cadastro, você precisará contatar um administrador.</p>
                            </div>
                             <Button variant="destructive">Excluir Minha Conta</Button>
                        </div>
                    </CardContent>
                 </Card>
            </div>
        </div>
    );
};

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
            {reservations.map(reservation => {
                 const checkoutDateTime = parseISO(`${reservation.check_out_date}T${reservation.checkout_time}`);
                 const deadline = addHours(checkoutDateTime, 24);
                 
                 let workWindowEnd = `Prazo: ${format(deadline, "dd/MM 'às' HH:mm", { locale: ptBR })}`;
                 if (reservation.next_check_in_date && reservation.next_checkin_time) {
                     const nextCheckinDateTime = parseISO(`${reservation.next_check_in_date}T${reservation.next_checkin_time}`);
                     workWindowEnd = `Entrada: ${format(nextCheckinDateTime, "dd/MM 'às' HH:mm", { locale: ptBR })}`;
                 }

                return (
                    <Card key={reservation.id} className={`hover:shadow-md transition-shadow ${reservation.is_urgent ? 'border-2 border-red-500 bg-red-50' : ''}`}>
                        <CardHeader className="pb-3 space-y-2">
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
                           {reservation.is_urgent && (
                               <div className="flex items-center gap-2 text-red-600 font-bold text-sm p-2 bg-red-100 rounded-md">
                                   <AlertTriangle className="h-4 w-4" />
                                   <span>ATENÇÃO: FAXINA URGENTE! PRAZO DE 24H TERMINANDO.</span>
                               </div>
                           )}
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-muted p-3 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="text-center sm:text-left">
                                    <p className="text-sm font-medium text-muted-foreground">INÍCIO DA JANELA (SAÍDA)</p>
                                    <p className="text-xl font-bold text-primary">{format(checkoutDateTime, "dd/MM 'às' HH:mm", { locale: ptBR })}</p>
                                </div>
                                <div className="text-center sm:text-left">
                                    <p className="text-sm font-medium text-muted-foreground">FIM DA JANELA</p>
                                    <p className="text-lg font-semibold">{workWindowEnd}</p>
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
                );
            })}
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
                        <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                           <div>
                                <CardTitle className="text-lg text-blue-800">{reservation.properties?.name || 'Propriedade'}</CardTitle>
                                <p className="text-sm text-blue-600 flex items-center mt-1">
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
