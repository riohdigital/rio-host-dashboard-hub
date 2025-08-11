import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client'; // NOVO: Importe o ReactDOM para a nova lógica de PDF
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
import ProfessionalReceiptTemplate from './ProfessionalReceiptTemplate';

// Interface e Type permanecem os mesmos
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
  properties?: { name: string; address?: string; cleaning_fee?: number; };
  payment_status?: string;
  payment_date?: string;
  net_revenue?: number;
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
      const { data, error } = await supabase.from('reservations').select(`*, properties (*)`).order('check_in_date', { ascending: false });
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

  // CORREÇÃO: LÓGICA ROBUSTA PARA GERAR PDF SEM FICAR EM BRANCO
  const generatePDF = (reservation: Reservation) => {
    toast({ title: "Gerando PDF...", description: "Aguarde um momento, estamos preparando seu documento." });

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px'; // Posiciona o container fora da tela
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

      pdf.html(elementToPrint, {
        callback: function (doc) {
          const filename = `${receiptType === 'payment' ? 'recibo-pagamento' : 'recibo-reserva'}-${reservation.reservation_code}.pdf`;
          doc.save(filename);
          document.body.removeChild(container); // Limpa o container temporário
          toast({ title: "Sucesso", description: "Recibo gerado!" });
        },
        html2canvas: {
          scale: 0.65, // Ajuste fino da escala para garantir que tudo caiba
          useCORS: true
        },
        margin: [0, 0, 0, 0]
      });
    }, 1000); // Um delay seguro para garantir que as imagens externas (logo, QR) sejam carregadas
  };

  const generateBatchPDF = async () => {
    toast({ title: "Função em desenvolvimento", description: "A geração de um resumo em lote será implementada." });
  };
  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatDate = (dateString: string) => format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });

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
            <Button onClick={generateBatchPDF} disabled={reservations.length === 0} className="flex items-center gap-2"><Download className="h-4 w-4" />Gerar Resumo em Lote</Button>
          </div>
          <Separator />
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {reservations.map((reservation) => (
              <div key={reservation.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap"><Badge variant="outline">{reservation.reservation_code}</Badge><Badge variant={reservation.platform === 'Airbnb' ? 'default' : 'secondary'}>{reservation.platform}</Badge></div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground pt-1"><div className="flex items-center gap-1"><User className="h-3 w-3" />{reservation.guest_name}</div><div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{reservation.properties?.name}</div></div>
                  <div className="text-lg font-semibold text-primary pt-1">{formatCurrency(reservation.total_revenue)}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPreviewReservation(reservation)} className="flex items-center gap-1"><Eye className="h-3 w-3" />Prévia</Button>
                  <Button size="sm" onClick={() => generatePDF(reservation)} className="flex items-center gap-1"><Download className="h-3 w-3" />PDF</Button>
                </div>
              </div>
            ))}
          </div>
          
          {/* CORREÇÃO: Popup da prévia com botão de fechar visível */}
          {previewReservation && (
            <div id="preview-wrapper" className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full relative">
                {/* BOTÃO DE FECHAR VISÍVEL */}
                <Button variant="ghost" size="icon" onClick={() => setPreviewReservation(null)} className="absolute top-2 right-2 z-10 bg-white/50 hover:bg-white/80 rounded-full h-8 w-8">
                  <X className="h-5 w-5 text-gray-600"/>
                </Button>
                <div className="max-h-[90vh] overflow-y-auto">
                   <ProfessionalReceiptTemplate reservation={previewReservation} receiptType={receiptType}/>
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
