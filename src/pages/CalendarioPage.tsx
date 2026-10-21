import { useState, useEffect, useMemo } from 'react';
import { useCalendarView } from '@/hooks/useCalendarView';
import { useCalendarData } from '@/hooks/useCalendarData';
import { useOccupancyStats } from '@/hooks/useOccupancyStats';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useProperties } from '@/hooks/useProperties';
import { useDateRange } from '@/hooks/dashboard/useDateRange';
import { CalendarHeader } from '@/components/calendario/CalendarHeader';
import { TimelineView } from '@/components/calendario/TimelineView';
import { GridView } from '@/components/calendario/GridView';
import { CompactListView } from '@/components/calendario/CompactListView';
import { CalendarLegend } from '@/components/calendario/CalendarLegend';
import { OccupancyStatsCard } from '@/components/calendario/OccupancyStatsCard';
import { CalendarReservation } from '@/types/calendar';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import ReservationForm from '@/components/reservations/ReservationForm';
import { Skeleton } from '@/components/ui/skeleton';
import { Info } from 'lucide-react';
import { useEventosDoPeriodo } from '@/hooks/useEventosDoPeriodo';
import { FeriadosDoPeriodo } from '@/components/calendario/FeriadosDoPeriodo';
import { eventoValeParaImovel, noites, somarDias } from '@/components/pricing/ocupacao';

const CalendarioPage = () => {
  const { selectedProperties, selectedPlatform, selectedPeriod, customStartDate, customEndDate } = useGlobalFilters();
  const { view, setView, goToNextPeriod, goToPreviousPeriod, goToToday, currentDate } = useCalendarView();
  const [selectedReservation, setSelectedReservation] = useState<CalendarReservation | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [dayWidth, setDayWidth] = useState(() => {
    // Carregar do localStorage ou usar padrão
    const saved = localStorage.getItem('calendar-day-width');
    return saved ? parseInt(saved) : 60;
  });

  // FASE 1: Usar filtros globais para dateRange (igual à página de Reservas)
  const { startDate, endDate } = useDateRange(selectedPeriod, customStartDate, customEndDate);

  // Persistir dayWidth no localStorage
  useEffect(() => {
    localStorage.setItem('calendar-day-width', dayWidth.toString());
  }, [dayWidth]);

  // Buscar propriedades
  const { properties: allProperties = [], loading: isLoadingProperties } = useProperties();

  // Filtrar propriedades baseado no filtro global
  const filteredProperties = selectedProperties.includes('todas')
    ? allProperties
    : allProperties.filter(p => selectedProperties.includes(p.id));

  // Buscar reservas com filtros CORRETOS usando startDate e endDate dos filtros globais
  const { data: reservations = [], isLoading: isLoadingReservations, refetch } = useCalendarData({
    startDate: startDate,
    endDate: endDate,
    propertyIds: selectedProperties,
    platform: selectedPlatform,
  });

  const handleReservationClick = (reservation: CalendarReservation) => {
    setSelectedReservation(reservation);
    setIsEditModalOpen(true);
  };

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    setSelectedReservation(null);
    refetch();
  };

  const handleEditCancel = () => {
    setIsEditModalOpen(false);
    setSelectedReservation(null);
  };

  const isLoading = isLoadingProperties || isLoadingReservations;

  // Feriados e eventos onde os imóveis do filtro estão (mesma regra da Precificação).
  const { data: eventos = [] } = useEventosDoPeriodo(startDate, endDate);
  const datasEspeciais = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const ev of eventos) {
      if (!filteredProperties.some(p => eventoValeParaImovel(ev, p))) continue;
      const n = Math.max(1, noites(ev.start_date, ev.end_date));
      for (let i = 0; i < n; i++) {
        const d = somarDias(ev.start_date, i);
        mapa.set(d, [...(mapa.get(d) || []), ev.name]);
      }
    }
    return mapa;
  }, [eventos, filteredProperties]);

  // Calcular estatísticas de ocupação usando startDate e endDate corretos
  const occupancyStats = useOccupancyStats(
    filteredProperties,
    reservations,
    startDate,
    endDate
  );

  return (
    <div className="p-6 space-y-6">
      <CalendarHeader
        currentDate={currentDate}
        view={view}
        onViewChange={setView}
        onPrevious={goToPreviousPeriod}
        onNext={goToNextPeriod}
        onToday={goToToday}
        dayWidth={dayWidth}
        onDayWidthChange={setDayWidth}
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <>
          {/* Estatísticas de Ocupação - Compacta e colapsável */}
          <OccupancyStatsCard stats={occupancyStats} />

          <FeriadosDoPeriodo eventos={eventos} properties={filteredProperties} reservations={reservations} />

          {/* Layout melhorado - Calendário em largura total */}
          <div className="relative">
            {view === 'timeline' ? (
              <TimelineView
                reservations={reservations}
                properties={filteredProperties}
                startDate={startDate}
                endDate={endDate}
                dayWidth={dayWidth}
                onReservationClick={handleReservationClick}
                datasEspeciais={datasEspeciais}
              />
            ) : view === 'grid' ? (
              <GridView
                reservations={reservations}
                properties={filteredProperties}
                startDate={startDate}
                endDate={endDate}
                onReservationClick={handleReservationClick}
              />
            ) : view === 'list' ? (
              <CompactListView
                reservations={reservations}
                properties={filteredProperties}
                startDate={startDate}
                endDate={endDate}
                onReservationClick={handleReservationClick}
              />
            ) : null}

            {/* Legenda em Sheet colapsável (lado direito) */}
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="fixed right-6 top-24 z-50 shadow-lg"
                >
                  <Info className="h-4 w-4 mr-2" />
                  Legenda
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <CalendarLegend />
              </SheetContent>
            </Sheet>
          </div>
        </>
      )}

      {/* Modal de edição */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedReservation && (
            <ReservationForm
              reservation={selectedReservation}
              onSuccess={handleEditSuccess}
              onCancel={handleEditCancel}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarioPage;