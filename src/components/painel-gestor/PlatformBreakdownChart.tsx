import { PlatformBreakdown } from '@/types/painel-gestor';
import ChartCard from '@/components/graficos/ChartCard';
import GraficoProporcao from '@/components/graficos/GraficoProporcao';
import { corDoCanalGrafico, eixoMoeda, moedaCompleta } from '@/components/graficos/tema';

interface PlatformBreakdownChartProps {
  data: PlatformBreakdown[];
  loading?: boolean;
}

/** Comissão por canal (rosca com total no centro) + reservas e receita de cada canal */
export const PlatformBreakdownChart = ({ data, loading }: PlatformBreakdownChartProps) => (
  <ChartCard
    titulo="Distribuição por Plataforma"
    subtitulo="Comissão por canal"
    carregando={loading}
    vazio={data.length === 0}
    mensagemVazio="Nenhum dado para exibir."
    legenda={
      data.length > 0 ? (
        <ul className="mt-3 divide-y border-t text-sm">
          {data.map((d) => (
            <li key={d.platform} className="flex items-center justify-between gap-3 py-2">
              <span className="flex items-center gap-2 text-gray-700">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: corDoCanalGrafico(d.platform) }} aria-hidden="true" />
                {d.platform}
              </span>
              <span className="text-right font-mono text-xs tabular-nums text-gray-600">
                {d.reservations} res. · {moedaCompleta(d.revenue)}
              </span>
            </li>
          ))}
        </ul>
      ) : undefined
    }
    alturaDesktop={260}
  >
    {(altura) => (
      <GraficoProporcao
        fatias={data.map((d) => ({ nome: d.platform, valor: d.commission, cor: corDoCanalGrafico(d.platform) }))}
        altura={altura}
        formatar={moedaCompleta}
        formatarTotal={eixoMoeda}
        rotuloTotal="Comissão"
      />
    )}
  </ChartCard>
);
