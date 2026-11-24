/**
 * Painel Gestor no celular (abaixo de 1024px), desenho `mPainel` do plano (T6):
 * FaixaResumo (comissão em destaque) → saídas sem faxineira → Comissões por
 * mês → Comissões (recebidas · a receber, lista recolhida) → Desempenho por
 * imóvel → Distribuição por plataforma → Próximos eventos e Atividades
 * recentes (recolhidos). Usa só os dados que useGestorDashboard já calcula;
 * o computador continua com o desenho de sempre (PainelGestorPage).
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow, isToday, isTomorrow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, CalendarPlus, CheckCircle, CreditCard, LogIn, LogOut, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Bloco from '@/components/comum/Bloco';
import FaixaResumo from '@/components/comum/FaixaResumo';
import BlocoRecolhivel from '@/components/comum/BlocoRecolhivel';
import LinhaLista from '@/components/comum/LinhaLista';
import { ListaLinhas } from '@/components/comum/GrupoLista';
import VerTodos from '@/components/comum/VerTodos';
import FolhaDetalhes from '@/components/comum/FolhaDetalhes';
import { Etiqueta } from '@/components/comum/Etiquetas';
import { EsqueletoLista } from '@/components/comum/Esqueleto';
import { useListaCurta } from '@/components/comum/useListaCurta';
import { formatarMoedaSemCentavos } from '@/components/comum/formatos';
import { CommissionChart } from './CommissionChart';
import { PlatformBreakdownChart } from './PlatformBreakdownChart';
import { AbasComissoes } from './CommissionDetailsCard';
import type {
  CleaningRiskAlert,
  CommissionSummary,
  GestorKPIs,
  MonthlyCommission,
  PlatformBreakdown,
  PropertyPerformance,
  RecentActivity,
  UpcomingEvent,
} from '@/types/painel-gestor';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';
import { useItemAberto } from '@/hooks/useItemAberto';

interface PainelGestorCelularProps {
  loading: boolean;
  kpis: GestorKPIs;
  monthlyCommissions: MonthlyCommission[];
  propertyPerformance: PropertyPerformance[];
  platformBreakdown: PlatformBreakdown[];
  upcomingEvents: UpcomingEvent[];
  cleaningRiskAlerts: CleaningRiskAlert[];
  recentActivities: RecentActivity[];
  commissionDetails: CommissionSummary;
}

/** Botão pequeno de ação numa linha ("Atribuir") */
const CLASSE_BOTAO_LINHA = 'h-9 rounded-full px-3.5 text-[13px] font-semibold';

const porcentagem = (v: number) => `${(Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** "hoje", "amanhã" ou "25 nov" */
const rotuloDia = (data: string) => {
  const d = parseISO(data);
  if (isToday(d)) return 'hoje';
  if (isTomorrow(d)) return 'amanhã';
  return format(d, 'd MMM', { locale: ptBR });
};

/** "Em 7 dias", "Amanhã", "Hoje" */
const emQuantosDias = (dias: number) => (dias <= 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`);

/** Pares rótulo/valor numa grade de 2 colunas (dentro das folhas) */
const Campos = ({ itens }: { itens: { rotulo: string; valor: React.ReactNode; classe?: string }[] }) => (
  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-gray-50 p-3.5">
    {itens.map((c) => (
      <div key={c.rotulo} className="min-w-0">
        <dt className="truncate text-xs text-gray-500">{c.rotulo}</dt>
        <dd className={`truncate font-mono text-sm font-semibold tabular-nums text-gray-900 ${c.classe ?? ''}`}>{c.valor}</dd>
      </div>
    ))}
  </dl>
);

