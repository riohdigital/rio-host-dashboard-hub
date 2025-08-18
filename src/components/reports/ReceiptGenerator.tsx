import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client'; // ADICIONADO: Import necessário
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, MapPin, User, Phone, Download, FileText, Eye, X } from 'lucide-react'; // ADICIONADO: Ícone X
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useDateRange } from '@/hooks/dashboard/useDateRange';
import jsPDF from 'jspdf';
import ProfessionalReceiptTemplate from './ProfessionalReceiptTemplate'; // ADICIONADO: Novo template

// CÓDIGO ORIGINAL MANTIDO
interface Reservation {
  id: string;
  guest_name: string;
  guest_phone: string;
  check_in_date: string;
  check_out_date: string;
  total_revenue: number;
  platform: string;
  reservation_code: string;
  number_of_guests: number;
  properties?: {
    id: string;
    name: string;
    address?: string;
    cleaning_fee?: number;
    commission_rate?: number;
  };
  payment_status?: string;
  payment_date?: string;
  commission_amount?: number;
  net_revenue?: number;
  cleaning_fee?: number;
  cleaning_allocation?: string;
  cleaner_name?: string;
}
type ReceiptType = 'reservation' | 'payment';

// CÓDIGO ORIGINAL MANTIDO
const ReceiptGenerator = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiptType, setReceiptType] = useState<ReceiptType>('reservation');
  const [previewReservation, setPreviewReservation] = useState<Reservation | null>(null);
  const { toast } = useToast();
  const { selectedProperties, selectedPeriod } = useGlobalFilters();
  const { startDateString, endDateString } = useDateRange(selectedPeriod);

  // Implementação com duas consultas separadas para evitar problemas de join
  useEffect(() => {
    const fetchReservations = async () => {
      try {
        setLoading(true);
        
        // Primera consulta: buscar reservas sem o join problemático
        let query = supabase
          .from('reservations')
          .select(`
            *,
            properties (
              id,
              name,
              address,
              cleaning_fee,
              commission_rate
            )
          `);
  
        // Apply property filter
        if (selectedProperties.length > 0 && !selectedProperties.includes('todas')) {
          query = query.in('property_id', selectedProperties);
        }
  
        // Apply date filter using overlap within the period
        if (selectedPeriod !== 'general') {
          query = query
            .lte('check_in_date', endDateString)
            .gte('check_out_date', startDateString);
        }
  
        const { data: reservationsData, error: reservationsError } = await query
          .order('check_in_date', { ascending: false })
          .limit(50);
  
        if (reservationsError) throw reservationsError;
        
        // Segunda consulta: buscar nomes das faxineiras
        const cleanerIds = [...new Set(reservationsData?.filter(r => r.cleaner_user_id).map(r => r.cleaner_user_id))];
        let cleanerNamesMap: Record<string, string> = {};
        
        if (cleanerIds.length > 0) {
          try {
            const { data: cleanersData, error: cleanersError } = await supabase
              .from('user_profiles')
              .select('user_id, full_name')
              .in('user_id', cleanerIds);
            
            if (!cleanersError && cleanersData) {
              cleanerNamesMap = cleanersData.reduce((acc, cleaner) => {
                acc[cleaner.user_id] = cleaner.full_name;
                return acc;
              }, {} as Record<string, string>);
            }
          } catch (cleanerError) {
            console.warn('Could not fetch cleaner names:', cleanerError);
            // Continue without cleaner names
          }
        }
        
        // Combinar dados no frontend
        const enrichedData = reservationsData.map((r: any) => {
            const commission = (typeof r.commission_amount === 'number' ? Number(r.commission_amount) : (Number(r.total_revenue) * (r.properties?.commission_rate || 0)));
            const net = (typeof r.net_revenue === 'number' ? Number(r.net_revenue) : (Number(r.total_revenue) - commission));
            const cleanerName = r.cleaner_user_id ? cleanerNamesMap[r.cleaner_user_id] || null : null;
            console.log('Reservation:', r.reservation_code, 'Cleaner ID:', r.cleaner_user_id, 'Cleaner Name:', cleanerName);
            return { ...r, commission_amount: commission, net_revenue: net, cleaner_name: cleanerName };
          });

        setReservations(enrichedData || []);
      } catch (error) {
        console.error('Erro ao buscar reservas:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar as reservas.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchReservations();
  }, [selectedProperties, selectedPeriod, startDateString, endDateString, toast]);

  // =================================================================================
  // ===== INÍCIO DA ALTERAÇÃO 1: NOVA FUNÇÃO generatePDF =============================
  // =================================================================================
  const generatePDF = (reservation: Reservation) => {
    toast({ title: "Gerando PDF...", description: "Aguarde, estamos preparando seu documento." });

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);

    const templateElement = React.createElement(ProfessionalReceiptTemplate, { reservation, receiptType });
    const tempRoot = ReactDOM.createRoot(container);
    tempRoot.render(templateElement);
    
    setTimeout(() => {
      const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
      const elementToPrint = container.children[0];

      if (!elementToPrint) {
        toast({ title: "Erro", description: "Ocorreu um problema ao criar o template.", variant: "destructive"});
        document.body.removeChild(container);
        return;
      }

      pdf.html(elementToPrint as HTMLElement, {
        callback: function (doc) {
          const filename = `${receiptType === 'payment' ? 'recibo-pagamento' : 'recibo-reserva'}-${reservation.reservation_code}.pdf`;
          doc.save(filename);
          document.body.removeChild(container);
          toast({ title: "Sucesso", description: "Recibo gerado!" });
        },
        html2canvas: { scale: 0.65, useCORS: true },
        margin: [0, 0, 0, 0]
      });
    }, 1000);
  };
  // =================================================================================
  // ===== FIM DA ALTERAÇÃO 1 ========================================================
  // =================================================================================

  // CÓDIGO ORIGINAL MANTIDO
  const generateBatchPDF = async () => {
    try {
      const pdf = new jsPDF();
      let isFirstPage = true;
      
      const filteredReservations = receiptType === 'payment' 
        ? reservations.filter(r => r.payment_status === 'Pago')
        : reservations;
      
      if (filteredReservations.length === 0) {
        toast({
          title: "Aviso",
          description: receiptType === 'payment' 
            ? "Nenhuma reserva com pagamento confirmado encontrada."
            : "Nenhuma reserva encontrada.",
          variant: "destructive",
        });
        return;
      }
      
      for (const reservation of filteredReservations) {
        if (!isFirstPage) {
          pdf.addPage();
        }
        
        pdf.setFontSize(20);
        pdf.setFont("helvetica", "bold");
        const title = receiptType === 'payment' ? 'RECIBO DE PAGAMENTO' : 'RECIBO DE RESERVA';
        pdf.text(title, 105, 20, { align: 'center' });
        
        pdf.setDrawColor(0, 0, 0);
        pdf.line(20, 30, 190, 30);
        
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "normal");
        pdf.text('RIOH HOST GESTÃO DE HOSPEDAGEM', 20, 45);
        pdf.text('Gestão Profissional de Propriedades para Hospedagem', 20, 52);
        
        let yPosition = 70;
        pdf.text(`Reserva: ${reservation.reservation_code}`, 20, yPosition);
        yPosition += 7;
        pdf.text(`Hóspede: ${reservation.guest_name || 'N/A'}`, 20, yPosition);
        yPosition += 7;
        pdf.text(`Propriedade: ${reservation.properties?.name || 'N/A'}`, 20, yPosition);
        yPosition += 7;
        
        const checkIn = format(new Date(reservation.check_in_date), "dd/MM/yyyy", { locale: ptBR });
        const checkOut = format(new Date(reservation.check_out_date), "dd/MM/yyyy", { locale: ptBR });
        pdf.text(`Período: ${checkIn} a ${checkOut}`, 20, yPosition);
        yPosition += 7;
        
        const totalFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(reservation.total_revenue || 0);
        pdf.text(`Valor: ${totalFormatted}`, 20, yPosition);

        if (receiptType === 'payment') {
          const commission = (reservation as any).commission_amount ?? (reservation.total_revenue * (reservation.properties?.commission_rate || 0));
          const cleaningFeeValue = Number((reservation as any).cleaning_fee ?? reservation.properties?.cleaning_fee ?? 0);
          
          // Normalizar cleaning_allocation para verificação
          const normalizedAllocation = ((reservation as any).cleaning_allocation || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const shouldDeductCleaning = (normalizedAllocation === 'proprietario' || normalizedAllocation === 'owner');
          const cleaningDeduct = shouldDeductCleaning ? cleaningFeeValue : 0;
          
          const baseNet = (reservation as any).net_revenue ?? (reservation.total_revenue - commission);
          const ownerTotal = Math.max(0, Number(baseNet) - cleaningDeduct);
          const cleaningFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cleaningDeduct);
          const ownerFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ownerTotal);
          yPosition += 7;
          pdf.text(`Limpeza: ${cleaningFormatted} | Proprietário: ${ownerFormatted}`, 20, yPosition);
        }
        
        isFirstPage = false;
      }
      
      const filename = receiptType === 'payment' 
        ? 'recibos-pagamento-lote.pdf'
        : 'recibos-reserva-lote.pdf';
      pdf.save(filename);
      
      toast({
        title: "Sucesso",
        description: `${filteredReservations.length} recibos gerados em lote!`,
      });
    } catch (error) {
      console.error('Erro ao gerar PDFs em lote:', error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar os recibos em lote.",
        variant: "destructive",
      });
    }
  };

  // CÓDIGO ORIGINAL MANTIDO
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // CÓDIGO ORIGINAL MANTIDO
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
  };

  // Função para calcular o valor do proprietário (mesma lógica do template)
  const calculateOwnerValue = (reservation: Reservation) => {
    const commission = reservation.commission_amount ?? (reservation.total_revenue * (reservation.properties?.commission_rate || 0));
    const cleaningFeeValue = Number(reservation.cleaning_fee ?? reservation.properties?.cleaning_fee ?? 0);
    
    // Normalizar cleaning_allocation para verificação
    const normalizedAllocation = (reservation.cleaning_allocation || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const shouldDeductCleaning = (normalizedAllocation === 'proprietario' || normalizedAllocation === 'owner');
    const cleaningDeduct = shouldDeductCleaning ? cleaningFeeValue : 0;
    
    const baseNet = reservation.net_revenue ?? (reservation.total_revenue - commission);
    return Math.max(0, Number(baseNet) - cleaningDeduct);
  };

  // CÓDIGO ORIGINAL MANTIDO
  if (loading) {
    return (
      <Card><CardContent className="flex justify-center items-center py-8"><div className="text-muted-foreground">Carregando reservas...</div></CardContent></Card>
    );
  }

  // CÓDIGO ORIGINAL MANTIDO
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Gerador de Recibos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Recibo:</label>
                <Select value={receiptType} onValueChange={(value: ReceiptType) => setReceiptType(value)}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reservation">Recibo de Reserva</SelectItem>
                    <SelectItem value="payment">Recibo de Pagamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground pt-7">{reservations.length} reserva(s) disponível(eis)</p>
            </div>
            <Button onClick={generateBatchPDF} disabled={reservations.length === 0} className="flex items-center gap-2"><Download className="h-4 w-4" />Gerar Todos os Recibos</Button>
          </div>
          <Separator />
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {reservations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Nenhuma reserva encontrada</div>
            ) : (
              reservations.map((reservation) => (
                <div key={reservation.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap"><Badge variant="outline">{reservation.reservation_code}</Badge><Badge variant={reservation.platform === 'Airbnb' ? 'default' : 'secondary'}>{reservation.platform}</Badge>{reservation.payment_status && (<Badge variant={reservation.payment_status === 'Pago' ? 'secondary' : 'destructive'}>{reservation.payment_status}</Badge>)}</div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground pt-1"><div className="flex items-center gap-1"><User className="h-3 w-3" />{reservation.guest_name || 'Nome não informado'}</div><div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{reservation.properties?.name || 'Propriedade não informada'}</div><div className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(reservation.check_in_date)} - {formatDate(reservation.check_out_date)}</div></div>
                    <div className="text-lg font-semibold text-primary pt-1">{formatCurrency(calculateOwnerValue(reservation))}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPreviewReservation(reservation)} className="flex items-center gap-1"><Eye className="h-3 w-3" />Prévia</Button>
                    <Button size="sm" onClick={() => generatePDF(reservation)} className="flex items-center gap-1"><Download className="h-3 w-3" />PDF</Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ========================================================================================== */}
          {/* ===== INÍCIO DA ALTERAÇÃO 2: NOVA LÓGICA DE PRÉVIA (POPUP) ============================== */}
          {/* ========================================================================================== */}
          {previewReservation && (
            <div id="preview-wrapper" className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full relative">
                <Button variant="ghost" size="icon" onClick={() => setPreviewReservation(null)} className="absolute top-2 right-2 z-10 bg-white/50 hover:bg-white/80 rounded-full h-8 w-8">
                  <X className="h-5 w-5 text-gray-600"/>
                </Button>
                <div className="max-h-[90vh] overflow-y-auto">
                   <ProfessionalReceiptTemplate
                      reservation={previewReservation}
                      receiptType={receiptType}
                    />
                </div>
              </div>
            </div>
          )}
          {/* ========================================================================================== */}
          {/* ===== FIM DA ALTERAÇÃO 2 ================================================================ */}
          {/* ========================================================================================== */}
          
        </div>
      </CardContent>
    </Card>
  );
};

export default ReceiptGenerator;
