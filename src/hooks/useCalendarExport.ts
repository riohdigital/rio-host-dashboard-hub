import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { CalendarReservation } from '@/types/calendar';
import { Property } from '@/types/property';
import { OccupancyStats } from '@/types/calendar';

export const useCalendarExport = () => {
  const exportToExcel = (
    reservations: CalendarReservation[],
    properties: Property[],
    startDate: Date,
    endDate: Date
  ) => {
    const data = reservations.map(r => ({
      Propriedade:
        properties.find(p => p.id === r.property_id)?.name || '',
      Apelido:
        properties.find(p => p.id === r.property_id)?.nickname || '',
      Código: r.reservation_code,
      Hóspede: r.guest_name || '',
      'Check-in': format(new Date(r.check_in_date), 'dd/MM/yyyy'),
      'Check-out': format(new Date(r.check_out_date), 'dd/MM/yyyy'),
      'Hora Check-in': r.checkin_time || '',
      'Hora Check-out': r.checkout_time || '',
      Plataforma: r.platform,
      'Status Reserva': r.reservation_status,
      'Status Pagamento': r.payment_status || '',
      'Nº Hóspedes': r.number_of_guests || 0,
      'Receita Total': r.total_revenue || 0,
      'Receita Base': r.base_revenue || 0,
      Comissão: r.commission_amount || 0,
      'Receita Líquida': r.net_revenue || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(data);

    // Ajustar largura das colunas
    const colWidths = [
      { wch: 20 }, // Propriedade
      { wch: 15 }, // Apelido
      { wch: 15 }, // Código
      { wch: 20 }, // Hóspede
      { wch: 12 }, // Check-in
      { wch: 12 }, // Check-out
      { wch: 12 }, // Hora Check-in
      { wch: 12 }, // Hora Check-out
      { wch: 12 }, // Plataforma
      { wch: 15 }, // Status Reserva
      { wch: 15 }, // Status Pagamento
      { wch: 12 }, // Nº Hóspedes
      { wch: 12 }, // Receita Total
      { wch: 12 }, // Receita Base
      { wch: 12 }, // Comissão
      { wch: 12 }, // Receita Líquida
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reservas');

    XLSX.writeFile(
      wb,
      `calendario-${format(startDate, 'yyyy-MM')}-${format(endDate, 'yyyy-MM')}.xlsx`
    );
  };

  const exportToPDF = async (element: HTMLElement, filename?: string) => {
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        logging: false,
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Calcular dimensões mantendo proporção
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;

      pdf.addImage(
        imgData,
        'PNG',
        imgX,
        imgY,
        imgWidth * ratio,
        imgHeight * ratio
      );

      pdf.save(filename || `calendario-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      throw error;
    }
  };

  const exportStatisticsPDF = (stats: OccupancyStats[]) => {
    const pdf = new jsPDF('portrait', 'mm', 'a4');

    // Título
    pdf.setFontSize(18);
    pdf.text('Estatísticas de Ocupação', 15, 20);

    // Data
    pdf.setFontSize(10);
    pdf.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 15, 28);

    // Tabela de estatísticas
    let y = 40;
    pdf.setFontSize(12);
    pdf.text('Propriedade', 15, y);
    pdf.text('Ocupação', 80, y);
    pdf.text('Dias', 120, y);
    pdf.text('Receita', 150, y);
    pdf.text('Diária Média', 180, y);

    y += 8;
    pdf.setFontSize(10);

    stats.forEach(stat => {
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }

      pdf.text(stat.propertyName.substring(0, 25), 15, y);
      pdf.text(`${stat.occupancyRate.toFixed(1)}%`, 80, y);
      pdf.text(`${stat.occupiedDays}/${stat.totalDays}`, 120, y);
      pdf.text(`R$ ${stat.totalRevenue.toFixed(2)}`, 150, y);
      pdf.text(`R$ ${stat.averageDailyRate.toFixed(2)}`, 180, y);
      y += 7;
    });

    pdf.save(`estatisticas-ocupacao-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return {
    exportToExcel,
    exportToPDF,
    exportStatisticsPDF,
  };
};
