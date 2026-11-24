/**
 * Calendário: segue o período do filtro global e o filtro de imóveis (regra
 * D2), no celular e no computador. Três visões:
 * - Mês: um bloco por mês do período, 3 por vez, com a faixa dos meses no topo;
 * - Imóveis: linha do tempo de 14 dias por vez, do 1º dia do período;
 * - Agenda: entradas e saídas, dia a dia, 14 dias por vez.
 * No topo, uma linha com ocupação · receita · reservas e a etiqueta dos feriados.
 */
import { useMemo } from 'react';
import { MessageCircle, Pencil } from 'lucide-react';
import { useCalendarData } from '@/hooks/useCalendarData';
import { useOccupancyStats } from '@/hooks/useOccupancyStats';
import { useGlobalFilters } from '@/contexts/GlobalFiltersContext';
import { useProperties } from '@/hooks/useProperties';
import { useDateRange } from '@/hooks/dashboard/useDateRange';
import { useEventosDoPeriodo } from '@/hooks/useEventosDoPeriodo';
import { useFaxineirasDosImoveis } from '@/hooks/useFaxineirasDosImoveis';
import { useEhCompacto } from '@/hooks/useMidia';
import { CalendarReservation } from '@/types/calendar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AbasRolaveis from '@/components/comum/AbasRolaveis';
import FolhaDetalhes from '@/components/comum/FolhaDetalhes';
import JanelaResponsiva from '@/components/comum/JanelaResponsiva';
import { EtiquetaPlataforma, EtiquetaStatus } from '@/components/comum/Etiquetas';
import { formatarMoeda } from '@/components/comum/formatos';
import { hojeLocal, noites } from '@/components/pricing/ocupacao';
import ReservationForm from '@/components/reservations/ReservationForm';
import ResumoDoPeriodo from '@/components/calendario/ResumoDoPeriodo';
import { feriadosRelevantes } from '@/components/calendario/feriados';
import VisaoMes from '@/components/calendario/VisaoMes';
import VisaoImoveis from '@/components/calendario/VisaoImoveis';
import VisaoAgenda from '@/components/calendario/VisaoAgenda';
import { EtiquetaFaxina } from '@/components/calendario/LinhaMovimento';
import { hora, indexarDias, mesesDoPeriodo, nomeDoImovel, paraTexto, periodoDesenhavel, rotuloDia, rotuloIntervalo } from '@/components/calendario/periodo';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';

type Visao = 'mes' | 'imoveis' | 'agenda';

const VISOES = [
  { valor: 'mes', rotulo: 'Mês' },
  { valor: 'imoveis', rotulo: 'Imóveis' },
  { valor: 'agenda', rotulo: 'Agenda' },
];