/* ── Saídas sem faxineira ─────────────────────────────── */
const AlertasFaxina = ({ alertas }: { alertas: CleaningRiskAlert[] }) => {
  const navigate = useNavigate();
  const lista = useListaCurta(alertas, 3, { chave: 'gestor.alertas.todos' });
  if (alertas.length === 0) return null;
  return (
    <Bloco tom="alerta" titulo={plural(alertas.length, 'saída sem faxineira', 'saídas sem faxineira')} extra="próximas primeiro" compacto>
      <ListaLinhas className="divide-danger-100">
        {lista.visiveis.map((a) => (
          <LinhaLista
            key={a.reservationId}
            icone={AlertTriangle}
            tomIcone="danger"
            titulo={`${a.propertyNickname || a.propertyName} · ${format(parseISO(a.checkoutDate), 'd MMM', { locale: ptBR })}`}
            subtitulo={`${a.guestName} · ${emQuantosDias(a.daysUntilCheckout)}`}
            acao={
              <Button size="sm" className={CLASSE_BOTAO_LINHA} onClick={() => navigate('/gestao-faxinas')}>
                Atribuir
              </Button>
            }
          />
        ))}
      </ListaLinhas>
      {lista.temMais && (
        <VerTodos
          rotulo={`Ver as ${lista.total}`}
          expandido={lista.expandido}
          aoClicar={lista.alternar}
          className="border-danger-100"
        />
      )}
    </Bloco>
  );
};

