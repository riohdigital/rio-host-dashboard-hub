import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Badge } from "@/components/ui/badge";
import { Download, FileText, DollarSign, Calendar, TrendingUp, PieChart, Share2, Check } from "lucide-react";
import PageHeader from "@/components/comum/PageHeader";
import { cn } from "@/lib/utils";
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
  const [exportando, setExportando] = useState(false);
  // Prévia: o modelo tem 794px (A4); em telas menores ele é reduzido para caber
  const caixaPreviaRef = useRef<HTMLDivElement>(null);
  const [escalaPrevia, setEscalaPrevia] = useState(1);
  useEffect(() => {
    const el = caixaPreviaRef.current;
    if (!el) return;
    const medir = () => setEscalaPrevia(Math.min(1, el.clientWidth / 794));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [currentReport]);
  const podeCompartilhar = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

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
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="text-center py-8">
            <p>Você não tem permissão para acessar os relatórios.</p>
          </CardContent>
        </Card>
      </div>
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

  const handleExportPDF = async (compartilhar = false) => {
    if (!currentReport) {
      toast({
        title: "Erro",
        description: "Gere um relatório primeiro para exportar.",
        variant: "destructive"
      });
      return;
    }

    try {
      // A prévia reduzida volta ao tamanho real durante a captura: o PDF fica igual ao de sempre
      setExportando(true);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await exportToPDF('report-preview', `relatorio-${currentReport.type}-${new Date().toISOString().split('T')[0]}`, { compartilhar });
      if (!compartilhar) {
        toast({
          title: "Sucesso",
          description: "Relatório exportado em PDF com sucesso!"
        });
      }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      toast({
        title: "Erro",
        description: "Falha ao exportar PDF. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setExportando(false);
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
    <div className="space-y-6">
        <PageHeader titulo="Relatórios" descricao="Gere relatórios detalhados sobre suas propriedades e reservas" />

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
            {/* Tipo de Relatório: lista para tocar */}
            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <span className="text-sm font-medium">Tipo de Relatório</span>
              <div role="radiogroup" aria-label="Tipo de relatório" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {reportTypes.map((type) => {
                  const Icon = type.icon;
                  const ativo = reportType === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      role="radio"
                      aria-checked={ativo}
                      onClick={() => setReportType(type.value as typeof reportType)}
                      className={cn(
                        'flex min-h-12 items-center gap-3 rounded-xl border px-3 text-left text-sm transition-colors',
                        ativo ? 'border-brand bg-brand-50 font-semibold text-brand-800' : 'bg-background hover:bg-surface',
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', ativo ? 'text-brand' : 'text-gray-500')} />
                      <span className="flex-1">{type.label}</span>
                      {ativo && <Check className="h-4 w-4 text-brand" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Plataforma */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Plataforma</label>
              <Select value={localPlatform} onValueChange={setLocalPlatform}>
                <SelectTrigger className="h-11 md:h-10">
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
            <Badge variant="secondary" className="font-mono font-normal">
              Período: {startDateString} até {endDateString}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
        <Button
          onClick={handleGenerateReport}
          className="col-span-2 gap-2 sm:col-span-1"
          disabled={reportLoading || propertiesLoading}
        >
          <FileText className="h-4 w-4" />
          {reportLoading ? 'Gerando...' : 'Gerar prévia'}
        </Button>
        <Button variant="outline" onClick={() => handleExportPDF(false)} className="gap-2" disabled={!currentReport || exportando}>
          <Download className="h-4 w-4" />
          Baixar PDF
        </Button>
        {podeCompartilhar ? (
          <Button variant="outline" onClick={() => handleExportPDF(true)} className="gap-2" disabled={!currentReport || exportando}>
            <Share2 className="h-4 w-4" />
            Compartilhar
          </Button>
        ) : null}
        <Button variant="outline" onClick={handleExportExcel} className={cn('gap-2', !podeCompartilhar && 'col-span-1')} disabled={!currentReport}>
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
            <div ref={caixaPreviaRef} className="w-full overflow-hidden">
              {/* zoom reduz a prévia no celular; na exportação volta ao tamanho real */}
              <div style={!exportando && escalaPrevia < 1 ? { width: 794, zoom: escalaPrevia } : undefined}>
                <div id="report-preview">
                  <EnhancedReportTemplate report={currentReport} />
                </div>
              </div>
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
  );
};

export default RelatoriosPage;