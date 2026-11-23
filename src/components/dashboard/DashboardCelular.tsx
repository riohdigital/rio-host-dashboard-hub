/**
 * Dashboard no celular (abaixo de 1024px), desenho `mDash` do plano (T1):
 * FaixaResumo (lucro em destaque) → Hoje → Receita por canal → Crescimento →
 * Pagamentos → Últimas reservas → Detalhamento da receita (recolhido) →
 * Dicas da IA (recolhido). Usa só os dados e cálculos que o Dashboard já
 * carrega; o computador continua com o desenho de sempre (Dashboard.tsx).
 */
import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { LogIn, LogOut } from 'lucide-react';
import Bloco from '@/components/comum/Bloco';
import FaixaResumo, { type ValorApoio } from '@/components/comum/FaixaResumo';
import BlocoRecolhivel from '@/components/comum/BlocoRecolhivel';
import LinhaLista from '@/components/comum/LinhaLista';
import { ListaLinhas } from '@/components/comum/GrupoLista';
import VerTodos from '@/components/comum/VerTodos';
import MarcaIA from '@/components/comum/MarcaIA';
import { Etiqueta } from '@/components/comum/Etiquetas';
import { formatarMoedaSemCentavos } from '@/components/comum/formatos';
import BarrasCanais from '@/components/graficos/BarrasCanais';
import BarraProgresso from '@/components/graficos/BarraProgresso';
import AnnualGrowthChart from './AnnualGrowthChart';
import RevenueBreakdownCard from './RevenueBreakdownCard';
import { StrategicInsightsCard } from './StrategicInsightsCard';
import { explicacaoDoRecebimento } from './canais';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** "2026-11-27" → { d: 27, m: 'nov' } (sem fuso) */
const partes = (data: string) => {
  const [, m, d] = (data || '').slice(0, 10).split('-').map(Number);
  return { d, m: MESES[(m || 1) - 1] };
};

/** "27 nov → 1 dez" ou "21 → 26 nov" */
function periodoCurto(entrada: string, saida: string): string {
  if (!entrada || !saida) return '';
  const a = partes(entrada);
  const b = partes(saida);
  return a.m === b.m ? `${a.d} → ${b.d} ${b.m}` : `${a.d} ${a.m} → ${b.d} ${b.m}`;
}

const nomeImovel = (r: { properties?: { nickname?: string | null; name?: string | null } | null }) =>
  r.properties?.nickname || r.properties?.name || 'Imóvel';

const ehPago = (status?: string | null) => (status || '').toLowerCase() === 'pago';
const ehCancelada = (status?: string | null) => /cancel/i.test(status || '');

interface Fluxo {
  airbnbReceived: number;
  bookingReceived: number;
  diretoReceived: number;
  airbnbReceivable: number;
  bookingReceivable: number;
  diretoReceivable: number;
}