/* ── Comissões: recebidas · a receber + lista recolhida ── */
const ResumoComissoes = ({ dados }: { dados: CommissionSummary }) => {
  const [aberta, setAberta] = useEstadoPersistente<boolean>('gestor.comissoes.lista', false);
  return (
    <Bloco titulo="Comissões" className="pb-0">
      <dl className="grid grid-cols-2 gap-3 pb-3">
        <div className="min-w-0">
          <dt className="truncate text-xs text-gray-500">Recebidas · {dados.receivedCount}</dt>
          <dd className="truncate font-mono text-base font-semibold tabular-nums text-success-700">{formatarMoedaSemCentavos(dados.totalReceived)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="truncate text-xs text-gray-500">A receber · {dados.pendingCount}</dt>
          <dd className="truncate font-mono text-base font-semibold tabular-nums text-warning-700">{formatarMoedaSemCentavos(dados.totalPending)}</dd>
        </div>
      </dl>
      {aberta && (
        <div className="border-t border-gray-100 pt-3">
          <AbasComissoes data={dados} />
        </div>
      )}
      {dados.details.length > 0 && <VerTodos rotulo={aberta ? 'Ocultar lista' : 'Ver lista'} aoClicar={() => setAberta((v) => !v)} />}
    </Bloco>
  );
};

/* ── Desempenho por imóvel ────────────────────────────── */
const DesempenhoImoveis = ({ dados, receitaTotal }: { dados: PropertyPerformance[]; receitaTotal: number }) => {
  const ordenados = useMemo(() => [...dados].sort((a, b) => b.totalRevenue - a.totalRevenue), [dados]);
  const lista = useListaCurta(ordenados, 5, { chave: 'gestor.imoveis.todos' });
  // A folha do imóvel volta aberta depois de recarregar (guarda só o id)
  const folha = useItemAberto('gestor.imovel.folha', dados, { idDe: (p) => p.propertyId });
  const sel = folha.aberto ? folha.item : null;
  const setSel = (p: PropertyPerformance | null) => (p ? folha.abrir(p) : folha.limpar());
  const maior = Math.max(1, ...ordenados.map((p) => p.totalRevenue));

  return (
    <Bloco
      titulo="Desempenho por imóvel"
      ajuda="Receita gerada no período, por imóvel. Toque num imóvel para ver a comissão, a taxa e as faxinas."
      className="pb-0"
    >
      <p className="-mt-1 mb-1 text-xs text-gray-500">
        Receita gerada <span className="font-mono font-semibold tabular-nums text-gray-900">{formatarMoedaSemCentavos(receitaTotal)}</span>
      </p>
      {ordenados.length === 0 ? (
        <p className="pb-3.5 text-sm text-gray-500">Nenhum imóvel no período selecionado.</p>
      ) : (
        <ListaLinhas>
          {lista.visiveis.map((p) => (
            <button
              key={p.propertyId}
              type="button"
              onClick={() => setSel(p)}
              className="block min-h-16 w-full rounded-lg py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:bg-gray-50"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-semibold text-gray-900">{p.nickname || p.propertyName}</span>
                <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-gray-900">{formatarMoedaSemCentavos(p.totalRevenue)}</span>
              </span>
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(2, (p.totalRevenue / maior) * 100)}%` }} />
              </span>
              <span className="mt-1 block truncate text-xs text-gray-500">
                Ocupação {porcentagem(p.occupancyRate)} · {plural(p.reservations, 'reserva', 'reservas')}
              </span>
            </button>
          ))}
        </ListaLinhas>
      )}
      {lista.temMais ? (
        <VerTodos rotulo={`Ver os ${lista.total} imóveis`} expandido={lista.expandido} aoClicar={lista.alternar} />
      ) : (
        <div className="h-1.5" />
      )}

      <FolhaDetalhes
        aberta={!!sel}
        aoMudar={(v) => !v && setSel(null)}
        titulo={sel ? sel.nickname || sel.propertyName : ''}
        subtitulo={sel?.nickname ? sel.propertyName : undefined}
      >
        {sel && (
          <Campos
            itens={[
              { rotulo: 'Receita', valor: formatarMoedaSemCentavos(sel.totalRevenue) },
              { rotulo: 'Comissão', valor: formatarMoedaSemCentavos(sel.commission), classe: 'text-success-700' },
              { rotulo: 'Taxa de comissão', valor: porcentagem(sel.commissionRate) },
              { rotulo: 'Reservas', valor: sel.reservations },
              { rotulo: 'Ocupação', valor: porcentagem(sel.occupancyRate) },
              { rotulo: 'Faxinas feitas / pendentes', valor: `${sel.completedCleanings} / ${sel.pendingCleanings}` },
            ]}
          />
        )}
      </FolhaDetalhes>
    </Bloco>
  );
};

/* ── Próximos eventos (recolhido) ─────────────────────── */
const ICONE_EVENTO = { 'check-in': LogIn, 'check-out': LogOut, cleaning: Sparkles } as const;
const TOM_EVENTO = { 'check-in': 'success', 'check-out': 'info', cleaning: 'brand' } as const;
const NOME_EVENTO = { 'check-in': 'Entrada', 'check-out': 'Saída', cleaning: 'Faxina' } as const;

const EtiquetaFaxina = ({ evento }: { evento: UpcomingEvent }) => {
  if (!evento.hasCleanerAssigned) return <Etiqueta tom="danger">Sem faxineira</Etiqueta>;
  if (evento.cleaningStatus === 'Realizada') return <Etiqueta tom="success">Faxina feita</Etiqueta>;
  return <Etiqueta tom="warning">Faxina pendente</Etiqueta>;
};

const ProximosEventos = ({ eventos }: { eventos: UpcomingEvent[] }) => {
  const lista = useListaCurta(eventos, 5, { chave: 'gestor.eventos.todos' });
  const entradas = eventos.filter((e) => e.type === 'check-in').length;
  const saidas = eventos.filter((e) => e.type === 'check-out').length;
  const prox = eventos[0];
  const resumo =
    eventos.length === 0
      ? 'Nenhum evento nos próximos 7 dias'
      : `${plural(entradas, 'entrada', 'entradas')} · ${plural(saidas, 'saída', 'saídas')} · próximo: ${rotuloDia(prox.date)}${prox.time ? ` ${prox.time.slice(0, 5)}` : ''}`;

  return (
    <BlocoRecolhivel chave="gestor.eventos.aberto" titulo="Próximos eventos" resumo={resumo}>
      {eventos.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum evento nos próximos 7 dias.</p>
      ) : (
        <>
          <ListaLinhas>
            {lista.visiveis.map((e) => (
              <LinhaLista
                key={`${e.id}-${e.type}`}
                icone={ICONE_EVENTO[e.type]}
                tomIcone={TOM_EVENTO[e.type]}
                titulo={e.guestName}
                subtitulo={`${NOME_EVENTO[e.type]} · ${rotuloDia(e.date)}${e.time ? ` ${e.time.slice(0, 5)}` : ''} · ${e.propertyNickname || e.propertyName}`}
                valor={e.type === 'check-in' ? formatarMoedaSemCentavos(e.commission) : undefined}
                legenda={e.type === 'check-in' ? 'comissão' : undefined}
                etiqueta={e.type !== 'check-in' ? <EtiquetaFaxina evento={e} /> : undefined}
              />
            ))}
          </ListaLinhas>
          {lista.temMais && <VerTodos total={lista.total} expandido={lista.expandido} aoClicar={lista.alternar} />}
        </>
      )}
    </BlocoRecolhivel>
  );
};

/* ── Atividades recentes (recolhido) ──────────────────── */
const ICONE_ATIVIDADE = {
  new_reservation: { icone: CalendarPlus, tom: 'success' },
  cleaning_completed: { icone: CheckCircle, tom: 'info' },
  payment_received: { icone: CreditCard, tom: 'success' },
  reservation_updated: { icone: RefreshCw, tom: 'warning' },
} as const;

const AtividadesRecentes = ({ atividades }: { atividades: RecentActivity[] }) => {
  const lista = useListaCurta(atividades, 5, { chave: 'gestor.atividades.todas' });
  const resumo = atividades.length === 0 ? 'Nenhuma atividade recente' : `Última: ${atividades[0].description}`;
  return (
    <BlocoRecolhivel chave="gestor.atividades.aberto" titulo="Atividades recentes" resumo={resumo}>
      {atividades.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma atividade recente.</p>
      ) : (
        <>
          <ListaLinhas>
            {lista.visiveis.map((a) => {
              const ic = ICONE_ATIVIDADE[a.type] ?? ICONE_ATIVIDADE.new_reservation;
              const quando = a.timestamp ? formatDistanceToNow(parseISO(a.timestamp), { addSuffix: true, locale: ptBR }) : '';
              return (
                <LinhaLista
                  key={a.id}
                  icone={ic.icone}
                  tomIcone={ic.tom}
                  titulo={a.description}
                  subtitulo={[a.propertyName, quando].filter(Boolean).join(' · ')}
                  valor={a.amount ? formatarMoedaSemCentavos(a.amount) : undefined}
                />
              );
            })}
          </ListaLinhas>
          {lista.temMais && <VerTodos rotulo={`Ver todas (${lista.total})`} expandido={lista.expandido} aoClicar={lista.alternar} />}
        </>
      )}
    </BlocoRecolhivel>
  );
};

const PainelGestorCelular = (p: PainelGestorCelularProps) => {
  if (p.loading && p.propertyPerformance.length === 0) return <EsqueletoLista linhas={4} />;
  const { kpis } = p;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <FaixaResumo
        rotulo="Comissão do período"
        valor={formatarMoedaSemCentavos(kpis.totalCommission)}
        apoio={[
          { rotulo: 'Por reserva', valor: formatarMoedaSemCentavos(kpis.avgCommission) },
          { rotulo: 'Reservas', valor: kpis.totalReservations },
          { rotulo: 'Ocupação', valor: porcentagem(kpis.occupancyRate) },
          { rotulo: 'Faxinas', valor: kpis.pendingCleanings, tom: kpis.pendingCleanings > 0 ? 'warning' : 'neutro' },
        ]}
        ajuda="Comissão das reservas confirmadas no período e nos imóveis do filtro. Faxinas: saídas do período com a faxina ainda pendente."
      />
      <AlertasFaxina alertas={p.cleaningRiskAlerts} />
      <CommissionChart data={p.monthlyCommissions} loading={p.loading} />
      <ResumoComissoes dados={p.commissionDetails} />
      <DesempenhoImoveis dados={p.propertyPerformance} receitaTotal={kpis.totalRevenue} />
      <PlatformBreakdownChart data={p.platformBreakdown} loading={p.loading} />
      <ProximosEventos eventos={p.upcomingEvents} />
      <AtividadesRecentes atividades={p.recentActivities} />
    </div>
  );
};

export default PainelGestorCelular;
