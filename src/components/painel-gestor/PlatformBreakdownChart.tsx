import { PlatformBreakdown } from '@/types/painel-gestor';
import ChartCard from '@/components/graficos/ChartCard';
import GraficoProporcao from '@/components/graficos/GraficoProporcao';
import { corDoCanalGrafico, eixoMoeda, moedaCompleta } from '@/components/graficos/tema';
import Bloco from '@/components/comum/Bloco';
import { formatarMoedaSemCentavos } from '@/components/comum/formatos';
import BarrasCanais from '@/components/graficos/BarrasCanais';
import { Skeleton } from '@/components/ui/skeleton';
import { useEhCompacto } from '@/hooks/useMidia';

interface PlatformBreakdownChartProps {
  data: PlatformBreakdown[];
  loading?: boolean;
}

/** Celular: o mesmo bloco de canais do Dashboard, com a comissão de cada canal */
const CanaisCelular = ({ data, loading }: PlatformBreakdownChartProps) => {
  const total = data.reduce((s, d) => s + d.commission, 0);
  return (
    <Bloco
      titulo="Distribuição por plataforma"
      extra={total > 0 ? <span className="font-mono text-[13px] font-semibold tabular-nums text-gray-900">{formatarMoedaSemCentavos(total)}</span> : undefined}
      ajuda="Comissão de cada canal no período, com a quantidade de reservas e a receita."
    >
      {loading ? (
        <Skeleton className="h-28 w-full rounded-xl" />
      ) : total > 0 ? (
        <BarrasCanais
          itens={data.map((d) => ({ canal: d.platform, recebido: d.commission, aReceber: 0 }))}
          legenda={false}
          linha={(c) => {
            const d = data.find((x) => x.platform === c.canal);
            return d ? `${d.reservations} ${d.reservations === 1 ? 'reserva' : 'reservas'} · receita ${formatarMoedaSemCentavos(d.revenue)}` : null;
          }}
        />
      ) : (
        <p className="text-sm text-gray-500">Nenhum dado para exibir.</p>
      )}
    </Bloco>
  );
};

/** Comissão por canal (rosca com total no centro) + reservas e receita de cada canal */
export const PlatformBreakdownChart = (props: PlatformBreakdownChartProps) => {
  const compacto = useEhCompacto();
  if (compacto) return <CanaisCelular {...props} />;
  return <DistribuicaoComputador {...props} />;
};

const DistribuicaoComputador = ({ data, loading }: PlatformBreakdownChartProps) => (
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
