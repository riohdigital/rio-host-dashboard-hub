import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import { MonthlyCommission } from '@/types/painel-gestor';
import ChartCard from '@/components/graficos/ChartCard';
import LegendaGrafico from '@/components/graficos/LegendaGrafico';
import TooltipGrafico from '@/components/graficos/TooltipGrafico';
import { eixoMoeda, moedaCompleta, PROPS_EIXO_X, PROPS_EIXO_Y, PROPS_GRADE, RAIO_BARRA } from '@/components/graficos/tema';
import Bloco from '@/components/comum/Bloco';
import { formatarMoedaSemCentavos } from '@/components/comum/formatos';
import BarrasSimples from '@/components/graficos/BarrasSimples';
import { Skeleton } from '@/components/ui/skeleton';
import { useEhCompacto } from '@/hooks/useMidia';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';

interface CommissionChartProps {
  data: MonthlyCommission[];
  loading?: boolean;
}

const COR_COMISSAO = 'hsl(var(--chart-1))';
const COR_RESERVAS = 'hsl(var(--chart-2))';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Mês depois do atual (desenhado em tom claro) */
const ehFuturo = (d: MonthlyCommission) => {
  const agora = new Date();
  const m = MESES.indexOf(d.month.slice(0, 3).toLowerCase());
  return d.year > agora.getFullYear() || (d.year === agora.getFullYear() && m > agora.getMonth());
};

/**
 * Celular: só as barras de comissão, com o valor em cima (sem a linha e sem o
 * segundo eixo); tocar num mês mostra a quantidade de reservas.
 */
const ComissoesCelular = ({ data, loading }: CommissionChartProps) => {
  const [sel, setSel] = useEstadoPersistente<number | null>('gestor.comissoesMes.selecionado', null, {
    aceita: (v) => v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 0),
  });
  const itens = data.map((d) => ({ ...d, rotulo: d.month.slice(0, 3).toLowerCase(), valor: d.commission, futuro: ehFuturo(d) }));
  const escolhido = sel !== null ? itens[sel] : null;
  return (
    <Bloco titulo="Comissões por mês" extra="em R$">
      {loading ? (
        <Skeleton className="h-[150px] w-full rounded-xl" />
      ) : !data.some((d) => d.commission > 0 || d.reservations > 0) ? (
        <p className="py-6 text-center text-sm text-gray-500">Sem dados no período selecionado.</p>
      ) : (
        <>
          <p className="h-5 text-right font-mono text-[11px] font-semibold tabular-nums text-gray-900" aria-live="polite">
            {escolhido
              ? `${escolhido.rotulo} ${escolhido.year} · ${formatarMoedaSemCentavos(escolhido.commission)} · ${escolhido.reservations} ${escolhido.reservations === 1 ? 'reserva' : 'reservas'}`
              : ''}
          </p>
          <BarrasSimples itens={itens} rotulo="Comissões por mês, em reais" aoTocar={(_, i) => setSel((s) => (s === i ? null : i))} />
          <p className="mt-1 text-xs text-gray-500">
            {itens.some((i) => i.futuro) ? 'Meses futuros em tom claro. ' : ''}Toque num mês para ver as reservas.
          </p>
        </>
      )}
    </Bloco>
  );
};

/** Comissão (barras, eixo esquerdo em R$) e reservas (linha, eixo direito em quantidade) */
export const CommissionChart = (props: CommissionChartProps) => {
  const compacto = useEhCompacto();
  if (compacto) return <ComissoesCelular {...props} />;
  return <CommissionChartComputador {...props} />;
};

const CommissionChartComputador = ({ data, loading }: CommissionChartProps) => (
  <ChartCard
    titulo="Evolução de Comissões"
    subtitulo="Últimos 12 meses · barras: comissão (R$, eixo esquerdo) · linha: reservas (eixo direito)"
    carregando={loading}
    vazio={!data.some((d) => d.commission > 0 || d.reservations > 0)}
    legenda={
      <LegendaGrafico
        itens={[
          { nome: 'Comissão (R$)', cor: COR_COMISSAO },
          { nome: 'Reservas (qtd.)', cor: COR_RESERVAS, linha: true },
        ]}
      />
    }
  >
    {(altura) => (
      <ResponsiveContainer width="100%" height={altura}>
        <ComposedChart data={data} margin={{ top: 20, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid {...PROPS_GRADE} />
          <XAxis dataKey="month" {...PROPS_EIXO_X} />
          <YAxis
            yAxisId="left"
            {...PROPS_EIXO_Y}
            tickFormatter={eixoMoeda}
            label={{ value: 'R$', position: 'top', offset: 8, fontSize: 11, fill: 'hsl(var(--chart-axis))' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            {...PROPS_EIXO_Y}
            width={36}
            allowDecimals={false}
            label={{ value: 'Qtd.', position: 'top', offset: 8, fontSize: 11, fill: 'hsl(var(--chart-axis))' }}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--chart-grid))' }}
            content={
              <TooltipGrafico
                formatar={(v, item) => (item.dataKey === 'commission' ? moedaCompleta(v) : `${v}`)}
              />
            }
          />
          <Bar yAxisId="left" dataKey="commission" fill={COR_COMISSAO} radius={RAIO_BARRA} maxBarSize={36} name="Comissão" />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="reservations"
            stroke={COR_RESERVAS}
            strokeWidth={2}
            dot={{ r: 3, fill: COR_RESERVAS, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
            name="Reservas"
          />
        </ComposedChart>
      </ResponsiveContainer>
    )}
  </ChartCard>
);
