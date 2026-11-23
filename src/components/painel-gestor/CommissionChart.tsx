import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import { MonthlyCommission } from '@/types/painel-gestor';
import ChartCard from '@/components/graficos/ChartCard';
import LegendaGrafico from '@/components/graficos/LegendaGrafico';
import TooltipGrafico from '@/components/graficos/TooltipGrafico';
import { eixoMoeda, moedaCompleta, PROPS_EIXO_X, PROPS_EIXO_Y, PROPS_GRADE, RAIO_BARRA } from '@/components/graficos/tema';

interface CommissionChartProps {
  data: MonthlyCommission[];
  loading?: boolean;
}

const COR_COMISSAO = 'hsl(var(--chart-1))';
const COR_RESERVAS = 'hsl(var(--chart-2))';

/** Comissão (barras, eixo esquerdo em R$) e reservas (linha, eixo direito em quantidade) */
export const CommissionChart = ({ data, loading }: CommissionChartProps) => (
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
