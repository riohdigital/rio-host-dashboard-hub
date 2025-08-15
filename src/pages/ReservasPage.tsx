import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useDateRange } from '@/hooks/dashboard/useDateRange';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Edit, Trash2, Plus, Search, Loader2, AlertTriangle, MessageCircle } from 'lucide-react';
import ReservationForm from '@/components/reservations/ReservationForm';
import StatusSelector from '@/components/reservations/StatusSelector';
import { supabase } from '@/integrations/supabase/client';
import { Reservation } from '@/types/reservation';
import { Property } from '@/types/property';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/MainLayout';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

const formatDate = (dateString: string | null): string => {
  if (!dateString) return '';
  // Corrige o bug de timezone
  const date = new Date(`${dateString}T00:00:00`);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatTime = (timeString: string | null): string => {
  if (!timeString) return '';
  return timeString.slice(0, 5);
};

// Função de busca de dados movida para fora do componente
const fetchReservationsAndProperties = async (getAccessibleProperties, hasPermission, selectedPeriod, startDateString, endDateString) => {
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
    (data || []).forEach(res => {
        if (res.properties) {
            propertiesMap.set(res.properties.id, res.properties);
        }
    });

    return { reservations: data || [], properties: Array.from(propertiesMap.values()) };
};


const ReservasPage = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const { toast } = useToast();
  const { hasPermission, getAccessibleProperties, loading: permissionsLoading } = useUserPermissions();
  const { selectedProperties } = useGlobalFilters();
  const { startDateString, endDateString, selectedPeriod } = useDateRange(); // Ajustado
  const queryClient = useQueryClient();

  const queryKey = useMemo(() => ['reservations', selectedPeriod, startDateString, endDateString, selectedProperties], 
    [selectedPeriod, startDateString, endDateString, selectedProperties]);

  const { data, isLoading: dataLoading, error } = useQuery({
    queryKey: queryKey,
    queryFn: () => fetchReservationsAndProperties(getAccessibleProperties, hasPermission, selectedPeriod, startDateString, endDateString),
    enabled: !permissionsLoading,
    staleTime: 10000, // Cache de 10 segundos
    refetchOnWindowFocus: true,
  });

  const reservations = data?.reservations || [];
  const properties = data?.properties || [];

  const handleDelete = async (reservationId: string): Promise<void> => {
    try {
      const { error } = await supabase.from('reservations').delete().eq('id', reservationId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Reserva excluída com sucesso." });
      await queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível excluir a reserva.", variant: "destructive" });
    }
  };

  const handleCheckboxChange = async (reservationId: string, field: 'is_communicated' | 'receipt_sent', value: boolean) => {
    // Optimistic UI update
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
      queryClient.invalidateQueries({ queryKey }); // Revert on error
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

  const filteredReservations = useMemo(() => {
    return reservations.filter(reservation => {
      const property = properties.find(p => p.id === reservation.property_id);
      const lowerSearchTerm = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        reservation.reservation_code.toLowerCase().includes(lowerSearchTerm) ||
        (reservation.guest_name && reservation.guest_name.toLowerCase().includes(lowerSearchTerm)) ||
        (property && (property.name.toLowerCase().includes(lowerSearchTerm) || 
                      (property.nickname && property.nickname.toLowerCase().includes(lowerSearchTerm))));
      
      const matchesProperty = selectedProperties.includes('todas') || 
        selectedProperties.includes(reservation.property_id || '');
      const matchesStatus = selectedStatus === 'all' || reservation.reservation_status === selectedStatus;
      const matchesPlatform = selectedPlatform === 'all' || reservation.platform === selectedPlatform;
      
      return matchesSearch && matchesProperty && matchesStatus && matchesPlatform;
    });
  }, [reservations, searchTerm, selectedProperties, selectedStatus, selectedPlatform, properties]);

  const totals = useMemo(() => filteredReservations.reduce((acc, reservation) => {
    acc.count += 1;
    acc.totalRevenue += reservation.total_revenue || 0;
    acc.netRevenue += reservation.net_revenue || 0;
    if (reservation.payment_status === 'Pago') acc.paidCount += 1;
    else acc.pendingCount += 1;
    
    if (reservation.platform === 'Airbnb') acc.airbnbCount += 1;
    else if (reservation.platform === 'Booking.com') acc.bookingCount += 1;
    else acc.diretoCount += 1;
    
    return acc;
  }, { count: 0, totalRevenue: 0, netRevenue: 0, paidCount: 0, pendingCount: 0, airbnbCount: 0, bookingCount: 0, diretoCount: 0 }), [filteredReservations]);

  const totalLoading = dataLoading || permissionsLoading;

  if (totalLoading && !data) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  const canViewReservations = hasPermission('reservations_view_all') || hasPermission('reservations_view_assigned');
  const canCreateReservations = hasPermission('reservations_create');
  const canEditReservations = hasPermission('reservations_edit');
  const canDeleteReservations = hasPermission('reservations_delete');

  if (!canViewReservations) {
    return (
      <MainLayout>
        <div className="container mx-auto py-8 px-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Você não tem permissão para visualizar reservas.</AlertDescription>
            </Alert>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
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
                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Todos os status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="Confirmada">Confirmada</SelectItem>
                  <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                  <SelectItem value="Finalizada">Finalizada</SelectItem>
                  <SelectItem value="Cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Todas as plataformas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as plataformas</SelectItem>
                  <SelectItem value="Airbnb">Airbnb</SelectItem>
                  <SelectItem value="Booking.com">Booking.com</SelectItem>
                  <SelectItem value="Direto">Direto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

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
                    const property = properties.find(p => p.id === reservation.property_id);
                    return (
                      <TableRow key={reservation.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium text-blue-600">{reservation.reservation_code}</TableCell>
                        <TableCell>{property?.nickname || property?.name}</TableCell>
                        <TableCell>{reservation.guest_name || '-'}</TableCell>
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
                          <div className="flex items-center space-x-2">
                            {canEditReservations ? (
                              <Checkbox checked={reservation.is_communicated || false} onCheckedChange={(checked) => handleCheckboxChange(reservation.id, 'is_communicated', checked as boolean)} />
                            ) : (
                              <div className={`w-4 h-4 border rounded flex items-center justify-center ${reservation.is_communicated ? 'bg-blue-600' : ''}`}></div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {canEditReservations ? (
                              <Checkbox checked={reservation.receipt_sent || false} onCheckedChange={(checked) => handleCheckboxChange(reservation.id, 'receipt_sent', checked as boolean)} />
                            ) : (
                              <div className={`w-4 h-4 border rounded flex items-center justify-center ${reservation.receipt_sent ? 'bg-blue-600' : ''}`}></div>
                            )}
                          </div>
                        </TableCell>
                        {(canEditReservations || canDeleteReservations) && (
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {canEditReservations && (<Button variant="outline" size="icon" onClick={() => handleEdit(reservation)} className="h-8 w-8"><Edit className="h-4 w-4" /></Button>)}
                              {canDeleteReservations && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8 text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Confirmar exclusão</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir a reserva {reservation.reservation_code}? Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(reservation.id)} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction></AlertDialogFooter>
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
                  <TableRow className="bg-gray-100 font-semibold">
                    <TableCell colSpan={9} className="font-bold">TOTAIS ({totals.count} reservas)</TableCell>
                    <TableCell>
                      <div className="space-y-1 font-bold">
                        <div>R$ {totals.netRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        <div className="text-sm text-gray-600 font-normal">Total: R$ {totals.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                      </div>
                    </TableCell>
                    <TableCell colSpan={3}></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>

        {showForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-6 text-gray-900">{editingReservation ? 'Editar Reserva' : 'Nova Reserva'}</h2>
                <ReservationForm reservation={editingReservation} onSuccess={handleFormSuccess} onCancel={() => { setShowForm(false); setEditingReservation(null); }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default ReservasPage;
