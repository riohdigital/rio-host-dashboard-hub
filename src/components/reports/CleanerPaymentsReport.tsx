import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, Brush, Calendar, User } from 'lucide-react';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useDateRange } from '@/hooks/dashboard/useDateRange';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePDFExport } from '@/hooks/reports/usePDFExport';

interface CleanerRow {
  id: string;
  reservation_code: string;
  cleaner_user_id: string | null;
  cleaner_name: string;
  property_name: string;
  check_in_date: string;
  check_out_date: string;
  cleaning_payment_status: string | null;
  cleaning_fee: number;
}

const CleanerPaymentsReport: React.FC = () => {
  const { selectedProperties, selectedPeriod } = useGlobalFilters();
  const { startDateString, endDateString } = useDateRange(selectedPeriod);
  const { toast } = useToast();
  const { exportToExcel } = usePDFExport();
  const [rows, setRows] = useState<CleanerRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        let query = supabase
          .from('reservations')
          .select(`id, reservation_code, cleaner_user_id, cleaning_payment_status, cleaning_fee, check_in_date, check_out_date, properties(name)`);

        if (selectedProperties.length > 0 && !selectedProperties.includes('todas')) {
          query = query.in('property_id', selectedProperties);
        }
        if (selectedPeriod !== 'general') {
          query = query
            .lte('check_in_date', endDateString)
            .gte('check_out_date', startDateString);
        }

        const { data, error } = await query.order('check_in_date', { ascending: false }).limit(100);
        if (error) throw error;

        const cleanerIds = Array.from(new Set((data || []).map((r: any) => r.cleaner_user_id).filter(Boolean)));
        let profilesMap: Record<string, string> = {};
        if (cleanerIds.length) {
          const { data: profiles, error: profErr } = await supabase
            .from('user_profiles')
            .select('user_id, full_name, email')
            .in('user_id', cleanerIds);
          if (profErr) throw profErr;
          profilesMap = (profiles || []).reduce((acc: any, p: any) => {
            acc[p.user_id] = p.full_name || p.email || '—';
            return acc;
          }, {});
        }

        const mapped: CleanerRow[] = (data || []).map((r: any) => ({
          id: r.id,
          reservation_code: r.reservation_code,
          cleaner_user_id: r.cleaner_user_id,
          cleaner_name: profilesMap[r.cleaner_user_id] || 'Não atribuído',
          property_name: r.properties?.name ?? '—',
          check_in_date: r.check_in_date,
          check_out_date: r.check_out_date,
          cleaning_payment_status: r.cleaning_payment_status,
          cleaning_fee: Number(r.cleaning_fee ?? 0),
        }));

        setRows(mapped);
      } catch (e) {
        console.error(e);
        toast({ title: 'Erro', description: 'Não foi possível carregar o relatório de faxinas.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedProperties, selectedPeriod, startDateString, endDateString, toast]);

  const grouped = useMemo(() => {
    const byCleaner: Record<string, { cleaner_name: string; items: CleanerRow[]; total: number; pendente: number }> = {};
    rows.forEach((r) => {
      const key = r.cleaner_user_id || 'na';
      if (!byCleaner[key]) byCleaner[key] = { cleaner_name: r.cleaner_name, items: [], total: 0, pendente: 0 };
      byCleaner[key].items.push(r);
      byCleaner[key].total += r.cleaning_fee;
      if (r.cleaning_payment_status !== 'Paga') byCleaner[key].pendente += r.cleaning_fee;
    });
    return byCleaner;
  }, [rows]);

  const handleExportExcel = async () => {
    const groups = Object.values(grouped);
    const flat = rows.map((r) => ({
      Reserva: r.reservation_code,
      Faxineira: r.cleaner_name,
      Propriedade: r.property_name,
      'Check-in': r.check_in_date,
      'Check-out': r.check_out_date,
      'Status Pagamento': r.cleaning_payment_status || '—',
      'Taxa Limpeza (R$)': r.cleaning_fee,
    }));

    await exportToExcel({
      type: 'cleaner_payments',
      title: 'Pagamentos de Faxineiras',
      generatedAt: new Date().toISOString(),
      data: {
        resumo: groups.map((g) => ({
          Faxineira: g.cleaner_name,
          'Total (R$)': g.total,
          'Pendente (R$)': g.pendente,
        })),
        detalhes: flat,
      }
    }, `pagamentos-faxineiras-${new Date().toISOString().split('T')[0]}`);
    toast({ title: 'Sucesso', description: 'Relatório exportado para Excel!' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brush className="h-5 w-5" /> Relatório de Pagamentos de Faxineiras
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Período: {startDateString} a {endDateString}
              </div>
              <Button onClick={handleExportExcel} className="gap-2">
                <Download className="h-4 w-4" /> Exportar Excel
              </Button>
            </div>
            <Separator />
            <div className="space-y-6">
              {Object.entries(grouped).map(([key, g]) => (
                <div key={key} className="border rounded-md p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{g.cleaner_name}</div>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary">Total: R$ {g.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Badge>
                      <Badge variant={g.pendente > 0 ? 'destructive' : 'secondary'}>Pendente: R$ {g.pendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 divide-y">
                    {g.items.map((r) => (
                      <div key={r.id} className="py-2 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{r.reservation_code}</Badge>
                          <div className="hidden md:flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3 w-3" /> {r.check_in_date} - {r.check_out_date}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div>R$ {r.cleaning_fee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                          <Badge variant={r.cleaning_payment_status === 'Paga' ? 'secondary' : 'destructive'}>
                            {r.cleaning_payment_status || '—'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CleanerPaymentsReport;
