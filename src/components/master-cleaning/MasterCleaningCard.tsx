import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserX, UserCheck, Calendar, Clock, MapPin, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { ReservationWithCleanerInfo, CleanerProfile } from '@/types/master-cleaning';

interface MasterCleaningCardProps {
  reservation: ReservationWithCleanerInfo;
  cleaners: CleanerProfile[];
  onReassign: (reservationId: string, cleanerId: string) => void;
  onUnassign: (reservationId: string) => void;
  onPropertyCleanersLoad?: (propertyId: string, cleaners: CleanerProfile[]) => void;
  isLoading?: boolean;
}

const getStatusVariant = (status: string | null): 'default' | 'destructive' | 'secondary' | 'outline' => {
  switch (status) {
    case 'Confirmada': return 'default';
    case 'Cancelada': return 'destructive';
    case 'Finalizada': return 'secondary';
    default: return 'outline';
  }
};

const getCleaningStatusVariant = (status: string | null): 'default' | 'destructive' | 'secondary' | 'outline' => {
  switch (status) {
    case 'Pendente': return 'outline';
    case 'Realizada': return 'default';
    default: return 'secondary';
  }
};

const MasterCleaningCard = ({ 
  reservation, 
  cleaners, 
  onReassign, 
  onUnassign,
  onPropertyCleanersLoad,
  isLoading = false 
}: MasterCleaningCardProps) => {
  const [selectedCleaner, setSelectedCleaner] = React.useState<string>('');
  const [propertyCleaners, setPropertyCleaners] = React.useState<CleanerProfile[]>(cleaners);
  const [loadingCleaners, setLoadingCleaners] = React.useState(false);

  // Buscar faxineiras da propriedade usando a mesma lógica do ReservationForm
  const fetchCleanersForProperty = async (propertyId: string) => {
    if (propertyCleaners.length > 0) return; // Já carregou
    
    setLoadingCleaners(true);
    try {
      const { data, error } = await supabase.rpc('fn_get_cleaners_for_properties' as any, {
        property_ids: [propertyId]
      });

      if (error) throw error;

      const formattedCleaners = (data || []).map((profile: any) => ({
        id: profile.id,
        user_id: profile.user_id,
        full_name: profile.full_name,
        email: profile.email,
        is_active: profile.is_active,
        phone: profile.phone
      }));

      setPropertyCleaners(formattedCleaners);
      onPropertyCleanersLoad?.(propertyId, formattedCleaners);
    } catch (e) {
      console.error('Erro ao buscar faxineiras da propriedade:', e);
      setPropertyCleaners([]);
      onPropertyCleanersLoad?.(propertyId, []);
    } finally {
      setLoadingCleaners(false);
    }
  };

  // Carregar faxineiras quando o componente montar ou quando não houver faxineiras
  React.useEffect(() => {
    if (cleaners.length === 0) {
      fetchCleanersForProperty(reservation.property_id);
    } else {
      setPropertyCleaners(cleaners);
    }
  }, [reservation.property_id, cleaners.length]);

  const handleReassign = () => {
    if (selectedCleaner) {
      onReassign(reservation.id, selectedCleaner);
      setSelectedCleaner('');
    }
  };

  const checkOutDate = new Date(reservation.check_out_date);
  const isUrgent = checkOutDate <= new Date(Date.now() + 24 * 60 * 60 * 1000);

  return (
    <Card className={`w-full ${isUrgent ? 'border-destructive' : 'border-border'}`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-semibold text-foreground">
            {reservation.properties?.name || 'Propriedade'}
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant={getStatusVariant(reservation.reservation_status)}>
              {reservation.reservation_status}
            </Badge>
            <Badge variant={getCleaningStatusVariant(reservation.cleaning_status)}>
              {reservation.cleaning_status}
            </Badge>
            {isUrgent && <Badge variant="destructive">Urgente</Badge>}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Informações básicas */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Check-out:</span>
            <span className="font-medium text-foreground">
              {format(checkOutDate, "dd/MM/yyyy", { locale: ptBR })}
            </span>
          </div>
          
          {reservation.checkout_time && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Horário:</span>
              <span className="font-medium text-foreground">{reservation.checkout_time}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Código:</span>
            <span className="font-medium text-foreground">{reservation.reservation_code}</span>
          </div>
          
          {reservation.guest_name && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Hóspede:</span>
              <span className="font-medium text-foreground">{reservation.guest_name}</span>
            </div>
          )}
        </div>

        {/* Informações da faxineira */}
        {reservation.cleaner_info ? (
          <div className="bg-muted/30 p-3 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">
                  {reservation.cleaner_info.full_name}
                </span>
                {reservation.cleaner_info.phone && (
                  <span className="text-sm text-muted-foreground">
                    • {reservation.cleaner_info.phone}
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onUnassign(reservation.id)}
                disabled={isLoading}
                className="text-destructive hover:text-destructive"
              >
                <UserX className="h-4 w-4 mr-1" />
                Remover
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-muted/30 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <UserX className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Sem faxineira atribuída</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Select value={selectedCleaner} onValueChange={setSelectedCleaner}>
                {loadingCleaners ? (
                  <SelectTrigger className="flex-1 bg-background cursor-not-allowed opacity-50">
                    <SelectValue placeholder="Carregando faxineiras..." />
                  </SelectTrigger>
                ) : propertyCleaners.length > 0 ? (
                  <>
                    <SelectTrigger className="flex-1 bg-background">
                      <SelectValue placeholder="Selecionar faxineira" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border z-50">
                      {propertyCleaners.map((cleaner) => (
                        <SelectItem key={cleaner.user_id} value={cleaner.user_id}>
                          {cleaner.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </>
                ) : (
                  <SelectTrigger className="flex-1 bg-background cursor-not-allowed opacity-50">
                    <SelectValue placeholder="Nenhuma faxineira disponível" />
                  </SelectTrigger>
                )}
              </Select>
              
              <Button
                size="sm"
                onClick={handleReassign}
                disabled={!selectedCleaner || isLoading}
              >
                <UserCheck className="h-4 w-4 mr-1" />
                Atribuir
              </Button>
            </div>
          </div>
        )}

        {/* Próximo check-in se houver */}
        {reservation.next_check_in_date && (
          <div className="text-xs text-muted-foreground bg-primary/5 p-2 rounded">
            <strong>Próximo check-in:</strong> {format(new Date(reservation.next_check_in_date), "dd/MM/yyyy", { locale: ptBR })}
            {reservation.next_checkin_time && ` às ${reservation.next_checkin_time}`}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MasterCleaningCard;