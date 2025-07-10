
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Reservation } from '@/types/reservation';
import { Property } from '@/types/property';

interface ReservationFormProps {
  reservation?: Reservation | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const ReservationForm = ({ reservation, onSuccess, onCancel }: ReservationFormProps) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  
  const [formData, setFormData] = useState({
    property_id: '',
    platform: 'Direto',
    reservation_code: '',
    guest_name: '',
    number_of_guests: 1,
    check_in_date: '',
    check_out_date: '',
    total_revenue: 0,
    payment_status: 'Agendado',
    reservation_status: 'Confirmada'
  });

  const [calculations, setCalculations] = useState({
    cleaning_fee: 0,
    base_revenue: 0,
    commission_amount: 0,
    net_revenue: 0
  });

  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    if (reservation) {
      setFormData({
        property_id: reservation.property_id || '',
        platform: reservation.platform || 'Direto',
        reservation_code: reservation.reservation_code || '',
        guest_name: reservation.guest_name || '',
        number_of_guests: reservation.number_of_guests || 1,
        check_in_date: reservation.check_in_date || '',
        check_out_date: reservation.check_out_date || '',
        total_revenue: reservation.total_revenue || 0,
        payment_status: reservation.payment_status || 'Agendado',
        reservation_status: reservation.reservation_status || 'Confirmada'
      });
    }
  }, [reservation]);

  useEffect(() => {
    if (formData.property_id && formData.total_revenue > 0) {
      calculateFinancials();
    }
  }, [formData.property_id, formData.total_revenue]);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('status', 'Ativo')
        .order('name');

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error('Erro ao buscar propriedades:', error);
    }
  };

  const calculateFinancials = () => {
    const property = properties.find(p => p.id === formData.property_id);
    if (!property) return;

    const cleaningFee = property.cleaning_fee || 0;
    const baseRevenue = formData.total_revenue - cleaningFee;
    const commissionAmount = baseRevenue * property.commission_rate;
    const netRevenue = baseRevenue - commissionAmount;

    setCalculations({
      cleaning_fee: cleaningFee,
      base_revenue: baseRevenue,
      commission_amount: commissionAmount,
      net_revenue: netRevenue
    });

    setSelectedProperty(property);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Preparar dados completos para submissão
      const dataToSubmit = {
        property_id: formData.property_id,
        platform: formData.platform,
        reservation_code: formData.reservation_code,
        guest_name: formData.guest_name || null,
        number_of_guests: formData.number_of_guests || null,
        check_in_date: formData.check_in_date,
        check_out_date: formData.check_out_date,
        total_revenue: formData.total_revenue,
        base_revenue: calculations.base_revenue,
        commission_amount: calculations.commission_amount,
        net_revenue: calculations.net_revenue,
        payment_status: formData.payment_status,
        reservation_status: formData.reservation_status
      };

      console.log('Submitting reservation data:', dataToSubmit);

      let error;
      if (reservation) {
        const { error: updateError } = await supabase
          .from('reservations')
          .update(dataToSubmit)
          .eq('id', reservation.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('reservations')
          .insert([dataToSubmit]);
        error = insertError;
      }

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      toast({
        title: "Sucesso",
        description: reservation ? "Reserva atualizada com sucesso." : "Reserva criada com sucesso.",
      });
      
      onSuccess();
    } catch (error) {
      console.error('Erro ao salvar reserva:', error);
      toast({
        title: "Erro",
        description: `Não foi possível salvar a reserva: ${error?.message || 'Erro desconhecido'}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Seção 1: Dados da Reserva */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-[#6A6DDF] border-b pb-2">
          Dados da Reserva
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="property_id">Propriedade *</Label>
            <Select 
              value={formData.property_id} 
              onValueChange={(value) => handleInputChange('property_id', value)}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a propriedade" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.nickname || property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="platform">Plataforma *</Label>
            <Select 
              value={formData.platform} 
              onValueChange={(value) => handleInputChange('platform', value)}
              required
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Airbnb">Airbnb</SelectItem>
                <SelectItem value="Booking.com">Booking.com</SelectItem>
                <SelectItem value="Direto">Direto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="reservation_code">Código da Reserva *</Label>
            <Input
              id="reservation_code"
              value={formData.reservation_code}
              onChange={(e) => handleInputChange('reservation_code', e.target.value)}
              placeholder="Ex: HM123456789"
              required
            />
          </div>
          <div>
            <Label htmlFor="guest_name">Nome do Hóspede</Label>
            <Input
              id="guest_name"
              value={formData.guest_name}
              onChange={(e) => handleInputChange('guest_name', e.target.value)}
              placeholder="Nome completo do hóspede"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="number_of_guests">Número de Hóspedes</Label>
            <Input
              id="number_of_guests"
              type="number"
              min="1"
              value={formData.number_of_guests}
              onChange={(e) => handleInputChange('number_of_guests', parseInt(e.target.value) || 1)}
            />
          </div>
          <div>
            <Label htmlFor="check_in_date">Check-in *</Label>
            <Input
              id="check_in_date"
              type="date"
              value={formData.check_in_date}
              onChange={(e) => handleInputChange('check_in_date', e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="check_out_date">Check-out *</Label>
            <Input
              id="check_out_date"
              type="date"
              value={formData.check_out_date}
              onChange={(e) => handleInputChange('check_out_date', e.target.value)}
              required
            />
          </div>
        </div>
        
        <div>
          <Label htmlFor="total_revenue">Valor Total da Reserva (R$) *</Label>
          <Input
            id="total_revenue"
            type="number"
            min="0"
            step="0.01"
            value={formData.total_revenue}
            onChange={(e) => handleInputChange('total_revenue', parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            required
          />
        </div>
      </div>

      {/* Seção 2: Detalhamento Financeiro */}
      {selectedProperty && formData.total_revenue > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[#6A6DDF] border-b pb-2">
            Detalhamento Financeiro
          </h3>
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span>Valor Total:</span>
              <span className="font-medium">R$ {formData.total_revenue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>(- Taxa de Limpeza):</span>
              <span>R$ {calculations.cleaning_fee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span>(=) Base de Cálculo:</span>
              <span className="font-medium">R$ {calculations.base_revenue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>(- Comissão Co-Anfitrião {(selectedProperty.commission_rate * 100).toFixed(0)}%):</span>
              <span>R$ {calculations.commission_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-lg font-semibold text-[#10B981]">
              <span>(=) Total Líquido do Proprietário:</span>
              <span>R$ {calculations.net_revenue.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Seção 3: Status */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-[#6A6DDF] border-b pb-2">
          Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="payment_status">Status do Pagamento</Label>
            <Select 
              value={formData.payment_status} 
              onValueChange={(value) => handleInputChange('payment_status', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Agendado">Agendado</SelectItem>
                <SelectItem value="Pago">Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="reservation_status">Status da Reserva</Label>
            <Select 
              value={formData.reservation_status} 
              onValueChange={(value) => handleInputChange('reservation_status', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Confirmada">Confirmada</SelectItem>
                <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                <SelectItem value="Finalizada">Finalizada</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Botões */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          className="bg-[#6A6DDF] hover:bg-[#5A5BCF] text-white"
          disabled={loading}
        >
          {loading ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
};

export default ReservationForm;
