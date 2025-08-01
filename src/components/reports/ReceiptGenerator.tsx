import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Download, Eye, Calendar, MapPin, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Reservation } from '@/types/reservation';
import { Property } from '@/types/property';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useDateRange } from '@/hooks/dashboard/useDateRange';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import { toast } from "sonner";

interface ReceiptGeneratorProps {
  reservations: Reservation[];
  properties: Property[];
}

interface ReceiptTemplate {
  id: string;
  name: string;
  style: 'airbnb' | 'booking' | 'direct';
  description: string;
}

const receiptTemplates: ReceiptTemplate[] = [
  {
    id: 'airbnb_style',
    name: 'Estilo Airbnb',
    style: 'airbnb',
    description: 'Template moderno e clean inspirado no Airbnb'
  },
  {
    id: 'booking_style',
    name: 'Estilo Booking.com',
    style: 'booking',
    description: 'Template formal e detalhado inspirado no Booking.com'
  },
  {
    id: 'direct_style',
    name: 'Reserva Direta',
    style: 'direct',
    description: 'Template personalizado para reservas diretas'
  }
];

export const ReceiptGenerator = ({ reservations, properties }: ReceiptGeneratorProps) => {
  const { selectedProperties, selectedPeriod } = useGlobalFilters();
  const { startDateString, endDateString } = useDateRange(selectedPeriod);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedReservations, setSelectedReservations] = useState<string[]>([]);
  const [previewReceipt, setPreviewReceipt] = useState<string | null>(null);
  const [actualReservations, setActualReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);

  // Buscar reservas reais do Supabase
  useEffect(() => {
    const fetchReservations = async () => {
      try {
        setLoading(true);
        
        const query = supabase
          .from('reservations')
          .select(`
            *,
            properties(name, address)
          `)
          .gte('check_in_date', startDateString)
          .lte('check_out_date', endDateString);

        // Filtrar por propriedades selecionadas
        if (selectedProperties.length > 0 && !selectedProperties.includes('todas')) {
          query.in('property_id', selectedProperties);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        setActualReservations(data || []);
      } catch (error) {
        console.error('Erro ao buscar reservas:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReservations();
  }, [selectedProperties, startDateString, endDateString]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Usar reservas reais em vez das vazias do prop
  const filteredReservations = actualReservations;

  const getPropertyName = (propertyId: string) => {
    return properties.find(p => p.id === propertyId)?.name || 'Propriedade não encontrada';
  };

  const generateReceiptPreview = (reservation: Reservation, template: ReceiptTemplate) => {
    const property = properties.find(p => p.id === reservation.property_id);
    
    if (template.style === 'airbnb') {
      return `
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #fff;">
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="color: #FF5A5F; font-size: 32px; margin: 0;">Comprovante de Reserva</h1>
            <p style="color: #767676; font-size: 16px; margin: 8px 0 0 0;">Obrigado por escolher nossa acomodação</p>
          </div>
          
          <div style="background: #F7F7F7; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
            <h2 style="color: #484848; font-size: 20px; margin: 0 0 16px 0;">${property?.name || 'Propriedade'}</h2>
            <p style="color: #767676; margin: 0; line-height: 1.5;">${property?.address || 'Endereço não informado'}</p>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px;">
            <div>
              <h3 style="color: #484848; font-size: 16px; margin: 0 0 8px 0;">Check-in</h3>
              <p style="color: #767676; margin: 0; font-size: 18px; font-weight: 600;">${format(new Date(reservation.check_in_date), "dd 'de' MMM", { locale: ptBR })}</p>
              <p style="color: #767676; margin: 4px 0 0 0; font-size: 14px;">${reservation.checkin_time || '15:00'}</p>
            </div>
            <div>
              <h3 style="color: #484848; font-size: 16px; margin: 0 0 8px 0;">Check-out</h3>
              <p style="color: #767676; margin: 0; font-size: 18px; font-weight: 600;">${format(new Date(reservation.check_out_date), "dd 'de' MMM", { locale: ptBR })}</p>
              <p style="color: #767676; margin: 4px 0 0 0; font-size: 14px;">${reservation.checkout_time || '11:00'}</p>
            </div>
          </div>
          
          <div style="border: 1px solid #EBEBEB; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
            <h3 style="color: #484848; font-size: 18px; margin: 0 0 16px 0;">Detalhes da Reserva</h3>
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <span style="color: #767676;">Código da Reserva:</span>
              <span style="color: #484848; font-weight: 600;">${reservation.reservation_code}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <span style="color: #767676;">Hóspede:</span>
              <span style="color: #484848; font-weight: 600;">${reservation.guest_name || 'Não informado'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <span style="color: #767676;">Número de Hóspedes:</span>
              <span style="color: #484848; font-weight: 600;">${reservation.number_of_guests || 1}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <span style="color: #767676;">Plataforma:</span>
              <span style="color: #484848; font-weight: 600;">${reservation.platform}</span>
            </div>
          </div>
          
          <div style="border: 1px solid #EBEBEB; border-radius: 12px; padding: 24px; background: #F7F7F7;">
            <h3 style="color: #484848; font-size: 18px; margin: 0 0 16px 0;">Resumo Financeiro</h3>
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <span style="color: #767676;">Valor Base:</span>
              <span style="color: #484848;">${formatCurrency(reservation.base_revenue || reservation.total_revenue)}</span>
            </div>
            ${reservation.commission_amount ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <span style="color: #767676;">Comissão da Plataforma:</span>
              <span style="color: #767676;">-${formatCurrency(reservation.commission_amount)}</span>
            </div>
            ` : ''}
            <hr style="border: none; border-top: 1px solid #EBEBEB; margin: 16px 0;">
            <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 600;">
              <span style="color: #484848;">Total:</span>
              <span style="color: #FF5A5F;">${formatCurrency(reservation.total_revenue)}</span>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 40px; padding-top: 24px; border-top: 1px solid #EBEBEB;">
            <p style="color: #767676; font-size: 14px; margin: 0;">Este comprovante foi gerado automaticamente em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          </div>
        </div>
      `;
    }
    
    // Template Booking.com style
    return `
      <div style="max-width: 650px; margin: 0 auto; padding: 30px; font-family: Arial, sans-serif; background: #fff; border: 1px solid #ddd;">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #003580; padding-bottom: 20px;">
          <h1 style="color: #003580; font-size: 28px; margin: 0;">COMPROVANTE DE RESERVA</h1>
          <p style="color: #666; font-size: 14px; margin: 8px 0 0 0;">Confirmação de Hospedagem</p>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; background: #f8f9fa; font-weight: bold; width: 30%;">Código de Reserva</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${reservation.reservation_code}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; background: #f8f9fa; font-weight: bold;">Propriedade</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${property?.name || 'Propriedade'}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; background: #f8f9fa; font-weight: bold;">Endereço</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${property?.address || 'Endereço não informado'}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; background: #f8f9fa; font-weight: bold;">Hóspede Principal</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${reservation.guest_name || 'Não informado'}</td>
          </tr>
        </table>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; background: #f8f9fa; font-weight: bold; width: 50%;">Data de Check-in</td>
            <td style="padding: 12px; border: 1px solid #ddd; background: #f8f9fa; font-weight: bold;">Data de Check-out</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd;">${format(new Date(reservation.check_in_date), "dd/MM/yyyy", { locale: ptBR })} às ${reservation.checkin_time || '15:00'}</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${format(new Date(reservation.check_out_date), "dd/MM/yyyy", { locale: ptBR })} às ${reservation.checkout_time || '11:00'}</td>
          </tr>
        </table>
        
        <div style="background: #f8f9fa; padding: 20px; border: 1px solid #ddd; margin-bottom: 25px;">
          <h3 style="color: #003580; margin: 0 0 15px 0; font-size: 18px;">RESUMO FINANCEIRO</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;">Valor da Hospedagem:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold;">${formatCurrency(reservation.base_revenue || reservation.total_revenue)}</td>
            </tr>
            ${reservation.commission_amount ? `
            <tr>
              <td style="padding: 8px 0; color: #666;">Taxa da Plataforma:</td>
              <td style="padding: 8px 0; text-align: right; color: #d93025;">-${formatCurrency(reservation.commission_amount)}</td>
            </tr>
            ` : ''}
            <tr style="border-top: 2px solid #003580;">
              <td style="padding: 12px 0 8px 0; font-size: 18px; font-weight: bold; color: #003580;">TOTAL PAGO:</td>
              <td style="padding: 12px 0 8px 0; text-align: right; font-size: 18px; font-weight: bold; color: #003580;">${formatCurrency(reservation.total_revenue)}</td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center; color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 20px;">
          <p style="margin: 0;">Este documento foi gerado automaticamente em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          <p style="margin: 8px 0 0 0;">Para dúvidas ou alterações, entre em contato conosco.</p>
        </div>
      </div>
    `;
  };

  const generatePDF = (reservation: Reservation, template: ReceiptTemplate) => {
    const property = properties.find(p => p.id === reservation.property_id);
    
    const pdf = new jsPDF();
    
    // Configurações do PDF
    pdf.setFont('helvetica');
    
    // Título
    pdf.setFontSize(20);
    pdf.setTextColor(255, 90, 95);
    pdf.text('COMPROVANTE DE RESERVA', 105, 30, { align: 'center' });
    
    // Informações da propriedade
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Propriedade: ${property?.name || 'N/A'}`, 20, 50);
    pdf.text(`Endereço: ${property?.address || 'N/A'}`, 20, 60);
    
    // Detalhes da reserva
    pdf.text(`Código: ${reservation.reservation_code}`, 20, 80);
    pdf.text(`Hóspede: ${reservation.guest_name || 'Não informado'}`, 20, 90);
    pdf.text(`Check-in: ${format(new Date(reservation.check_in_date), "dd/MM/yyyy")}`, 20, 100);
    pdf.text(`Check-out: ${format(new Date(reservation.check_out_date), "dd/MM/yyyy")}`, 20, 110);
    pdf.text(`Plataforma: ${reservation.platform}`, 20, 120);
    
    // Valores
    pdf.text(`Valor Total: ${formatCurrency(reservation.total_revenue)}`, 20, 140);
    if (reservation.commission_amount) {
      pdf.text(`Comissão: ${formatCurrency(reservation.commission_amount)}`, 20, 150);
    }
    
    // Data de geração
    pdf.setFontSize(10);
    pdf.setTextColor(128, 128, 128);
    pdf.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 20, 270);
    
    return pdf;
  };

  const handleGenerateReceipts = async () => {
    if (!selectedTemplate) {
      toast.error('Selecione um template para gerar os recibos');
      return;
    }

    const reservationsToProcess = selectedReservations.length > 0 
      ? filteredReservations.filter(r => selectedReservations.includes(r.id))
      : filteredReservations;

    if (reservationsToProcess.length === 0) {
      toast.error('Nenhuma reserva encontrada para o período selecionado');
      return;
    }

    try {
      setLoading(true);
      const template = receiptTemplates.find(t => t.id === selectedTemplate);
      
      if (reservationsToProcess.length === 1) {
        // Gerar PDF individual
        const pdf = generatePDF(reservationsToProcess[0], template!);
        pdf.save(`recibo-${reservationsToProcess[0].reservation_code}.pdf`);
        toast.success('Recibo gerado com sucesso!');
      } else {
        // Gerar múltiplos PDFs em um ZIP seria ideal, mas por simplicidade vamos gerar um PDF por vez
        for (let i = 0; i < reservationsToProcess.length; i++) {
          const reservation = reservationsToProcess[i];
          const pdf = generatePDF(reservation, template!);
          pdf.save(`recibo-${reservation.reservation_code}.pdf`);
          
          // Pequena pausa entre downloads
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        toast.success(`${reservationsToProcess.length} recibos gerados com sucesso!`);
      }
    } catch (error) {
      console.error('Erro ao gerar recibos:', error);
      toast.error('Erro ao gerar recibos');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateIndividualReceipt = async (reservationId: string) => {
    if (!selectedTemplate) {
      toast.error('Selecione um template primeiro');
      return;
    }

    const reservation = filteredReservations.find(r => r.id === reservationId);
    const template = receiptTemplates.find(t => t.id === selectedTemplate);
    
    if (reservation && template) {
      try {
        const pdf = generatePDF(reservation, template);
        pdf.save(`recibo-${reservation.reservation_code}.pdf`);
        toast.success('Recibo gerado com sucesso!');
      } catch (error) {
        console.error('Erro ao gerar recibo:', error);
        toast.error('Erro ao gerar recibo');
      }
    }
  };

  const handlePreviewReceipt = (reservationId: string) => {
    if (!selectedTemplate) {
      alert('Selecione um template primeiro');
      return;
    }

    const reservation = filteredReservations.find(r => r.id === reservationId);
    const template = receiptTemplates.find(t => t.id === selectedTemplate);
    
    if (reservation && template) {
      const preview = generateReceiptPreview(reservation, template);
      setPreviewReceipt(preview);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Geração de Recibos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Template Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Selecionar Template</label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um template de recibo" />
              </SelectTrigger>
              <SelectContent>
                {receiptTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div>
                      <div className="font-medium">{template.name}</div>
                      <div className="text-xs text-muted-foreground">{template.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reservations List */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium flex items-center gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Reservas do Período ({filteredReservations.length} encontradas)
              </h3>
              <div className="flex gap-2">
                <Button 
                  onClick={handleGenerateReceipts}
                  disabled={!selectedTemplate || loading || filteredReservations.length === 0}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Gerar Todos os Recibos
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Carregando reservas...</span>
              </div>
            ) : filteredReservations.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma reserva encontrada para o período e propriedades selecionadas</p>
                <p className="text-sm mt-2">Ajuste os filtros na barra lateral para ver mais reservas</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {filteredReservations.map((reservation) => (
                <Card key={reservation.id} className="p-3">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{reservation.reservation_code}</p>
                          <p className="text-sm text-muted-foreground">
                            {getPropertyName(reservation.property_id)} • {reservation.guest_name || 'Sem nome'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(reservation.check_in_date), "dd/MM/yyyy")} - {format(new Date(reservation.check_out_date), "dd/MM/yyyy")}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={reservation.payment_status === 'Pago' ? 'default' : 'secondary'}>
                        {reservation.payment_status || 'Pendente'}
                      </Badge>
                      <span className="font-medium">{formatCurrency(reservation.total_revenue)}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePreviewReceipt(reservation.id)}
                        disabled={!selectedTemplate}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview Modal */}
      {previewReceipt && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Prévia do Recibo</CardTitle>
              <Button variant="outline" onClick={() => setPreviewReceipt(null)}>
                Fechar Prévia
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div 
              className="border border-border rounded-lg p-4 bg-background"
              dangerouslySetInnerHTML={{ __html: previewReceipt }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};