import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useDateRange } from '@/hooks/dashboard/useDateRange';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Edit, Trash2, Plus, Search, Loader2, AlertTriangle, MessageCircle, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import ReservationForm from '@/components/reservations/ReservationForm';
import StatusSelector from '@/components/reservations/StatusSelector';
import { supabase } from '@/integrations/supabase/client';
import { Reservation } from '@/types/reservation';
import { Property } from '@/types/property';
import { useToast } from '@/hooks/use-toast';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

const formatDate = (dateString: string | null): string => {
    if (!dateString) return '';
    const date = new Date(`${dateString}T00:00:00`);
    return format(date, 'dd/MM/yyyy');
};

const formatTime = (timeString: string | null): string => {
    if (!timeString) return '';
    return timeString.slice(0, 5);
};

const calculateNights = (checkIn: string, checkOut: string): number => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = end.getTime() - start.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const fetchReservationsAndProperties = async (getAccessibleProperties: () => string[], hasPermission: (p: any) => boolean, selectedPeriod: string, startDateString: string, endDateString: string) => {
    const accessibleProperties = getAccessibleProperties();
    const hasFullAccess = hasPermission('reservations_view_all');
    
    let query = supabase
        .from('reservations')
        .select('*, properties!inner(*)')
        .order('check_in_date', { ascending: false });

    if (selectedPeriod !== 'general') {
        query = query
            .lte('check_in_date', endDateString)
            .gte('check_out_date', startDateString);
    }
    
    if (!hasFullAccess && accessibleProperties.length > 0) {
        query = query.in('property_id', accessibleProperties);
    }
    
    const { data, error } = await query;
    if (error) {
        console.error("Erro na busca de reservas:", error);
        throw error;
    }
    
    const propertiesMap = new Map();
    const normalizedReservations = (data || []).map(res => {
        const { properties, ...reservationData } = res;
        if (properties) {
            propertiesMap.set(properties.id, properties);
        }
        return {
            ...reservationData,
            property_id: properties?.id,
            properties: properties
        };
    });

    // Buscar nomes das faxineiras separadamente
    const cleanerIds = [...new Set(
        normalizedReservations
            .filter(r => r.cleaner_user_id)
            .map(r => r.cleaner_user_id)
    )] as string[];
    
    let cleanerMap = new Map<string, string>();
    
    if (cleanerIds.length > 0) {
        const { data: cleaners } = await supabase
            .from('user_profiles')
            .select('user_id, full_name')
            .in('user_id', cleanerIds);
        
        cleanerMap = new Map(cleaners?.map(c => [c.user_id as string, c.full_name || '']) || []);
    }

    return { reservations: normalizedReservations, properties: Array.from(propertiesMap.values()), cleanerMap };
};

