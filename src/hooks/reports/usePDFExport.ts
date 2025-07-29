import { useCallback } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

interface ReportData {
  type: string;
  title: string;
  data: any;
  generatedAt: string | Date;
}

export const usePDFExport = () => {
  const exportToPDF = useCallback(async (elementId: string, filename: string) => {
    try {
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error('Elemento não encontrado para exportação');
      }

      // Configurar o elemento para impressão
      const originalStyle = element.style.cssText;
      element.style.cssText += `
        background: white !important;
        width: 794px !important;
        max-width: none !important;
        margin: 0 !important;
        padding: 40px !important;
        box-shadow: none !important;
        border: none !important;
      `;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 794,
        height: element.scrollHeight + 80
      });

      // Restaurar estilo original
      element.style.cssText = originalStyle;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${filename}.pdf`);
      return true;
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      throw new Error('Falha ao gerar PDF. Tente novamente.');
    }
  }, []);

  const exportToExcel = useCallback((reportData: ReportData, filename: string) => {
    try {
      const workbook = XLSX.utils.book_new();
      
      // Criar planilha principal com resumo
      const summaryData = [
        ['Relatório', reportData.title],
        ['Tipo', reportData.type],
        ['Gerado em', typeof reportData.generatedAt === 'string' ? new Date(reportData.generatedAt).toLocaleString('pt-BR') : reportData.generatedAt.toLocaleString('pt-BR')],
        [], // linha vazia
      ];

      // Adicionar dados específicos baseado no tipo do relatório
      if (reportData.type === 'financial') {
        summaryData.push(
          ['RESUMO FINANCEIRO'],
          ['Receita Total', `R$ ${reportData.data.totalRevenue?.toFixed(2) || '0,00'}`],
          ['Despesas Totais', `R$ ${reportData.data.totalExpenses?.toFixed(2) || '0,00'}`],
          ['Lucro Líquido', `R$ ${reportData.data.netProfit?.toFixed(2) || '0,00'}`],
          ['Margem de Lucro', `${reportData.data.profitMargin?.toFixed(2) || '0'}%`],
          []
        );

        // Receita mensal
        if (reportData.data.monthlyRevenue) {
          summaryData.push(['RECEITA MENSAL']);
          reportData.data.monthlyRevenue.forEach((item: any) => {
            summaryData.push([item.month, `R$ ${item.revenue?.toFixed(2) || '0,00'}`]);
          });
          summaryData.push([]);
        }

        // Receita por plataforma
        if (reportData.data.platformRevenue) {
          summaryData.push(['RECEITA POR PLATAFORMA']);
          reportData.data.platformRevenue.forEach((item: any) => {
            summaryData.push([item.platform, `R$ ${item.revenue?.toFixed(2) || '0,00'}`]);
          });
        }
      }

      if (reportData.type === 'occupancy') {
        summaryData.push(
          ['RELATÓRIO DE OCUPAÇÃO'],
          ['Taxa de Ocupação', `${reportData.data.occupancyRate?.toFixed(2) || '0'}%`],
          ['Total de Noites', reportData.data.totalNights || 0],
          ['Valor Médio Diária', `R$ ${reportData.data.avgDailyRate?.toFixed(2) || '0,00'}`],
          []
        );

        if (reportData.data.propertyOccupancy) {
          summaryData.push(['OCUPAÇÃO POR PROPRIEDADE']);
          reportData.data.propertyOccupancy.forEach((item: any) => {
            summaryData.push([item.property, `${item.occupancy?.toFixed(2) || '0'}%`]);
          });
        }
      }

      if (reportData.type === 'property_performance') {
        summaryData.push(['PERFORMANCE POR PROPRIEDADE']);
        if (reportData.data.properties) {
          summaryData.push(['Propriedade', 'Receita', 'Ocupação', 'ADR', 'RevPAR']);
          reportData.data.properties.forEach((item: any) => {
            summaryData.push([
              item.name,
              `R$ ${item.revenue?.toFixed(2) || '0,00'}`,
              `${item.occupancy?.toFixed(2) || '0'}%`,
              `R$ ${item.adr?.toFixed(2) || '0,00'}`,
              `R$ ${item.revpar?.toFixed(2) || '0,00'}`
            ]);
          });
        }
      }

      const worksheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório');

      // Adicionar planilhas detalhadas se houver dados
      if (reportData.data.detailedData) {
        const detailSheet = XLSX.utils.json_to_sheet(reportData.data.detailedData);
        XLSX.utils.book_append_sheet(workbook, detailSheet, 'Dados Detalhados');
      }

      XLSX.writeFile(workbook, `${filename}.xlsx`);
      return true;
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      throw new Error('Falha ao gerar arquivo Excel. Tente novamente.');
    }
  }, []);

  const exportReceiptToPDF = useCallback(async (receiptHTML: string, filename: string) => {
    try {
      // Criar um elemento temporário
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = receiptHTML;
      tempDiv.style.cssText = `
        position: absolute;
        top: -9999px;
        left: -9999px;
        width: 600px;
        background: white;
        padding: 40px;
      `;
      document.body.appendChild(tempDiv);

      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 600
      });

      document.body.removeChild(tempDiv);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 180;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Centralizar na página
      const x = (210 - imgWidth) / 2;
      const y = 20;
      
      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
      pdf.save(`${filename}.pdf`);
      
      return true;
    } catch (error) {
      console.error('Erro ao exportar recibo:', error);
      throw new Error('Falha ao gerar PDF do recibo. Tente novamente.');
    }
  }, []);

  return {
    exportToPDF,
    exportToExcel,
    exportReceiptToPDF
  };
};