const CalendarioPage = () => {
  const { selectedProperties, selectedPlatform, selectedPeriod, customStartDate, customEndDate } = useGlobalFilters();
  // Visão, reserva aberta (folha no celular, edição no computador): voltam depois de recarregar
  const [visao, setVisao] = useEstadoPersistente<Visao>('calendario.visao', 'mes', { aceita: ['mes', 'imoveis', 'agenda'] });
  const [reservaAbertaId, setReservaAbertaId] = useEstadoPersistente<string | null>('calendario.reserva', null);
  const [isEditModalOpen, setIsEditModalOpen] = useEstadoPersistente<boolean>('calendario.edicao.aberta', false);
  const [detalheAberto, setDetalheAberto] = useEstadoPersistente<boolean>('calendario.detalhe.aberto', false);
  const compacto = useEhCompacto();
  const hoje = hojeLocal();

  // Período do filtro global (o mesmo da página de Reservas)
  const { startDate, endDate } = useDateRange(selectedPeriod, customStartDate, customEndDate);

  const { properties: allProperties = [], loading: isLoadingProperties } = useProperties();
  const filteredProperties = useMemo(
    () => (selectedProperties.includes('todas') ? allProperties : allProperties.filter((p) => selectedProperties.includes(p.id))),
    [allProperties, selectedProperties],
  );

  const { data: reservations = [], isLoading: isLoadingReservations, refetch } = useCalendarData({
    startDate,
    endDate,
    propertyIds: selectedProperties,
    platform: selectedPlatform,
  });

  const selectedReservation = useMemo(
    () => (reservaAbertaId ? reservations.find((x) => x.id === reservaAbertaId) ?? null : null),
    [reservations, reservaAbertaId],
  );
  const setSelectedReservation = (reserva: CalendarReservation | null) => setReservaAbertaId(reserva?.id ?? null);

  const idsImoveis = useMemo(() => filteredProperties.map((p) => p.id), [filteredProperties]);
  const { data: faxineiras } = useFaxineirasDosImoveis(idsImoveis);
  const nomesImoveis = useMemo(() => new Map(filteredProperties.map((p) => [p.id, p.nickname || p.name])), [filteredProperties]);

  // O que o calendário desenha: o período do filtro ("Geral" encolhe para os meses com reservas)
  const periodo = useMemo(
    () => periodoDesenhavel(paraTexto(startDate), paraTexto(endDate), reservations, hoje),
    [startDate, endDate, reservations, hoje],
  );
  const meses = useMemo(() => mesesDoPeriodo(periodo.inicio, periodo.fim), [periodo]);
  const dias = useMemo(() => indexarDias(reservations, new Set(idsImoveis), periodo.inicio, periodo.fim), [reservations, idsImoveis, periodo]);

  const occupancyStats = useOccupancyStats(filteredProperties, reservations, startDate, endDate);

  // Feriados e eventos onde os imóveis do filtro estão (mesma regra da Precificação)
  const { data: eventos = [] } = useEventosDoPeriodo(startDate, endDate);
  const feriados = useMemo(() => feriadosRelevantes(eventos, filteredProperties, reservations), [eventos, filteredProperties, reservations]);

  // Celular: toque abre a folha de detalhes; computador: abre a edição direto (como antes)
  const handleReservationClick = (reservation: CalendarReservation) => {
    setSelectedReservation(reservation);
    if (compacto) setDetalheAberto(true);
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
  const r = selectedReservation;
  // As visões recomeçam (1º mês, 1º dia) quando o período muda
  const chavePeriodo = `${periodo.inicio}|${periodo.fim}`;

  return (
    <div className="space-y-3 lg:space-y-4">
      {/* Celular: o nome da tela fica só na barra do topo */}
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink max-lg:sr-only sm:text-3xl">Calendário de Reservas</h1>

      <AbasRolaveis rotulo="Visões do calendário" valor={visao} aoMudar={(v) => setVisao(v as Visao)} itens={VISOES} className="lg:w-auto lg:max-w-md" />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <ResumoDoPeriodo stats={occupancyStats} rotuloPeriodo={rotuloIntervalo(paraTexto(startDate), paraTexto(endDate))} feriados={feriados} />

          {visao === 'mes' ? (
            <VisaoMes
              key={chavePeriodo}
              meses={meses}
              dias={dias}
              imoveis={filteredProperties}
              nomesImoveis={nomesImoveis}
              faxineiras={faxineiras}
              hoje={hoje}
              aoTocarReserva={handleReservationClick}
            />
          ) : visao === 'imoveis' ? (
            <VisaoImoveis
              key={chavePeriodo}
              inicio={periodo.inicio}
              fim={periodo.fim}
              meses={meses}
              imoveis={filteredProperties}
              reservas={reservations.filter((x) => nomesImoveis.has(x.property_id))}
              hoje={hoje}
              aoTocarReserva={handleReservationClick}
            />
          ) : (
            <VisaoAgenda
              key={chavePeriodo}
              inicio={periodo.inicio}
              fim={periodo.fim}
              dias={dias}
              nomesImoveis={nomesImoveis}
              faxineiras={faxineiras}
              hoje={hoje}
              aoTocarReserva={handleReservationClick}
            />
          )}
        </>
      )}

      {/* Celular: folha de detalhes da reserva */}
      <FolhaDetalhes
        aberta={detalheAberto && !!r}
        aoMudar={(a) => {
          setDetalheAberto(a);
          if (!a && !isEditModalOpen) setSelectedReservation(null);
        }}
        titulo={r?.guest_name || 'Reserva'}
        etiqueta={r ? <EtiquetaPlataforma plataforma={r.platform} /> : undefined}
        subtitulo={
          r
            ? `${nomeDoImovel(r, nomesImoveis)} · ${rotuloDia(r.check_in_date)} → ${rotuloDia(r.check_out_date)} · ${noites(r.check_in_date, r.check_out_date)} noites · ${r.reservation_code}`
            : undefined
        }
        acoes={
          r ? (
            <>
              {r.guest_phone && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    const tel = r.guest_phone?.replace(/\D/g, '');
                    if (tel) window.open(`https://wa.me/55${tel}`, '_blank');
                  }}
                >
                  <MessageCircle className="h-4 w-4 text-success-600" /> WhatsApp
                </Button>
              )}
              <Button
                onClick={() => {
                  setDetalheAberto(false);
                  setIsEditModalOpen(true);
                }}
                className="gap-2"
              >
                <Pencil className="h-4 w-4" /> Editar
              </Button>
            </>
          ) : undefined
        }
      >
        {r && (
          <>
            <dl className="grid grid-cols-3 gap-2">
              <div className="min-w-0 rounded-xl bg-gray-50 p-2.5">
                <dt className="text-xs text-gray-500">Entrada</dt>
                <dd className="font-mono text-sm font-semibold tabular-nums text-gray-900">{hora(r.checkin_time) || rotuloDia(r.check_in_date)}</dd>
              </div>
              <div className="min-w-0 rounded-xl bg-gray-50 p-2.5">
                <dt className="text-xs text-gray-500">Saída</dt>
                <dd className="font-mono text-sm font-semibold tabular-nums text-gray-900">{hora(r.checkout_time) || rotuloDia(r.check_out_date)}</dd>
              </div>
              <div className="min-w-0 rounded-xl bg-gray-50 p-2.5">
                <dt className="text-xs text-gray-500">Hóspedes</dt>
                <dd className="font-mono text-sm font-semibold tabular-nums text-gray-900">{r.number_of_guests || '—'}</dd>
              </div>
              <div className="col-span-3 flex min-w-0 items-baseline justify-between gap-2 rounded-xl bg-gray-50 p-2.5">
                <dt className="text-xs text-gray-500">Total</dt>
                <dd className="truncate font-mono text-sm font-semibold tabular-nums text-gray-900">
                  {formatarMoeda(r.total_revenue)} <span className="text-xs font-medium text-success-700">· líquido {formatarMoeda(r.net_revenue)}</span>
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap items-center gap-2">
              <EtiquetaStatus status={r.reservation_status} />
              <EtiquetaStatus status={r.payment_status || 'Pendente'} />
              <EtiquetaFaxina reserva={r} faxineiras={faxineiras} hoje={hoje} />
            </div>
          </>
        )}
      </FolhaDetalhes>

      {/* Edição */}
      <JanelaResponsiva
        aberta={isEditModalOpen && !!selectedReservation}
        aoMudar={(a) => {
          if (!a) handleEditCancel();
        }}
        titulo="Editar Reserva"
        telaCheia
        largura="xl"
      >
        {selectedReservation && <ReservationForm reservation={selectedReservation} onSuccess={handleEditSuccess} onCancel={handleEditCancel} />}
      </JanelaResponsiva>
    </div>
  );
};

export default CalendarioPage;
