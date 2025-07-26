import React, { useState, useEffect, useMemo } from 'react';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useDateRange } from '@/hooks/dashboard/useDateRange';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Edit, Trash2, Plus, Search, Loader2, AlertTriangle } from 'lucide-react';
import ReservationForm from '@/components/reservations/ReservationForm';
import StatusSelector from '@/components/reservations/StatusSelector';
import { supabase } from '@/integrations/supabase/client';
import { Reservation } from '@/types/reservation';
import { Property } from '@/types/property';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/MainLayout';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

// CORREÇÃO DA DATA: Função que trata a data como string para evitar bugs de fuso horário.
const formatDate = (dateString: string | null): string => {
  if (!dateString) return '';
  const parts = dateString.split('-'); // Ex: '2025-07-18'
  if (parts.length !== 3) return dateString; // Fallback para formatos inesperados
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`; // Retorna '18/07/2025'
};

const formatTime = (timeString: string | null): string => {
  if (!timeString) return '';
  return timeString.slice(0, 5);
};

const ReservasPage = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const { toast } = useToast();
  const { hasPermission, getAccessibleProperties, loading: permissionsLoading } = useUserPermissions();
  const { selectedProperties, selectedPeriod } = useGlobalFilters();
  const { startDateString, endDateString } = useDateRange(selectedPeriod);
  const { isVisible, shouldRefetch } = usePageVisibility();

  useEffect(() => {
    if (!permissionsLoading) {
      fetchAllData();
    }
  }, [permissionsLoading, getAccessibleProperties]);

  // Effect para refetch quando página volta a ficar visível
  useEffect(() => {
    if (isVisible && shouldRefetch()) {
      fetchAllData();
    }
  }, [isVisible]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const accessibleProperties = getAccessibleProperties();
      const hasFullAccess = hasPermission('reservations_view_all');
      
      let reservationsQuery = supabase
        .from('reservations')
        .select('*')
        .order('check_in_date', { ascending: false });

      // Aplicar filtros de data quando não for período geral
      if (selectedPeriod !== 'general') {
        reservationsQuery = reservationsQuery
          .gte('check_in_date', startDateString)
          .lte('check_out_date', endDateString);
      }
      
      let propertiesQuery = supabase
        .from('properties')
        .select('*')
        .order('name');

      // Apply filters based on permissions
      if (!hasFullAccess && accessibleProperties.length > 0) {
        reservationsQuery = reservationsQuery.in('property_id', accessibleProperties);
        propertiesQuery = propertiesQuery.in('id', accessibleProperties);
      }

      const [reservationsResponse, propertiesResponse] = await Promise.all([
        reservationsQuery,
        propertiesQuery
      ]);

      if (reservationsResponse.error) throw reservationsResponse.error;
      if (propertiesResponse.error) throw propertiesResponse.error;

      setReservations(reservationsResponse.data || []);
      setProperties(propertiesResponse.data || []);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (reservationId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', reservationId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Reserva excluída com sucesso.",
      });
      
      fetchAllData();
    } catch (error) {
      console.error('Erro ao excluir reserva:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a reserva.",
        variant: "destructive",
      });
    }
  };

  const handleCheckboxChange = async (reservationId: string, field: 'is_communicated' | 'receipt_sent', value: boolean) => {
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ [field]: value })
        .eq('id', reservationId);

      if (error) throw error;

      setReservations(prev => 
        prev.map(reservation => 
          reservation.id === reservationId 
            ? { ...reservation, [field]: value }
            : reservation
        )
      );

      const fieldName = field === 'is_communicated' ? 'comunicação' : 'recibo';
      toast({
        title: "Sucesso",
        description: `Status de ${fieldName} atualizado com sucesso.`,
      });
    } catch (error) {
      console.error(`Erro ao atualizar ${field}:`, error);
      toast({
        title: "Erro",
        description: `Não foi possível atualizar o status de ${field === 'is_communicated' ? 'comunicação' : 'recibo'}.`,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (reservation: Reservation) => {
    setEditingReservation(reservation);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingReservation(null);
    fetchAllData();
  };

  const filteredReservations = useMemo(() => {
    return reservations.filter(reservation => {
      const property = properties.find(p => p.id === reservation.property_id);
      const matchesSearch = !searchTerm || 
        reservation.reservation_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (reservation.guest_name && reservation.guest_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (property && (property.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      (property.nickname && property.nickname.toLowerCase().includes(searchTerm.toLowerCase()))));
      
      const matchesProperty = selectedProperties.includes('todas') || 
        selectedProperties.includes(reservation.property_id || '');
      const matchesStatus = selectedStatus === 'all' || reservation.reservation_status === selectedStatus;
      const matchesPlatform = selectedPlatform === 'all' || reservation.platform === selectedPlatform;
      
      return matchesSearch && matchesProperty && matchesStatus && matchesPlatform;
    });
  }, [reservations, searchTerm, selectedProperties, selectedStatus, selectedPlatform, properties]);

  // Calcular totais dos dados filtrados
  const totals = filteredReservations.reduce((acc, reservation) => {
    acc.count += 1;
    acc.totalRevenue += reservation.total_revenue || 0;
    acc.netRevenue += reservation.net_revenue || 0;
    if (reservation.payment_status === 'Pago') acc.paidCount += 1;
    else acc.pendingCount += 1;
    
    // Contar por plataforma
    if (reservation.platform === 'Airbnb') acc.airbnbCount += 1;
    else if (reservation.platform === 'Booking.com') acc.bookingCount += 1;
    else acc.diretoCount += 1;
    
    return acc;
  }, {
    count: 0,
    totalRevenue: 0,
    netRevenue: 0,
    paidCount: 0,
    pendingCount: 0,
    airbnbCount: 0,
    bookingCount: 0,
    diretoCount: 0
  });

  const totalLoading = loading || permissionsLoading;

  if (totalLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">Carregando permissões...</div>
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
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Reservas</h1>
              <p className="text-gray-600 mt-1">Gerencie suas reservas e acompanhe o status</p>
            </div>
          </div>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Você não tem permissão para acessar esta seção. Entre em contato com o administrador para solicitar acesso.
            </AlertDescription>
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
            <Button 
              onClick={() => {
                setEditingReservation(null);
                setShowForm(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
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
                  className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full sm:w-[180px] border-gray-300">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="Confirmada">Confirmada</SelectItem>
                  <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                  <SelectItem value="Finalizada">Finalizada</SelectItem>
                  <SelectItem value="Cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger className="w-full sm:w-[180px] border-gray-300">
                  <SelectValue placeholder="Todas as plataformas" />
                </SelectTrigger>
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
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold text-gray-900">Código</TableHead>
                    <TableHead className="font-semibold text-gray-900">Propriedade</TableHead>
                    <TableHead className="font-semibold text-gray-900">Hóspede</TableHead>
                    <TableHead className="font-semibold text-gray-900">Check-in</TableHead>
                    <TableHead className="font-semibold text-gray-900">Check-out</TableHead>
                    <TableHead className="font-semibold text-gray-900">Plataforma</TableHead>
                    <TableHead className="font-semibold text-gray-900">Status</TableHead>
                    <TableHead className="font-semibold text-gray-900">Pagamento</TableHead>
                    <TableHead className="font-semibold text-gray-900">Valores</TableHead>
                    <TableHead className="font-semibold text-gray-900">Comunicado</TableHead>
                    <TableHead className="font-semibold text-gray-900">Recibo</TableHead>
                    {(canEditReservations || canDeleteReservations) && (
                      <TableHead className="font-semibold text-gray-900">Ações</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReservations.map((reservation) => {
                    const property = properties.find(p => p.id === reservation.property_id);
                    return (
                      <TableRow key={reservation.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium text-blue-600">{reservation.reservation_code}</TableCell>
                        <TableCell className="font-medium">{property?.nickname || property?.name}</TableCell>
                        <TableCell>{reservation.guest_name || '-'}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{formatDate(reservation.check_in_date)}</div>
                            {reservation.checkin_time && (<div className="text-sm text-gray-500">{formatTime(reservation.checkin_time)}</div>)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{formatDate(reservation.check_out_date)}</div>
                            {reservation.checkout_time && (<div className="text-sm text-gray-500">{formatTime(reservation.checkout_time)}</div>)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700">{reservation.platform}</Badge>
                        </TableCell>
                        <TableCell>
                          {canEditReservations ? (
                            <StatusSelector reservationId={reservation.id} currentStatus={reservation.reservation_status} statusType="reservation_status" onUpdate={fetchAllData} />
                          ) : (
                            <Badge variant="secondary">{reservation.reservation_status}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {canEditReservations ? (
                            <StatusSelector reservationId={reservation.id} currentStatus={reservation.payment_status || 'Pendente'} statusType="payment_status" onUpdate={fetchAllData} />
                          ) : (
                            <Badge variant="secondary">{reservation.payment_status || 'Pendente'}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-bold text-green-700 text-base">R$ {reservation.net_revenue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}</div>
                            <div className="text-sm text-gray-600">Total: R$ {reservation.total_revenue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {canEditReservations ? (
                              <Checkbox checked={reservation.is_communicated || false} onCheckedChange={(checked) => handleCheckboxChange(reservation.id, 'is_communicated', checked as boolean)} />
                            ) : (
                              <div className="w-4 h-4 border rounded flex items-center justify-center">
                                {reservation.is_communicated && <div className="w-2 h-2 bg-blue-600 rounded"></div>}
                              </div>
                            )}
                            <span className="text-sm text-gray-600">{reservation.is_communicated ? 'Sim' : 'Não'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {canEditReservations ? (
                              <Checkbox checked={reservation.receipt_sent || false} onCheckedChange={(checked) => handleCheckboxChange(reservation.id, 'receipt_sent', checked as boolean)} />
                            ) : (
                              <div className="w-4 h-4 border rounded flex items-center justify-center">
                                {reservation.receipt_sent && <div className="w-2 h-2 bg-blue-600 rounded"></div>}
                              </div>
                            )}
                            <span className="text-sm text-gray-600">{reservation.receipt_sent ? 'Sim' : 'Não'}</span>
                          </div>
                        </TableCell>
                        {(canEditReservations || canDeleteReservations) && (
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {canEditReservations && (
                                <Button variant="outline" size="sm" onClick={() => handleEdit(reservation)} className="text-blue-600 border-blue-600 hover:bg-blue-50">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {canDeleteReservations && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="text-red-600 border-red-600 hover:bg-red-50">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
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
                  <TableRow className="bg-gray-100 font-semibold">
                    <TableCell colSpan={2} className="font-bold">TOTAIS ({totals.count} reservas)</TableCell>
                    <TableCell className="text-center">-</TableCell>
                    <TableCell className="text-center">-</TableCell>
                    <TableCell className="text-center">-</TableCell>
                    <TableCell>
                      <div className="space-y-1 text-xs">
                        <div>Airbnb: {totals.airbnbCount}</div>
                        <div>Booking: {totals.bookingCount}</div>
                        <div>Direto: {totals.diretoCount}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">-</TableCell>
                    <TableCell>
                      <div className="space-y-1 text-xs">
                        <div>Pago: {totals.paidCount}</div>
                        <div>Pendente: {totals.pendingCount}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-bold text-green-700">R$ {totals.netRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        <div className="text-sm text-gray-600">Total: R$ {totals.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">-</TableCell>
                    <TableCell className="text-center">-</TableCell>
                    {(canEditReservations || canDeleteReservations) && (
                      <TableCell className="text-center">-</TableCell>
                    )}
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>

        {showForm && canCreateReservations && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">{editingReservation ? 'Editar Reserva' : 'Nova Reserva'}</h2>
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