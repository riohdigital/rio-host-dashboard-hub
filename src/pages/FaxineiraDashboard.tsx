import React, { useState, useMemo } from 'react';
import { EtiquetaStatus } from '@/components/comum/Etiquetas';
import LinhaLista from '@/components/comum/LinhaLista';
import GrupoLista, { ListaLinhas } from '@/components/comum/GrupoLista';
import FolhaDetalhes from '@/components/comum/FolhaDetalhes';
import { formatarMoeda } from '@/components/comum/formatos';
import { tomDoStatus } from '@/components/comum/cores';
import { useEhCompacto } from '@/hooks/useMidia';
import AbasRolaveis from '@/components/comum/AbasRolaveis';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
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
    urgency?: { level: 'overdue' | 'critical' | 'warning' | 'normal', message: string }
};

const fetchAssignedReservations = async (userId: string) => {
    const { data, error } = await supabase.rpc('fn_get_cleaner_reservations', { cleaner_id: userId });
    if (error) { console.error("Erro ao buscar reservas da função RPC:", error); throw error; }
    return (data || []).map(r => ({...r, properties: typeof r.properties === 'string' ? JSON.parse(r.properties) : r.properties}));
};

const fetchAvailableReservations = async (userId: string) => {
    const { data, error } = await supabase.rpc('fn_get_available_reservations', { cleaner_id: userId });
    if (error) { console.error("Erro ao buscar oportunidades da função RPC:", error); throw error; }
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

    const signUpMutation = useMutation({
        mutationFn: async (reservationId: string): Promise<void> => {
            if (!user) throw new Error("Usuário não autenticado");
            const { error } = await supabase.rpc('assign_cleaning_with_permissions' as any, {
                reservation_id: reservationId,
                cleaner_id: user.id
            });
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Sucesso!", description: "Você assinou esta faxina. Ela foi movida para 'Próximas'." });
            queryClient.invalidateQueries({ queryKey: assignedKey });
            queryClient.invalidateQueries({ queryKey: availableKey });
        },
        onError: (error: any) => {
            let errorMessage = "Não foi possível assinar a faxina.";
            if (error.message.includes('REGRA_VIOLADA')) {
                errorMessage = "Você já possui uma faxina em andamento.";
            } else if (error.message.includes('FALHA_UPDATE')) {
                errorMessage = "Esta oportunidade já foi assinada por outra pessoa.";
            }
            toast({ title: "Ação não permitida", description: errorMessage, variant: "destructive" });
        }
    });

    const markCompleteMutation = useMutation({
        mutationFn: async (reservationId: string): Promise<void> => {
            const { error } = await supabase.from('reservations').update({ cleaning_status: 'Realizada' }).eq('id', reservationId);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Sucesso!", description: "Faxina marcada como concluída e movida para o histórico." });
            queryClient.invalidateQueries({ queryKey: assignedKey });
        },
        onError: (error: any) => {
             toast({ title: "Erro", description: error.message || "Não foi possível atualizar o status.", variant: "destructive" });
        }
    });

    const handleSignUpForCleaning = (reservationId: string) => {
        signUpMutation.mutate(reservationId);
    };

    const handleMarkAsComplete = (reservationId: string) => {
        const confirmed = window.confirm("Tem certeza que deseja marcar esta faxina como 'Realizada'?\n\nEsta ação moverá o card para o seu histórico e não poderá ser desfeita facilmente.");
        if (confirmed) {
            markCompleteMutation.mutate(reservationId);
        }
    };

    if (isLoadingAssigned || isLoadingAvailable) {
        return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between gap-3">
                {/* Seções da faxineira: pílulas que rolam de lado no celular */}
                <nav className="no-scrollbar -mx-1 flex flex-1 gap-1 overflow-x-auto rounded-full bg-muted p-1 sm:flex-none">
                    {([['dashboard', 'Faxinas'], ['ganhos', 'Meus Ganhos'], ['configuracao', 'Minha conta']] as const).map(([valor, rotulo]) => (
                        <button
                            key={valor}
                            type="button"
                            onClick={() => setActiveTab(valor)}
                            aria-current={activeTab === valor ? 'page' : undefined}
                            className={`min-h-10 flex-1 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors sm:flex-none ${activeTab === valor ? 'bg-background text-ink shadow-sm' : 'text-gray-600'}`}
                        >
                            {rotulo}
                        </button>
                    ))}
                </nav>
                {/* No celular o Sair fica na barra de cima */}
                <Button variant="outline" size="sm" onClick={signOut} className="hidden lg:inline-flex"><LogOut className="h-4 w-4 mr-2" />Sair</Button>
            </header>
            
            <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
                <div className="max-lg:sr-only">
                    <h1 className="font-display text-2xl font-extrabold text-ink">Minhas Faxinas</h1>
                    <p className="text-muted-foreground">Visualize e gerencie as limpezas designadas para você.</p>
                </div>
                <Tabs defaultValue="proximas" className="w-full mt-4 max-lg:mt-0">
                    <AbasRolaveis
                        rotulo="Minhas faxinas"
                        itens={[
                            { valor: 'proximas', rotulo: 'Próximas', contagem: upcomingReservations.length },
                            { valor: 'oportunidades', rotulo: 'Oportunidades', contagem: availableReservations.length },
                            { valor: 'historico', rotulo: 'Histórico', contagem: pastReservations.length },
                        ]}
                    />
                    <TabsContent value="proximas"><UpcomingList reservations={upcomingReservations} onMarkAsComplete={handleMarkAsComplete} /></TabsContent>
                    <TabsContent value="oportunidades"><AvailableCleaningsList reservations={availableReservations} onSignUp={handleSignUpForCleaning} hasActiveCleaning={hasActiveCleaning} /></TabsContent>
                    <TabsContent value="historico"><HistoryList reservations={pastReservations} /></TabsContent>
                </Tabs>
            </div>
            
            <div style={{ display: activeTab === 'ganhos' ? 'block' : 'none' }}>
                 <MeusGanhosPage historicalData={pastReservations} />
            </div>
            
            <div style={{ display: activeTab === 'configuracao' ? 'block' : 'none' }}>
                 <div className="max-lg:sr-only">
                     <h1 className="font-display text-2xl font-extrabold text-ink">Configuração da Conta</h1>
                     <p className="text-muted-foreground mb-6">Altere seus dados pessoais e de segurança.</p>
                 </div>
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
                 <Card className="mt-6 border-danger-500">
                    <CardHeader><CardTitle className="text-danger-700">Zona de Perigo</CardTitle></CardHeader>
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
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                 <div className="max-lg:sr-only"><h1 className="font-display text-2xl font-extrabold text-ink">Meus Ganhos</h1><p className="text-muted-foreground">Acompanhe seus recebimentos por ciclo.</p></div>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="h-11 w-full capitalize sm:w-[200px]"><SelectValue placeholder="Selecione o Mês" /></SelectTrigger>
                    <SelectContent>
                        {availableMonths.map(month => (
                             <SelectItem key={month} value={month}>{format(parseISO(`${month}-02`), 'MMMM / yyyy', { locale: ptBR })}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2 md:gap-6">
                <Card className="border-success-500 bg-success-50"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-success-800">Recebido neste Ciclo (Pago)</CardTitle><DollarSign className="h-4 w-4 text-success-700" /></CardHeader><CardContent><div className="font-mono text-2xl font-semibold tabular-nums text-success-700">R$ {monthData.pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div><p className="text-xs text-success-600">Valores de faxinas (ex: Airbnb) já recebidos.</p></CardContent></Card>
                <Card className="border-orange-500 bg-orange-50"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-orange-800">A receber no Próximo Ciclo</CardTitle><Clock className="h-4 w-4 text-orange-700" /></CardHeader><CardContent><div className="font-mono text-2xl font-semibold tabular-nums text-orange-700">R$ {monthData.proximoCiclo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div><p className="text-xs text-orange-600">Valores (ex: Booking) que serão pagos até o 5º dia útil do próximo mês.</p></CardContent></Card>
            </div>
        </div>
    );
};

const getStatusVariant = (status: string | null): 'default' | 'destructive' | 'secondary' | 'outline' => {
    switch (status) { case 'Confirmada': return 'default'; case 'Cancelada': return 'destructive'; case 'Finalizada': return 'secondary'; default: return 'outline'; }
};

/** Data e hora da saída do hóspede; sem horário cadastrado, o começo do dia da saída */
const saidaDoHospede = (r: { check_out_date: string; checkout_time?: string | null }) =>
    parseISO(r.checkout_time ? `${r.check_out_date}T${r.checkout_time}` : r.check_out_date);

/** Janela de trabalho da faxina: da saída do hóspede até a próxima entrada */
const janelaDeTrabalho = (reservation: ReservationWithDetails) => {
    const now = new Date();
    const checkoutDateTime = saidaDoHospede(reservation);
    const hasCheckoutPassed = isPast(checkoutDateTime);
    let startLabel = "INÍCIO DA JANELA (SAÍDA)";
    // Sem horário de saída cadastrado, mostra só o dia (antes a tela quebrava com "Invalid time value")
    let startValue = format(checkoutDateTime, reservation.checkout_time ? "dd/MM 'às' HH:mm" : 'dd/MM', { locale: ptBR });
    const endLabel = "FIM DA JANELA";
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
};

const UpcomingCard = ({ reservation, children }: { reservation: ReservationWithDetails, children?: React.ReactNode }) => {
    const workWindowInfo = useMemo(() => janelaDeTrabalho(reservation),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [reservation.check_out_date, reservation.checkout_time, reservation.next_check_in_date, reservation.next_checkin_time]);
    
    const urgencyClasses = { overdue: 'border-2 border-danger-500 bg-danger-50', critical: 'border-2 border-danger-500 bg-danger-50', warning: 'border-2 border-warning-500 bg-warning-50', normal: '' };

    return (
        <Card className={`hover:shadow-md transition-shadow ${urgencyClasses[reservation.urgency?.level || 'normal']}`}>
            <CardHeader className="pb-3 space-y-2">
                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                    <div>
                        <CardTitle className="text-lg">{reservation.properties?.name || 'Propriedade'}</CardTitle>
                        {reservation.properties?.address ? (
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(reservation.properties.address)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1.5 flex min-h-11 items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-[15px] font-medium text-brand-800"
                            >
                                <MapPin className="h-5 w-5 flex-shrink-0 text-brand" />
                                <span className="flex-1">{reservation.properties.address}</span>
                                <span className="text-xs font-semibold text-brand">Mapa</span>
                            </a>
                        ) : (
                            <p className="text-sm text-muted-foreground flex items-center mt-1"><MapPin className="h-4 w-4 mr-1.5 flex-shrink-0" />Endereço não informado</p>
                        )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        <EtiquetaStatus status={reservation.reservation_status} />
                        <EtiquetaStatus status={reservation.cleaning_payment_status} />
                    </div>
                </div>
               {reservation.urgency?.level !== 'normal' && (
                   <div className={`flex items-center gap-2 font-bold text-sm p-2 rounded-md ${reservation.urgency?.level === 'warning' ? 'bg-warning-100 text-warning-800' : 'bg-danger-100 text-danger-700'}`}>
                       <AlertTriangle className="h-4 w-4" />
                       <span>{reservation.urgency.message}</span>
                   </div>
               )}
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Horário em destaque */}
                <div className="grid gap-3 rounded-2xl bg-surface p-3 sm:grid-cols-2">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{workWindowInfo.startLabel}</p>
                        <p className="font-mono text-2xl font-semibold tabular-nums text-brand-700">{workWindowInfo.startValue}</p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{workWindowInfo.endLabel}</p>
                        <p className="text-base font-semibold text-ink">{workWindowInfo.endValue}</p>
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
                        <EtiquetaStatus status={reservation.reservation_status} />
                        <EtiquetaStatus status={reservation.cleaning_payment_status} />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid md:grid-cols-2 gap-x-4 gap-y-2 text-sm pt-4">
                    <p><span className="font-medium">Data da Faxina:</span> {format(parseISO(reservation.check_out_date), "dd/MM/yyyy")}</p>
                    <p><span className="font-medium">Sua Taxa:</span> <span className="font-mono text-success-600 font-semibold tabular-nums">R$ {parseFloat(String(reservation.cleaning_fee || 0)).toFixed(2)}</span></p>
                    {reservation.cleaning_rating > 0 && (<p className="flex items-center"><Star className="h-4 w-4 mr-1.5 text-warning-500" />Sua Avaliação: {reservation.cleaning_rating}/5</p>)}
                </div>
            </CardContent>
        </Card>
    );
};

/* ── Celular (abaixo de 1024px): linhas no lugar dos cartões altos, endereço e
   horário em destaque e botões grandes para aceitar e concluir ────────────── */
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** "Qua 25 nov, 11:00" */
const quandoSaida = (r: ReservationWithDetails) => {
    const d = parseISO(r.check_out_date);
    return `${DIAS_CURTOS[d.getDay()]} ${format(d, 'd MMM', { locale: ptBR })}${r.checkout_time ? `, ${String(r.checkout_time).slice(0, 5)}` : ''}`;
};
const taxaDaFaxina = (r: ReservationWithDetails) => formatarMoeda(Number(r.cleaning_fee || 0));
const ICONE_URGENCIA = { overdue: AlertTriangle, critical: AlertTriangle, warning: Clock, normal: Calendar } as const;
const TOM_URGENCIA = { overdue: 'danger', critical: 'danger', warning: 'warning', normal: 'brand' } as const;

/** Endereço (abre o mapa), janela de trabalho em destaque e os dados da faxina */
const DetalhesFaxinaCelular = ({ reservation }: { reservation: ReservationWithDetails }) => {
    const janela = janelaDeTrabalho(reservation);
    const nivel = reservation.urgency?.level || 'normal';
    return (
        <div className="grid gap-3">
            {nivel !== 'normal' && (
                <p className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${nivel === 'warning' ? 'bg-warning-100 text-warning-800' : 'bg-danger-100 text-danger-700'}`}>
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {reservation.urgency?.message}
                </p>
            )}
            {reservation.properties?.address ? (
                <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(reservation.properties.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-12 items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-[15px] font-medium text-brand-800"
                >
                    <MapPin className="h-5 w-5 shrink-0 text-brand" />
                    <span className="min-w-0 flex-1">{reservation.properties.address}</span>
                    <span className="text-xs font-semibold text-brand">Mapa</span>
                </a>
            ) : (
                <p className="flex items-center gap-1.5 text-sm text-gray-500"><MapPin className="h-4 w-4 shrink-0" />Endereço não informado</p>
            )}
            <div className="grid gap-2 rounded-2xl bg-surface p-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{janela.startLabel}</p>
                    <p className="font-mono text-[28px] font-semibold leading-tight tabular-nums text-brand-700">{janela.startValue}</p>
                </div>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{janela.endLabel}</p>
                    <p className="text-base font-semibold text-ink">{janela.endValue}</p>
                </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="min-w-0"><dt className="text-xs text-gray-500">Sua taxa</dt><dd className="font-mono font-semibold tabular-nums text-success-700">{taxaDaFaxina(reservation)}</dd></div>
                {reservation.number_of_guests ? <div className="min-w-0"><dt className="text-xs text-gray-500">Hóspedes</dt><dd className="font-semibold text-gray-900">{reservation.number_of_guests}</dd></div> : null}
                {reservation.guest_name ? <div className="col-span-2 min-w-0"><dt className="text-xs text-gray-500">Hóspede anterior</dt><dd className="truncate font-semibold text-gray-900">{reservation.guest_name}</dd></div> : null}
            </dl>
            {reservation.cleaning_notes && (
                <p className="rounded-xl bg-gray-50 p-3 text-sm"><span className="font-semibold">Observações:</span> <span className="text-gray-600">{reservation.cleaning_notes}</span></p>
            )}
        </div>
    );
};

/** Botão grande de concluir (só depois da saída do hóspede) */
const BotaoConcluir = ({ reservation, onMarkAsComplete }: { reservation: ReservationWithDetails, onMarkAsComplete: (id: string) => void }) => {
    const liberado = isPast(saidaDoHospede(reservation));
    return (
        <div className="grid gap-1.5">
            <Button size="lg" className="h-12 w-full text-base" onClick={() => onMarkAsComplete(reservation.id)} disabled={!liberado}>
                <CheckCircle className="mr-2 h-5 w-5" />Marcar como concluída
            </Button>
            {!liberado && <p className="text-center text-xs text-gray-500">Libera depois do check-out do hóspede.</p>}
        </div>
    );
};

const ProximasCelular = ({ reservations, onMarkAsComplete }: { reservations: ReservationWithDetails[], onMarkAsComplete: (id: string) => void }) => {
    const [selId, setSelId] = useState<string | null>(null);
    const sel = reservations.find((r) => r.id === selId) ?? null;
    const [primeira, ...demais] = reservations;
    return (
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3">
            <section className="rounded-2xl border bg-card p-3.5 shadow-sm">
                <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
                    <h2 className="min-w-0 truncate font-display text-base font-bold text-gray-900">{primeira.properties?.name || 'Propriedade'}</h2>
                    <EtiquetaStatus status={primeira.cleaning_payment_status} />
                </div>
                <DetalhesFaxinaCelular reservation={primeira} />
                <div className="mt-3"><BotaoConcluir reservation={primeira} onMarkAsComplete={onMarkAsComplete} /></div>
            </section>
            {demais.length > 0 && (
                <GrupoLista titulo={<span className="normal-case">Depois desta</span>} resumo={`${demais.length} ${demais.length === 1 ? 'faxina' : 'faxinas'}`}>
                    {demais.map((r) => (
                        <LinhaLista
                            key={r.id}
                            icone={ICONE_URGENCIA[r.urgency?.level || 'normal']}
                            tomIcone={TOM_URGENCIA[r.urgency?.level || 'normal']}
                            titulo={r.properties?.name || 'Propriedade'}
                            subtitulo={`Saída ${quandoSaida(r)}`}
                            valor={taxaDaFaxina(r)}
                            aoTocar={() => setSelId(r.id)}
                        />
                    ))}
                </GrupoLista>
            )}
            <FolhaDetalhes
                aberta={!!sel}
                aoMudar={(v) => !v && setSelId(null)}
                titulo={sel?.properties?.name || 'Faxina'}
                etiqueta={sel ? <EtiquetaStatus status={sel.cleaning_payment_status} /> : undefined}
                subtitulo={sel ? `Saída ${quandoSaida(sel)}` : undefined}
            >
                {sel && (<><DetalhesFaxinaCelular reservation={sel} /><BotaoConcluir reservation={sel} onMarkAsComplete={(id) => { onMarkAsComplete(id); setSelId(null); }} /></>)}
            </FolhaDetalhes>
        </div>
    );
};

const OportunidadesCelular = ({ reservations, onSignUp, hasActiveCleaning }: { reservations: ReservationWithDetails[], onSignUp: (id: string) => void, hasActiveCleaning: boolean }) => {
    const [selId, setSelId] = useState<string | null>(null);
    const sel = reservations.find((r) => r.id === selId) ?? null;
    const podeAceitar = (r: ReservationWithDetails) => !hasActiveCleaning || r.urgency?.level === 'critical' || r.urgency?.level === 'overdue';
    return (
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3">
            {hasActiveCleaning && <p className="px-1 text-xs text-gray-500">Você já tem uma faxina em andamento. Conclua-a para aceitar outras; as urgentes ficam liberadas.</p>}
            <div className="rounded-2xl border bg-card px-3.5 py-1 shadow-sm">
                <ListaLinhas>
                    {reservations.map((r) => (
                        <LinhaLista
                            key={r.id}
                            icone={ICONE_URGENCIA[r.urgency?.level || 'normal']}
                            tomIcone={TOM_URGENCIA[r.urgency?.level || 'normal']}
                            titulo={r.properties?.name || 'Propriedade'}
                            subtitulo={`${quandoSaida(r)} · ${taxaDaFaxina(r)}`}
                            aoTocar={() => setSelId(r.id)}
                            acao={
                                <Button className="h-11 rounded-full px-4 text-sm font-semibold" onClick={() => onSignUp(r.id)} disabled={!podeAceitar(r)}>
                                    Aceitar
                                </Button>
                            }
                        />
                    ))}
                </ListaLinhas>
            </div>
            <FolhaDetalhes
                aberta={!!sel}
                aoMudar={(v) => !v && setSelId(null)}
                titulo={sel?.properties?.name || 'Faxina'}
                subtitulo={sel ? `Saída ${quandoSaida(sel)}` : undefined}
            >
                {sel && (
                    <>
                        <DetalhesFaxinaCelular reservation={sel} />
                        <Button size="lg" className="h-12 w-full text-base" onClick={() => { onSignUp(sel.id); setSelId(null); }} disabled={!podeAceitar(sel)}>
                            <Hand className="mr-2 h-5 w-5" />Aceitar faxina
                        </Button>
                    </>
                )}
            </FolhaDetalhes>
        </div>
    );
};

const UpcomingList = ({ reservations, onMarkAsComplete }: { reservations: ReservationWithDetails[], onMarkAsComplete: (id: string) => void }) => {
    const compacto = useEhCompacto();
    if (reservations.length > 0 && compacto) return <ProximasCelular reservations={reservations} onMarkAsComplete={onMarkAsComplete} />;
    if (reservations.length === 0) { return <Card className="mt-4"><CardContent className="pt-6 text-center text-muted-foreground"><Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" /><p>Nenhuma reserva encontrada</p><p className="text-sm">Você não possui faxinas futuras agendadas.</p></CardContent></Card>; }
    return (
        <div className="grid gap-4 mt-4">
            {reservations.map(reservation => {
                const checkoutDateTime = saidaDoHospede(reservation);
                const canMarkAsComplete = isPast(checkoutDateTime);
                return (
                    <UpcomingCard key={reservation.id} reservation={reservation}>
                        <div className="grid md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            {reservation.guest_name && (<p><span className="font-medium">Hóspede Anterior:</span> {reservation.guest_name}</p>)}
                            {reservation.number_of_guests && (<p className="flex items-center"><Users className="h-4 w-4 mr-1.5" />{reservation.number_of_guests} Hóspedes</p>)}
                            {reservation.cleaning_fee && (<p><span className="font-medium">Sua Taxa:</span> <span className="font-mono text-success-600 font-semibold tabular-nums">R$ {parseFloat(String(reservation.cleaning_fee)).toFixed(2)}</span></p>)}
                            {reservation.cleaning_rating > 0 && (<p className="flex items-center"><Star className="h-4 w-4 mr-1.5 text-warning-500" />Sua Avaliação: {reservation.cleaning_rating}/5</p>)}
                        </div>
                        {reservation.cleaning_notes && (<div className="pt-2 border-t"><p className="text-sm"><span className="font-medium">Observações:</span> <span className="text-muted-foreground">{reservation.cleaning_notes}</span></p></div>)}
                        {reservation.cleaning_status !== 'Realizada' && (
                            <div className="pt-4 border-t flex flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
                                {!canMarkAsComplete && <p className="text-xs text-muted-foreground sm:hidden">Libera depois do check-out do hóspede.</p>}
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span tabIndex={0} className="block"><Button size="lg" className="w-full sm:h-10 sm:w-auto" onClick={() => onMarkAsComplete(reservation.id)} disabled={!canMarkAsComplete}><CheckCircle className="h-4 w-4 mr-2" />Marcar como Concluída</Button></span>
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
    const compacto = useEhCompacto();
    if (reservations.length > 0 && compacto) return <OportunidadesCelular reservations={reservations} onSignUp={onSignUp} hasActiveCleaning={hasActiveCleaning} />;
    if (reservations.length === 0) { return <Card className="mt-4"><CardContent className="pt-6 text-center text-muted-foreground"><CheckCircle className="mx-auto h-12 w-12 mb-4 opacity-50 text-success-500" /><p>Nenhuma oportunidade no momento</p><p className="text-sm">Não há faxinas disponíveis nas suas propriedades para as próximas duas semanas.</p></CardContent></Card>; }
    return (
        <div className="grid gap-4 mt-4">
            {reservations.map(reservation => {
                const canSignUp = !hasActiveCleaning || reservation.urgency?.level === 'critical' || reservation.urgency?.level === 'overdue';
                return (
                    <UpcomingCard key={reservation.id} reservation={reservation}>
                         <div className="flex flex-col gap-3 rounded-2xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-medium">Sua Taxa</p>
                                <p className="font-mono text-xl font-semibold tabular-nums text-success-600">R$ {parseFloat(String(reservation.cleaning_fee || 0)).toFixed(2)}</p>
                            </div>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span tabIndex={0} className="block">
                                            <Button size="lg" className="w-full sm:h-10 sm:w-auto" onClick={() => onSignUp(reservation.id)} disabled={!canSignUp}><Hand className="h-4 w-4 mr-2" />Assinar Faxina</Button>
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
    const compacto = useEhCompacto();
    // Abre no mês atual; sem faxinas nele, no mês mais recente do histórico (antes o seletor ficava em branco)
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const atual = format(new Date(), 'yyyy-MM');
        const meses = reservations.map(r => format(parseISO(r.check_out_date), 'yyyy-MM')).sort();
        return meses.length === 0 || meses.includes(atual) ? atual : meses[meses.length - 1];
    });
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
                    <SelectTrigger className="h-11 w-full capitalize sm:w-[200px]"><SelectValue placeholder="Filtrar por Mês" /></SelectTrigger>
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
                compacto ? (
                    <div className="rounded-2xl border bg-card px-3.5 py-1 shadow-sm">
                        <ListaLinhas>
                            {filteredReservations.map(r => (
                                <LinhaLista
                                    key={r.id}
                                    icone={CheckCircle}
                                    tomIcone="success"
                                    titulo={r.properties?.name || 'Propriedade'}
                                    subtitulo={`${format(parseISO(r.check_out_date), 'dd/MM/yyyy')}${r.cleaning_rating > 0 ? ` · avaliação ${r.cleaning_rating}/5` : ''}`}
                                    valor={taxaDaFaxina(r)}
                                    legenda={(r.cleaning_payment_status || 'Pendente').replace(/pagamento no pr[oó]ximo ciclo/i, 'Próx. ciclo')}
                                    tomLegenda={tomDoStatus(r.cleaning_payment_status)}
                                />
                            ))}
                        </ListaLinhas>
                    </div>
                ) : (
                <div className="grid gap-4">
                    {filteredReservations.map(reservation => (
                        <HistoryCard key={reservation.id} reservation={reservation} />
                    ))}
                </div>
                )
            )}
        </div>
    );
};

export default FaxineiraDashboard;
