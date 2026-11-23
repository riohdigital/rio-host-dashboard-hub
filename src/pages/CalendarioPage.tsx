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
import { Button } from '@/components/ui/button';
import JanelaResponsiva from '@/components/comum/JanelaResponsiva';
import { EtiquetaPlataforma, EtiquetaStatus } from '@/components/comum/Etiquetas';
import { formatarData, formatarMoeda } from '@/components/comum/formatos';
import { useEhCelular } from '@/hooks/useMidia';
import { CalendarDensityControl } from '@/components/calendario/CalendarDensityControl';
import ReservationForm from '@/components/reservations/ReservationForm';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageCircle, Pencil } from 'lucide-react';
import { useEventosDoPeriodo } from '@/hooks/useEventosDoPeriodo';
import { FeriadosDoPeriodo } from '@/components/calendario/FeriadosDoPeriodo';
import { eventoValeParaImovel, noites, somarDias } from '@/components/pricing/ocupacao';

const CalendarioPage = () => {
  const { selectedProperties, selectedPlatform, selectedPeriod, customStartDate, customEndDate } = useGlobalFilters();
  const { view, setView, goToNextPeriod, goToPreviousPeriod, goToToday, currentDate } = useCalendarView();
  const [selectedReservation, setSelectedReservation] = useState<CalendarReservation | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const celular = useEhCelular();
  const [detalheAberto, setDetalheAberto] = useState(false);
  const [exibicaoAberta, setExibicaoAberta] = useState(false);

  // No celular o calendário abre na Lista compacta
  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) setView('list');
  }, [setView]);
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

  // Celular: toque abre a folha de detalhes; desktop: abre a edição direto (como antes)
  const handleReservationClick = (reservation: CalendarReservation) => {
    setSelectedReservation(reservation);
    if (celular) setDetalheAberto(true);
    else setIsEditModalOpen(true);
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

  const r = selectedReservation;

  return (
    <div className="space-y-5 sm:space-y-6">
      <CalendarHeader
        currentDate={currentDate}
        view={view}
        onViewChange={setView}
        onPrevious={goToPreviousPeriod}
        onNext={goToNextPeriod}
        onToday={goToToday}
        onAbrirExibicao={() => setExibicaoAberta(true)}
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          {/* Estatísticas de Ocupação - Compacta e colapsável */}
          <OccupancyStatsCard stats={occupancyStats} />

          <FeriadosDoPeriodo eventos={eventos} properties={filteredProperties} reservations={reservations} />

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
        </>
      )}

      {/* Exibição: densidade da linha do tempo e legenda */}
      <JanelaResponsiva aberta={exibicaoAberta} aoMudar={setExibicaoAberta} titulo="Exibição do calendário" largura="lg">
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-ink">Densidade da linha do tempo</h3>
            <CalendarDensityControl dayWidth={dayWidth} onDayWidthChange={setDayWidth} />
          </section>
          <section>
            <CalendarLegend />
          </section>
        </div>
      </JanelaResponsiva>

      {/* Celular: folha de detalhes da reserva */}
      <JanelaResponsiva
        aberta={detalheAberto && !!r}
        aoMudar={(a) => { setDetalheAberto(a); if (!a && !isEditModalOpen) setSelectedReservation(null); }}
        titulo={r?.guest_name || 'Reserva'}
        descricao={r ? `${r.properties?.nickname || r.properties?.name || ''} · ${r.reservation_code}` : undefined}
        rodape={
          <>
            <Button variant="outline" onClick={() => { setDetalheAberto(false); setSelectedReservation(null); }}>Fechar</Button>
            <Button onClick={() => { setDetalheAberto(false); setIsEditModalOpen(true); }} className="gap-2">
              <Pencil className="h-4 w-4" /> Editar reserva
            </Button>
          </>
        }
      >
        {r && (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-surface p-3">
              <dt className="text-xs text-gray-500">Check-in</dt>
              <dd className="font-mono font-semibold tabular-nums text-ink">{formatarData(r.check_in_date)}</dd>
              {r.checkin_time && <dd className="font-mono text-xs text-gray-500">{r.checkin_time.slice(0, 5)}</dd>}
            </div>
            <div className="rounded-2xl bg-surface p-3">
              <dt className="text-xs text-gray-500">Check-out</dt>
              <dd className="font-mono font-semibold tabular-nums text-ink">{formatarData(r.check_out_date)}</dd>
              {r.checkout_time && <dd className="font-mono text-xs text-gray-500">{r.checkout_time.slice(0, 5)}</dd>}
            </div>
            <div className="rounded-2xl bg-surface p-3">
              <dt className="text-xs text-gray-500">Valor total</dt>
              <dd className="font-mono font-semibold tabular-nums text-ink">{formatarMoeda(r.total_revenue)}</dd>
              <dd className="font-mono text-xs text-success-700">Líquido {formatarMoeda(r.net_revenue)}</dd>
            </div>
            <div className="rounded-2xl bg-surface p-3">
              <dt className="text-xs text-gray-500">Hóspedes</dt>
              <dd className="font-mono font-semibold tabular-nums text-ink">{r.number_of_guests || '—'}</dd>
            </div>
            <div className="col-span-2 flex flex-wrap items-center gap-2">
              <EtiquetaPlataforma plataforma={r.platform} />
              <EtiquetaStatus status={r.reservation_status} />
              <EtiquetaStatus status={r.payment_status || 'Pendente'} />
            </div>
            {r.guest_phone && (
              <div className="col-span-2">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    const tel = r.guest_phone?.replace(/\D/g, '');
                    if (tel) window.open(`https://wa.me/55${tel}`, '_blank');
                  }}
                >
                  <MessageCircle className="h-4 w-4 text-success-600" /> WhatsApp do hóspede
                </Button>
              </div>
            )}
          </dl>
        )}
      </JanelaResponsiva>

      {/* Edição */}
      <JanelaResponsiva
        aberta={isEditModalOpen && !!selectedReservation}
        aoMudar={(a) => { if (!a) handleEditCancel(); }}
        titulo="Editar Reserva"
        telaCheia
        largura="xl"
      >
        {selectedReservation && (
          <ReservationForm
            reservation={selectedReservation}
            onSuccess={handleEditSuccess}
            onCancel={handleEditCancel}
          />
        )}
      </JanelaResponsiva>
    </div>
  );
};

export default CalendarioPage;
