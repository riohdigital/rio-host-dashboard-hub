import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client'; // ADICIONADO: Import necessário
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, MapPin, User, Phone, Download, FileText, Eye, X } from 'lucide-react'; // ADICIONADO: Ícone X
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDateSafe } from '@/lib/dateUtils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useDateRange } from '@/hooks/dashboard/useDateRange';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ProfessionalReceiptTemplate from './ProfessionalReceiptTemplate'; // ADICIONADO: Novo template
import GuestReceiptTemplate from './GuestReceiptTemplate';
import { buildGuestMonthReceipts, formatMonthLabel, GuestMonthReceipt } from '@/lib/guestReceipts';
import { useReceiptIssuer } from '@/hooks/useReceiptIssuer';
import VerTodos from '@/components/comum/VerTodos';
import { useListaCurta } from '@/components/comum/useListaCurta';

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
  guest_total_paid?: number | null;
  reservation_status?: string | null;
  platform_verified_data?: unknown;
}
type ReceiptType = 'reservation' | 'payment' | 'guest';

// CÓDIGO ORIGINAL MANTIDO
const ReceiptGenerator = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiptType, setReceiptType] = useState<ReceiptType>('reservation');
  const [previewReservation, setPreviewReservation] = useState<Reservation | null>(null);
  const [previewGuestReceipt, setPreviewGuestReceipt] = useState<GuestMonthReceipt<Reservation> | null>(null);
  const { issuer } = useReceiptIssuer();
  const { toast } = useToast();
  const { selectedProperties, selectedPeriod, selectedPlatform, customStartDate, customEndDate } = useGlobalFilters();
  const { startDateString, endDateString } = useDateRange(selectedPeriod, customStartDate, customEndDate);

  // Comprovante do Hóspede: um por mês de estadia, só os meses dentro do filtro global.
  const guestReceipts = useMemo(() => buildGuestMonthReceipts(
    reservations,
    selectedPeriod === 'general' ? null : { start: startDateString, end: endDateString },
  ), [reservations, selectedPeriod, startDateString, endDateString]);
  const reservationsWithoutGuestValue = useMemo(() => {
    const comValor = new Set(buildGuestMonthReceipts(reservations).map((r) => r.reservation.id));
    return reservations.filter((r) => r.reservation_status !== 'Cancelada' && !comValor.has(r.id)).length;
  }, [reservations]);

  // Celular: 3 itens + "Ver todos" (sem rolagem dentro da página); computador: caixa com rolagem
  const listaComprovantes = useListaCurta(guestReceipts, 3, { soCompacto: true });
  const listaRecibos = useListaCurta(reservations, 3, { soCompacto: true });

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

        // Apply platform filter
        if (selectedPlatform && selectedPlatform !== 'all') {
          query = query.eq('platform', selectedPlatform);
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
  }, [selectedProperties, selectedPeriod, selectedPlatform, startDateString, endDateString, customStartDate, customEndDate, toast]);

  // =================================================================================
  // ===== INÍCIO DA ALTERAÇÃO 1: NOVA FUNÇÃO generatePDF =============================
  // =================================================================================
  const generatePDF = async (reservation: Reservation) => {
    toast({ title: "Gerando PDF...", description: "Aguarde, estamos preparando seu documento." });

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '800px';
    document.body.appendChild(container);

    const templateElement = React.createElement(ProfessionalReceiptTemplate, { reservation, receiptType });
    const tempRoot = ReactDOM.createRoot(container);
    tempRoot.render(templateElement);
    
    // Wait for render and images to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const elementToPrint = container.children[0] as HTMLElement;
    if (!elementToPrint) {
      toast({ title: "Erro", description: "Ocorreu um problema ao criar o template.", variant: "destructive"});
      document.body.removeChild(container);
      return;
    }

    // Wait for all images to load
    const images = elementToPrint.getElementsByTagName('img');
    const imagePromises = Array.from(images).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    });
    await Promise.all(imagePromises);

    try {
      // Use html2canvas like batch generation
      const canvas = await html2canvas(elementToPrint, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Calculate dimensions to fit A4
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // Scale to fit width with margins
      const margins = 10;
      const availableWidth = pdfWidth - (margins * 2);
      const scale = availableWidth / imgWidth * 2;
      const scaledHeight = imgHeight * scale;
      
      // Center on page
      const x = margins;
      const y = (pdfHeight - scaledHeight) / 2;
      
      pdf.addImage(imgData, 'PNG', x, y > 0 ? y : margins, availableWidth, scaledHeight);
      
      const filename = `${receiptType === 'payment' ? 'recibo-pagamento' : 'recibo-reserva'}-${reservation.reservation_code}.pdf`;
      pdf.save(filename);
      
      toast({ title: "Sucesso", description: "Recibo gerado!" });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({ title: "Erro", description: "Erro ao gerar PDF", variant: "destructive" });
    } finally {
      document.body.removeChild(container);
    }
  };
  // =================================================================================
  // ===== FIM DA ALTERAÇÃO 1 ========================================================
  // =================================================================================

  // NOVO SISTEMA DE RECIBO CONSOLIDADO
  const generateBatchPDF = async () => {
    try {
      let filteredReservations = receiptType === 'payment' 
        ? reservations.filter(r => r.payment_status === 'Pago')
        : reservations;

      // Apply platform filter to batch generation
      if (selectedPlatform && selectedPlatform !== 'all') {
        filteredReservations = filteredReservations.filter(r => r.platform === selectedPlatform);
      }
      
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

      toast({
        title: "Gerando recibo consolidado...",
        description: "Por favor, aguarde enquanto o recibo é gerado.",
      });

      // Criar range de datas se houver reservas
      let dateRange = null;
      if (filteredReservations.length > 0) {
        const dates = filteredReservations.map(r => new Date(r.check_in_date).getTime());
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        dateRange = {
          start: format(minDate, "dd/MM/yyyy", { locale: ptBR }),
          end: format(maxDate, "dd/MM/yyyy", { locale: ptBR })
        };
      }

      // Usar ReactDOM para renderizar o template
      const { default: BatchReceiptTemplate } = await import('./BatchReceiptTemplate.jsx');
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      tempDiv.style.width = '210mm'; // A4 width
      document.body.appendChild(tempDiv);

      const { createRoot } = await import('react-dom/client');
      const root = createRoot(tempDiv);
      
      await new Promise((resolve) => {
        root.render(
          React.createElement(BatchReceiptTemplate, {
            reservations: filteredReservations,
            receiptType,
            dateRange
          })
        );
        setTimeout(resolve, 100);
      });

      // Usar html2canvas para capturar o elemento
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(tempDiv.firstChild as HTMLElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      // Criar PDF
      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // Adicionar primeira página
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Adicionar páginas adicionais se necessário
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      // Limpar elemento temporário
      document.body.removeChild(tempDiv);

      // Salvar PDF
      const filename = receiptType === 'payment' 
        ? 'recibo-consolidado-pagamentos.pdf'
        : 'recibo-consolidado-reservas.pdf';
      pdf.save(filename);
      
      toast({
        title: "Sucesso",
        description: `Recibo consolidado gerado com ${filteredReservations.length} reserva(s)!`,
      });
    } catch (error) {
      console.error('Erro ao gerar recibo consolidado:', error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o recibo consolidado.",
        variant: "destructive",
      });
    }
  };

  // ===== COMPROVANTE DO HÓSPEDE =====================================================
  // Renderiza um comprovante fora da tela e devolve o canvas para o PDF.
  const renderGuestReceiptCanvas = async (receipt: GuestMonthReceipt<Reservation>) => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '800px';
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);
    try {
      root.render(React.createElement(GuestReceiptTemplate, { receipt, issuer }));
      await new Promise(resolve => setTimeout(resolve, 600));
      const element = container.children[0] as HTMLElement;
      if (!element) throw new Error('Template vazio');
      await Promise.all(Array.from(element.getElementsByTagName('img')).map(img => (
        img.complete ? Promise.resolve() : new Promise(resolve => { img.onload = resolve; img.onerror = resolve; })
      )));
      return await html2canvas(element, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' });
    } finally {
      root.unmount();
      document.body.removeChild(container);
    }
  };

  const addCanvasPage = (pdf: jsPDF, canvas: HTMLCanvasElement) => {
    const margins = 10;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const width = pageWidth - margins * 2;
    let height = (canvas.height * width) / canvas.width;
    let finalWidth = width;
    if (height > pageHeight - margins * 2) {
      height = pageHeight - margins * 2;
      finalWidth = (canvas.width * height) / canvas.height;
    }
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageWidth - finalWidth) / 2, margins, finalWidth, height);
  };

  const guestFileName = (receipt: GuestMonthReceipt<Reservation>) =>
    `comprovante-hospede-${receipt.reservation.reservation_code}-${receipt.monthKey}.pdf`;

  const generateGuestPDF = async (receipt: GuestMonthReceipt<Reservation>) => {
    toast({ title: "Gerando PDF...", description: "Aguarde, estamos preparando o comprovante." });
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      addCanvasPage(pdf, await renderGuestReceiptCanvas(receipt));
      pdf.save(guestFileName(receipt));
      toast({ title: "Sucesso", description: "Comprovante gerado!" });
    } catch (error) {
      console.error('Erro ao gerar comprovante do hóspede:', error);
      toast({ title: "Erro", description: "Não foi possível gerar o comprovante.", variant: "destructive" });
    }
  };

  // Todos os comprovantes do filtro num PDF só, um por página.
  const generateGuestBatchPDF = async () => {
    if (guestReceipts.length === 0) {
      toast({ title: "Aviso", description: "Nenhum comprovante de hóspede no período.", variant: "destructive" });
      return;
    }
    toast({ title: "Gerando comprovantes...", description: `${guestReceipts.length} comprovante(s). Aguarde.` });
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      for (const [indice, receipt] of guestReceipts.entries()) {
        if (indice > 0) pdf.addPage();
        addCanvasPage(pdf, await renderGuestReceiptCanvas(receipt));
      }
      pdf.save(guestReceipts.length === 1 ? guestFileName(guestReceipts[0]) : 'comprovantes-hospedes.pdf');
      toast({ title: "Sucesso", description: `${guestReceipts.length} comprovante(s) gerado(s)!` });
    } catch (error) {
      console.error('Erro ao gerar comprovantes de hóspedes:', error);
      toast({ title: "Erro", description: "Não foi possível gerar os comprovantes.", variant: "destructive" });
    }
  };

  // CÓDIGO ORIGINAL MANTIDO
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Formatação de data com timezone seguro
  const formatDate = (dateString: string) => {
    return formatDateSafe(dateString);
  };

  // Função para calcular o valor do proprietário (mesma lógica do template)
  const calculateOwnerValue = (reservation: Reservation) => {
    const commission = reservation.commission_amount ?? (reservation.total_revenue * (reservation.properties?.commission_rate || 0));
    
    // Como net_revenue já vem calculado corretamente do backend, apenas usar esse valor
    const baseNet = reservation.net_revenue ?? (reservation.total_revenue - commission);
    return Math.max(0, Number(baseNet));
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Recibo:</label>
                <Select value={receiptType} onValueChange={(value: ReceiptType) => setReceiptType(value)}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reservation">Recibo de Reserva</SelectItem>
                    <SelectItem value="payment">Recibo de Pagamento</SelectItem>
                    <SelectItem value="guest">Comprovante do Hóspede</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground pt-7">
                {receiptType === 'guest'
                  ? `${guestReceipts.length} comprovante(s) mensal(is)${reservationsWithoutGuestValue ? ` · ${reservationsWithoutGuestValue} reserva(s) sem valor pago pelo hóspede` : ''}`
                  : `${reservations.length} reserva(s) disponível(eis)`}
              </p>
            </div>
            {receiptType === 'guest'
              ? <Button onClick={generateGuestBatchPDF} disabled={guestReceipts.length === 0} className="flex w-full items-center gap-2 whitespace-normal sm:w-auto"><Download className="h-4 w-4" />Gerar Todos os Comprovantes</Button>
              : <Button onClick={generateBatchPDF} disabled={reservations.length === 0} className="flex w-full items-center gap-2 whitespace-normal sm:w-auto"><Download className="h-4 w-4" />Gerar Todos os Recibos</Button>}
          </div>
          <Separator />
          {receiptType === 'guest' ? (
          <>
          <div className="space-y-3 lg:max-h-96 lg:overflow-y-auto lg:pr-2">
            {guestReceipts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Nenhuma reserva com valor pago pelo hóspede no período</div>
            ) : (
              listaComprovantes.visiveis.map((receipt) => (
                <div key={receipt.key} className="flex flex-col gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap"><Badge>{formatMonthLabel(receipt.monthKey)}</Badge><Badge variant="outline">{receipt.reservation.reservation_code}</Badge><Badge variant="secondary">{receipt.reservation.platform}</Badge></div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground pt-1 flex-wrap"><div className="flex items-center gap-1"><User className="h-3 w-3" />{receipt.reservation.guest_name || 'Nome não informado'}</div><div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{receipt.reservation.properties?.name || 'Propriedade não informada'}</div><div className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(receipt.periodStart)} - {formatDate(receipt.periodEnd)} ({receipt.nightsInMonth} noite(s))</div></div>
                    <div className="pt-1 font-mono text-lg font-semibold tabular-nums text-primary">{formatCurrency(receipt.amount)}</div>
                  </div>
                  <div className="flex gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
                    <Button variant="outline" size="sm" onClick={() => setPreviewGuestReceipt(receipt)} className="flex items-center gap-1"><Eye className="h-3 w-3" />Prévia</Button>
                    <Button size="sm" onClick={() => generateGuestPDF(receipt)} className="flex items-center gap-1"><Download className="h-3 w-3" />PDF</Button>
                  </div>
                </div>
              ))
            )}
          </div>
          {listaComprovantes.temMais && <VerTodos total={listaComprovantes.total} expandido={listaComprovantes.expandido} aoClicar={listaComprovantes.alternar} />}
          </>
          ) : (
          <>
          <div className="space-y-3 lg:max-h-96 lg:overflow-y-auto lg:pr-2">
            {reservations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Nenhuma reserva encontrada</div>
            ) : (
              listaRecibos.visiveis.map((reservation) => (
                <div key={reservation.id} className="flex flex-col gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap"><Badge variant="outline">{reservation.reservation_code}</Badge><Badge variant={reservation.platform === 'Airbnb' ? 'default' : 'secondary'}>{reservation.platform}</Badge>{reservation.payment_status && (<Badge variant={reservation.payment_status === 'Pago' ? 'secondary' : 'destructive'}>{reservation.payment_status}</Badge>)}</div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground pt-1 flex-wrap"><div className="flex items-center gap-1"><User className="h-3 w-3" />{reservation.guest_name || 'Nome não informado'}</div><div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{reservation.properties?.name || 'Propriedade não informada'}</div><div className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(reservation.check_in_date)} - {formatDate(reservation.check_out_date)}</div></div>
                    <div className="pt-1 font-mono text-lg font-semibold tabular-nums text-primary">{formatCurrency(calculateOwnerValue(reservation))}</div>
                  </div>
                  <div className="flex gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
                    <Button variant="outline" size="sm" onClick={() => setPreviewReservation(reservation)} className="flex items-center gap-1"><Eye className="h-3 w-3" />Prévia</Button>
                    <Button size="sm" onClick={() => generatePDF(reservation)} className="flex items-center gap-1"><Download className="h-3 w-3" />PDF</Button>
                  </div>
                </div>
              ))
            )}
          </div>
          {listaRecibos.temMais && <VerTodos total={listaRecibos.total} expandido={listaRecibos.expandido} aoClicar={listaRecibos.alternar} />}
          </>
          )}

          {previewGuestReceipt && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full relative">
                <Button variant="ghost" size="icon" onClick={() => setPreviewGuestReceipt(null)} className="absolute top-2 right-2 z-10 bg-white/50 hover:bg-white/80 rounded-full h-8 w-8">
                  <X className="h-5 w-5 text-gray-600"/>
                </Button>
                <div className="max-h-[90vh] overflow-y-auto">
                  <GuestReceiptTemplate receipt={previewGuestReceipt} issuer={issuer} />
                </div>
              </div>
            </div>
          )}

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
