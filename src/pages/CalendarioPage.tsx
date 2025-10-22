import React, { useState } from 'react';
import { useCalendarView } from '@/hooks/useCalendarView';
import { useCalendarData } from '@/hooks/useCalendarData';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useProperties } from '@/hooks/useProperties';
import { CalendarHeader } from '@/components/calendario/CalendarHeader';
import { TimelineView } from '@/components/calendario/TimelineView';
import { CalendarReservation } from '@/types/calendar';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import ReservationForm from '@/components/reservations/ReservationForm';
import { Skeleton } from '@/components/ui/skeleton';

const CalendarioPage: React.FC = () => {
  const { selectedProperties, selectedPlatform } = useGlobalFilters();
  const { dateRange, goToNextPeriod, goToPreviousPeriod, goToToday, currentDate } = useCalendarView();
  const [selectedReservation, setSelectedReservation] = useState<CalendarReservation | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Buscar propriedades
  const { properties: allProperties = [], loading: isLoadingProperties } = useProperties();

  // Filtrar propriedades baseado no filtro global
  const filteredProperties = selectedProperties.includes('todas')
    ? allProperties
    : allProperties.filter(p => selectedProperties.includes(p.id));

  // Buscar reservas com filtros
  const { data: reservations = [], isLoading: isLoadingReservations, refetch } = useCalendarData({
    startDate: dateRange.start,
    endDate: dateRange.end,
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

  return (
    <div className="p-6 space-y-6">
      <CalendarHeader
        currentDate={currentDate}
        onPrevious={goToPreviousPeriod}
        onNext={goToNextPeriod}
        onToday={goToToday}
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <TimelineView
          reservations={reservations}
          properties={filteredProperties}
          startDate={dateRange.start}
          endDate={dateRange.end}
          onReservationClick={handleReservationClick}
        />
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
