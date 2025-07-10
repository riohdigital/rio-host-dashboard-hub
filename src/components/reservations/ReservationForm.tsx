
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, TrendingUp, Building2 } from 'lucide-react';
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

      {/* Seção 2: Detalhamento Financeiro Melhorado */}
      {selectedProperty && totalRevenue > 0 && (
        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white pb-6">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-white/20 rounded-lg">
                <Calculator className="h-6 w-6" />
              </div>
              Detalhamento Financeiro
              <span className="text-blue-100 text-sm font-normal ml-2">
                (Cálculo Automático)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="space-y-4">
              {/* Valor Total */}
              <div className="flex justify-between items-center p-4 bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-sm">1</span>
                  </div>
                  <span className="text-slate-700 font-medium">Valor Total da Reserva</span>
                </div>
                <span className="font-bold text-slate-900 text-xl">
                  R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              
              {/* Taxa de Limpeza */}
              <div className="flex justify-between items-center p-4 bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 font-semibold text-sm">-</span>
                  </div>
                  <span className="text-slate-700 font-medium">Taxa de Limpeza</span>
                </div>
                <span className="font-bold text-red-600 text-xl">
                  - R$ {cleaningFee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              
              {/* Base de Cálculo */}
              <div className="flex justify-between items-center p-5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl shadow-md text-white">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">=</span>
                  </div>
                  <span className="font-semibold text-lg">Base de Cálculo</span>
                </div>
                <span className="font-bold text-2xl">
                  R$ {baseRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              
              {/* Comissão */}
              <div className="flex justify-between items-center p-4 bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-orange-600 font-semibold text-sm">-</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-700 font-medium">Comissão Co-Anfitrião</span>
                    <span className="text-slate-500 text-sm">
                      {((commissionRate || 0) * 100).toFixed(1)}% sobre a base
                    </span>
                  </div>
                </div>
                <span className="font-bold text-orange-600 text-xl">
                  - R$ {commissionAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              
              {/* Divisor */}
              <div className="border-t-2 border-dashed border-slate-300 my-6"></div>
              
              {/* Total Líquido do Proprietário */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 rounded-2xl opacity-10"></div>
                <div className="relative flex justify-between items-center p-6 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-lg text-white">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-xl">
                      <Building2 className="h-8 w-8" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-xl">TOTAL LÍQUIDO</span>
                      <span className="font-bold text-xl">DO PROPRIETÁRIO</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-6 w-6" />
                      <span className="font-bold text-3xl">
                        R$ {ownerTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Informações da Propriedade */}
            <div className="mt-6 p-4 bg-white/60 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 text-slate-600 text-sm">
                <Building2 className="h-4 w-4" />
                <span className="font-medium">Propriedade:</span>
                <span className="font-semibold text-slate-800">
                  {selectedProperty.nickname || selectedProperty.name}
                </span>
                <span className="mx-2">•</span>
                <span className="font-medium">Comissão:</span>
                <span className="font-semibold text-slate-800">
                  {((selectedProperty.commission_rate || 0) * 100).toFixed(1)}%
                </span>
                <span className="mx-2">•</span>
                <span className="font-medium">Taxa Limpeza:</span>
                <span className="font-semibold text-slate-800">
                  R$ {(selectedProperty.cleaning_fee || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mensagem quando não há propriedade selecionada */}
      {(!selectedProperty || totalRevenue === 0) && (
        <Card className="border-2 border-dashed border-slate-300 bg-slate-50/50">
          <CardContent className="pt-8 pb-8">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                <Calculator className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium mb-2">
                {!selectedProperty 
                  ? "Selecione uma propriedade para ver o detalhamento financeiro"
                  : "Digite o valor total da reserva para calcular automaticamente"
                }
              </p>
              <p className="text-slate-500 text-sm">
                Os cálculos serão atualizados em tempo real conforme você preenche os dados
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReservationForm;
