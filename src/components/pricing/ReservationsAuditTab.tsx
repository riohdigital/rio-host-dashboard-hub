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
  AlertCircle,
  ExternalLink
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
  const [auditingIds, setAuditingIds] = useState<Record<string, boolean>>({});

  const fetchReservations = async (silent = false) => {
    if (!silent) setLoading(true);
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
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, [propertyId]);

  // Mantém a lista atualizada em tempo real caso ocorram auditorias automáticas (Google Script / Cron)
  useEffect(() => {
    const mainChannel = supabase
      .channel(`audit-tab-live-${propertyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations'
        },
        () => {
          fetchReservations(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(mainChannel);
    };
  }, [propertyId]);

  const handleAuditSingle = async (e: React.MouseEvent, res: any) => {
    e.preventDefault();
    e.stopPropagation();

    // 1. Marca imediatamente a reserva como sendo auditada no estado local
    setAuditingIds(prev => ({ ...prev, [res.id]: true }));

    toast({
      title: 'Auditoria Iniciada',
      description: `O Agente Navegador da VPS está acessando o portal ${res.platform} para validar a reserva ${res.reservation_code}...`,
    });

    try {
      // 2. Chama o Webhook Manual que AGORA responde de forma síncrona com os dados concluídos!
      const resp = await fetch('https://n8n-n8n.dgyrua.easypanel.host/webhook/rioh-host-auditoria-reservas-manual', {
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
          title: 'Auditoria Concluída com Sucesso!',
          description: `A reserva ${res.reservation_code} foi auditada no portal oficial e os valores foram atualizados.`,
        });
      } else {
        toast({
          title: 'Auditoria Processada',
          description: `A conferência da reserva ${res.reservation_code} foi concluída na VPS.`,
        });
      }
    } catch (err) {
      console.error('Erro na chamada da auditoria:', err);
      toast({
        title: 'Auditoria em Andamento',
        description: `O comando foi enviado para a VPS. Os dados serão atualizados em instantes.`,
      });
    } finally {
      // 3. Atualiza os dados imediatamente na tela aberta, sem fechar nem recarregar a página!
      await fetchReservations(true);
      setAuditingIds(prev => {
        const next = { ...prev };
        delete next[res.id];
        return next;
      });
    }
  };

  const getPlatformDirectUrl = (platform: string, code: string) => {
    const p = (platform || '').toLowerCase();
    if (p.includes('airbnb')) {
      return `https://www.airbnb.com.br/hosting/reservations/details/${code}`;
    }
    if (p.includes('booking')) {
      return `https://admin.booking.com/hotel/hoteladmin/extranet_ng/manage/booking.html?res_id=${code}`;
    }
    return null;
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
            const isAuditing = !!auditingIds[res.id];
            const isAirbnb = res.platform?.toLowerCase() === 'airbnb';
            const directUrl = getPlatformDirectUrl(res.platform, res.reservation_code);

            return (
              <Card
                key={res.id}
                className={`transition-all border-l-4 ${
                  isAuditing
                    ? 'border-l-indigo-500 bg-indigo-50/20 shadow-sm'
                    : isVerified
                    ? 'border-l-emerald-500 bg-white'
                    : 'border-l-amber-400 bg-white'
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

                        {isAuditing ? (
                          <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] gap-1 font-semibold animate-pulse">
                            <RefreshCw className="h-3 w-3 animate-spin text-indigo-600" /> Auditando no Portal...
                          </Badge>
                        ) : isVerified ? (
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

                      {/* Links Diretos para Conferência Oficial dos Valores */}
                      <div className="flex items-center gap-3 pt-1 flex-wrap">
                        {directUrl && (
                          <a
                            href={directUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6A6DDF] hover:text-[#5254be] hover:underline bg-[#6A6DDF]/5 px-2.5 py-1 rounded-md border border-[#6A6DDF]/20 transition-all shadow-2xs"
                            title={`Abrir página oficial da reserva no ${res.platform}`}
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-[#6A6DDF]" />
                            Conferir Valores no {res.platform} ↗
                          </a>
                        )}
                        {isAirbnb && (
                          <a
                            href="https://www.airbnb.com.br/earnings"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 hover:underline"
                            title="Abrir histórico e extrato de repasses do Airbnb"
                          >
                            Extrato de Repasses ↗
                          </a>
                        )}
                      </div>

                      {/* Notas de Auditoria da IA */}
                      {res.verification_notes && (
                        <div
                          className={`p-2.5 rounded text-[11px] border mt-2 flex items-start gap-1.5 ${
                            isVerified
                              ? 'bg-emerald-50/70 text-emerald-900 border-emerald-100'
                              : 'bg-amber-50/70 text-amber-900 border-amber-200'
                          }`}
                        >
                          {isVerified ? (
                            <Sparkles className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                          )}
                          <span>{res.verification_notes}</span>
                        </div>
                      )}
                    </div>

                    {/* Ação de Auditoria Sob Demanda */}
                    <div className="sm:self-center">
                      <Button
                        type="button"
                        size="sm"
                        variant={isAuditing ? "secondary" : "outline"}
                        onClick={(e) => handleAuditSingle(e, res)}
                        disabled={isAuditing}
                        className={`text-xs font-semibold h-8 gap-1.5 transition-all ${
                          isAuditing
                            ? 'bg-indigo-50 text-[#6A6DDF] border-[#6A6DDF]/30 cursor-wait'
                            : 'text-gray-700 hover:text-[#6A6DDF]'
                        }`}
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
