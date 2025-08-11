import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, MapPin, User, Download, FileText, Eye, X } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

// Importe o seu novo componente de template
import ProfessionalReceiptTemplate from './ProfessionalReceiptTemplate'; // Ajuste o caminho se necessário

// Interface completa da Reserva, com exemplos dos dados fornecidos
interface Reservation {
  id: string;
  guest_name: string; [cite_start]// Ex: Alexis Fabrizio Carvajal [cite: 9, 30]
  guest_phone: string; [cite_start]// Ex: N/A [cite: 10, 31]
  check_in_date: string; [cite_start]// Ex: 28/07/2025 [cite: 13, 34]
  check_out_date: string; [cite_start]// Ex: 02/08/2025 [cite: 14, 35]
  total_revenue: number; [cite_start]// Ex: 1030.95 [cite: 17, 38]
  platform: string; [cite_start]// Ex: Airbnb [cite: 7, 28]
  reservation_code: string; [cite_start]// Ex: HM8ETJHAEF [cite: 5, 26]
  number_of_guests: number; [cite_start]// Ex: 2 [cite: 11, 32]
  properties?: {
    name: string; [cite_start]// Ex: Santa Clara 115/612 [cite: 6, 27]
    address?: string; [cite_start]// Ex: Rua Santa Clara, 115 612, Rio de Janeiro, Rio de Janeiro 22041-011, Brasil [cite: 7, 28]
    cleaning_fee?: number; [cite_start]// Ex: 250.00 [cite: 18, 39]
  };
  payment_status?: string;
  payment_date?: string;
  net_revenue?: number; [cite_start]// Ex: 624.76 [cite: 19, 40]
}

type ReceiptType = 'reservation' | 'payment';

const ReceiptGenerator = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiptType, setReceiptType] = useState<ReceiptType>('reservation');
  const [previewReservation, setPreviewReservation] = useState<Reservation | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchReservations = async () => {
      setLoading(true);
      // Simula a busca de dados que você já tem no seu ambiente
      const { data, error } = await supabase
        .from('reservations') // Use o nome correto da sua tabela
        .select(`
          id,
          guest_name,
          guest_phone,
          check_in_date,
          check_out_date,
          total_revenue,
          platform,
          reservation_code,
          number_of_guests,
          payment_status,
          payment_date,
          net_revenue,
          properties (
            name,
            address,
            cleaning_fee
          )
        `)
        .order('check_in_date', { ascending: false });

      if (error) {
        console.error('Erro ao buscar reservas:', error);
        toast({ title: "Erro", description: "Não foi possível carregar as reservas.", variant: "destructive" });
      } else {
        setReservations(data as Reservation[]);
      }
      setLoading(false);
    };

    fetchReservations();
  }, [toast]);

  const generatePDF = (reservation: Reservation) => {
    toast({ title: "Gerando PDF...", description: "Por favor, aguarde." });

    setPreviewReservation(reservation);

    setTimeout(() => {
      const receiptElement = document.getElementById('receipt-to-print');
      
      if (!receiptElement) {
        toast({ title: "Erro", description: "Não foi possível encontrar o template para gerar o PDF.", variant: "destructive" });
        setPreviewReservation(null);
        return;
      }
      
      const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

      pdf.html(receiptElement, {
        callback: function (doc) {
          const filename = `${receiptType === 'payment' ? 'recibo-pagamento' : 'recibo-reserva'}-${reservation.reservation_code}.pdf`;
          doc.save(filename);
          
          setPreviewReservation(null);
          toast({ title: "Sucesso", description: "Recibo gerado com sucesso!" });
        },
        html2canvas: {
          scale: 0.7, 
          useCORS: true
        },
        margin: [0, 0, 0, 0]
      });

    }, 500);
  };
  
  const generateBatchPDF = async () => {
    // Esta função foi mantida conforme solicitado, para implementação futura de um template de lote.
    toast({
        title: "Função em desenvolvimento",
        description: "A geração de um resumo em lote ainda será implementada com um novo template."
    });
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
              
              <p className="text-sm text-muted-foreground pt-7">
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
              Gerar Resumo em Lote
            </Button>
          </div>

          <Separator />

          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
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
                    <div className="flex items-center gap-2 flex-wrap">
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
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground pt-1">
                      <div className="flex items-center gap-1"><User className="h-3 w-3" />{reservation.guest_name}</div>
                      <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{reservation.properties?.name}</div>
                    </div>
                    
                    <div className="text-lg font-semibold text-primary pt-1">
                      {formatCurrency(reservation.total_revenue)}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPreviewReservation(reservation)} className="flex items-center gap-1"><Eye className="h-3 w-3" />Prévia</Button>
                    <Button size="sm" onClick={() => generatePDF(reservation)} className="flex items-center gap-1"><Download className="h-3 w-3" />PDF</Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {previewReservation && (
            <div id="preview-wrapper" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                 <div className="bg-transparent rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
                     <Button variant="ghost" size="sm" onClick={() => setPreviewReservation(null)} className="absolute -top-8 right-0 z-10 text-white hover:bg-white/20"><X className="h-6 w-6"/></Button>
                     <ProfessionalReceiptTemplate
                         reservation={previewReservation}
                         receiptType={receiptType}
                     />
                 </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ReceiptGenerator;
