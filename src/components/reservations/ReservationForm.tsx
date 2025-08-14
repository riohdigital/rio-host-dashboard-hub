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
import { Pencil, Star, Check, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import CleanerCreateModal from './CleanerCreateModal';

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
    // Campos de faxina
    cleaning_destination: z.string().optional(), // Novo campo unificado para a lógica da UI
    cleaner_user_id: z.string().optional(), // Mantido para o DB
    cleaning_allocation: z.string().optional(), // Mantido para o DB
    cleaning_payment_status: z.string().optional(),
    cleaning_rating: z.number().min(0).max(5).optional(),
    cleaning_notes: z.string().optional(),
    cleaning_fee: z.number().optional(),
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
    const [cleaners, setCleaners] = useState<{ user_id: string; full_name: string | null; email: string }[]>([]);
    const [editingCleaningFee, setEditingCleaningFee] = useState(false);
    const [editingCommission, setEditingCommission] = useState(false);
    const [manualCleaningFee, setManualCleaningFee] = useState<number | undefined>(undefined);
    const [manualCommission, setManualCommission] = useState<number | undefined>(undefined);
    const [showCleanerForm, setShowCleanerForm] = useState(false);
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
            cleaning_destination: 'none', // Valor padrão para a nova lógica
        }
    });

    const watchedValues = watch();
    
    // Persistência de formulário
    const formKey = `reservation-form-${reservation?.id || 'new'}`;
    const { restoreData, clearSavedData } = useFormPersistence({
        key: formKey,
        values: watchedValues,
        setValue,
        enabled: !reservation
    });

    useEffect(() => {
        fetchProperties();
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
        if (reservation && properties.length) {
            Object.keys(reservation).forEach(key => {
                const formKey = key as keyof ReservationFormData;
                if (formKey === 'check_in_date' || formKey === 'check_out_date') {
                    setValue(formKey, new Date(reservation[formKey]!).toISOString().split('T')[0]);
                } else if (formKey === 'checkin_time' || formKey === 'checkout_time') {
                    if (reservation[formKey]) {
                        setValue(formKey, reservation[formKey]!.slice(0, 5));
                        if(formKey === 'checkin_time') setUsePropertyDefaults(false);
                    }
                } else {
                    const value = reservation[formKey as keyof Reservation];
                    if (value !== undefined && value !== null && typeof value !== 'boolean') {
                        setValue(formKey, value);
                    }
                }
            });
            
            // Lógica para definir o 'cleaning_destination' inicial com base nos dados existentes
            if (reservation.cleaner_user_id) {
                setValue('cleaning_destination', reservation.cleaner_user_id);
            } else if (reservation.cleaning_allocation === 'co_anfitriao') {
                setValue('cleaning_destination', 'host');
            } else if (reservation.cleaning_allocation === 'proprietario') {
                setValue('cleaning_destination', 'owner');
            } else {
                setValue('cleaning_destination', 'none');
            }

            if (reservation.property_id) {
                const property = properties.find(p => p.id === reservation.property_id);
                if (property) {
                    setSelectedProperty(property);
                }
            }
        }
    }, [reservation, setValue, properties]);

    useEffect(() => {
        if (selectedProperty && usePropertyDefaults) {
            if (selectedProperty.default_checkin_time) setValue('checkin_time', selectedProperty.default_checkin_time.slice(0, 5));
            if (selectedProperty.default_checkout_time) setValue('checkout_time', selectedProperty.default_checkout_time.slice(0, 5));
        }
    }, [selectedProperty, setValue, usePropertyDefaults]);

    const watchedPropertyId = watch('property_id');
    useEffect(() => {
        if (watchedPropertyId) {
            const property = properties.find(p => p.id === watchedPropertyId);
            setSelectedProperty(property || null);
        }
    }, [watchedPropertyId, properties]);

    const fetchCleanersForProperty = async (propertyId: string) => {
        try {
            const { data: accessList, error: accessError } = await supabase
                .from('user_property_access')
                .select('user_id')
                .eq('property_id', propertyId);
            if (accessError) throw accessError;
            const userIds = (accessList || []).map((a: any) => a.user_id).filter(Boolean);
            if (userIds.length === 0) {
                setCleaners([]);
                return;
            }
            const { data: profiles, error: profError } = await supabase
                .from('user_profiles')
                .select('user_id, full_name, email, role')
                .eq('role', 'faxineira')
                .in('user_id', userIds);
            if (profError) throw profError;
            setCleaners((profiles || []).map((p: any) => ({ user_id: p.user_id, full_name: p.full_name, email: p.email })));
        } catch (e) {
            console.error('Erro ao buscar faxineiras da propriedade:', e);
            setCleaners([]);
        }
    };

    useEffect(() => {
        if (watchedPropertyId) {
            fetchCleanersForProperty(watchedPropertyId);
        } else {
            setCleaners([]);
        }
    }, [watchedPropertyId]);

    useEffect(() => {
        const checkIn = watchedValues.check_in_date ? new Date(watchedValues.check_in_date) : null;
        const checkOut = watchedValues.check_out_date ? new Date(watchedValues.check_out_date) : null;
        if (checkOut && checkIn && checkOut > checkIn) {
            const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
            setNumberOfDays(Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        } else {
            setNumberOfDays(0);
        }

        if (selectedProperty && watchedValues.total_revenue > 0) {
            const totalRevenue = watchedValues.total_revenue;
            const commissionRate = selectedProperty.commission_rate || 0;
            const destination = watchedValues.cleaning_destination;
            
            // 1. Determina a taxa de limpeza efetiva (manual ou padrão)
            const effectiveCleaningFee = manualCleaningFee ?? (selectedProperty.cleaning_fee || 0);
            
            // 2. Calcula a receita base (o que será dividido entre anfitrião e proprietário)
            const baseRevenue = totalRevenue - effectiveCleaningFee;

            // 3. Determina a comissão efetiva (manual ou padrão)
            const defaultCommission = baseRevenue * commissionRate;
            const effectiveCommission = manualCommission ?? defaultCommission;

            // 4. Inicia os valores finais de comissão e valor líquido
            let finalCommission = effectiveCommission;
            let finalNetRevenue = baseRevenue - effectiveCommission;

            // 5. Ajusta os valores com base na destinação da taxa de limpeza
            if (destination === 'host') {
                finalCommission += effectiveCleaningFee;
            } else if (destination === 'owner') {
                finalNetRevenue += effectiveCleaningFee;
            }
            // Se for 'none' ou um ID de faxineira, a taxa já foi subtraída e não entra na divisão.
            
            setValue('cleaning_fee', Number(effectiveCleaningFee.toFixed(2)));
            setValue('base_revenue', Number(baseRevenue.toFixed(2)));
            setValue('commission_amount', Number(finalCommission.toFixed(2)));
            setValue('net_revenue', Number(finalNetRevenue.toFixed(2)));
        }
    }, [
        watchedValues.check_in_date,
        watchedValues.check_out_date,
        watchedValues.total_revenue,
        watchedValues.cleaning_destination,
        selectedProperty,
        manualCleaningFee,
        manualCommission,
        setValue
    ]);

    const onSubmit = async (data: ReservationFormData) => {
        setLoading(true);
        try {
            // Mapeia o campo unificado 'cleaning_destination' de volta para os campos do banco de dados
            let finalCleanerId: string | null = null;
            let finalCleaningAllocation: string | null = null;
            
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

            if (uuidRegex.test(data.cleaning_destination || '')) {
                finalCleanerId = data.cleaning_destination!;
                finalCleaningAllocation = null;
            } else if (data.cleaning_destination === 'host') {
                finalCleaningAllocation = 'co_anfitriao';
            } else if (data.cleaning_destination === 'owner') {
                finalCleaningAllocation = 'proprietario';
            }

            const submissionData: any = {
                ...data,
                cleaner_user_id: finalCleanerId,
                cleaning_allocation: finalCleaningAllocation,
                property_id: data.property_id || null,
                guest_name: data.guest_name || null,
                guest_phone: data.guest_phone || null,
                number_of_guests: data.number_of_guests || null,
                payment_date: data.payment_date || null,
                checkin_time: data.checkin_time || null,
                checkout_time: data.checkout_time || null,
                payment_status: data.payment_status || null,
                cleaning_payment_status: data.cleaning_payment_status || null,
                cleaning_notes: data.cleaning_notes || null,
                cleaning_rating: data.cleaning_rating ?? 0,
            };
            delete submissionData.cleaning_destination; // Remove o campo temporário

            if (reservation) {
                const { error } = await supabase.from('reservations').update(submissionData).eq('id', reservation.id);
                if (error) throw error;
                toast({ title: "Sucesso", description: "Reserva atualizada com sucesso." });
            } else {
                const { error } = await supabase.from('reservations').insert([submissionData]);
                if (error) throw error;
                toast({ title: "Sucesso", description: "Reserva criada com sucesso." });
            }

            clearSavedData();
            onSuccess();
        } catch (error) {
            console.error('Erro ao salvar reserva:', error);
            toast({ title: "Erro", description: "Não foi possível salvar a reserva.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    if (!properties.length && loading) return <p>Carregando propriedades...</p>;

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <h3 className="text-lg font-semibold text-blue-600 border-b pb-2">Informações da Reserva</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="property_id">Propriedade *</Label>
                    <Select value={watchedValues.property_id || ''} onValueChange={(value) => setValue('property_id', value)}>
                        <SelectTrigger><SelectValue placeholder="Selecione uma propriedade" /></SelectTrigger>
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
                    <Select value={watchedValues.platform} onValueChange={(value) => setValue('platform', value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Airbnb">Airbnb</SelectItem>
                            <SelectItem value="Booking.com">Booking.com</SelectItem>
                            <SelectItem value="Direto">Direto</SelectItem>
                            <SelectItem value="Outros">Outros</SelectItem>
                        </SelectContent>
                    </Select>
                    {errors.platform && <span className="text-red-500 text-sm">{errors.platform.message}</span>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="reservation_code">Código da Reserva *</Label>
                    <Input id="reservation_code" {...register('reservation_code')} placeholder="Ex: HMAB123456" />
                    {errors.reservation_code && <span className="text-red-500 text-sm">{errors.reservation_code.message}</span>}
                </div>
                <div>
                    <Label htmlFor="guest_name">Nome do Hóspede</Label>
                    <Input id="guest_name" {...register('guest_name')} placeholder="Nome do hóspede" />
                </div>
                <div>
                    <Label htmlFor="guest_phone">Telefone do Hóspede</Label>
                    <Input id="guest_phone" {...register('guest_phone')} placeholder="(11) 99999-9999" />
                </div>
                 <div>
                    <Label htmlFor="number_of_guests">Número de Hóspedes</Label>
                    <Input id="number_of_guests" type="number" {...register('number_of_guests', { valueAsNumber: true })} placeholder="Ex: 2" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="total_revenue">Receita Total (R$) *</Label>
                    <Input id="total_revenue" type="number" step="0.01" {...register('total_revenue', { valueAsNumber: true })} placeholder="Ex: 1500.00" />
                    {errors.total_revenue && <span className="text-red-500 text-sm">{errors.total_revenue.message}</span>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <Label htmlFor="check_in_date">Data de Check-in *</Label>
                    <Input id="check_in_date" type="date" {...register('check_in_date')} className={errors.check_in_date ? 'border-red-500' : ''} />
                    {errors.check_in_date && <span className="text-red-500 text-sm">{errors.check_in_date.message}</span>}
                </div>
                <div>
                    <Label htmlFor="check_out_date">Data de Check-out *</Label>
                    <Input id="check_out_date" type="date" {...register('check_out_date')} className={errors.check_out_date ? 'border-red-500' : ''} />
                    {errors.check_out_date && <span className="text-red-500 text-sm">{errors.check_out_date.message}</span>}
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
                    <Checkbox id="use_property_defaults" checked={usePropertyDefaults} onCheckedChange={(checked) => setUsePropertyDefaults(checked as boolean)} />
                    <Label htmlFor="use_property_defaults" className="text-sm">Usar horários padrão da propriedade</Label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="checkin_time">Horário de Check-in</Label>
                        <Input id="checkin_time" type="time" {...register('checkin_time')} disabled={usePropertyDefaults} className={usePropertyDefaults ? 'bg-gray-100' : ''} />
                    </div>
                    <div>
                        <Label htmlFor="checkout_time">Horário de Check-out</Label>
                        <Input id="checkout_time" type="time" {...register('checkout_time')} disabled={usePropertyDefaults} className={usePropertyDefaults ? 'bg-gray-100' : ''} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="payment_status">Status do Pagamento</Label>
                    <Select value={watchedValues.payment_status || ''} onValueChange={(value) => setValue('payment_status', value)}>
                        <SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Pendente">Pendente</SelectItem>
                            <SelectItem value="Pago">Pago</SelectItem>
                            <SelectItem value="Atrasado">Atrasado</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="reservation_status">Status da Reserva *</Label>
                    <Select value={watchedValues.reservation_status} onValueChange={(value) => setValue('reservation_status', value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Confirmada">Confirmada</SelectItem>
                            <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                            <SelectItem value="Finalizada">Finalizada</SelectItem>
                            <SelectItem value="Cancelada">Cancelada</SelectItem>
                        </SelectContent>
                    </Select>
                    {errors.reservation_status && <span className="text-red-500 text-sm">{errors.reservation_status.message}</span>}
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-purple-600 border-b pb-2">Serviço de Faxina</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="cleaning_destination">Faxineira responsável</Label>
                        <Select value={watchedValues.cleaning_destination || 'none'} onValueChange={(value) => {
                            if (value === 'new_cleaner') {
                                setShowCleanerForm(true);
                            } else {
                                setValue('cleaning_destination', value);
                            }
                        }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o destino da taxa..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">A decidir/Nenhuma Faxineira</SelectItem>
                                {cleaners.length > 0 && cleaners.map((c) => (
                                    <SelectItem key={c.user_id} value={c.user_id}>
                                        {c.full_name || c.email}
                                    </SelectItem>
                                ))}
                                <SelectItem value="host">Anfitrião (somar à comissão)</SelectItem>
                                <SelectItem value="owner">Proprietário (somar ao líquido)</SelectItem>
                                <SelectItem value="new_cleaner">Novo Cadastro +</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="cleaning_payment_status">Status do Pagamento da Faxina</Label>
                        <Select value={watchedValues.cleaning_payment_status || ''} onValueChange={(value) => setValue('cleaning_payment_status', value)}>
                            <SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Paga">Paga</SelectItem>
                                <SelectItem value="Pagamento no Próximo Ciclo">Pagamento no Próximo Ciclo</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label>Nota da Faxina</Label>
                        <div className="flex items-center gap-1 pt-2">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <button type="button" key={i} onClick={() => setValue('cleaning_rating', i)} className="p-1">
                                    <Star className={(watchedValues.cleaning_rating || 0) >= i ? 'text-yellow-500' : 'text-gray-300'} size={18} />
                                </button>
                            ))}
                            <span className="ml-2 text-sm text-gray-600">{watchedValues.cleaning_rating || 0}/5</span>
                        </div>
                    </div>
                </div>
                <div>
                    <Label htmlFor="cleaning_notes">Observações da Faxina</Label>
                    <Textarea id="cleaning_notes" {...register('cleaning_notes')} placeholder="Ex.: caprichou na cozinha, faltou pano extra..." />
                </div>
            </div>

            {selectedProperty && watchedValues.total_revenue > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-green-600 border-b pb-2">Detalhamento Financeiro</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Receita Total</CardTitle></CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold text-blue-600">
                                    R$ {watchedValues.total_revenue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Taxa de Limpeza</CardTitle>
                                {!editingCleaningFee && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingCleaningFee(true)}><Pencil className="h-4 w-4" /></Button>
                                )}
                            </CardHeader>
                            <CardContent>
                                {editingCleaningFee ? (
                                    <div className="flex items-center gap-2">
                                        <Input type="number" step="0.01" className="h-9" placeholder="R$ 0,00" value={manualCleaningFee ?? ''} onChange={(e) => setManualCleaningFee(e.target.value === '' ? undefined : Number(e.target.value))} />
                                        <Button size="icon" className="h-8 w-8" onClick={() => setEditingCleaningFee(false)}><Check className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setManualCleaningFee(undefined); setEditingCleaningFee(false); }}><X className="h-4 w-4" /></Button>
                                    </div>
                                ) : (
                                    <p className="text-2xl font-bold">
                                        R$ {watchedValues.cleaning_fee?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                        
                        <Card>
                             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Comissão ({(selectedProperty.commission_rate * 100).toFixed(0)}%)</CardTitle>
                                {!editingCommission && (
                                     <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingCommission(true)}><Pencil className="h-4 w-4" /></Button>
                                )}
                            </CardHeader>
                            <CardContent>
                                {editingCommission ? (
                                    <div className="flex items-center gap-2">
                                        <Input type="number" step="0.01" className="h-9" placeholder="R$ 0,00" value={manualCommission ?? ''} onChange={(e) => setManualCommission(e.target.value === '' ? undefined : Number(e.target.value))} />
                                        <Button size="icon" className="h-8 w-8" onClick={() => setEditingCommission(false)}><Check className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setManualCommission(undefined); setEditingCommission(false); }}><X className="h-4 w-4" /></Button>
                                    </div>
                                ) : (
                                    <p className="text-2xl font-bold text-orange-600">
                                        R$ {watchedValues.commission_amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="bg-green-50 border-green-200">
                        <CardContent className="pt-6">
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

            <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={loading}>
                    {loading ? 'Salvando...' : 'Salvar'}
                </Button>
            </div>

            <CleanerCreateModal
                open={showCleanerForm}
                onClose={() => setShowCleanerForm(false)}
                onCleanerCreated={(cleanerId, cleanerName) => {
                    setValue('cleaning_destination', cleanerId);
                    setShowCleanerForm(false);
                    if (watchedPropertyId) {
                        fetchCleanersForProperty(watchedPropertyId);
                    }
                }}
                propertyId={watchedPropertyId}
            />
        </form>
    );
};

export default ReservationForm;
