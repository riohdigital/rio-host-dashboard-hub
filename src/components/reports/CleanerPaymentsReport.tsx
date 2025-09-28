import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Download, Brush, Calendar, User, ChevronDown } from 'lucide-react';
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
  const { selectedProperties, selectedPeriod, selectedPlatform, customStartDate, customEndDate } = useGlobalFilters();
  const { startDateString, endDateString } = useDateRange(selectedPeriod, customStartDate, customEndDate);
  const { toast } = useToast();
  const { exportToExcel } = usePDFExport();
  const [rows, setRows] = useState<CleanerRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Build property IDs array for the function call
        let propertyIds: string[] | null = null;
        if (selectedProperties.length > 0 && !selectedProperties.includes('todas')) {
          propertyIds = selectedProperties;
        }

        // Prepare date range
        let startDate = '1900-01-01';
        let endDate = '2099-12-31';
        if (selectedPeriod !== 'general') {
          startDate = startDateString;
          endDate = endDateString;
        }

        // Use the database function that properly joins with cleaner profiles
        const { data: allReservations, error: functionError } = await supabase
          .rpc('fn_get_all_cleaner_reservations', {
            start_date: startDate,
            end_date: endDate,
            property_ids: propertyIds
          });

        if (functionError) {
          console.error('Function error:', functionError);
          throw functionError;
        }

        // Filter by platform if needed
        let filteredReservations = allReservations || [];
        if (selectedPlatform && selectedPlatform !== 'all') {
          filteredReservations = filteredReservations.filter((r: any) => r.platform === selectedPlatform);
        }

        const mapped: CleanerRow[] = filteredReservations.map((r: any) => {
          const cleanerName = r.cleaner_info?.full_name || 
                             r.cleaner_info?.email || 
                             'Não atribuído';
          
          return {
            id: r.id,
            reservation_code: r.reservation_code,
            cleaner_user_id: r.cleaner_user_id,
            cleaner_name: cleanerName,
            property_name: r.properties?.name ?? '—',
            check_in_date: r.check_in_date,
            check_out_date: r.check_out_date,
            cleaning_payment_status: r.cleaning_payment_status,
            cleaning_fee: Number(r.cleaning_fee ?? 0),
          };
        });

        setRows(mapped);
      } catch (e) {
        console.error(e);
        toast({ title: 'Erro', description: 'Não foi possível carregar o relatório de faxinas.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedProperties, selectedPeriod, selectedPlatform, startDateString, endDateString, customStartDate, customEndDate, toast]);

  const grouped = useMemo(() => {
    const byCleaner: Record<string, { cleaner_name: string; items: CleanerRow[]; total: number; pendente: number }> = {};
    
    rows.forEach((r) => {
      // Use cleaner_user_id as key, or 'unassigned' for null
      const key = r.cleaner_user_id || 'unassigned';
      
      if (!byCleaner[key]) {
        byCleaner[key] = { 
          cleaner_name: r.cleaner_name, 
          items: [], 
          total: 0, 
          pendente: 0 
        };
      }
      
      byCleaner[key].items.push(r);
      byCleaner[key].total += r.cleaning_fee;
      
      if (r.cleaning_payment_status !== 'Paga') {
        byCleaner[key].pendente += r.cleaning_fee;
      }
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
            
            <Accordion type="multiple" className="space-y-2">
              {Object.entries(grouped).map(([key, g]) => (
                <AccordionItem key={key} value={key} className="border rounded-lg">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-2">
                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4 text-primary" />
                        <div className="font-medium">{g.cleaner_name}</div>
                        <Badge variant="outline" className="ml-2">
                          {g.items.length} {g.items.length === 1 ? 'reserva' : 'reservas'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary">
                          Total: R$ {g.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </Badge>
                        {g.pendente > 0 && (
                          <Badge variant="destructive">
                            Pendente: R$ {g.pendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  
                  <AccordionContent className="px-4 pb-4">
                    <div className="divide-y">
                      {g.items.map((r) => (
                        <div key={r.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                            <Badge variant="outline">{r.reservation_code}</Badge>
                            <div className="text-sm text-muted-foreground">
                              {r.property_name}
                            </div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {r.check_in_date} - {r.check_out_date}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="font-medium">
                              R$ {r.cleaning_fee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                            <Badge 
                              variant={r.cleaning_payment_status === 'Paga' ? 'secondary' : 'destructive'}
                              className="whitespace-nowrap"
                            >
                              {r.cleaning_payment_status || 'Pendente'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CleanerPaymentsReport;
