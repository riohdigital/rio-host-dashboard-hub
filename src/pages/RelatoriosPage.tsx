import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, DollarSign, Calendar, TrendingUp, PieChart } from "lucide-react";
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useDateRange } from '@/hooks/dashboard/useDateRange';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { useToast } from '@/hooks/use-toast';
import { useProperties } from '@/hooks/useProperties';
import { useReportData, ReportData } from '@/hooks/reports/useReportData';
import { usePDFExport } from '@/hooks/reports/usePDFExport';
import { ReportTemplate } from '@/components/reports/ReportTemplate';
import { ReceiptGenerator } from '@/components/reports/ReceiptGenerator';
import MainLayout from '@/components/layout/MainLayout';

const RelatoriosPage: React.FC = () => {
  const { selectedPeriod } = useGlobalFilters();
  const { startDateString, endDateString } = useDateRange(selectedPeriod);
  const { permissions, isMaster } = useUserPermissions();
  const { toast } = useToast();
  const { properties, loading: propertiesLoading } = useProperties();
  const { generateReport, loading: reportLoading } = useReportData();
  const { exportToPDF, exportToExcel } = usePDFExport();
  
  const [reportType, setReportType] = useState<string>('financial');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [currentReport, setCurrentReport] = useState<ReportData | null>(null);

  // Verificar permissões
  const canViewReports = isMaster() || 
                         permissions.some(p => p.permission_type === 'reports_view' && p.permission_value) || 
                         permissions.some(p => p.permission_type === 'reports_create' && p.permission_value);

  if (!canViewReports) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="text-center py-8">
              <p>Você não tem permissão para acessar os relatórios.</p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const reportTypes = [
    { value: 'financial', label: 'Relatório Financeiro', icon: DollarSign },
    { value: 'occupancy', label: 'Relatório de Ocupação', icon: Calendar },
    { value: 'property', label: 'Performance por Propriedade', icon: TrendingUp },
    { value: 'platform', label: 'Relatório de Plataformas', icon: PieChart },
    { value: 'expenses', label: 'Despesas vs Receitas', icon: FileText },
    { value: 'checkins', label: 'Check-ins/Check-outs', icon: Calendar },
  ];

  const handleGenerateReport = async () => {
    try {
      const filters = {
        reportType,
        propertyId: selectedProperty,
        platform: selectedPlatform,
        startDate: customStartDate ? customStartDate.toISOString().split('T')[0] : startDateString,
        endDate: customEndDate ? customEndDate.toISOString().split('T')[0] : endDateString
      };

      const report = await generateReport(filters);
      if (report) {
        setCurrentReport(report);
        toast({
          title: "Relatório gerado com sucesso",
          description: `${report.title} foi gerado para o período selecionado.`,
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao gerar relatório",
        description: "Ocorreu um erro ao gerar o relatório. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleExportPDF = async () => {
    if (!currentReport) {
      toast({
        title: "Erro",
        description: "Gere um relatório primeiro para exportar.",
        variant: "destructive"
      });
      return;
    }

    try {
      await exportToPDF('report-preview', `relatorio-${currentReport.type}-${new Date().toISOString().split('T')[0]}`);
      toast({
        title: "Sucesso",
        description: "Relatório exportado em PDF com sucesso!"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao exportar PDF. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleExportExcel = async () => {
    if (!currentReport) {
      toast({
        title: "Erro",
        description: "Gere um relatório primeiro para exportar.",
        variant: "destructive"
      });
      return;
    }

    try {
      await exportToExcel(currentReport, `relatorio-${currentReport.type}-${new Date().toISOString().split('T')[0]}`);
      toast({
        title: "Sucesso",
        description: "Relatório exportado em Excel com sucesso!"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao exportar Excel. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Relatórios</h1>
            <p className="text-muted-foreground">
              Gere relatórios detalhados sobre suas propriedades e reservas
            </p>
          </div>
        </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros de Relatório</CardTitle>
          <CardDescription>
            Configure os parâmetros para gerar seu relatório
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Tipo de Relatório */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Relatório</label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Propriedade */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Propriedade</label>
              <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as propriedades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as propriedades</SelectItem>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.nickname || property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Plataforma */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Plataforma</label>
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as plataformas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as plataformas</SelectItem>
                  <SelectItem value="Airbnb">Airbnb</SelectItem>
                  <SelectItem value="Booking">Booking.com</SelectItem>
                  <SelectItem value="Direto">Direto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Período Personalizado */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Período Personalizado (Opcional)</label>
            <div className="flex gap-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Data Início</label>
                <DatePicker
                  date={customStartDate}
                  onDateChange={setCustomStartDate}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Data Fim</label>
                <DatePicker
                  date={customEndDate}
                  onDateChange={setCustomEndDate}
                />
              </div>
            </div>
          </div>

          {/* Período Atual */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              Período Selecionado: {startDateString} até {endDateString}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex gap-4">
        <Button 
          onClick={handleGenerateReport} 
          className="gap-2"
          disabled={reportLoading || propertiesLoading}
        >
          <FileText className="h-4 w-4" />
          {reportLoading ? 'Gerando...' : 'Gerar Relatório'}
        </Button>
        <Button 
          variant="outline" 
          onClick={handleExportPDF} 
          className="gap-2"
          disabled={!currentReport}
        >
          <Download className="h-4 w-4" />
          Exportar PDF
        </Button>
        <Button 
          variant="outline" 
          onClick={handleExportExcel} 
          className="gap-2"
          disabled={!currentReport}
        >
          <Download className="h-4 w-4" />
          Exportar Excel
        </Button>
      </div>

      {/* Prévia do Relatório */}
      {currentReport && (
        <Card>
          <CardHeader>
            <CardTitle>Prévia do Relatório</CardTitle>
          </CardHeader>
          <CardContent>
            <div id="report-preview">
              <ReportTemplate report={currentReport} />
            </div>
          </CardContent>
        </Card>
      )}

      {!currentReport && (
        <Card>
          <CardHeader>
            <CardTitle>Prévia do Relatório</CardTitle>
            <CardDescription>
              {reportTypes.find(r => r.value === reportType)?.label || 'Relatório'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">Relatório será exibido aqui</p>
              <p className="text-sm">
                Clique em "Gerar Relatório" para visualizar os dados
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Geração de Recibos */}
      <ReceiptGenerator 
        reservations={[]} // Será implementado com dados reais das reservas
        properties={properties}
        selectedProperty={selectedProperty !== 'all' ? selectedProperty : undefined}
        dateRange={{
          start: customStartDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          end: customEndDate || new Date()
        }}
      />
      </div>
    </MainLayout>
  );
};

export default RelatoriosPage;