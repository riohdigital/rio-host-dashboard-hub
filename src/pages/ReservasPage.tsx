
import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ReservationForm from '@/components/reservations/ReservationForm';
import { Reservation } from '@/types/reservation';
import { Property } from '@/types/property';

const ReservasPage = () => {
  const [reservations, setReservations] = useState<(Reservation & { property_name?: string; property_nickname?: string })[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProperty, setSelectedProperty] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchReservations();
    fetchProperties();
  }, []);

  const fetchReservations = async () => {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          properties (
            name,
            nickname
          )
        `)
        .order('check_in_date', { ascending: false });

      if (error) throw error;
      
      const formattedData = (data || []).map(reservation => ({
        ...reservation,
        property_name: reservation.properties?.name,
        property_nickname: reservation.properties?.nickname
      }));
      
      setReservations(formattedData);
    } catch (error) {
      console.error('Erro ao buscar reservas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as reservas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('name');

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error('Erro ao buscar propriedades:', error);
    }
  };

  const handleDelete = async (reservationId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta reserva?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', reservationId);

      if (error) throw error;

      setReservations(reservations.filter(r => r.id !== reservationId));
      toast({
        title: "Sucesso",
        description: "Reserva excluída com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao excluir reserva:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a reserva.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (reservation: Reservation) => {
    setEditingReservation(reservation);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setEditingReservation(null);
    fetchReservations();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'ativa':
        return 'bg-green-100 text-green-800';
      case 'confirmada':
        return 'bg-blue-100 text-blue-800';
      case 'finalizada':
        return 'bg-gray-100 text-gray-800';
      case 'cancelada':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const filteredReservations = reservations.filter(reservation => {
    const matchesSearch = !searchTerm || 
      reservation.reservation_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reservation.guest_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesProperty = !selectedProperty || reservation.property_id === selectedProperty;
    const matchesStatus = !selectedStatus || reservation.reservation_status === selectedStatus;
    
    return matchesSearch && matchesProperty && matchesStatus;
  });

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-[#6A6DDF] text-lg">Carregando reservas...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-[#6A6DDF]">Minhas Reservas</h1>
          <Dialog open={isFormOpen} onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingReservation(null);
          }}>
            <DialogTrigger asChild>
              <Button className="bg-[#6A6DDF] hover:bg-[#5A5BCF] text-white">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Nova Reserva
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-[#6A6DDF]">
                  {editingReservation ? 'Editar Reserva' : 'Nova Reserva'}
                </DialogTitle>
              </DialogHeader>
              <ReservationForm 
                reservation={editingReservation} 
                onSuccess={handleFormSuccess}
                onCancel={() => setIsFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Barra de Ferramentas */}
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar por código ou hóspede..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por propriedade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas as propriedades</SelectItem>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.nickname || property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os status</SelectItem>
                <SelectItem value="Confirmada">Confirmada</SelectItem>
                <SelectItem value="Ativa">Ativa</SelectItem>
                <SelectItem value="Finalizada">Finalizada</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchTerm('');
                setSelectedProperty('');
                setSelectedStatus('');
              }}
            >
              Limpar Filtros
            </Button>
          </div>
        </div>

        {/* Tabela de Reservas */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propriedade</TableHead>
                <TableHead>Hóspede / Código</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Valor Proprietário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReservations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    {reservations.length === 0 
                      ? "Nenhuma reserva cadastrada ainda."
                      : "Nenhuma reserva encontrada com os filtros aplicados."
                    }
                  </TableCell>
                </TableRow>
              ) : (
                filteredReservations.map((reservation) => (
                  <TableRow key={reservation.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {reservation.property_nickname || reservation.property_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {reservation.platform}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {reservation.guest_name || 'Não informado'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {reservation.reservation_code}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDate(reservation.check_in_date)} a {formatDate(reservation.check_out_date)}
                      </div>
                      {reservation.number_of_guests && (
                        <div className="text-xs text-gray-500">
                          {reservation.number_of_guests} hóspede(s)
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-[#10B981]">
                        R$ {(reservation.net_revenue || 0).toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Total: R$ {reservation.total_revenue.toFixed(2)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(reservation.reservation_status)}>
                        {reservation.reservation_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(reservation)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(reservation.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </MainLayout>
  );
};

export default ReservasPage;
