import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Plus, Edit, Trash2, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ReservationForm from '@/components/reservations/ReservationForm';
import { Reservation } from '@/types/reservation';
import { Property } from '@/types/property';
import StatusSelector from '@/components/reservations/StatusSelector'; // Importando o componente de status

// MELHORIA 1: Função de formatação de data corrigida
const formatDate = (dateString: string | null) => {
  if (!dateString) return '--';
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

const ReservasPage = () => {
  const [reservations, setReservations] = useState<any[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProperty, setSelectedProperty] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const { toast } = useToast();

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [reservationsRes, propertiesRes] = await Promise.all([
        supabase.from('reservations').select('*, properties (name, nickname)').order('check_in_date', { ascending: false }),
        supabase.from('properties').select('*').order('name')
      ]);

      if (reservationsRes.error) throw reservationsRes.error;
      if (propertiesRes.error) throw propertiesRes.error;

      setReservations(reservationsRes.data || []);
      setProperties(propertiesRes.data || []);
    } catch (error: any) {
      console.error('Erro ao buscar dados:', error);
      toast({ title: "Erro", description: "Não foi possível carregar os dados da página.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleDelete = async (reservationId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta reserva?')) return;
    try {
      const { error } = await supabase.from('reservations').delete().eq('id', reservationId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Reserva excluída com sucesso." });
      fetchAllData(); // Recarrega tudo
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleEdit = (reservation: Reservation) => {
    setEditingReservation(reservation);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setEditingReservation(null);
    fetchAllData();
  };

  const filteredReservations = reservations.filter(reservation => {
    const propertyData = reservation.properties;
    const guestName = reservation.guest_name || '';

    const matchesSearch = !searchTerm || 
      (reservation.reservation_code && reservation.reservation_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (guestName && guestName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesProperty = !selectedProperty || selectedProperty === 'all-properties' || reservation.property_id === selectedProperty;
    const matchesStatus = !selectedStatus || selectedStatus === 'all-status' || reservation.reservation_status === selectedStatus;
    
    return matchesSearch && matchesProperty && matchesStatus;
  });

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#6A6DDF] to-[#8B5CF6] bg-clip-text text-transparent">
            Minhas Reservas
          </h1>
          <Dialog open={isFormOpen} onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingReservation(null);
          }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-[#6A6DDF] to-[#8B5CF6] hover:from-[#5A5BCF] hover:to-[#7C3AED] text-white shadow-lg">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Nova Reserva
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar">
              <ReservationForm 
                reservation={editingReservation} 
                onSuccess={handleFormSuccess}
                onCancel={() => setIsFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Barra de Ferramentas */}
        <div className="bg-gradient-to-r from-white to-gray-50 p-4 rounded-lg shadow-sm border">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input placeholder="Buscar por código ou hóspede..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger><SelectValue placeholder="Filtrar por propriedade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all-properties">Todas as propriedades</SelectItem>
                {properties.map((property) => (<SelectItem key={property.id} value={property.id}>{property.nickname || property.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger><SelectValue placeholder="Filtrar por status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all-status">Todos os status</SelectItem>
                <SelectItem value="Confirmada">Confirmada</SelectItem>
                <SelectItem value="Em andamento">Em andamento</SelectItem>
                <SelectItem value="Finalizada">Finalizada</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => { setSearchTerm(''); setSelectedProperty('all-properties'); setSelectedStatus('all-status'); }}>Limpar Filtros</Button>
          </div>
        </div>

        {/* Tabela de Reservas */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border">
          <Table>
            <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
              <TableRow>
                <TableHead>Propriedade</TableHead>
                <TableHead>Hóspede / Código</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Valor Proprietário</TableHead>
                <TableHead className="w-[180px]">Status da Reserva</TableHead>
                <TableHead className="w-[180px]">Status do Pagamento</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReservations.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">{reservations.length === 0 ? "Nenhuma reserva cadastrada ainda." : "Nenhuma reserva encontrada com os filtros aplicados."}</TableCell></TableRow>
              ) : (
                filteredReservations.map((reservation) => (
                  <TableRow key={reservation.id} className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-transparent">
                    <TableCell>
                      <div className="font-medium">{reservation.properties?.nickname || reservation.properties?.name}</div>
                      <div className="text-sm text-gray-500">{reservation.platform}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{reservation.guest_name || 'Não informado'}</div>
                      <div className="text-sm text-gray-500">{reservation.reservation_code}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{formatDate(reservation.check_in_date)} a {formatDate(reservation.check_out_date)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-[#10B981]">R$ {(reservation.net_revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </TableCell>
                    {/* MELHORIA 2: STATUS INTERATIVO */}
                    <TableCell>
                      <StatusSelector reservationId={reservation.id} currentStatus={reservation.reservation_status || 'Confirmada'} statusType="reservation_status" onUpdate={fetchAllData} />
                    </TableCell>
                    <TableCell>
                      <StatusSelector reservationId={reservation.id} currentStatus={reservation.payment_status || 'Pendente'} statusType="payment_status" onUpdate={fetchAllData} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(reservation)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(reservation.id)} className="text-red-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
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