const ReservasPage = () => {
    const [showForm, setShowForm] = useState(false);
    const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('all');
    const [activeTab, setActiveTab] = useState('cashflow');
    const { toast } = useToast();
    const { hasPermission, getAccessibleProperties, loading: permissionsLoading } = useUserPermissions();
    const { selectedProperties, selectedPeriod, selectedPlatform, customStartDate, customEndDate } = useGlobalFilters();
    const { startDateString, endDateString } = useDateRange(selectedPeriod, customStartDate, customEndDate);
    const queryClient = useQueryClient();

    // LOG: Verificando o estado a cada renderização
    console.log("--- COMPONENTE RENDERIZADO ---");
    console.log("Estado 'showForm':", showForm);
    console.log("Reserva em edição:", editingReservation ? editingReservation.id : null);

    const queryKey = useMemo(() => ['reservations', selectedPeriod, startDateString, endDateString, selectedProperties, selectedPlatform, selectedPaymentStatus], 
        [selectedPeriod, startDateString, endDateString, selectedProperties, selectedPlatform, selectedPaymentStatus]);

    const { data, isLoading: dataLoading } = useQuery({
        queryKey: queryKey,
        queryFn: () => fetchReservationsAndProperties(getAccessibleProperties, hasPermission, selectedPeriod, startDateString, endDateString),
        enabled: !permissionsLoading,
        staleTime: 10000,
        refetchOnWindowFocus: true,
    });

    const reservations = data?.reservations || [];
    const properties = data?.properties || [];
    const cleanerMap = data?.cleanerMap || new Map<string, string>();

    const handleDelete = async (reservationId: string): Promise<void> => {
        try {
            const { error } = await supabase.from('reservations').delete().eq('id', reservationId);
            if (error) throw error;
            toast({ title: "Sucesso", description: "Reserva excluída com sucesso." });
            await queryClient.invalidateQueries({ queryKey });
        } catch (error: any) {
            toast({ title: "Erro", description: error.message || "Não foi possível excluir a reserva.", variant: "destructive" });
        }
    };

    const handleCheckboxChange = async (reservationId: string, field: 'is_communicated' | 'receipt_sent', value: boolean) => {
        queryClient.setQueryData(queryKey, (oldData: any) => ({
            ...oldData,
            reservations: oldData.reservations.map(r => r.id === reservationId ? { ...r, [field]: value } : r),
        }));

        try {
            const { error } = await supabase.from('reservations').update({ [field]: value }).eq('id', reservationId);
            if (error) throw error;
            const fieldName = field === 'is_communicated' ? 'comunicação' : 'recibo';
            toast({ title: "Sucesso", description: `Status de ${fieldName} atualizado.` });
        } catch (error) {
            toast({ title: "Erro", description: `Falha ao atualizar status.`, variant: "destructive" });
            queryClient.invalidateQueries({ queryKey });
        }
    };

    // LOG: Adicionando logs detalhados à função handleEdit
    const handleEdit = (reservation: Reservation) => {
        console.log("--- PASSO 2: Função handleEdit EXECUTADA ---");
        console.log("Definindo 'editingReservation' para:", reservation);
        setEditingReservation(reservation);
        console.log("Definindo 'showForm' para: true");
        setShowForm(true);
    };

    const handleFormSuccess = () => {
        setShowForm(false);
        setEditingReservation(null);
        queryClient.invalidateQueries({ queryKey });
    };

    // Separar reservas por tipo de competência
    const reservationsByCompetence = useMemo(() => {
        const active: any[] = [];
        const cashflow: any[] = [];
        const received: any[] = [];
        const future: any[] = [];
        
        reservations.forEach((reservation: any) => {
            const property = reservation.properties;
            const lowerSearchTerm = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm || 
                reservation.reservation_code.toLowerCase().includes(lowerSearchTerm) ||
                (reservation.guest_name && reservation.guest_name.toLowerCase().includes(lowerSearchTerm)) ||
                (property && (property.name.toLowerCase().includes(lowerSearchTerm) || 
                               (property.nickname && property.nickname.toLowerCase().includes(lowerSearchTerm))));
            
            const matchesProperty = selectedProperties.includes('todas') || 
                (reservation.property_id && selectedProperties.includes(reservation.property_id));
            const matchesStatus = selectedStatus === 'all' || reservation.reservation_status === selectedStatus;
            const matchesPlatform = selectedPlatform === 'all' || reservation.platform === selectedPlatform;
            const matchesPaymentStatus = selectedPaymentStatus === 'all' || reservation.payment_status === selectedPaymentStatus;
            
            if (!matchesSearch || !matchesProperty || !matchesStatus || !matchesPlatform || !matchesPaymentStatus) {
                return;
            }
            
            // Ativas no Período: reservas que ocupam o período
            const checkIn = new Date(reservation.check_in_date);
            const checkOut = new Date(reservation.check_out_date);
            const periodStart = new Date(startDateString);
            const periodEnd = new Date(endDateString);
            
            if (checkIn <= periodEnd && checkOut >= periodStart) {
                active.push(reservation);
            }
            
            // Caixa do Período: receitas geradas no período (Airbnb + Direto recebidas + Booking futuras)
            const paymentDate = reservation.payment_date ? new Date(reservation.payment_date) : null;
            const isAirbnbReceived = reservation.platform === 'Airbnb' && paymentDate && paymentDate >= periodStart && paymentDate <= periodEnd;
            const isDiretoReceived = reservation.platform === 'Direto' && paymentDate && paymentDate >= periodStart && paymentDate <= periodEnd;
            const isBookingGenerated = reservation.platform === 'Booking.com' && checkOut >= periodStart && checkOut <= periodEnd;
            
            if (isAirbnbReceived || isDiretoReceived || isBookingGenerated) {
                cashflow.push(reservation);
            }
            
            // Receitas Recebidas (Airbnb e Direto): payment_date dentro do período, excluindo Booking
            if (reservation.payment_date && reservation.platform !== 'Booking.com') {
                const paymentDate = new Date(reservation.payment_date);
                if (paymentDate >= periodStart && paymentDate <= periodEnd) {
                    received.push(reservation);
                }
            }
            
            // Receitas Futuras: Booking.com com checkout no período mas payment_date fora
            if (reservation.platform === 'Booking.com' && checkOut >= periodStart && checkOut <= periodEnd) {
                if (!reservation.payment_date || new Date(reservation.payment_date) > periodEnd) {
                    future.push(reservation);
                }
            }
        });
        
        return { active, cashflow, received, future };
    }, [reservations, searchTerm, selectedProperties, selectedStatus, selectedPlatform, selectedPaymentStatus, startDateString, endDateString]);

    const filteredReservations = useMemo(() => {
        if (activeTab === 'active') return reservationsByCompetence.active;
        if (activeTab === 'cashflow') return reservationsByCompetence.cashflow;
        if (activeTab === 'received') return reservationsByCompetence.received;
        if (activeTab === 'future') return reservationsByCompetence.future;
        return [];
    }, [activeTab, reservationsByCompetence]);

    const totals = useMemo(() => filteredReservations.reduce((acc, reservation) => {
        acc.count += 1;
        acc.totalRevenue += reservation.total_revenue || 0;
        acc.netRevenue += reservation.net_revenue || 0;
        
        // Separar receitas recebidas vs futuras (para aba Caixa)
        if (activeTab === 'cashflow') {
            if (reservation.platform === 'Booking.com' && 
                (!reservation.payment_date || new Date(reservation.payment_date) > new Date(endDateString))) {
                acc.futureNetRevenue += reservation.net_revenue || 0;
            } else {
                acc.receivedNetRevenue += reservation.net_revenue || 0;
            }
        }
        
        if (reservation.payment_status === 'Pago') acc.paidCount += 1;
        else acc.pendingCount += 1;
        
        if (reservation.platform === 'Airbnb') acc.airbnbCount += 1;
        else if (reservation.platform === 'Booking.com') acc.bookingCount += 1;
        else acc.diretoCount += 1;
        
        return acc;
    }, { 
        count: 0, 
        totalRevenue: 0, 
        netRevenue: 0, 
        receivedNetRevenue: 0, 
        futureNetRevenue: 0, 
        paidCount: 0, 
        pendingCount: 0, 
        airbnbCount: 0, 
        bookingCount: 0, 
        diretoCount: 0 
    }), [filteredReservations, activeTab, endDateString]);

    const totalLoading = dataLoading || permissionsLoading;

    if (totalLoading && !data) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    const canViewReservations = hasPermission('reservations_view_all') || hasPermission('reservations_view_assigned');
    const canCreateReservations = hasPermission('reservations_create');
    const canEditReservations = hasPermission('reservations_edit');
    const canDeleteReservations = hasPermission('reservations_delete');

    if (!canViewReservations) {
        return (
            <div className="p-6">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>Você não tem permissão para visualizar reservas.</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Reservas</h1>
                        <p className="text-gray-600 mt-1">Gerencie suas reservas e acompanhe o status</p>
                    </div>
                    {canCreateReservations && (
                        <Button onClick={() => { setEditingReservation(null); setShowForm(true); }} className="bg-blue-600 hover:bg-blue-700 text-white">
                            <Plus className="mr-2 h-4 w-4" />
                            Adicionar Nova Reserva
                        </Button>
                    )}
                </div>

                <Card className="mb-6">
                    <CardContent className="pt-6">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Buscar por código, hóspede ou propriedade..."
                                    className="pl-10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Status da reserva" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os status</SelectItem>
                                    <SelectItem value="Confirmada">Confirmada</SelectItem>
                                    <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                                    <SelectItem value="Finalizada">Finalizada</SelectItem>
                                    <SelectItem value="Cancelada">Cancelada</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={selectedPaymentStatus} onValueChange={setSelectedPaymentStatus}>
                                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Status do pagamento" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os status de pagamento</SelectItem>
                                    <SelectItem value="Pago">Pago</SelectItem>
                                    <SelectItem value="Pendente">Pendente</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                <TooltipProvider delayDuration={200}>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-4 mb-4">
                        <TabsTrigger value="cashflow">
                            <div className="flex items-center gap-1.5">
                                <span>Receita Gerada no Período</span>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" align="center" className="max-w-lg whitespace-normal" sideOffset={8}>
                                        <p className="text-sm">Representa a receita efetivamente gerada no período selecionado: inclui Airbnb e Direto já recebidos + Booking.com com check-out no período (mesmo que o pagamento seja futuro). Este é o caixa real do mês.</p>
                                    </TooltipContent>
                                </Tooltip>
                                <Badge variant="secondary" className="ml-1">{reservationsByCompetence.cashflow.length}</Badge>
                            </div>
                        </TabsTrigger>
                        <TabsTrigger value="received">
                            <div className="flex items-center gap-1.5">
                                <span>Receber no Período (Airbnb e Direto)</span>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" align="center" className="max-w-lg whitespace-normal" sideOffset={8}>
                                        <p className="text-sm">Mostra reservas do Airbnb e Direto cujo pagamento foi efetivamente recebido dentro do período selecionado. Exclui Booking.com que paga no mês seguinte ao check-out.</p>
                                    </TooltipContent>
                                </Tooltip>
                                <Badge variant="secondary" className="ml-1">{reservationsByCompetence.received.length}</Badge>
                            </div>
                        </TabsTrigger>
                        <TabsTrigger value="future">
                            <div className="flex items-center gap-1.5">
                                <span>À Receber no Próximo Período (Booking)</span>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" align="center" className="max-w-lg whitespace-normal" sideOffset={8}>
                                        <p className="text-sm">Reservas do Booking.com com check-out no período selecionado, mas cujo pagamento será recebido apenas no próximo período (mês seguinte ao check-out).</p>
                                    </TooltipContent>
                                </Tooltip>
                                <Badge variant="secondary" className="ml-1">{reservationsByCompetence.future.length}</Badge>
                            </div>
                        </TabsTrigger>
                        <TabsTrigger value="active">
                            <div className="flex items-center gap-1.5">
                                <span>Ativas no Período</span>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" align="center" className="max-w-lg whitespace-normal" sideOffset={8}>
                                        <p className="text-sm">Mostra todas as reservas que possuem intersecção com o período selecionado (check-in ou check-out dentro do período), independente de quando o pagamento foi recebido. Útil para visualizar a ocupação geral.</p>
                                    </TooltipContent>
                                </Tooltip>
                                <Badge variant="secondary" className="ml-1">{reservationsByCompetence.active.length}</Badge>
                            </div>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value={activeTab}>
                        <Card>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50 hover:bg-gray-50">
                                        <TableHead>Código</TableHead>
                                        <TableHead>Propriedade</TableHead>
                                        <TableHead>Hóspede</TableHead>
                                        <TableHead>Contato</TableHead>
                                        <TableHead>Check-in</TableHead>
                                        <TableHead>Check-out</TableHead>
                                        <TableHead className="text-center">Noites</TableHead>
                                        <TableHead>Faxineira</TableHead>
                                        <TableHead>Plataforma</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Pagamento</TableHead>
                                        <TableHead>Valores</TableHead>
                                        <TableHead>Comunicado</TableHead>
                                        <TableHead>Recibo</TableHead>
                                        {(canEditReservations || canDeleteReservations) && (<TableHead>Ações</TableHead>)}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredReservations.map((reservation) => {
                                        const property = reservation.properties;
                                        return (
                                            <TableRow key={reservation.id} className="hover:bg-gray-50">
                                                <TableCell className="font-medium text-blue-600">{reservation.reservation_code}</TableCell>
                                                <TableCell>{property?.nickname || property?.name}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span>{reservation.guest_name || '-'}</span>
                                                        {reservation.number_of_guests && (
                                                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                                                {reservation.number_of_guests} 👥
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {reservation.guest_phone ? (<Button variant="outline" size="sm" onClick={() => {
                                                        const phoneNumber = reservation.guest_phone?.replace(/\D/g, '');
                                                        if (phoneNumber) window.open(`https://wa.me/55${phoneNumber}`, '_blank');
                                                        }} className="gap-2">
                                                        <MessageCircle className="h-4 w-4 text-green-600" /> WhatsApp
                                                    </Button>
                                                    ) : ('-')}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1"><div className="font-medium">{formatDate(reservation.check_in_date)}</div>
                                                        {reservation.checkin_time && (<div className="text-sm text-gray-500">{formatTime(reservation.checkin_time)}</div>)}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1"><div className="font-medium">{formatDate(reservation.check_out_date)}</div>
                                                        {reservation.checkout_time && (<div className="text-sm text-gray-500">{formatTime(reservation.checkout_time)}</div>)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                                        {calculateNights(reservation.check_in_date, reservation.check_out_date)} noites
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <span className="text-sm font-medium">
                                                            {reservation.cleaner_user_id ? cleanerMap.get(reservation.cleaner_user_id) || 'Não atribuída' : 'Não atribuída'}
                                                        </span>
                                                        <div>
                                                            <Badge 
                                                                variant="outline"
                                                                className={
                                                                    reservation.cleaning_status === 'Realizada' 
                                                                        ? 'bg-green-50 text-green-700 border-green-200 text-xs' 
                                                                        : 'bg-orange-50 text-orange-700 border-orange-200 text-xs'
                                                                }
                                                            >
                                                                {reservation.cleaning_status || 'Pendente'}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell><Badge variant="secondary">{reservation.platform}</Badge></TableCell>
                                                <TableCell>
                                                    {canEditReservations ? (
                                                        <StatusSelector reservationId={reservation.id} currentStatus={reservation.reservation_status} statusType="reservation_status" onUpdate={() => queryClient.invalidateQueries({ queryKey })} />
                                                    ) : (
                                                        <Badge variant="secondary">{reservation.reservation_status}</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {canEditReservations ? (
                                                        <StatusSelector reservationId={reservation.id} currentStatus={reservation.payment_status || 'Pendente'} statusType="payment_status" onUpdate={() => queryClient.invalidateQueries({ queryKey })} />
                                                    ) : (
                                                        <Badge variant="secondary">{reservation.payment_status || 'Pendente'}</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <div className="font-bold text-green-700">R$ {reservation.net_revenue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}</div>
                                                        <div className="text-sm text-gray-600">Total: R$ {reservation.total_revenue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center justify-center">
                                                        {canEditReservations ? (
                                                            <Checkbox checked={reservation.is_communicated || false} onCheckedChange={(checked) => handleCheckboxChange(reservation.id, 'is_communicated', checked as boolean)} />
                                                        ) : (
                                                            <div className={`w-4 h-4 border rounded ${reservation.is_communicated ? 'bg-blue-600' : ''}`}></div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center justify-center">
                                                        {canEditReservations ? (
                                                            <Checkbox checked={reservation.receipt_sent || false} onCheckedChange={(checked) => handleCheckboxChange(reservation.id, 'receipt_sent', checked as boolean)} />
                                                        ) : (
                                                            <div className={`w-4 h-4 border rounded ${reservation.receipt_sent ? 'bg-blue-600' : ''}`}></div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                {(canEditReservations || canDeleteReservations) && (
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            {canEditReservations && (<Button
                                                                variant="outline"
                                                                size="icon"
                                                                onClick={() => {
                                                                    console.log("--- PASSO 1: Botão de Edição CLICADO ---");
                                                                    console.log("Reserva a ser editada:", reservation);
                                                                    handleEdit(reservation);
                                                                }}
                                                                className="h-8 w-8"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>)}
                                                            {canDeleteReservations && (
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8 text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader>
                                                                            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                                                            <AlertDialogDescription>Tem certeza que deseja excluir esta reserva? Esta ação não pode ser desfeita.</AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                            <AlertDialogAction onClick={() => handleDelete(reservation.id)} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                                <TableFooter>
                                    <TableRow>
                                        <TableCell colSpan={11} className="font-medium">Total de Reservas: {totals.count}</TableCell>
                                        <TableCell className="font-bold">
                                            <div className="space-y-1">
                                                <div className="text-green-700">
                                                    Líquido Total: R$ {totals.netRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </div>
                                                {activeTab === 'cashflow' && (
                                                    <>
                                                        <div className="text-sm text-blue-600">
                                                            Recebido: R$ {totals.receivedNetRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </div>
                                                        <div className="text-sm text-orange-600">
                                                            A Receber: R$ {totals.futureNetRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </div>
                                                    </>
                                                )}
                                                <div className="text-sm text-gray-600">Bruto: R$ {totals.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell colSpan={3}>
                                            <div className="space-y-1 text-sm">
                                                <div>Pagos: {totals.paidCount} | Pendentes: {totals.pendingCount}</div>
                                                <div>Airbnb: {totals.airbnbCount} | Booking: {totals.bookingCount} | Direto: {totals.diretoCount}</div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                </TableFooter>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    </Tabs>
                </TooltipProvider>
                
                {(() => {
                    if (typeof window !== 'undefined') {
                        console.log("--- PASSO 3: Verificando condição para RENDERIZAR o formulário ---");
                        console.log("Valor de 'showForm' neste momento:", showForm);
                        if (showForm) {
                            console.log("✅ CONDIÇÃO VERDADEIRA: O modal deveria ser renderizado agora.");
                        } else {
                            console.log("❌ CONDIÇÃO FALSA: O modal não será renderizado.");
                        }
                    }
                    return null;
                })()}

                {showForm && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6">
                                <h2 className="text-xl font-semibold mb-6 text-gray-900">{editingReservation ? 'Editar Reserva' : 'Nova Reserva'}</h2>
                                <ReservationForm
                                    reservation={editingReservation}
                                    onSuccess={handleFormSuccess}
                                    onCancel={() => { setShowForm(false); setEditingReservation(null); }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
    );
};

export default ReservasPage;
