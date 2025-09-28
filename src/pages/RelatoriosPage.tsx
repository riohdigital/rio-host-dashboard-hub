import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Badge } from "@/components/ui/badge";
import { Download, FileText, DollarSign, Calendar, TrendingUp, PieChart } from "lucide-react";
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useDateRange } from '@/hooks/dashboard/useDateRange';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { useToast } from '@/hooks/use-toast';
import { useProperties } from '@/hooks/useProperties';
import { useReportData, ReportData } from '@/hooks/reports/useReportData';
import { usePDFExport } from '@/hooks/reports/usePDFExport';
import { EnhancedReportTemplate } from '@/components/reports/EnhancedReportTemplate';
import ReceiptGenerator from '@/components/reports/ReceiptGenerator';
import CleanerPaymentsReport from '@/components/reports/CleanerPaymentsReport';
import MainLayout from '@/components/layout/MainLayout';

const RelatoriosPage: React.FC = () => {
  const { selectedPeriod, selectedProperties, selectedPlatform, customStartDate: globalCustomStartDate, customEndDate: globalCustomEndDate } = useGlobalFilters();
  const { startDateString, endDateString } = useDateRange(selectedPeriod, globalCustomStartDate, globalCustomEndDate);
  const { permissions, isMaster } = useUserPermissions();
  const { toast } = useToast();
  const { properties, loading: propertiesLoading } = useProperties();
  const { generateReport, loading: reportLoading } = useReportData();
  const { exportToPDF, exportToExcel } = usePDFExport();
  
  const [reportType, setReportType] = useState<'financial_owner' | 'financial_expenses' | 'occupancy' | 'property' | 'platform' | 'expenses' | 'checkins'>('financial_owner');
  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const [localPlatform, setLocalPlatform] = useState<string>('all');
  const [currentReport, setCurrentReport] = useState<ReportData | null>(null);

  // Atualizar automaticamente a prévia quando período, propriedades ou plataforma globais mudarem
  useEffect(() => {
    if (currentReport) {
      handleGenerateReport();
    }
  }, [selectedPeriod, startDateString, endDateString, selectedProperties, selectedPlatform, globalCustomStartDate, globalCustomEndDate]);

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
    { value: 'financial_owner', label: 'Relatório Financeiro (Proprietário)', icon: DollarSign },
    { value: 'financial_expenses', label: 'Relatório Financeiro (ComDespesas)', icon: DollarSign },
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
        platform: localPlatform,
        startDate: startDateString,
        endDate: endDateString,
        selectedProperties, // Passar as propriedades selecionadas no filtro global
        selectedPlatform // Passar a plataforma selecionada no filtro global
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
          <CardTitle>Configurações do Relatório</CardTitle>
          <CardDescription>
            Configure o tipo e período para gerar seu relatório
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Tipo de Relatório */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Relatório</label>
              <Select value={reportType} onValueChange={(value) => setReportType(value as any)}>
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

            {/* Plataforma */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Plataforma</label>
              <Select value={localPlatform} onValueChange={setLocalPlatform}>
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
          {reportLoading ? 'Gerando...' : 'Prévia'}
        </Button>
        <Button 
          variant="outline" 
          onClick={handleExportPDF} 
          className="gap-2"
          disabled={!currentReport}
        >
          <Download className="h-4 w-4" />
          PDF
        </Button>
        <Button 
          variant="outline" 
          onClick={handleExportExcel} 
          className="gap-2"
          disabled={!currentReport}
        >
          <Download className="h-4 w-4" />
          Excel
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
              <EnhancedReportTemplate report={currentReport} />
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

      {/* Relatório de Pagamentos de Faxineiras */}
      <CleanerPaymentsReport />

      {/* Geração de Recibos */}
      <ReceiptGenerator />
      </div>
    </MainLayout>
  );
};

export default RelatoriosPage;