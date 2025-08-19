import React, { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, MapPin, Users, Star, CheckCircle, Hand, Loader2, LogOut, AlertTriangle, DollarSign, Clock } from 'lucide-react';
import { format, isPast, addHours, differenceInHours, parseISO, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ReservationWithDetails = Awaited<ReturnType<typeof fetchAssignedReservations>>[0] & { 
    next_check_in_date?: string,
    next_checkin_time?: string,
    urgency?: { 
        level: 'overdue' | 'critical' | 'warning' | 'normal',
        message: string 
    }
};

const fetchAssignedReservations = async (userId: string) => {
    const { data, error } = await supabase.rpc('fn_get_cleaner_reservations', { cleaner_id: userId });
    if (error) {
        console.error("Erro ao buscar reservas da função RPC:", error);
        throw error;
    }
    return (data || []).map(r => ({...r, properties: typeof r.properties === 'string' ? JSON.parse(r.properties) : r.properties}));
};

const fetchAvailableReservations = async (userId: string) => {
    const { data, error } = await supabase.rpc('fn_get_available_reservations', { cleaner_id: userId });
    if (error) {
        console.error("Erro ao buscar oportunidades da função RPC:", error);
        throw error;
    }
    return (data || []).map(r => ({...r, properties: typeof r.properties === 'string' ? JSON.parse(r.properties) : r.properties}));
};

const FaxineiraDashboard = () => {
    const { user, signOut } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('dashboard');

    const assignedKey = ['faxineira-reservations', user?.id];
    const availableKey = ['available-cleanings', user?.id];

    const { data: assignedReservationsData, isLoading: isLoadingAssigned } = useQuery({ queryKey: assignedKey, queryFn: () => fetchAssignedReservations(user!.id), enabled: !!user });
    const { data: availableReservationsData, isLoading: isLoadingAvailable } = useQuery({ queryKey: availableKey, queryFn: () => fetchAvailableReservations(user!.id), enabled: !!user });
    
    const processUpcomingReservations = (reservations: any[] | undefined) => {
        if (!reservations) return [];
        const now = new Date();
        const withUrgency = reservations.map(r => {
            const checkoutDateTime = parseISO(`${r.check_out_date}T${r.checkout_time}`);
            const hoursUntilCheckout = differenceInHours(checkoutDateTime, now);
            
            let level: 'overdue' | 'critical' | 'warning' | 'normal' = 'normal';
            let message = '';

            if (hoursUntilCheckout < 0) {
                level = 'overdue';
                message = `ATENÇÃO: FAXINA ATRASADA HÁ ${Math.abs(Math.round(hoursUntilCheckout))} HORAS`;
            } else if (hoursUntilCheckout <= 24) {
                level = 'critical';
                message = `ATENÇÃO: PRAZO MENOR QUE 24H`;
            } else if (hoursUntilCheckout <= 48) {
                level = 'warning';
                message = `AVISO: PRAZO MENOR QUE 48H`;
            }
            
            return { ...r, urgency: { level, message } };
        });

        return withUrgency.sort((a, b) => {
            const levelOrder = { overdue: -1, critical: 0, warning: 1, normal: 2 };
            if (levelOrder[a.urgency.level] < levelOrder[b.urgency.level]) return -1;
            if (levelOrder[a.urgency.level] > levelOrder[b.urgency.level]) return 1;
            return new Date(a.check_out_date).getTime() - new Date(b.check_out_date).getTime();
        });
    };

    const upcomingReservations = useMemo(() => processUpcomingReservations(assignedReservationsData?.filter(r => r.cleaning_status !== 'Realizada')), [assignedReservationsData]);
    const availableReservations = useMemo(() => processUpcomingReservations(availableReservationsData), [availableReservationsData]);
    const pastReservations = useMemo(() => {
        const data = assignedReservationsData?.filter(r => r.cleaning_status === 'Realizada' && (isToday(new Date(r.check_out_date)) || isPast(new Date(r.check_out_date)))) ?? [];
        return data.sort((a, b) => new Date(b.check_out_date).getTime() - new Date(a.check_out_date).getTime());
    }, [assignedReservationsData]);

    const hasActiveCleaning = upcomingReservations.length > 0;

    const handleSignUpForCleaning = async (reservationId: string) => {
        if (!user) return;
        try {
            const { error } = await supabase.from('reservations').update({ cleaner_user_id: user.id }).eq('id', reservationId).is('cleaner_user_id', null);
            if (error) throw error;
            toast({ title: "Sucesso!", description: "Você assinou esta faxina. Ela foi movida para 'Próximas'." });
            await queryClient.invalidateQueries({ queryKey: assignedKey });
            await queryClient.invalidateQueries({ queryKey: availableKey });
        } catch (error: any) {
            toast({ title: "Erro", description: error.message || "Não foi possível assinar a faxina.", variant: "destructive" });
        }
    };

    const handleMarkAsComplete = async (reservationId: string) => {
        const confirmed = window.confirm("⚠️ Tem certeza que deseja marcar esta faxina como 'Realizada'?\n\nEsta ação moverá o card para o seu histórico e não poderá ser desfeita facilmente.");
        if (confirmed) {
            try {
                const { error } = await supabase.from('reservations').update({ cleaning_status: 'Realizada' }).eq('id', reservationId);
                if (error) throw error;
                toast({ title: "Sucesso!", description: "Faxina marcada como concluída e movida para o histórico." });
                await queryClient.invalidateQueries({ queryKey: assignedKey });
            } catch (error: any) {
                toast({ title: "Erro", description: error.message || "Não foi possível atualizar o status.", variant: "destructive" });
            }
        }
    };

    if (isLoadingAssigned || isLoadingAvailable) {
        return <div className="p-6 flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="p-4 md:p-6 space-y-6">
            <header className="flex justify-between items-center pb-4 border-b">
                <nav className="flex items-center gap-4">
                    <Button variant={activeTab === 'dashboard' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('dashboard')}>Dashboard</Button>
                    <Button variant={activeTab === 'ganhos' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('ganhos')}>Meus Ganhos</Button>
                    <Button variant={activeTab === 'configuracao' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('configuracao')}>Configuração</Button>
                </nav>
                <Button variant="outline" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-2" />Sair</Button>
            </header>
            
            <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Minhas Faxinas</h1>
                    <p className="text-muted-foreground">Visualize e gerencie as limpezas designadas para você.</p>
                </div>
                <Tabs defaultValue="proximas" className="w-full mt-4">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="proximas">Próximas ({upcomingReservations.length})</TabsTrigger>
                        <TabsTrigger value="oportunidades">Oportunidades ({availableReservations.length})</TabsTrigger>
                        <TabsTrigger value="historico">Histórico ({pastReservations.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="proximas"><UpcomingList reservations={upcomingReservations} onMarkAsComplete={handleMarkAsComplete} /></TabsContent>
                    <TabsContent value="oportunidades"><AvailableCleaningsList reservations={availableReservations} onSignUp={handleSignUpForCleaning} hasActiveCleaning={hasActiveCleaning} /></TabsContent>
                    <TabsContent value="historico"><HistoryList reservations={pastReservations} /></TabsContent>
                </Tabs>
            </div>
            
            <div style={{ display: activeTab === 'ganhos' ? 'block' : 'none' }}>
                 <MeusGanhosPage historicalData={pastReservations} />
            </div>
            
            <div style={{ display: activeTab === 'configuracao' ? 'block' : 'none' }}>
                 <h1 className="text-2xl font-bold text-foreground">Configuração da Conta</h1>
                 <p className="text-muted-foreground mb-6">Altere seus dados pessoais e de segurança.</p>
                 <Card>
                    <CardHeader><CardTitle>Dados Pessoais</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div><Label htmlFor="fullName">Nome Completo</Label><Input id="fullName" placeholder="Seu nome completo" defaultValue={user?.user_metadata.full_name || ''} /></div>
                            <div><Label htmlFor="email">Email</Label><Input id="email" type="email" placeholder="Seu email" defaultValue={user?.email || ''} disabled /></div>
                        </div>
                        <div><Label htmlFor="phone">Telefone</Label><Input id="phone" placeholder="(XX) XXXXX-XXXX" defaultValue={user?.user_metadata.phone || ''} /></div>
                         <div className="flex justify-end"><Button>Salvar Alterações</Button></div>
                    </CardContent>
                 </Card>
                 <Card className="mt-6">
                    <CardHeader><CardTitle>Alterar Senha</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div><Label htmlFor="currentPassword">Senha Atual</Label><Input id="currentPassword" type="password" /></div>
                        <div><Label htmlFor="newPassword">Nova Senha</Label><Input id="newPassword" type="password" /></div>
                         <div className="flex justify-end"><Button>Alterar Senha</Button></div>
                    </CardContent>
                 </Card>
                 <Card className="mt-6 border-red-500">
                    <CardHeader><CardTitle className="text-red-700">Zona de Perigo</CardTitle></CardHeader>
                    <CardContent>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div><h3 className="font-semibold">Excluir sua conta</h3><p className="text-sm text-muted-foreground">Esta ação é permanente e removerá todos os seus dados. <br /> Para criar um novo cadastro, você precisará contatar um administrador.</p></div>
                             <Button variant="destructive">Excluir Minha Conta</Button>
                        </div>
                    </CardContent>
                 </Card>
            </div>
        </div>
    );
};

const MeusGanhosPage = ({ historicalData }: { historicalData: ReservationWithDetails[] }) => {
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const availableMonths = useMemo(() => {
        const months = new Set(historicalData.map(r => format(parseISO(r.check_out_date), 'yyyy-MM')));
        if (months.size === 0) { months.add(format(new Date(), 'yyyy-MM')); }
        return Array.from(months).sort().reverse();
    }, [historicalData]);
    const monthData = useMemo(() => {
        const filtered = historicalData.filter(r => format(parseISO(r.check_out_date), 'yyyy-MM') === selectedMonth);
        return filtered.reduce((acc, res) => {
            const fee = Number(res.cleaning_fee || 0);
            if (res.cleaning_payment_status === 'Paga') { acc.pago += fee; } 
            else { acc.proximoCiclo += fee; }
            return acc;
        }, { pago: 0, proximoCiclo: 0 });
    }, [historicalData, selectedMonth]);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                 <div><h1 className="text-2xl font-bold text-foreground">Meus Ganhos</h1><p className="text-muted-foreground">Acompanhe seus recebimentos por ciclo.</p></div>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="Selecione o Mês" /></SelectTrigger>
                    <SelectContent>
                        {availableMonths.map(month => (
                             <SelectItem key={month} value={month}>{format(parseISO(`${month}-02`), 'MMMM / yyyy', { locale: ptBR })}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-green-500 bg-green-50"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-green-800">Recebido neste Ciclo (Pago)</CardTitle><DollarSign className="h-4 w-4 text-green-700" /></CardHeader><CardContent><div className="text-2xl font-bold text-green-700">R$ {monthData.pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div><p className="text-xs text-green-600">Valores de faxinas (ex: Airbnb) já recebidos.</p></CardContent></Card>
                <Card className="border-orange-500 bg-orange-50"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-orange-800">A receber no Próximo Ciclo</CardTitle><Clock className="h-4 w-4 text-orange-700" /></CardHeader><CardContent><div className="text-2xl font-bold text-orange-700">R$ {monthData.proximoCiclo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div><p className="text-xs text-orange-600">Valores (ex: Booking) que serão pagos até o 5º dia útil do próximo mês.</p></CardContent></Card>
            </div>
        </div>
    );
};

const getStatusVariant = (status: string | null): 'success' | 'destructive' | 'default' | 'secondary' => {
    switch (status) {
        case 'Confirmada': return 'success';
        case 'Cancelada': return 'destructive';
        case 'Finalizada': return 'default';
        default: return 'secondary';
    }
};

const UpcomingCard = ({ reservation, children }: { reservation: ReservationWithDetails, children?: React.ReactNode }) => {
    const workWindowInfo = useMemo(() => {
        const now = new Date();
        const checkoutDateTime = parseISO(`${reservation.check_out_date}T${reservation.checkout_time}`);
        const hasCheckoutPassed = isPast(checkoutDateTime);
        let startLabel = "INÍCIO DA JANELA (SAÍDA)";
        let startValue = format(checkoutDateTime, "dd/MM 'às' HH:mm", { locale: ptBR });
        let endLabel = "FIM DA JANELA";
        let endValue = "Prazo de 48h para concluir";
        if (reservation.next_check_in_date && reservation.next_checkin_time) {
            const nextCheckinDateTime = parseISO(`${reservation.next_check_in_date}T${reservation.next_checkin_time}`);
            const hoursRemaining = differenceInHours(nextCheckinDateTime, now);
            if(hoursRemaining < 0) { endValue = `ENTRADA PERDIDA HÁ ${Math.abs(Math.round(hoursRemaining))}H`; } 
            else if (hoursRemaining <= 48) { endValue = `Entrada: ${format(nextCheckinDateTime, "dd/MM 'às' HH:mm", { locale: ptBR })}`; } 
            else { endValue = "Janela Ampla (+48h)"; }
        }
        if(hasCheckoutPassed) {
            startLabel = "JANELA RESTANTE (DESDE)";
            startValue = format(now, "dd/MM 'às' HH:mm", { locale: ptBR });
        }
        return { startLabel, startValue, endLabel, endValue };
    }, [reservation.check_out_date, reservation.checkout_time, reservation.next_check_in_date, reservation.next_checkin_time]);
    
    const urgencyClasses = { overdue: 'border-2 border-red-500 bg-red-50', critical: 'border-2 border-red-500 bg-red-50', warning: 'border-2 border-yellow-500 bg-yellow-50', normal: '' };

    return (
        <Card className={`hover:shadow-md transition-shadow ${urgencyClasses[reservation.urgency?.level || 'normal']}`}>
            <CardHeader className="pb-3 space-y-2">
                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                    <div>
                        <CardTitle className="text-lg">{reservation.properties?.name || 'Propriedade'}</CardTitle>
                        <p className="text-sm text-muted-foreground flex items-center mt-1"><MapPin className="h-4 w-4 mr-1.5 flex-shrink-0" />{reservation.properties?.address || 'Endereço não informado'}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        <Badge variant={getStatusVariant(reservation.reservation_status)}>{reservation.reservation_status}</Badge>
                        <Badge variant={reservation.cleaning_payment_status === 'Paga' ? 'default' : 'destructive'}>{reservation.cleaning_payment_status}</Badge>
                    </div>
                </div>
               {reservation.urgency?.level !== 'normal' && (
                   <div className={`flex items-center gap-2 font-bold text-sm p-2 rounded-md ${reservation.urgency?.level === 'warning' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-700'}`}>
                       <AlertTriangle className="h-4 w-4" />
                       <span>{reservation.urgency.message}</span>
                   </div>
               )}
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="bg-muted p-3 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-center sm:text-left">
                        <p className="text-sm font-medium text-muted-foreground">{workWindowInfo.startLabel}</p>
                        <p className="text-xl font-bold text-primary">{workWindowInfo.startValue}</p>
                    </div>
                    <div className="text-center sm:text-left">
                        <p className="text-sm font-medium text-muted-foreground">{workWindowInfo.endLabel}</p>
                        <p className="text-lg font-semibold">{workWindowInfo.endValue}</p>
                    </div>
                </div>
                {children}
            </CardContent>
        </Card>
    );
};

const HistoryCard = ({ reservation }: { reservation: ReservationWithDetails }) => {
    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                    <div>
                        <CardTitle className="text-lg">{reservation.properties?.name || 'Propriedade'}</CardTitle>
                        <p className="text-sm text-muted-foreground flex items-center mt-1"><MapPin className="h-4 w-4 mr-1.5 flex-shrink-0" />{reservation.properties?.address || 'Endereço não informado'}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        <Badge variant={getStatusVariant(reservation.reservation_status)}>{reservation.reservation_status}</Badge>
                        <Badge variant={reservation.cleaning_payment_status === 'Paga' ? 'default' : 'destructive'}>{reservation.cleaning_payment_status}</Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid md:grid-cols-2 gap-x-4 gap-y-2 text-sm pt-4">
                    <p><span className="font-medium">Data da Faxina:</span> {format(parseISO(reservation.check_out_date), "dd/MM/yyyy")}</p>
                    <p><span className="font-medium">Sua Taxa:</span> <span className="text-green-600 font-semibold">R$ {parseFloat(String(reservation.cleaning_fee || 0)).toFixed(2)}</span></p>
                    {reservation.cleaning_rating > 0 && (<p className="flex items-center"><Star className="h-4 w-4 mr-1.5 text-yellow-500" />Sua Avaliação: {reservation.cleaning_rating}/5</p>)}
                </div>
            </CardContent>
        </Card>
    );
};

const UpcomingList = ({ reservations, onMarkAsComplete }: { reservations: ReservationWithDetails[], onMarkAsComplete: (id: string) => void }) => {
    if (reservations.length === 0) { return <Card className="mt-4"><CardContent className="pt-6 text-center text-muted-foreground"><Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" /><p>Nenhuma reserva encontrada</p><p className="text-sm">Você não possui faxinas futuras agendadas.</p></CardContent></Card>; }
    return (
        <div className="grid gap-4 mt-4">
            {reservations.map(reservation => {
                const checkoutDateTime = parseISO(`${reservation.check_out_date}T${reservation.checkout_time}`);
                const canMarkAsComplete = isPast(checkoutDateTime);
                return (
                    <UpcomingCard key={reservation.id} reservation={reservation}>
                        <div className="grid md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            {reservation.guest_name && (<p><span className="font-medium">Hóspede Anterior:</span> {reservation.guest_name}</p>)}
                            {reservation.number_of_guests && (<p className="flex items-center"><Users className="h-4 w-4 mr-1.5" />{reservation.number_of_guests} Hóspedes</p>)}
                            {reservation.cleaning_fee && (<p><span className="font-medium">Sua Taxa:</span> <span className="text-green-600 font-semibold">R$ {parseFloat(String(reservation.cleaning_fee)).toFixed(2)}</span></p>)}
                            {reservation.cleaning_rating > 0 && (<p className="flex items-center"><Star className="h-4 w-4 mr-1.5 text-yellow-500" />Sua Avaliação: {reservation.cleaning_rating}/5</p>)}
                        </div>
                        {reservation.cleaning_notes && (<div className="pt-2 border-t"><p className="text-sm"><span className="font-medium">Observações:</span> <span className="text-muted-foreground">{reservation.cleaning_notes}</span></p></div>)}
                        {reservation.cleaning_status !== 'Realizada' && (
                            <div className="pt-4 border-t flex justify-end">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span tabIndex={0}><Button onClick={() => onMarkAsComplete(reservation.id)} disabled={!canMarkAsComplete}><CheckCircle className="h-4 w-4 mr-2" />Marcar como Concluída</Button></span>
                                        </TooltipTrigger>
                                        {!canMarkAsComplete && (<TooltipContent><p>Só é possível concluir após a data e hora de checkout do hóspede.</p></TooltipContent>)}
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        )}
                    </UpcomingCard>
                );
            })}
        </div>
    );
};

const AvailableCleaningsList = ({ reservations, onSignUp, hasActiveCleaning }: { reservations: ReservationWithDetails[], onSignUp: (id: string) => void, hasActiveCleaning: boolean }) => {
    if (reservations.length === 0) { return <Card className="mt-4"><CardContent className="pt-6 text-center text-muted-foreground"><CheckCircle className="mx-auto h-12 w-12 mb-4 opacity-50 text-green-500" /><p>Nenhuma oportunidade no momento</p><p className="text-sm">Não há faxinas disponíveis nas suas propriedades para as próximas duas semanas.</p></CardContent></Card>; }
    return (
        <div className="grid gap-4 mt-4">
            {reservations.map(reservation => {
                const canSignUp = !hasActiveCleaning || reservation.urgency?.level === 'critical' || reservation.urgency?.level === 'overdue';
                return (
                    <UpcomingCard key={reservation.id} reservation={reservation}>
                         <div className="flex justify-between items-center bg-white p-3 rounded-lg">
                            <div>
                                <p className="text-sm font-medium">Sua Taxa</p>
                                <p className="text-lg font-bold text-green-600">R$ {parseFloat(String(reservation.cleaning_fee || 0)).toFixed(2)}</p>
                            </div>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span tabIndex={0}>
                                            <Button onClick={() => onSignUp(reservation.id)} disabled={!canSignUp}><Hand className="h-4 w-4 mr-2" />Assinar Faxina</Button>
                                        </span>
                                    </TooltipTrigger>
                                    {!canSignUp && (<TooltipContent><p>Você já possui uma faxina em andamento. Conclua-a para assinar novas oportunidades.</p></TooltipContent>)}
                                </Tooltip>
                            </TooltipProvider>
                         </div>
                    </UpcomingCard>
                );
            })}
        </div>
    );
};

const HistoryList = ({ reservations }: { reservations: ReservationWithDetails[] }) => {
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const availableMonths = useMemo(() => {
        const months = new Set(reservations.map(r => format(parseISO(r.check_out_date), 'yyyy-MM')));
        if (months.size === 0) { months.add(format(new Date(), 'yyyy-MM')); }
        return Array.from(months).sort().reverse();
    }, [reservations]);
    
    const filteredReservations = useMemo(() => {
        if (selectedMonth === 'all') return reservations;
        return reservations.filter(r => format(parseISO(r.check_out_date), 'yyyy-MM') === selectedMonth);
    }, [reservations, selectedMonth]);

    if (reservations.length === 0) { return <Card className="mt-4"><CardContent className="pt-6 text-center text-muted-foreground"><Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" /><p>Nenhuma reserva encontrada</p><p className="text-sm">Nenhuma faxina no seu histórico.</p></CardContent></Card>; }
    
    return (
        <div className="space-y-4 mt-4">
            <div className="flex justify-end">
                 <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar por Mês" /></SelectTrigger>
                    <SelectContent>
                         <SelectItem value="all">Todos os Meses</SelectItem>
                         {availableMonths.map(month => (
                             <SelectItem key={month} value={month}>{format(parseISO(`${month}-02`), 'MMMM / yyyy', { locale: ptBR })}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {filteredReservations.length === 0 ? (
                <Card className="mt-4"><CardContent className="pt-6 text-center text-muted-foreground"><p>Nenhuma faxina encontrada para o período selecionado.</p></CardContent></Card>
            ) : (
                <div className="grid gap-4">
                    {filteredReservations.map(reservation => (
                        <HistoryCard key={reservation.id} reservation={reservation} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default FaxineiraDashboard;
