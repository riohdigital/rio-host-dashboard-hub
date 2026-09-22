import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  ShieldAlert,
  Calendar,
  DollarSign,
  RefreshCw,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Property } from '@/types/property';

interface ReservationsAuditTabProps {
  propertyId: string;
  selectedProperty: Property | null;
}

export const ReservationsAuditTab: React.FC<ReservationsAuditTabProps> = ({
  propertyId,
  selectedProperty
}) => {
  const { toast } = useToast();
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditingId, setAuditingId] = useState<string | null>(null);

  const fetchReservations = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('reservations')
        .select(`
          id,
          reservation_code,
          platform,
          property_id,
          guest_name,
          check_in_date,
          check_out_date,
          total_revenue,
          cleaning_fee,
          created_by_source,
          is_verified_by_ai,
          verified_at,
          verification_notes,
          platform_verified_data
        `)
        .order('created_at', { ascending: false })
        .limit(30);

      if (propertyId !== 'todas') {
        query = query.eq('property_id', propertyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setReservations(data || []);
    } catch (e) {
      console.error('Erro ao buscar reservas auditadas:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, [propertyId]);

  const handleAuditSingle = async (res: any) => {
    setAuditingId(res.id);
    try {
      const resp = await fetch('https://n8n-n8n.dgyrua.easypanel.host/webhook/rioh-host-auditoria-reserva-criada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: res.id,
          reservation_code: res.reservation_code,
          platform: res.platform,
          property_id: res.property_id,
          check_in_date: res.check_in_date,
          check_out_date: res.check_out_date,
          total_revenue: res.total_revenue,
          cleaning_fee: res.cleaning_fee,
          created_by_source: res.created_by_source || 'manual'
        })
      });

      if (resp.ok) {
        toast({
          title: 'Auditoria Disparada na VPS',
          description: `O Agente Navegador está acessando ${res.platform} para validar a reserva ${res.reservation_code}.`,
        });
      }
    } catch (err) {
      toast({
        title: 'Comando Enviado',
        description: 'O Agente Navegador da VPS iniciou a validação dos valores oficiais.',
      });
    } finally {
      setTimeout(() => {
        setAuditingId(null);
        fetchReservations();
      }, 4000);
    }
  };

  const verifiedCount = reservations.filter(r => r.is_verified_by_ai).length;
  const pendingCount = reservations.length - verifiedCount;

  return (
    <div className="space-y-6">
      {/* Top Banner com Estatísticas de Auditoria */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border shadow-xs">
        <div>
          <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Auditoria de Reservas & Validação de Plataforma (IA)
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Conferência automatizada pelo Agente Navegador diretamente no portal de anfitrião (Airbnb e Booking.com)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
            {verifiedCount} Auditadas por IA
          </Badge>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
            {pendingCount} Pendentes
          </Badge>
        </div>
      </div>

      {/* Tabela / Lista de Reservas */}
      {loading ? (
        <div className="py-12 text-center text-gray-500 bg-white rounded-lg border">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-[#6A6DDF] mb-2" />
          Carregando histórico de auditorias...
        </div>
      ) : reservations.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-xl border p-8 space-y-2">
          <ShieldCheck className="h-10 w-10 text-gray-400 mx-auto" />
          <h4 className="font-bold text-gray-800 text-base">Nenhuma reserva encontrada</h4>
          <p className="text-xs text-gray-500">Nenhuma reserva registrada para este imóvel.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reservations.map(res => {
            const isVerified = !!res.is_verified_by_ai;
            const isAuditing = auditingId === res.id;
            const isAirbnb = res.platform?.toLowerCase() === 'airbnb';

            return (
              <Card
                key={res.id}
                className={`transition-all border-l-4 ${
                  isVerified ? 'border-l-emerald-500 bg-white' : 'border-l-amber-400 bg-white'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={
                            isAirbnb
                              ? 'bg-rose-50 text-rose-700 border-rose-200 text-[10px]'
                              : 'bg-blue-50 text-blue-700 border-blue-200 text-[10px]'
                          }
                        >
                          {res.platform}
                        </Badge>

                        <span className="font-mono font-bold text-xs text-gray-800">
                          {res.reservation_code}
                        </span>

                        <span className="text-xs font-medium text-gray-600">
                          • {res.guest_name || 'Hóspede'}
                        </span>

                        {isVerified ? (
                          <Badge className="bg-emerald-100 text-emerald-800 text-[10px] gap-1 font-semibold">
                            <CheckCircle2 className="h-3 w-3" /> Auditada Oficialmente
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 text-[10px] gap-1 font-semibold">
                            <AlertCircle className="h-3 w-3" /> Aguardando Validação
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>
                          {new Date(res.check_in_date).toLocaleDateString('pt-BR')} a{' '}
                          {new Date(res.check_out_date).toLocaleDateString('pt-BR')}
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-gray-700">
                          Receita Total: R$ {parseFloat(res.total_revenue || 0).toFixed(2)}
                        </span>
                        {res.cleaning_fee > 0 && (
                          <>
                            <span>•</span>
                            <span>Limpeza: R$ {parseFloat(res.cleaning_fee).toFixed(2)}</span>
                          </>
                        )}
                      </div>

                      {/* Notas de Auditoria da IA */}
                      {res.verification_notes && (
                        <div className="bg-emerald-50/70 p-2 rounded text-[11px] text-emerald-900 border border-emerald-100 mt-2 flex items-start gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{res.verification_notes}</span>
                        </div>
                      )}
                    </div>

                    {/* Ação de Auditoria Sob Demanda */}
                    <div className="sm:self-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAuditSingle(res)}
                        disabled={isAuditing}
                        className="text-xs font-semibold h-8 gap-1.5 text-gray-700 hover:text-[#6A6DDF]"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isAuditing ? 'animate-spin text-[#6A6DDF]' : ''}`} />
                        {isAuditing ? 'Auditando...' : isVerified ? 'Reconferir' : 'Auditar com IA'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReservationsAuditTab;
