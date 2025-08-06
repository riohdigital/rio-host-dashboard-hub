import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, MapPin, User, Phone, Download, FileText, Eye } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import jsPDF from 'jspdf';

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
    name: string;
    address?: string;
  };
  payment_status?: string;
  payment_date?: string;
}

type ReceiptType = 'reservation' | 'payment';

const ReceiptGenerator = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiptType, setReceiptType] = useState<ReceiptType>('reservation');
  const [previewReservation, setPreviewReservation] = useState<Reservation | null>(null);
  const { toast } = useToast();
  const { selectedProperties, selectedPeriod } = useGlobalFilters();

  useEffect(() => {
    fetchReservations();
  }, [selectedProperties, selectedPeriod]);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('reservations')
        .select(`
          *,
          properties (
            name,
            address
          )
        `);

      // Apply property filter
      if (selectedProperties.length > 0 && !selectedProperties.includes('todas')) {
        query = query.in('property_id', selectedProperties);
      }

      // Apply date filter
      if (selectedPeriod !== 'all_time') {
        const now = new Date();
        let startDate: Date;
        
        switch (selectedPeriod) {
          case 'current_month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'current_year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
          case 'last_30_days':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case 'last_90_days':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(now.getFullYear(), 0, 1);
        }
        
        query = query.gte('check_in_date', startDate.toISOString().split('T')[0]);
      }

      const { data, error } = await query
        .order('check_in_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      setReservations(data || []);
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

  const generatePDF = (reservation: Reservation) => {
    try {
      const pdf = new jsPDF();
      
      // Header - diferentes títulos baseados no tipo
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      const title = receiptType === 'payment' ? 'RECIBO DE PAGAMENTO' : 'RECIBO DE RESERVA';
      pdf.text(title, 105, 20, { align: 'center' });
      
      // Linha separadora
      pdf.setDrawColor(0, 0, 0);
      pdf.line(20, 30, 190, 30);
      
      // Informações da empresa
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text('RIOH HOST GESTÃO DE HOSPEDAGEM', 20, 45);
      pdf.text('Gestão Profissional de Propriedades para Hospedagem', 20, 52);
      
      // Informações da reserva
      let yPosition = 70;
      
      pdf.setFont("helvetica", "bold");
      pdf.text('DADOS DA RESERVA:', 20, yPosition);
      yPosition += 10;
      
      pdf.setFont("helvetica", "normal");
      pdf.text(`Código da Reserva: ${reservation.reservation_code}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`Propriedade: ${reservation.properties?.name || 'N/A'}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`Endereço: ${reservation.properties?.address || 'N/A'}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`Plataforma: ${reservation.platform}`, 20, yPosition);
      yPosition += 15;
      
      // Informações do hóspede
      pdf.setFont("helvetica", "bold");
      pdf.text('DADOS DO HÓSPEDE:', 20, yPosition);
      yPosition += 10;
      
      pdf.setFont("helvetica", "normal");
      pdf.text(`Nome: ${reservation.guest_name || 'N/A'}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`Telefone: ${reservation.guest_phone || 'N/A'}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`Número de Hóspedes: ${reservation.number_of_guests || 1}`, 20, yPosition);
      yPosition += 15;
      
      // Datas da estadia
      pdf.setFont("helvetica", "bold");
      pdf.text('PERÍODO DA ESTADIA:', 20, yPosition);
      yPosition += 10;
      
      pdf.setFont("helvetica", "normal");
      const checkIn = format(new Date(reservation.check_in_date), "dd/MM/yyyy", { locale: ptBR });
      const checkOut = format(new Date(reservation.check_out_date), "dd/MM/yyyy", { locale: ptBR });
      const nights = differenceInDays(new Date(reservation.check_out_date), new Date(reservation.check_in_date));
      
      pdf.text(`Check-in: ${checkIn}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`Check-out: ${checkOut}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`Total de Noites: ${nights}`, 20, yPosition);
      yPosition += 15;
      
      // Informações financeiras
      pdf.setFont("helvetica", "bold");
      pdf.text('INFORMAÇÕES FINANCEIRAS:', 20, yPosition);
      yPosition += 10;
      
      pdf.setFont("helvetica", "normal");
      const totalFormatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(reservation.total_revenue);
      
      pdf.text(`Valor Total: ${totalFormatted}`, 20, yPosition);
      yPosition += 7;
      
      // Informações específicas do tipo de recibo
      if (receiptType === 'payment') {
        pdf.text(`Status do Pagamento: ${reservation.payment_status || 'N/A'}`, 20, yPosition);
        yPosition += 7;
        if (reservation.payment_date) {
          const paymentDate = format(new Date(reservation.payment_date), "dd/MM/yyyy", { locale: ptBR });
          pdf.text(`Data do Pagamento: ${paymentDate}`, 20, yPosition);
          yPosition += 7;
        }
      }
      yPosition += 13;
      
      // Rodapé
      pdf.setFontSize(10);
      const footerText = receiptType === 'payment' 
        ? 'Este documento comprova o pagamento da reserva acima mencionada.'
        : 'Este documento confirma a reserva e os dados informados acima.';
      pdf.text(footerText, 20, yPosition);
      yPosition += 7;
      pdf.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 20, yPosition);
      
      // Salvar o PDF
      const filename = receiptType === 'payment' 
        ? `recibo-pagamento-${reservation.reservation_code}.pdf`
        : `recibo-reserva-${reservation.reservation_code}.pdf`;
      pdf.save(filename);
      
      toast({
        title: "Sucesso",
        description: "Recibo gerado com sucesso!",
      });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o recibo.",
        variant: "destructive",
      });
    }
  };

  const generateBatchPDF = async () => {
    try {
      const pdf = new jsPDF();
      let isFirstPage = true;
      
      // Filtrar reservações baseado no tipo de recibo
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
        
        // Header
        pdf.setFontSize(20);
        pdf.setFont("helvetica", "bold");
        const title = receiptType === 'payment' ? 'RECIBO DE PAGAMENTO' : 'RECIBO DE RESERVA';
        pdf.text(title, 105, 20, { align: 'center' });
        
        // Linha separadora
        pdf.setDrawColor(0, 0, 0);
        pdf.line(20, 30, 190, 30);
        
        // Informações da empresa
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "normal");
        pdf.text('RIOH HOST GESTÃO DE HOSPEDAGEM', 20, 45);
        pdf.text('Gestão Profissional de Propriedades para Hospedagem', 20, 52);
        
        // Resto dos dados da reserva (versão resumida para o lote)
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
        
        const totalFormatted = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(reservation.total_revenue);
        pdf.text(`Valor: ${totalFormatted}`, 20, yPosition);
        
        if (receiptType === 'payment' && reservation.payment_status) {
          yPosition += 7;
          pdf.text(`Status: ${reservation.payment_status}`, 20, yPosition);
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-8">
          <div className="text-muted-foreground">Carregando reservas...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Gerador de Recibos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Recibo:</label>
                <Select value={receiptType} onValueChange={(value: ReceiptType) => setReceiptType(value)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reservation">Recibo de Reserva</SelectItem>
                    <SelectItem value="payment">Recibo de Pagamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <p className="text-sm text-muted-foreground">
                {reservations.length} reserva(s) disponível(eis)
                {receiptType === 'payment' && (
                  <span className="block">
                    ({reservations.filter(r => r.payment_status === 'Pago').length} com pagamento confirmado)
                  </span>
                )}
              </p>
            </div>
            
            <Button 
              onClick={generateBatchPDF}
              disabled={reservations.length === 0}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Gerar Todos os Recibos
            </Button>
          </div>

          <Separator />

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {reservations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma reserva encontrada
              </div>
            ) : (
              reservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {reservation.reservation_code}
                      </Badge>
                      <Badge variant={reservation.platform === 'Airbnb' ? 'default' : 'secondary'}>
                        {reservation.platform}
                      </Badge>
                      {reservation.payment_status && (
                        <Badge variant={reservation.payment_status === 'Pago' ? 'default' : 'destructive'}>
                          {reservation.payment_status}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {reservation.guest_name || 'Nome não informado'}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {reservation.properties?.name || 'Propriedade não informada'}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(reservation.check_in_date)} - {formatDate(reservation.check_out_date)}
                      </div>
                    </div>
                    
                    <div className="text-lg font-semibold text-primary">
                      {formatCurrency(reservation.total_revenue)}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewReservation(reservation)}
                      className="flex items-center gap-1"
                    >
                      <Eye className="h-3 w-3" />
                      Prévia
                    </Button>
                    
                    <Button
                      size="sm"
                      onClick={() => generatePDF(reservation)}
                      disabled={receiptType === 'payment' && reservation.payment_status !== 'Pago'}
                      className="flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                      PDF
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {previewReservation && (
            <div className="mt-6 border-t pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  Prévia do {receiptType === 'payment' ? 'Recibo de Pagamento' : 'Recibo de Reserva'}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewReservation(null)}
                >
                  Fechar Prévia
                </Button>
              </div>
              
              <div className="bg-white p-6 border rounded-lg shadow-sm max-w-2xl mx-auto">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold">
                    {receiptType === 'payment' ? 'RECIBO DE PAGAMENTO' : 'RECIBO DE RESERVA'}
                  </h2>
                  <div className="w-full h-px bg-gray-300 my-4"></div>
                  <p className="text-sm text-gray-600">RIOH HOST GESTÃO DE HOSPEDAGEM</p>
                  <p className="text-xs text-gray-500">Gestão Profissional de Propriedades para Hospedagem</p>
                </div>
                
                <div className="space-y-4 text-sm">
                  <div>
                    <h4 className="font-semibold mb-2">DADOS DA RESERVA:</h4>
                    <p>Código da Reserva: {previewReservation.reservation_code}</p>
                    <p>Propriedade: {previewReservation.properties?.name || 'N/A'}</p>
                    <p>Endereço: {previewReservation.properties?.address || 'N/A'}</p>
                    <p>Plataforma: {previewReservation.platform}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">DADOS DO HÓSPEDE:</h4>
                    <p>Nome: {previewReservation.guest_name || 'N/A'}</p>
                    <p>Telefone: {previewReservation.guest_phone || 'N/A'}</p>
                    <p>Número de Hóspedes: {previewReservation.number_of_guests || 1}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">PERÍODO DA ESTADIA:</h4>
                    <p>Check-in: {formatDate(previewReservation.check_in_date)}</p>
                    <p>Check-out: {formatDate(previewReservation.check_out_date)}</p>
                    <p>Total de Noites: {differenceInDays(new Date(previewReservation.check_out_date), new Date(previewReservation.check_in_date))}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">INFORMAÇÕES FINANCEIRAS:</h4>
                    <p>Valor Total: {formatCurrency(previewReservation.total_revenue)}</p>
                    {receiptType === 'payment' && (
                      <>
                        <p>Status do Pagamento: {previewReservation.payment_status || 'N/A'}</p>
                        {previewReservation.payment_date && (
                          <p>Data do Pagamento: {formatDate(previewReservation.payment_date)}</p>
                        )}
                      </>
                    )}
                  </div>
                  
                  <div className="pt-4 border-t text-xs text-gray-500">
                    <p>
                      {receiptType === 'payment' 
                        ? 'Este documento comprova o pagamento da reserva acima mencionada.'
                        : 'Este documento confirma a reserva e os dados informados acima.'}
                    </p>
                    <p>Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ReceiptGenerator;