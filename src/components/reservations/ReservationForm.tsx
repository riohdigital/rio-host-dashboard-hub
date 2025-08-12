import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { Reservation } from '@/types/reservation';
import { Property } from '@/types/property';
import { useToast } from '@/hooks/use-toast';
import { Pencil } from 'lucide-react';

// Schema de validação com os novos campos
const reservationSchema = z.object({
  property_id: z.string().optional(),
  platform: z.string().min(1, 'Plataforma é obrigatória'),
  reservation_code: z.string().min(1, 'Código da reserva é obrigatório'),
  guest_name: z.string().optional(),
  guest_phone: z.string().optional(),
  number_of_guests: z.number().min(1).optional(),
  check_in_date: z.string().min(1, 'Data de check-in é obrigatória'),
  check_out_date: z.string().min(1, 'Data de check-out é obrigatória'),
  checkin_time: z.string().optional(),
  checkout_time: z.string().optional(),
  total_revenue: z.number().min(0, 'Receita total deve ser positiva'),
  base_revenue: z.number().optional(),
  commission_amount: z.number().optional(),
  net_revenue: z.number().optional(),
  payment_status: z.string().optional(),
  reservation_status: z.string().min(1, 'Status da reserva é obrigatório'),
  payment_date: z.string().optional(),
  // Novos campos de faxina
  cleaner_user_id: z.string().optional(),
  cleaning_payment_status: z.string().optional(),
  cleaning_rating: z.number().min(0).max(5).optional(),
  cleaning_notes: z.string().optional(),
  cleaning_fee: z.number().optional(),
  cleaning_allocation: z.string().optional(),
}).refine(data => {
  if (data.check_in_date && data.check_out_date) {
    return new Date(data.check_out_date) > new Date(data.check_in_date);
  }
  return true;
}, {
  message: "A data de check-out deve ser posterior à de check-in.",
  path: ["check_out_date"],
});

type ReservationFormData = z.infer<typeof reservationSchema>;

