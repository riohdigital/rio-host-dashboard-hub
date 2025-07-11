import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, TrendingUp, Building2, CalendarDays } from 'lucide-react'; // Adicionado CalendarDays
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/types/property';
import { Reservation } from '@/types/reservation';
import { useToast } from '@/hooks/use-toast';

// --- MELHORIA 2: Adicionando validação de data no Schema ---
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
}).refine(data => {
  if (data.check_in_date && data.check_out_date) {
    return new Date(data.check_out_date) > new Date(data.check_in_date);
  }
  return true;
}, {
  message: "A data de check-out deve ser posterior à de check-in.",
  path: ["check_out_date"], // Define qual campo receberá a mensagem de erro
});
// --- FIM DA MELHORIA 2 ---

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
  // --- MELHORIA 1: Estado para armazenar o número de dias ---
  const [numberOfDays, setNumberOfDays] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control, // Adicionado para o Select
    formState: { errors },
  } = useForm<ReservationFormData>({
    resolver: zodResolver(reservationSchema),
    defaultValues: reservation ? {
      // ... (defaultValues permanecem os mesmos)
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
      const { data, error } = await supabase.from('properties').select('*').order('name');
      if (error) throw error;
      setProperties(data || []);
      // Se estiver editando, pré-seleciona a propriedade
      if(reservation?.property_id) {
        const property = data?.find(p => p.id === reservation.property_id);
        setSelectedProperty(property || null);
      }
    } catch (error) {
      console.error('Erro ao buscar propriedades:', error);
    }
  };

  // Observador para calcular automaticamente os valores
  useEffect(() => {
    const subscription = watch((value, { name, type }) => {
      // --- MELHORIA 1: Calcular dias quando as datas mudam ---
      if (name === 'check_in_date' || name === 'check_out_date') {
        if (value.check_in_date && value.check_out_date) {
          const checkIn = new Date(value.check_in_date);
          const checkOut = new Date(value.check_out_date);
          if (checkOut > checkIn) {
            const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            setNumberOfDays(diffDays);
          } else {
            setNumberOfDays(null);
          }
        } else {
          setNumberOfDays(null);
        }
      }

      if (name === 'total_revenue' || name === 'property_id') {
        const totalRevenue = value.total_revenue || 0;
        if (selectedProperty && totalRevenue > 0) {
          const cleaningFee = selectedProperty.cleaning_fee || 0;
          const commissionRate = selectedProperty.commission_rate || 0;
          const baseRevenue = totalRevenue - cleaningFee;
          const commissionAmount = baseRevenue * commissionRate;
          const ownerTotal = baseRevenue - commissionAmount;

          setValue('base_revenue', Number(baseRevenue.toFixed(2)));
          setValue('commission_amount', Number(commissionAmount.toFixed(2)));
          setValue('net_revenue', Number(ownerTotal.toFixed(2)));
        } else {
          setValue('base_revenue', 0);
          setValue('commission_amount', 0);
          setValue('net_revenue', 0);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [watch, setValue, selectedProperty]);
  
  // Atualizar propriedade selecionada
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
    // ... (lógica de submit permanece a mesma)
  };

  const watchedValues = watch();

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
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                📋 Dados da Reserva
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* ... (campos de propriedade e plataforma permanecem os mesmos) ... */}
              </div>

              {/* ... (campos de código da reserva e nome do hóspede permanecem os mesmos) ... */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* ... (campo número de hóspedes) ... */}
                {/* ... (campo valor total da reserva) ... */}
              </div>

              {/* --- MELHORIA 1: EXIBIÇÃO DA QUANTIDADE DE DIAS --- */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="check_in_date">Data de Check-in</Label>
                  <Input type="date" {...register('check_in_date')} />
                  {errors.check_in_date && (<p className="text-sm text-red-600">{errors.check_in_date.message}</p>)}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="check_out_date">Data de Check-out</Label>
                  <Input type="date" {...register('check_out_date')} />
                  {errors.check_out_date && (<p className="text-sm text-red-600">{errors.check_out_date.message}</p>)}
                </div>
                <div className="space-y-2">
                  <Label>Total de Diárias</Label>
                  <div className="flex items-center h-10 px-3 border border-gray-200 rounded-md bg-gray-50">
                    {numberOfDays !== null ? (
                      <>
                        <CalendarDays className="h-4 w-4 mr-2 text-gray-500" />
                        <span className="font-medium text-gray-800">{numberOfDays} {numberOfDays === 1 ? 'noite' : 'noites'}</span>
                      </>
                    ) : (
                      <span className="text-gray-400">--</span>
                    )}
                  </div>
                </div>
              </div>
              {/* --- FIM DA MELHORIA 1 --- */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* ... (campos de status de pagamento e reserva permanecem os mesmos) ... */}
              </div>
            </div>

            <div className="flex justify-end space-x-4 pt-4">
              {/* ... (botões permanecem os mesmos) ... */}
            </div>
          </form>
        </CardContent>
      </Card>
      {/* ... (seção de detalhamento financeiro permanece a mesma) ... */}
      {/* ... (mensagem de "selecione uma propriedade" permanece a mesma) ... */}
    </div>
  );
};

export default ReservationForm;