interface ReservaRecente {
  id?: string;
  reservation_code?: string;
  guest_name: string;
  property_name: string;
  check_in_date: string;
  check_out_date: string;
  platform: string;
  total_revenue: number;
  payment_status?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- as reservas chegam do Supabase sem tipo (select('*')) */
interface DashboardCelularProps {
  pode: (permissao: string) => boolean;
  previsao: boolean;
  /** Período do filtro global (yyyy-MM-dd) */
  inicio: string;
  fim: string;
  receita: number;
  comissao: number;
  liquido: number;
  despesas: number;
  ocupacaoPrevista: number;
  /** Valores do Detalhamento da receita (os mesmos do computador) */
  detalhamento: { bruto: number; base: number; comissao: number; liquido: number; despesas: number };
  reservasDoPeriodo: any[];
  totalImoveis: number;
  fluxo: Fluxo;
  bookingFuturo: { total: number; mes: string } | null;
  pagas: number;
  pendentes: number;
  recentes: ReservaRecente[];
  crescimento: { monthlyData: { month: string; current: number; previous: number }[]; yearlyData: { year: string; revenue: number }[]; loading: boolean };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Receita bruta dos últimos 6 meses (até o mês atual), para a mini-linha da faixa */
function ultimos6Meses(mensal: { current: number; previous: number }[]): number[] {
  if (mensal.length !== 12) return [];
  const atual = new Date().getMonth();
  const valores: number[] = [];
  for (let i = 5; i >= 0; i--) {
    const m = atual - i;
    valores.push(m >= 0 ? mensal[m].current : mensal[m + 12].previous);
  }
  return valores;
}

const DashboardCelular = (p: DashboardCelularProps) => {
  const hojeStr = format(new Date(), 'yyyy-MM-dd');
  const hojeNoPeriodo = hojeStr >= p.inicio && hojeStr <= p.fim;

  /* ── Faixa de resumo ───────────────────────────────── */
  const lucro = p.liquido - p.despesas;
  const candidatos: (ValorApoio & { chave: string })[] = [];
  if (p.pode('dashboard_profit')) candidatos.push({ chave: 'lucro', rotulo: p.previsao ? 'Lucro líquido previsto' : 'Lucro líquido do período', valor: formatarMoedaSemCentavos(lucro), tom: lucro < 0 ? 'danger' : undefined });
  if (p.pode('dashboard_revenue')) candidatos.push({ chave: 'receita', rotulo: p.previsao ? 'Receita prevista' : 'Receita', valor: formatarMoedaSemCentavos(p.receita) });
  if (p.pode('dashboard_profit')) candidatos.push({ chave: 'comissao', rotulo: 'Comissão', valor: formatarMoedaSemCentavos(p.comissao) });
  if (p.pode('dashboard_expenses')) candidatos.push({ chave: 'despesas', rotulo: 'Despesas', valor: formatarMoedaSemCentavos(p.despesas), tom: 'danger' });
  if (p.previsao && p.pode('dashboard_occupancy')) candidatos.push({ chave: 'ocupacao', rotulo: 'Ocupação', valor: `${p.ocupacaoPrevista.toFixed(0)}%` });
  const [principal, ...apoio] = candidatos;
  const tendencia = ultimos6Meses(p.crescimento.monthlyData);

  /* ── Hoje: entradas, saídas e ocupação, das reservas que o Dashboard já busca ── */
  const hoje = useMemo(() => {
    const validas = p.reservasDoPeriodo.filter((r) => !ehCancelada(r.reservation_status));
    const entradas = validas.filter((r) => r.check_in_date === hojeStr);
    const saidas = validas.filter((r) => r.check_out_date === hojeStr);
    const ocupados = new Set(validas.filter((r) => r.check_in_date <= hojeStr && r.check_out_date > hojeStr).map((r) => r.property_id));
    return { entradas, saidas, ocupados: ocupados.size };
  }, [p.reservasDoPeriodo, hojeStr]);

  const agora = new Date();
  const rotuloHoje = `${DIAS[agora.getDay()]}, ${agora.getDate()} ${MESES[agora.getMonth()]}`;
  const linkReserva = (codigo?: string | null) => (codigo ? `/reservas?code=${encodeURIComponent(codigo)}` : undefined);
  const hora = (h?: string | null) => (h ? ` ${h.slice(0, 5)}` : '');

  /* ── Receita por canal ─────────────────────────────── */
  const canais = [
    { canal: 'Airbnb', recebido: p.fluxo.airbnbReceived, aReceber: p.fluxo.airbnbReceivable },
    { canal: 'Booking.com', recebido: p.fluxo.bookingReceived, aReceber: p.fluxo.bookingReceivable },
    { canal: 'Direto', recebido: p.fluxo.diretoReceived, aReceber: p.fluxo.diretoReceivable },
  ];
  const totalCanais = canais.reduce((s, c) => s + c.recebido + c.aReceber, 0);
  const aReceber = canais.reduce((s, c) => s + c.aReceber, 0);

  /* ── Pagamentos ────────────────────────────────────── */
  const totalReservas = p.pagas + p.pendentes;

  return (
    <div className="space-y-3">
      {principal && (
        <FaixaResumo
          rotulo={principal.rotulo}
          valor={principal.valor}
          tomValor={principal.tom}
          apoio={apoio.slice(0, 3)}
          tendencia={tendencia}
          ajuda={
            principal.chave === 'lucro' ? (
              <>
                Líquido do proprietário (receita menos comissão e taxa de limpeza) menos as despesas do período. A conta
                completa está em Detalhamento da receita. A mini-linha mostra a receita dos últimos 6 meses.
              </>
            ) : undefined
          }
        />
      )}

      <Bloco titulo="Hoje" extra={rotuloHoje} compacto>
        {!hojeNoPeriodo ? (
          <p className="pb-3 pt-1 text-sm text-gray-500">Hoje fica fora do período escolhido no filtro.</p>
        ) : hoje.entradas.length + hoje.saidas.length === 0 ? (
          <p className="pb-3 pt-1 text-sm text-gray-500">Nenhuma entrada ou saída hoje.</p>
        ) : (
          <ListaLinhas>
            {hoje.entradas.map((r) => (
              <LinhaLista
                key={`e-${r.id}`}
                icone={LogIn}
                tomIcone="success"
                titulo={r.guest_name || 'Hóspede'}
                subtitulo={`Entrada${hora(r.checkin_time)} · ${nomeImovel(r)}`}
                etiqueta={ehPago(r.payment_status) ? <Etiqueta tom="success">Pago</Etiqueta> : <Etiqueta tom="warning">A receber</Etiqueta>}
                para={linkReserva(r.reservation_code)}
              />
            ))}
            {hoje.saidas.map((r) => (
              <LinhaLista
                key={`s-${r.id}`}
                icone={LogOut}
                tomIcone="warning"
                titulo={r.guest_name || 'Hóspede'}
                subtitulo={`Saída${hora(r.checkout_time)} · ${nomeImovel(r)}`}
                etiqueta={!r.cleaner_user_id && r.cleaning_status !== 'Realizada' ? <Etiqueta tom="danger">Sem faxineira</Etiqueta> : undefined}
                para={linkReserva(r.reservation_code)}
              />
            ))}
          </ListaLinhas>
        )}
        <VerTodos
          para="/calendario"
          rotulo={hojeNoPeriodo && p.totalImoveis > 0 ? `${hoje.ocupados} de ${p.totalImoveis} imóveis ocupados · ver calendário` : 'Ver calendário'}
        />
      </Bloco>

      <Bloco
        titulo="Receita por canal"
        extra={totalCanais > 0 ? <span className="font-mono text-[13px] font-semibold tabular-nums text-gray-900">{formatarMoedaSemCentavos(totalCanais)}</span> : undefined}
        ajuda="Receita líquida das reservas com check-in no período. Parte cheia: já recebido; parte clara: a receber. Toque num canal para ver quando ele paga."
      >
        {totalCanais > 0 ? (
          <BarrasCanais
            itens={canais}
            detalhe={(c) => (
              <>
                {explicacaoDoRecebimento(c.canal)}
                {c.canal === 'Booking.com' && p.bookingFuturo && p.bookingFuturo.total > 0 && (
                  <>
                    {' '}
                    Previsão de recebimento em {p.bookingFuturo.mes}:{' '}
                    <span className="font-mono font-semibold tabular-nums">{formatarMoedaSemCentavos(p.bookingFuturo.total)}</span>.
                  </>
                )}
              </>
            )}
          />
        ) : (
          <p className="text-sm text-gray-500">Nenhuma reserva com check-in no período.</p>
        )}
      </Bloco>

      <AnnualGrowthChart monthlyData={p.crescimento.monthlyData} yearlyData={p.crescimento.yearlyData} loading={p.crescimento.loading} />

      <Bloco
        titulo="Pagamentos"
        extra={totalReservas > 0 ? <span className="font-mono tabular-nums">{`${p.pagas} de ${totalReservas} pagas`}</span> : undefined}
        ajuda="Reservas com check-in no período. A receber é o valor líquido das que ainda não foram pagas."
      >
        {totalReservas > 0 ? (
          <BarraProgresso
            valor={p.pagas}
            total={totalReservas}
            sufixo="pagas"
            semCabecalho
            detalhe={
              <>
                {p.pendentes} {p.pendentes === 1 ? 'pendente' : 'pendentes'} ·{' '}
                <span className="font-mono tabular-nums">{formatarMoedaSemCentavos(aReceber)}</span> a receber
              </>
            }
          />
        ) : (
          <p className="text-sm text-gray-500">Nenhuma reserva com check-in no período.</p>
        )}
      </Bloco>

      <Bloco titulo="Últimas reservas" compacto>
        {p.recentes.length === 0 ? (
          <p className="pb-3 pt-1 text-sm text-gray-500">Nenhuma reserva ainda.</p>
        ) : (
          <ListaLinhas>
            {p.recentes.slice(0, 3).map((r, i) => (
              <LinhaLista
                key={r.id || i}
                canal={r.platform}
                titulo={r.guest_name || 'Hóspede'}
                subtitulo={`${r.property_name} · ${periodoCurto(r.check_in_date, r.check_out_date)}`}
                valor={formatarMoedaSemCentavos(r.total_revenue)}
                legenda={ehPago(r.payment_status) ? 'Pago' : 'A receber'}
                tomLegenda={ehPago(r.payment_status) ? 'success' : 'warning'}
                para={linkReserva(r.reservation_code)}
              />
            ))}
          </ListaLinhas>
        )}
        <VerTodos para="/reservas" rotulo="Ver todas as reservas" />
      </Bloco>

      <BlocoRecolhivel titulo="Detalhamento da receita" resumo="Bruto, comissão, líquido e despesas">
        <RevenueBreakdownCard
          semCartao
          grossRevenue={p.detalhamento.bruto}
          baseRevenue={p.detalhamento.base}
          commission={p.detalhamento.comissao}
          netRevenue={p.detalhamento.liquido}
          expenses={p.detalhamento.despesas}
        />
      </BlocoRecolhivel>

      {p.pode('dashboard_revenue') && (
        <BlocoRecolhivel titulo="Dicas da IA" etiqueta={<MarcaIA />} resumo="Resumo, diagnóstico e plano de ação por imóvel">
          <StrategicInsightsCard semCartao />
        </BlocoRecolhivel>
      )}
    </div>
  );
};

export default DashboardCelular;