interface ReservationFormProps {
  reservation?: Reservation | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const ReservationForm = ({ reservation, onSuccess, onCancel }: ReservationFormProps) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(false);
  const [numberOfDays, setNumberOfDays] = useState(0);
  const [usePropertyDefaults, setUsePropertyDefaults] = useState(true);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ReservationFormData>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      platform: 'Direto',
      reservation_status: 'Confirmada',
      payment_status: 'Pendente',
    }
  });

  const watchedValues = watch();
  
  // Persistência de formulário
  const formKey = `reservation-form-${reservation?.id || 'new'}`;
  const { restoreData, clearSavedData } = useFormPersistence({
    key: formKey,
    values: watchedValues,
    setValue,
    enabled: !reservation // Só persiste para novos formulários
  });

  useEffect(() => {
    fetchProperties();
    
    // Restaurar dados salvos apenas para novos formulários
    if (!reservation) {
      setTimeout(() => restoreData(), 100);
    }
  }, []);

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

  useEffect(() => {
    if (reservation) {
      setValue('property_id', reservation.property_id || '');
      setValue('platform', reservation.platform);
      setValue('reservation_code', reservation.reservation_code);
      setValue('guest_name', reservation.guest_name || '');
      setValue('number_of_guests', reservation.number_of_guests || undefined);
      setValue('check_in_date', new Date(reservation.check_in_date).toISOString().split('T')[0]);
      setValue('check_out_date', new Date(reservation.check_out_date).toISOString().split('T')[0]);
      setValue('total_revenue', reservation.total_revenue);
      setValue('payment_status', reservation.payment_status || '');

      if (reservation.property_id) {
        const property = properties.find(p => p.id === reservation.property_id);
        if (property) {
          setSelectedProperty(property);
          setValue('property_id', property.id);
        }
      }

      if (reservation.checkin_time) {
        setValue('checkin_time', reservation.checkin_time.slice(0, 5));
        setUsePropertyDefaults(false);
      }
      if (reservation.checkout_time) {
        setValue('checkout_time', reservation.checkout_time.slice(0, 5));
      }
    }
  }, [reservation, setValue, properties]);

  useEffect(() => {
    if (selectedProperty) {
      setValue('property_id', selectedProperty.id);
      
      if (usePropertyDefaults) {
        if (selectedProperty.default_checkin_time) {
          setValue('checkin_time', selectedProperty.default_checkin_time.slice(0, 5));
        }
        if (selectedProperty.default_checkout_time) {
          setValue('checkout_time', selectedProperty.default_checkout_time.slice(0, 5));
        }
      }
    }
  }, [selectedProperty, setValue, usePropertyDefaults]);

  const watchedPropertyId = watch('property_id');
  useEffect(() => {
    if (watchedPropertyId) {
      const property = properties.find(p => p.id === watchedPropertyId);
      setSelectedProperty(property || null);
    }
  }, [watchedPropertyId, properties]);

  useEffect(() => {
    if (watchedValues.check_in_date && watchedValues.check_out_date) {
      const checkIn = new Date(watchedValues.check_in_date);
      const checkOut = new Date(watchedValues.check_out_date);
      if (checkOut > checkIn) {
        const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setNumberOfDays(diffDays);
      } else {
        setNumberOfDays(0);
      }
    } else {
      setNumberOfDays(0);
    }

    if (selectedProperty && watchedValues.total_revenue > 0) {
      const totalRevenue = watchedValues.total_revenue;
      const cleaningFee = selectedProperty.cleaning_fee || 0;
      const commissionRate = selectedProperty.commission_rate || 0;
      
      const baseRevenue = totalRevenue - cleaningFee;
      const commissionAmount = baseRevenue * commissionRate;
      const netRevenue = baseRevenue - commissionAmount;

      setValue('base_revenue', Number(baseRevenue.toFixed(2)));
      setValue('commission_amount', Number(commissionAmount.toFixed(2)));
      setValue('net_revenue', Number(netRevenue.toFixed(2)));
    }
  }, [watchedValues.check_in_date, watchedValues.check_out_date, watchedValues.total_revenue, selectedProperty, setValue]);

  const onSubmit = async (data: ReservationFormData) => {
    setLoading(true);
    try {
      const totalRevenue = data.total_revenue;
      const cleaningFee = selectedProperty?.cleaning_fee || 0;
      const commissionRate = selectedProperty?.commission_rate || 0;
      
      const baseRevenue = totalRevenue - cleaningFee;
      const commissionAmount = baseRevenue * commissionRate;
      const netRevenue = baseRevenue - commissionAmount;

      const submissionData = {
        property_id: data.property_id || null,
        platform: data.platform,
        reservation_code: data.reservation_code,
          guest_name: data.guest_name || null,
          guest_phone: data.guest_phone || null,
          number_of_guests: data.number_of_guests || null,
        check_in_date: data.check_in_date,
        check_out_date: data.check_out_date,
        total_revenue: data.total_revenue,
        base_revenue: baseRevenue,
        commission_amount: commissionAmount,
        net_revenue: netRevenue,
        payment_date: data.payment_date || null,
        checkin_time: data.checkin_time || null,
        checkout_time: data.checkout_time || null,
        payment_status: data.payment_status || null,
        reservation_status: data.reservation_status,
      };

      if (reservation) {
        const { error } = await supabase
          .from('reservations')
          .update(submissionData)
          .eq('id', reservation.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Reserva atualizada com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from('reservations')
          .insert([submissionData]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Reserva criada com sucesso.",
        });
      }

      // Limpar dados salvos após sucesso
      clearSavedData();
      onSuccess();
    } catch (error) {
      console.error('Erro ao salvar reserva:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a reserva.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!selectedProperty && watchedValues.total_revenue === 0) {
    return (
      <div className="p-6 text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Selecione uma propriedade</h3>
        <p className="text-gray-600">Escolha uma propriedade para começar a preencher os dados da reserva.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Seção 1: Informações da Reserva */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-blue-600 border-b pb-2">
          Informações da Reserva
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="property_id">Propriedade *</Label>
            <Select 
              value={watchedValues.property_id || ''} 
              onValueChange={(value) => setValue('property_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma propriedade" />
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
              value={watchedValues.platform} 
              onValueChange={(value) => setValue('platform', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Airbnb">Airbnb</SelectItem>
                <SelectItem value="Booking.com">Booking.com</SelectItem>
                <SelectItem value="Direto">Direto</SelectItem>
                <SelectItem value="Outros">Outros</SelectItem>
              </SelectContent>
            </Select>
            {errors.platform && (
              <span className="text-red-500 text-sm">{errors.platform.message}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="reservation_code">Código da Reserva *</Label>
            <Input
              id="reservation_code"
              {...register('reservation_code')}
              placeholder="Ex: HMAB123456"
            />
            {errors.reservation_code && (
              <span className="text-red-500 text-sm">{errors.reservation_code.message}</span>
            )}
          </div>
          
          <div>
            <Label htmlFor="guest_name">Nome do Hóspede</Label>
            <Input
              id="guest_name"
              {...register('guest_name')}
              placeholder="Nome do hóspede"
            />
          </div>
          
          <div>
            <Label htmlFor="guest_phone">Telefone do Hóspede</Label>
            <Input
              id="guest_phone"
              {...register('guest_phone')}
              placeholder="(11) 99999-9999"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="number_of_guests">Número de Hóspedes</Label>
            <Input
              id="number_of_guests"
              type="number"
              {...register('number_of_guests', { valueAsNumber: true })}
              placeholder="Ex: 2"
            />
          </div>
          
          <div>
            <Label htmlFor="total_revenue">Receita Total (R$) *</Label>
            <Input
              id="total_revenue"
              type="number"
              step="0.01"
              {...register('total_revenue', { valueAsNumber: true })}
              placeholder="Ex: 1500.00"
            />
            {errors.total_revenue && (
              <span className="text-red-500 text-sm">{errors.total_revenue.message}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="check_in_date">Data de Check-in *</Label>
            <Input
              id="check_in_date"
              type="date"
              {...register('check_in_date')}
              className={errors.check_in_date ? 'border-red-500' : ''}
            />
            {errors.check_in_date && (
              <span className="text-red-500 text-sm">{errors.check_in_date.message}</span>
            )}
          </div>
          <div>
            <Label htmlFor="check_out_date">Data de Check-out *</Label>
            <Input
              id="check_out_date"
              type="date"
              {...register('check_out_date')}
              className={errors.check_out_date ? 'border-red-500' : ''}
            />
            {errors.check_out_date && (
              <span className="text-red-500 text-sm">{errors.check_out_date.message}</span>
            )}
          </div>
          <div className="flex flex-col justify-center">
            <Label className="text-sm text-gray-600 mb-2">Número de Diárias</Label>
            <div className="flex items-center justify-center p-2 bg-blue-50 rounded-md border border-blue-200">
              <span className="text-lg font-semibold text-blue-600">
                {numberOfDays > 0 ? `${numberOfDays} ${numberOfDays === 1 ? 'diária' : 'diárias'}` : '-'}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="use_property_defaults"
              checked={usePropertyDefaults}
              onCheckedChange={(checked) => setUsePropertyDefaults(checked as boolean)}
            />
            <Label htmlFor="use_property_defaults" className="text-sm">
              Usar horários padrão da propriedade
            </Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="checkin_time">Horário de Check-in</Label>
              <Input
                id="checkin_time"
                type="time"
                {...register('checkin_time')}
                disabled={usePropertyDefaults}
                className={usePropertyDefaults ? 'bg-gray-100' : ''}
              />
            </div>
            <div>
              <Label htmlFor="checkout_time">Horário de Check-out</Label>
              <Input
                id="checkout_time"
                type="time"
                {...register('checkout_time')}
                disabled={usePropertyDefaults}
                className={usePropertyDefaults ? 'bg-gray-100' : ''}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="payment_status">Status do Pagamento</Label>
            <Select 
              value={watchedValues.payment_status || ''} 
              onValueChange={(value) => setValue('payment_status', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Pago">Pago</SelectItem>
                <SelectItem value="Atrasado">Atrasado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="reservation_status">Status da Reserva *</Label>
            <Select 
              value={watchedValues.reservation_status} 
              onValueChange={(value) => setValue('reservation_status', value)}
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
            {errors.reservation_status && (
              <span className="text-red-500 text-sm">{errors.reservation_status.message}</span>
            )}
          </div>
        </div>
      </div>

      {/* Seção 2: Detalhamento Financeiro */}
      {selectedProperty && watchedValues.total_revenue > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-green-600 border-b pb-2">
            Detalhamento Financeiro
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Receita Total</p>
                  <p className="text-lg font-semibold text-blue-600">
                    R$ {watchedValues.total_revenue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Taxa de Limpeza</p>
                  <p className="text-lg font-semibold text-gray-600">
                    R$ {selectedProperty.cleaning_fee?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Comissão ({(selectedProperty.commission_rate * 100).toFixed(0)}%)</p>
                  <p className="text-lg font-semibold text-orange-600">
                    R$ {watchedValues.commission_amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Valor Líquido para o Proprietário</p>
                <p className="text-2xl font-bold text-green-600">
                  R$ {watchedValues.net_revenue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
          className="bg-blue-600 hover:bg-blue-700 text-white"
          disabled={loading}
        >
          {loading ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
};

export default ReservationForm;
