import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/types/property';
import { Reservation } from '@/types/reservation';
import { useToast } from '@/hooks/use-toast';

const reservationSchema = z.object({
  property_id: z.string().optional(),
  platform: z.string().min(1, 'Plataforma é obrigatória'),
  reservation_code: z.string().min(1, 'Código da reserva é obrigatório'),
  guest_name: z.string().optional(),
  number_of_guests: z.number().min(1).optional(),
  check_in_date: z.string().min(1, 'Data de check-in é obrigatória'),
  check_out_date: z.string().min(1, 'Data de check-out é obrigatória'),
  total_revenue: z.number().min(0, 'Receita total deve ser positiva'),
  base_revenue: z.number().min(0).optional(),
  commission_amount: z.number().min(0).optional(),
  net_revenue: z.number().min(0).optional(),
  payment_status: z.string().optional(),
  reservation_status: z.string().min(1, 'Status da reserva é obrigatório'),
});

type ReservationFormData = z.infer<typeof reservationSchema>;

interface ReservationFormProps {
  reservation?: Reservation;
  onSuccess: () => void;
  onCancel: () => void;
}

const ReservationForm = ({ reservation, onSuccess, onCancel }: ReservationFormProps) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ReservationFormData>({
    resolver: zodResolver(reservationSchema),
    defaultValues: reservation ? {
      ...reservation,
      property_id: reservation.property_id || '',
      check_in_date: reservation.check_in_date,
      check_out_date: reservation.check_out_date,
      number_of_guests: reservation.number_of_guests || undefined,
      base_revenue: reservation.base_revenue || undefined,
      commission_amount: reservation.commission_amount || undefined,
      net_revenue: reservation.net_revenue || undefined,
    } : {
      platform: 'Direto',
      reservation_status: 'Confirmada',
      payment_status: 'Pago',
    }
  });

  useEffect(() => {
    fetchProperties();
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

  // Calcular net_revenue automaticamente
  useEffect(() => {
    const subscription = watch((value) => {
      const totalRevenue = value.total_revenue || 0;
      const commissionAmount = value.commission_amount || 0;
      const netRevenue = totalRevenue - commissionAmount;
      setValue('net_revenue', netRevenue);
    });

    return () => subscription.unsubscribe();
  }, [watch, setValue]);

  const onSubmit = async (data: ReservationFormData) => {
    setLoading(true);
    try {
      // Preparar dados para envio garantindo que campos obrigatórios estejam presentes
      const submitData = {
        platform: data.platform,
        reservation_code: data.reservation_code,
        check_in_date: data.check_in_date,
        check_out_date: data.check_out_date,
        total_revenue: data.total_revenue,
        reservation_status: data.reservation_status,
        property_id: data.property_id && data.property_id !== '' ? data.property_id : null,
        guest_name: data.guest_name || null,
        number_of_guests: data.number_of_guests || null,
        base_revenue: data.base_revenue || null,
        commission_amount: data.commission_amount || null,
        net_revenue: data.net_revenue || null,
        payment_status: data.payment_status || null,
      };

      if (reservation) {
        // Atualizar reserva existente
        const { error } = await supabase
          .from('reservations')
          .update(submitData)
          .eq('id', reservation.id);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Reserva atualizada com sucesso!",
        });
      } else {
        // Criar nova reserva
        const { error } = await supabase
          .from('reservations')
          .insert(submitData);

        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Reserva criada com sucesso!",
        });
      }

      onSuccess();
    } catch (error) {
      console.error('Erro ao salvar reserva:', error);
      toast({
        title: "Erro",
        description: `Não foi possível salvar a reserva: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const watchedValues = watch();

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>
          {reservation ? 'Editar Reserva' : 'Nova Reserva'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="property_id">Propriedade</Label>
              <Select 
                value={watchedValues.property_id || ''} 
                onValueChange={(value) => setValue('property_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma propriedade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma propriedade</SelectItem>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.nickname || property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="platform">Plataforma</Label>
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
                <p className="text-sm text-red-600">{errors.platform.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reservation_code">Código da Reserva</Label>
              <Input
                id="reservation_code"
                {...register('reservation_code')}
                placeholder="Ex: HMAB123456"
              />
              {errors.reservation_code && (
                <p className="text-sm text-red-600">{errors.reservation_code.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="guest_name">Nome do Hóspede</Label>
              <Input
                id="guest_name"
                {...register('guest_name')}
                placeholder="Nome do hóspede"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="number_of_guests">Número de Hóspedes</Label>
              <Input
                id="number_of_guests"
                type="number"
                {...register('number_of_guests', { valueAsNumber: true })}
                placeholder="Ex: 2"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_revenue">Receita Total (R$)</Label>
              <Input
                id="total_revenue"
                type="number"
                step="0.01"
                {...register('total_revenue', { valueAsNumber: true })}
                placeholder="Ex: 1500.00"
              />
              {errors.total_revenue && (
                <p className="text-sm text-red-600">{errors.total_revenue.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="commission_amount">Valor da Comissão (R$)</Label>
              <Input
                id="commission_amount"
                type="number"
                step="0.01"
                {...register('commission_amount', { valueAsNumber: true })}
                placeholder="Ex: 300.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="net_revenue">Receita Líquida (R$)</Label>
              <Input
                id="net_revenue"
                type="number"
                step="0.01"
                {...register('net_revenue', { valueAsNumber: true })}
                placeholder="Calculado automaticamente"
                readOnly
                className="bg-gray-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="check_in_date">Data de Check-in</Label>
              <Input
                id="check_in_date"
                type="date"
                {...register('check_in_date')}
              />
              {errors.check_in_date && (
                <p className="text-sm text-red-600">{errors.check_in_date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="check_out_date">Data de Check-out</Label>
              <Input
                id="check_out_date"
                type="date"
                {...register('check_out_date')}
              />
              {errors.check_out_date && (
                <p className="text-sm text-red-600">{errors.check_out_date.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="payment_status">Status do Pagamento</Label>
              <Select 
                value={watchedValues.payment_status || ''} 
                onValueChange={(value) => setValue('payment_status', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pago">Pago</SelectItem>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Atrasado">Atrasado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reservation_status">Status da Reserva</Label>
              <Select 
                value={watchedValues.reservation_status} 
                onValueChange={(value) => setValue('reservation_status', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Confirmada">Confirmada</SelectItem>
                  <SelectItem value="Cancelada">Cancelada</SelectItem>
                  <SelectItem value="Em andamento">Em andamento</SelectItem>
                  <SelectItem value="Finalizada">Finalizada</SelectItem>
                </SelectContent>
              </Select>
              {errors.reservation_status && (
                <p className="text-sm text-red-600">{errors.reservation_status.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : reservation ? 'Atualizar' : 'Criar'} Reserva
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ReservationForm;
