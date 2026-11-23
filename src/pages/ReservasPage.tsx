import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useDateRange } from '@/hooks/dashboard/useDateRange';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Edit, Trash2, Plus, Search, AlertTriangle, MessageCircle, Info, CalendarX, Users } from 'lucide-react';
import PageHeader from '@/components/comum/PageHeader';
import TabelaResponsiva, { type Coluna } from '@/components/comum/TabelaResponsiva';
import JanelaResponsiva from '@/components/comum/JanelaResponsiva';
import EstadoVazio from '@/components/comum/EstadoVazio';
import { EsqueletoLista } from '@/components/comum/Esqueleto';
import { Etiqueta, EtiquetaPlataforma, EtiquetaStatus } from '@/components/comum/Etiquetas';
import { formatarMoeda } from '@/components/comum/formatos';
import AbasRolaveis from '@/components/comum/AbasRolaveis';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import ReservationForm from '@/components/reservations/ReservationForm';
import StatusSelector from '@/components/reservations/StatusSelector';
import ReservasCelular from '@/components/reservations/ReservasCelular';
import FolhaReserva, { type ReservaDaFolha } from '@/components/reservations/FolhaReserva';
import { useEhCompacto } from '@/hooks/useMidia';
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

const fetchReservationsAndProperties = async (
    getAccessibleProperties: () => string[], 
    hasPermission: (p: any) => boolean, 
    selectedPeriod: string, 
    startDateString: string, 
    endDateString: string,
    searchCode?: string
) => {
    const accessibleProperties = getAccessibleProperties();
    const hasFullAccess = hasPermission('reservations_view_all');
    
    let query = supabase
        .from('reservations')
        .select('*, properties!inner(*)')
        .order('check_in_date', { ascending: false });

    // Se houver busca direta por código via URL/parâmetro, busca a reserva sem limitar por período
    if (searchCode && searchCode.trim().length > 0) {
        query = query.ilike('reservation_code', `%${searchCode.trim()}%`);
    } else if (selectedPeriod !== 'general') {
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
    const [searchParams] = useSearchParams();
    const urlSearchCode = searchParams.get('search') || searchParams.get('code') || '';

    const [showForm, setShowForm] = useState(false);
    const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
    const [searchTerm, setSearchTerm] = useState(urlSearchCode);
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('all');
    const [activeTab, setActiveTab] = useState(urlSearchCode ? 'active' : 'cashflow');
    const [excluindoId, setExcluindoId] = useState<string | null>(null);
    // Celular: a reserva aberta na folha de detalhes (D5)
    const [folhaId, setFolhaId] = useState<string | null>(null);
    const [folhaAberta, setFolhaAberta] = useState(false);
    const codigoJaAberto = useRef<string | null>(null);
    const compacto = useEhCompacto();
    const { toast } = useToast();
    const { hasPermission, getAccessibleProperties, loading: permissionsLoading } = useUserPermissions();
    const { selectedProperties, selectedPeriod, selectedPlatform, customStartDate, customEndDate } = useGlobalFilters();
    const { startDateString, endDateString } = useDateRange(selectedPeriod, customStartDate, customEndDate);
    const queryClient = useQueryClient();

    useEffect(() => {
        if (urlSearchCode) {
            setSearchTerm(urlSearchCode);
            setActiveTab('active');
        }
    }, [urlSearchCode]);

    const queryKey = useMemo(() => ['reservations', selectedPeriod, startDateString, endDateString, selectedProperties, selectedPlatform, selectedPaymentStatus, urlSearchCode], 
        [selectedPeriod, startDateString, endDateString, selectedProperties, selectedPlatform, selectedPaymentStatus, urlSearchCode]);

    const { data, isLoading: dataLoading } = useQuery({
        queryKey: queryKey,
        queryFn: () => fetchReservationsAndProperties(getAccessibleProperties, hasPermission, selectedPeriod, startDateString, endDateString, urlSearchCode),
        enabled: !permissionsLoading,
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
    });

    // Real-time subscription for reservations
    useRealtimeSubscription({
        table: 'reservations',
        queryKeys: [queryKey],
        showToasts: true,
        enabled: !permissionsLoading
    });

    const reservations = data?.reservations || [];
    const properties = data?.properties || [];
    const cleanerMap = data?.cleanerMap || new Map<string, string>();

    // ?code=… (vem do Dashboard): no celular, abre a folha dessa reserva direto
    useEffect(() => {
        if (!compacto || !urlSearchCode || !data || codigoJaAberto.current === urlSearchCode) return;
        const alvo = urlSearchCode.trim().toLowerCase();
        const lista = data.reservations as Array<{ id: string; reservation_code?: string | null }>;
        const achada = lista.find((r) => (r.reservation_code || '').toLowerCase() === alvo) ?? (lista.length === 1 ? lista[0] : null);
        codigoJaAberto.current = urlSearchCode;
        if (achada) {
            setFolhaId(achada.id);
            setFolhaAberta(true);
        }
    }, [compacto, urlSearchCode, data]);

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

    const handleEdit = (reservation: Reservation) => {
        setEditingReservation(reservation);
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
        let list: any[] = [];
        if (activeTab === 'active') list = reservationsByCompetence.active;
        else if (activeTab === 'cashflow') list = reservationsByCompetence.cashflow;
        else if (activeTab === 'received') list = reservationsByCompetence.received;
        else if (activeTab === 'future') list = reservationsByCompetence.future;
        
        // Se houver busca específica e a aba atual estiver vazia, exibe as reservas encontradas na lista
        if (list.length === 0 && searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            const found = reservations.filter((r: any) => 
                r.reservation_code?.toLowerCase().includes(lowerSearch) ||
                (r.guest_name && r.guest_name.toLowerCase().includes(lowerSearch))
            );
            if (found.length > 0) return found;
        }
        return list;
    }, [activeTab, reservationsByCompetence, reservations, searchTerm]);

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
            <div className="space-y-4">
                <div className="h-8 w-40 animate-pulse rounded-lg bg-gray-200" />
                <EsqueletoLista linhas={6} />
            </div>
        );
    }

    const canViewReservations = hasPermission('reservations_view_all') || hasPermission('reservations_view_assigned');
    const canCreateReservations = hasPermission('reservations_create');
    const canEditReservations = hasPermission('reservations_edit');
    const canDeleteReservations = hasPermission('reservations_delete');

    if (!canViewReservations) {
        return (
            <div>
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>Você não tem permissão para visualizar reservas.</AlertDescription>
                </Alert>
            </div>
        );
    }

    const atualizar = () => queryClient.invalidateQueries({ queryKey });
    const nomeFaxineira = (r: any) =>
        r.cleaner_user_id ? cleanerMap.get(r.cleaner_user_id) || 'Não atribuída' : 'Não atribuída';
    const abrirWhatsApp = (r: any) => {
        const phoneNumber = r.guest_phone?.replace(/\D/g, '');
        if (phoneNumber) window.open(`https://wa.me/55${phoneNumber}`, '_blank');
    };
    const temAcoes = canEditReservations || canDeleteReservations;

    const colunas: Coluna<any>[] = [
        { chave: 'codigo', titulo: 'Código', celula: (r) => <span className="font-mono text-sm font-medium text-info-600">{r.reservation_code}</span> },
        { chave: 'imovel', titulo: 'Propriedade', celula: (r) => r.properties?.nickname || r.properties?.name },
        {
            chave: 'hospede', titulo: 'Hóspede', celula: (r) => (
                <div className="flex items-center gap-2">
                    <span>{r.guest_name || '-'}</span>
                    {r.number_of_guests && (
                        <Badge variant="outline" className="gap-0.5 text-xs bg-info-50 text-info-700 border-info-200"><Users className="h-3 w-3" aria-hidden="true" />{r.number_of_guests}<span className="sr-only"> hóspedes</span></Badge>
                    )}
                </div>
            ),
        },
        {
            chave: 'contato', titulo: 'Contato', celula: (r) => r.guest_phone ? (
                <Button variant="outline" size="sm" onClick={() => abrirWhatsApp(r)} className="gap-2">
                    <MessageCircle className="h-4 w-4 text-success-600" /> WhatsApp
                </Button>
            ) : '-',
        },
        {
            chave: 'checkin', titulo: 'Check-in', celula: (r) => (
                <div className="space-y-1"><div className="font-mono text-sm font-medium">{formatDate(r.check_in_date)}</div>
                    {r.checkin_time && <div className="font-mono text-xs text-gray-500">{formatTime(r.checkin_time)}</div>}
                </div>
            ),
        },
        {
            chave: 'checkout', titulo: 'Check-out', celula: (r) => (
                <div className="space-y-1"><div className="font-mono text-sm font-medium">{formatDate(r.check_out_date)}</div>
                    {r.checkout_time && <div className="font-mono text-xs text-gray-500">{formatTime(r.checkout_time)}</div>}
                </div>
            ),
        },
        {
            chave: 'noites', titulo: 'Noites', alinhar: 'centro', celula: (r) => (
                <Etiqueta tom="brand">{calculateNights(r.check_in_date, r.check_out_date)} noites</Etiqueta>
            ),
        },
        {
            chave: 'faxineira', titulo: 'Faxineira', celula: (r) => (
                <div className="space-y-1">
                    <span className="text-sm font-medium">{nomeFaxineira(r)}</span>
                    <div><EtiquetaStatus status={r.cleaning_status || 'Pendente'} /></div>
                </div>
            ),
        },
        { chave: 'plataforma', titulo: 'Plataforma', celula: (r) => <EtiquetaPlataforma plataforma={r.platform} /> },
        {
            chave: 'status', titulo: 'Status', celula: (r) => canEditReservations ? (
                <StatusSelector reservationId={r.id} currentStatus={r.reservation_status} statusType="reservation_status" onUpdate={atualizar} />
            ) : <EtiquetaStatus status={r.reservation_status} />,
        },
        {
            chave: 'pagamento', titulo: 'Pagamento', celula: (r) => canEditReservations ? (
                <StatusSelector reservationId={r.id} currentStatus={r.payment_status || 'Pendente'} statusType="payment_status" onUpdate={atualizar} />
            ) : <EtiquetaStatus status={r.payment_status || 'Pendente'} />,
        },
        {
            chave: 'valores', titulo: 'Valores', alinhar: 'direita', celula: (r) => (
                <div className="space-y-1 font-mono tabular-nums">
                    <div className="font-semibold text-success-700">{formatarMoeda(r.net_revenue)}</div>
                    <div className="text-xs text-gray-600">Total: {formatarMoeda(r.total_revenue)}</div>
                </div>
            ),
        },
        {
            chave: 'comunicado', titulo: 'Comunicado', alinhar: 'centro', celula: (r) => canEditReservations ? (
                <Checkbox aria-label="Comunicado" checked={r.is_communicated || false} onCheckedChange={(checked) => handleCheckboxChange(r.id, 'is_communicated', checked as boolean)} />
            ) : <div className={`mx-auto w-4 h-4 border rounded ${r.is_communicated ? 'bg-info-600' : ''}`}></div>,
        },
        {
            chave: 'recibo', titulo: 'Recibo', alinhar: 'centro', celula: (r) => canEditReservations ? (
                <Checkbox aria-label="Recibo enviado" checked={r.receipt_sent || false} onCheckedChange={(checked) => handleCheckboxChange(r.id, 'receipt_sent', checked as boolean)} />
            ) : <div className={`mx-auto w-4 h-4 border rounded ${r.receipt_sent ? 'bg-info-600' : ''}`}></div>,
        },
        ...(temAcoes ? [{
            chave: 'acoes', titulo: 'Ações', celula: (r: any) => (
                <div className="flex items-center gap-2">
                    {canEditReservations && (
                        <Button variant="outline" size="icon" onClick={() => handleEdit(r)} className="h-8 w-8" aria-label="Editar reserva">
                            <Edit className="h-4 w-4" />
                        </Button>
                    )}
                    {canDeleteReservations && (
                        <Button variant="outline" size="icon" onClick={() => setExcluindoId(r.id)} className="h-8 w-8 text-danger-600 border-danger-300 hover:bg-danger-50 hover:text-danger-700" aria-label="Excluir reserva">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            ),
        }] : []),
    ];

    const ABAS = [
        { valor: 'cashflow', rotulo: 'Receita Gerada no Período', curto: 'Receita gerada', total: reservationsByCompetence.cashflow.length, ajuda: 'Representa a receita efetivamente gerada no período selecionado: inclui Airbnb e Direto já recebidos + Booking.com com check-out no período (mesmo que o pagamento seja futuro). Este é o caixa real do mês.' },
        { valor: 'received', rotulo: 'Receber no Período (Airbnb e Direto)', curto: 'Recebidas', total: reservationsByCompetence.received.length, ajuda: 'Mostra reservas do Airbnb e Direto cujo pagamento foi efetivamente recebido dentro do período selecionado. Exclui Booking.com que paga no mês seguinte ao check-out.' },
        { valor: 'future', rotulo: 'À Receber no Próximo Período (Booking)', curto: 'A receber (Booking)', total: reservationsByCompetence.future.length, ajuda: 'Reservas do Booking.com com check-out no período selecionado, mas cujo pagamento será recebido apenas no próximo período (mês seguinte ao check-out).' },
        { valor: 'active', rotulo: 'Ativas no Período', curto: 'Ativas', total: reservationsByCompetence.active.length, ajuda: 'Mostra todas as reservas que possuem intersecção com o período selecionado (check-in ou check-out dentro do período), independente de quando o pagamento foi recebido. Útil para visualizar a ocupação geral.' },
    ];

    if (compacto) {
        const folhaReserva = (folhaId ? reservations.find((r) => r.id === folhaId) : null) as unknown as ReservaDaFolha | null;
        return (
            <div className="min-w-0">
                <PageHeader titulo="Reservas" descricao="Gerencie suas reservas e acompanhe o status" />
                <ReservasCelular
                    reservas={filteredReservations}
                    abas={ABAS}
                    aba={activeTab}
                    aoMudarAba={setActiveTab}
                    busca={searchTerm}
                    aoBuscar={setSearchTerm}
                    status={selectedStatus}
                    aoMudarStatus={setSelectedStatus}
                    pagamento={selectedPaymentStatus}
                    aoMudarPagamento={setSelectedPaymentStatus}
                    totais={totals}
                    podeCriar={canCreateReservations}
                    aoNova={() => { setEditingReservation(null); setShowForm(true); }}
                    aoTocar={(r) => { setFolhaId(r.id); setFolhaAberta(true); }}
                />
                <FolhaReserva
                    aberta={folhaAberta}
                    aoMudar={setFolhaAberta}
                    reserva={folhaReserva}
                    nomeFaxineira={folhaReserva?.cleaner_user_id ? cleanerMap.get(folhaReserva.cleaner_user_id) : null}
                    aoAlterar={atualizar}
                    aoEditar={(r) => handleEdit(r)}
                />
                <JanelaResponsiva
                    aberta={showForm}
                    aoMudar={(aberta) => { if (!aberta) { setShowForm(false); setEditingReservation(null); } }}
                    titulo={editingReservation ? 'Editar Reserva' : 'Nova Reserva'}
                    telaCheia
                    largura="xl"
                >
                    <ReservationForm
                        reservation={editingReservation}
                        onSuccess={handleFormSuccess}
                        onCancel={() => { setShowForm(false); setEditingReservation(null); }}
                    />
                </JanelaResponsiva>
            </div>
        );
    }

    return (
        <div className="space-y-5 sm:space-y-6">
                <PageHeader
                    titulo="Reservas"
                    descricao="Gerencie suas reservas e acompanhe o status"
                    acao={canCreateReservations ? (
                        <Button onClick={() => { setEditingReservation(null); setShowForm(true); }} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Nova reserva
                        </Button>
                    ) : undefined}
                />

                <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-sm sm:flex-row sm:p-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                            type="search"
                            placeholder="Buscar por código, hóspede ou propriedade..."
                            className="h-11 pl-10 sm:h-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:flex">
                        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                            <SelectTrigger className="h-11 w-full sm:h-10 sm:w-[180px]"><SelectValue placeholder="Status da reserva" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os status</SelectItem>
                                <SelectItem value="Confirmada">Confirmada</SelectItem>
                                <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                                <SelectItem value="Finalizada">Finalizada</SelectItem>
                                <SelectItem value="Cancelada">Cancelada</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={selectedPaymentStatus} onValueChange={setSelectedPaymentStatus}>
                            <SelectTrigger className="h-11 w-full sm:h-10 sm:w-[180px]"><SelectValue placeholder="Status do pagamento" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os pagamentos</SelectItem>
                                <SelectItem value="Pago">Pago</SelectItem>
                                <SelectItem value="Pendente">Pendente</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <TooltipProvider delayDuration={200}>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <AbasRolaveis
                        rotulo="Recortes das reservas"
                        sangrar
                        className="mb-1"
                        itens={ABAS.map((aba) => ({
                            valor: aba.valor,
                            rotulo: aba.rotulo,
                            curto: aba.curto,
                            contagem: aba.total,
                            extra: (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="h-3.5 w-3.5 text-muted-foreground transition-colors hover:text-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" align="center" className="max-w-lg whitespace-normal" sideOffset={8}>
                                        <p className="text-sm">{aba.ajuda}</p>
                                    </TooltipContent>
                                </Tooltip>
                            ),
                        }))}
                    />

                    <TabsContent value={activeTab} className="mt-3 space-y-3">
                        <div className="md:rounded-2xl md:border md:bg-card md:shadow-sm">
                            <TabelaResponsiva
                                itens={filteredReservations}
                                chaveItem={(r: any) => r.id}
                                colunas={colunas}
                                cartao={() => null}
                                vazio={
                                    <EstadoVazio
                                        icone={CalendarX}
                                        titulo="Nenhuma reserva aqui"
                                        descricao="Ajuste a busca, os status ou o período nos filtros."
                                        className="md:border-0"
                                    />
                                }
                                rodape={
                                    <TableRow>
                                        <TableCell colSpan={11} className="font-medium">Total de Reservas: {totals.count}</TableCell>
                                        <TableCell className="font-semibold">
                                            <div className="space-y-1 text-right font-mono tabular-nums">
                                                <div className="text-success-700">Líquido Total: {formatarMoeda(totals.netRevenue)}</div>
                                                {activeTab === 'cashflow' && (
                                                    <>
                                                        <div className="text-sm text-info-600">Recebido: {formatarMoeda(totals.receivedNetRevenue)}</div>
                                                        <div className="text-sm text-orange-600">A Receber: {formatarMoeda(totals.futureNetRevenue)}</div>
                                                    </>
                                                )}
                                                <div className="text-sm text-gray-600">Bruto: {formatarMoeda(totals.totalRevenue)}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell colSpan={temAcoes ? 3 : 2}>
                                            <div className="space-y-1 text-sm">
                                                <div>Pagos: {totals.paidCount} | Pendentes: {totals.pendingCount}</div>
                                                <div>Airbnb: {totals.airbnbCount} | Booking: {totals.bookingCount} | Direto: {totals.diretoCount}</div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                }
                            />
                        </div>
                    </TabsContent>
                    </Tabs>
                </TooltipProvider>

                <AlertDialog open={!!excluindoId} onOpenChange={(aberto) => { if (!aberto) setExcluindoId(null); }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                            <AlertDialogDescription>Tem certeza que deseja excluir esta reserva? Esta ação não pode ser desfeita.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => { if (excluindoId) handleDelete(excluindoId); setExcluindoId(null); }}
                                className="bg-danger-600 hover:bg-danger-700"
                            >
                                Excluir
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <JanelaResponsiva
                    aberta={showForm}
                    aoMudar={(aberta) => { if (!aberta) { setShowForm(false); setEditingReservation(null); } }}
                    titulo={editingReservation ? 'Editar Reserva' : 'Nova Reserva'}
                    telaCheia
                    largura="xl"
                >
                    <ReservationForm
                        reservation={editingReservation}
                        onSuccess={handleFormSuccess}
                        onCancel={() => { setShowForm(false); setEditingReservation(null); }}
                    />
                </JanelaResponsiva>
            </div>
    );
};

export default ReservasPage;
