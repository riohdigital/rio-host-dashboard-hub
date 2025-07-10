
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
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
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
      property_id: reservation.property_id || undefined,
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

  // Calcular valores financeiros automaticamente
  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (name === 'total_revenue' || name === 'property_id') {
        const totalRevenue = value.total_revenue || 0;
        
        if (selectedProperty && totalRevenue > 0) {
          // Nova lógica de cálculo
          const cleaningFee = selectedProperty.cleaning_fee || 0;
          const commissionRate = selectedProperty.commission_rate || 0;
          
          // Base de Cálculo = Valor Total - Taxa de Limpeza
          const baseRevenue = totalRevenue - cleaningFee;
          
          // Comissão Co-anfitrião = Base de Cálculo * Comissão (%)
          const commissionAmount = baseRevenue * commissionRate;
          
          // Total do Proprietário = Base de Cálculo - Comissão Co-anfitrião
          const ownerTotal = baseRevenue - commissionAmount;

          // Atualizar os valores apenas se realmente mudaram
          const currentBase = value.base_revenue || 0;
          const currentCommission = value.commission_amount || 0;
          const currentNet = value.net_revenue || 0;
          
          if (Math.abs(currentBase - baseRevenue) > 0.01) {
            setValue('base_revenue', Number(baseRevenue.toFixed(2)));
          }
          
          if (Math.abs(currentCommission - commissionAmount) > 0.01) {
            setValue('commission_amount', Number(commissionAmount.toFixed(2)));
          }
          
          if (Math.abs(currentNet - ownerTotal) > 0.01) {
            setValue('net_revenue', Number(ownerTotal.toFixed(2)));
          }
        } else {
          // Se não há propriedade, zerar cálculos automáticos
          setValue('base_revenue', 0);
          setValue('commission_amount', 0);
          setValue('net_revenue', 0);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [watch, setValue, selectedProperty]);

  // Atualizar propriedade selecionada quando property_id mudar
  useEffect(() => {
    const subscription = watch((value) => {
      if (value.property_id) {
        const property = properties.find(p => p.id === value.property_id);
        setSelectedProperty(property || null);
      } else {
        setSelectedProperty(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [watch, properties]);

  const onSubmit = async (data: ReservationFormData) => {
    setLoading(true);
    try {
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

  // Cálculos para exibição no detalhamento financeiro
  const totalRevenue = watchedValues.total_revenue || 0;
  const cleaningFee = selectedProperty?.cleaning_fee || 0;
  const baseRevenue = totalRevenue - cleaningFee;
  const commissionRate = selectedProperty?.commission_rate || 0;
  const commissionAmount = baseRevenue * commissionRate;
  const ownerTotal = baseRevenue - commissionAmount;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="bg-gradient-to-r from-[#6A6DDF] to-[#8B5CF6] bg-clip-text text-transparent">
            {reservation ? 'Editar Reserva' : 'Nova Reserva'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Seção 1: Dados da Reserva */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                📋 Dados da Reserva
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="property_id">Propriedade</Label>
                  <Select 
                    value={watchedValues.property_id || ''} 
                    onValueChange={(value) => setValue('property_id', value || undefined)}
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
                  <Label htmlFor="total_revenue">Valor Total da Reserva (R$)</Label>
                  <Input
                    id="total_revenue"
                    type="number"
                    step="0.01"
                    {...register('total_revenue', { valueAsNumber: true })}
                    placeholder="Ex: 1500.00"
                    className="font-medium"
                  />
                  {errors.total_revenue && (
                    <p className="text-sm text-red-600">{errors.total_revenue.message}</p>
                  )}
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
                      <SelectValue placeholder="Selecione o status" />
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

      {/* Seção 2: Detalhamento Financeiro */}
      {selectedProperty && totalRevenue > 0 && (
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800 flex items-center gap-2">
              📊 Detalhamento Financeiro
              <span className="text-sm font-normal text-blue-600">
                (Cálculo Automático)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 font-mono text-sm">
              <div className="flex justify-between items-center p-2 bg-white rounded border">
                <span className="text-gray-700">Valor Total da Reserva:</span>
                <span className="font-semibold text-gray-900">
                  R$ {totalRevenue.toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-2 bg-white rounded border">
                <span className="text-gray-700">(- Taxa de Limpeza):</span>
                <span className="font-semibold text-red-600">
                  R$ {cleaningFee.toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-2 bg-blue-100 rounded border-2 border-blue-300">
                <span className="text-blue-800 font-medium">(=) Base de Cálculo:</span>
                <span className="font-bold text-blue-900">
                  R$ {baseRevenue.toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-2 bg-white rounded border">
                <span className="text-gray-700">
                  (- Comissão Co-Anfitrião {((commissionRate || 0) * 100).toFixed(1)}%):
                </span>
                <span className="font-semibold text-red-600">
                  R$ {commissionAmount.toFixed(2)}
                </span>
              </div>
              
              <div className="border-t-2 border-gray-300 pt-2">
                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg border-2 border-green-300">
                  <span className="text-green-800 font-bold text-base">
                    🏠 TOTAL LÍQUIDO DO PROPRIETÁRIO:
                  </span>
                  <span className="font-bold text-green-900 text-lg">
                    R$ {ownerTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-blue-100 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>Propriedade:</strong> {selectedProperty.nickname || selectedProperty.name} | 
                <strong> Comissão:</strong> {((selectedProperty.commission_rate || 0) * 100).toFixed(1)}% | 
                <strong> Taxa Limpeza:</strong> R$ {(selectedProperty.cleaning_fee || 0).toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mensagem quando não há propriedade selecionada */}
      {(!selectedProperty || totalRevenue === 0) && (
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="pt-6">
            <div className="text-center text-gray-500">
              <p className="text-sm">
                {!selectedProperty 
                  ? "📋 Selecione uma propriedade para ver o detalhamento financeiro automático"
                  : "💰 Digite o valor total da reserva para ver os cálculos"
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReservationForm;
