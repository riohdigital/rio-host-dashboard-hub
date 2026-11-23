import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import ChartCard from '@/components/graficos/ChartCard';
import LegendaGrafico from '@/components/graficos/LegendaGrafico';
import TooltipGrafico from '@/components/graficos/TooltipGrafico';
import { eixoMoeda, moedaCompleta, PROPS_EIXO_X, PROPS_EIXO_Y, PROPS_GRADE, RAIO_BARRA } from '@/components/graficos/tema';
import { TrendingUp, TrendingDown } from 'lucide-react';
import Bloco from '@/components/comum/Bloco';
import AbasRolaveis from '@/components/comum/AbasRolaveis';
import { formatarMoedaCurta } from '@/components/comum/formatos';
import LinhaSemEixo from '@/components/graficos/LinhaSemEixo';
import BarrasSimples from '@/components/graficos/BarrasSimples';
import { Skeleton } from '@/components/ui/skeleton';
import { useEhCompacto } from '@/hooks/useMidia';

interface MonthlyData {
  month: string;
  current: number;
  previous: number;
}

interface YearlyData {
  year: string;
  revenue: number;
}

interface AnnualGrowthChartProps {
  monthlyData: MonthlyData[];
  yearlyData: YearlyData[];
  loading: boolean;
}

const AnnualGrowthChart = ({ monthlyData, yearlyData, loading }: AnnualGrowthChartProps) => {
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const compacto = useEhCompacto();

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  // Lógica de cálculo de crescimento anual
  const calculateTotalGrowth = () => {
    if (yearlyData.length < 2) {
      return { value: 0, text: 'N/A', type: 'nodata' };
    }

    const currentYearRevenue = yearlyData[yearlyData.length - 1]?.revenue || 0;
    const previousYearRevenue = yearlyData[yearlyData.length - 2]?.revenue || 0;

    if (previousYearRevenue > 0) {
      const growth = ((currentYearRevenue - previousYearRevenue) / previousYearRevenue) * 100;
      return { value: growth, text: `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`, type: 'percentage' };
    }
    
    // ALTERAÇÃO 1: Se a receita anterior for R$ 0, o texto principal agora será "100%".
    if (previousYearRevenue === 0 && currentYearRevenue > 0) {
      return { value: 100, text: '100%', type: 'absolute_growth' };
    }

    return { value: 0, text: '+0.0%', type: 'percentage' };
  };

  const totalGrowthInfo = calculateTotalGrowth();

  // Lógica de cálculo de crescimento médio Mês a Mês (MoM)
  const calculateAverageMoMGrowth = (data: MonthlyData[]) => {
    const monthlyGrowths: number[] = [];
    const relevantMonths = data.filter(m => m.current > 0).slice(0, new Date().getMonth() + 1);

    for (let i = 1; i < relevantMonths.length; i++) {
      const currentMonthRevenue = relevantMonths[i].current;
      const previousMonthRevenue = relevantMonths[i - 1].current;
      if (previousMonthRevenue > 0) {
        monthlyGrowths.push(((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100);
      }
    }

    if (monthlyGrowths.length === 0) return 0;
    return monthlyGrowths.reduce((sum, g) => sum + g, 0) / monthlyGrowths.length;
  };

  const avgMonthlyGrowth = calculateAverageMoMGrowth(monthlyData);

  // Lógica de exibição do subtítulo contextual
  const renderSubtitle = () => {
    const avgMoMText = `Média MoM: ${avgMonthlyGrowth >= 0 ? '+' : ''}${avgMonthlyGrowth.toFixed(1)}%`;
    
    if (totalGrowthInfo.type === 'percentage') {
      return `Crescimento de ${currentYear} vs ${previousYear} • ${avgMoMText}`;
    }
    // ALTERAÇÃO 2: Novo texto para o subtítulo quando o crescimento é a partir do zero.
    if (totalGrowthInfo.type === 'absolute_growth') {
      return `Comparativo ${previousYear} a ${currentYear} (base anterior R$ 0) • ${avgMoMText}`;
    }
    return 'Aguardando dados para comparação.';
  };

  const seletor = (
    <Select value={viewMode} onValueChange={(value) => setViewMode(value as 'monthly' | 'yearly')}>
      <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="monthly">Mensal</SelectItem>
        <SelectItem value="yearly">Anual</SelectItem>
      </SelectContent>
    </Select>
  );

  const semDados =
    viewMode === 'monthly'
      ? !monthlyData.some((m) => m.current > 0 || m.previous > 0)
      : !yearlyData.some((y) => y.revenue > 0);

  // Celular (G2): linha sem eixo, Mensal/Anual em dois botões
  if (compacto) {
    // Meses do ano até o atual (ou até o último com receita, se houver reservas à frente)
    const mesAtual = new Date().getMonth();
    const ultimoComValor = monthlyData.reduce((u, m, i) => (m.current > 0 ? i : u), -1);
    const pontos = monthlyData
      .slice(0, Math.max(mesAtual, ultimoComValor) + 1)
      .map((m) => ({ rotulo: m.month.toLowerCase(), valor: m.current }));
    const crescimento =
      totalGrowthInfo.type === 'nodata' ? null : `${totalGrowthInfo.text.replace('.', ',')} sobre ${previousYear}`;

    return (
      <Bloco
        titulo="Crescimento"
        extra={
          <AbasRolaveis
            valor={viewMode}
            aoMudar={(v) => setViewMode(v as 'monthly' | 'yearly')}
            rotulo="Ver crescimento"
            className="max-lg:w-[150px]"
            itens={[
              { valor: 'monthly', rotulo: 'Mensal' },
              { valor: 'yearly', rotulo: 'Anual' },
            ]}
          />
        }
      >
        <p className="text-xs text-gray-500">
          {viewMode === 'monthly' ? `Receita por mês em ${currentYear}` : 'Receita por ano'}
          {crescimento && (
            <>
              {' · '}
              <span className={totalGrowthInfo.value >= 0 ? 'text-success-700' : 'text-danger-700'}>{crescimento}</span>
            </>
          )}
        </p>
        {loading ? (
          <Skeleton className="mt-2 h-[150px] w-full rounded-xl" />
        ) : semDados ? (
          <p className="py-6 text-center text-sm text-gray-500">Sem receita para comparar ainda.</p>
        ) : viewMode === 'monthly' ? (
          <LinhaSemEixo pontos={pontos} rotulo={`Receita por mês em ${currentYear}`} className="mt-1" />
        ) : (
          <BarrasSimples
            itens={yearlyData.map((y) => ({ rotulo: y.year, valor: y.revenue }))}
            rotulo="Receita por ano"
            formatar={formatarMoedaCurta}
            className="mt-2"
          />
        )}
      </Bloco>
    );
  }

  return (
    <ChartCard
      titulo={<span className="text-gradient-primary">Crescimento Anual</span>}
      icone={totalGrowthInfo.value >= 0 ? <TrendingUp className="h-5 w-5 text-success-500" /> : <TrendingDown className="h-5 w-5 text-danger-500" />}
      acoes={seletor}
      carregando={loading}
      vazio={semDados}
      destaque={
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={`font-mono text-2xl font-semibold tabular-nums ${totalGrowthInfo.value >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
            {totalGrowthInfo.text}
          </span>
          <span className="text-xs text-gray-500 sm:text-sm">{renderSubtitle()}</span>
        </div>
      }
      legenda={
        viewMode === 'monthly' ? (
          <LegendaGrafico
            itens={[
              { nome: `${currentYear}`, cor: 'hsl(var(--chart-1))' },
              { nome: `${previousYear}`, cor: 'hsl(var(--gray-400))', linha: true },
            ]}
          />
        ) : undefined
      }
    >
      {(altura) =>
        viewMode === 'monthly' ? (
          <ResponsiveContainer width="100%" height={altura}>
            <ComposedChart data={monthlyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="degradeCrescimento" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...PROPS_GRADE} />
              <XAxis dataKey="month" {...PROPS_EIXO_X} />
              <YAxis {...PROPS_EIXO_Y} tickFormatter={eixoMoeda} />
              <Tooltip
                cursor={{ stroke: 'hsl(var(--gray-300))' }}
                content={<TooltipGrafico formatar={moedaCompleta} titulo={(label) => `Mês: ${label}`} />}
              />
              <Line type="monotone" dataKey="previous" stroke="hsl(var(--gray-400))" strokeWidth={2} strokeDasharray="4 4" dot={false} name={`${previousYear}`} />
              <Area type="monotone" dataKey="current" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#degradeCrescimento)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--background))' }} name={`${currentYear}`} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={altura}>
            <BarChart data={yearlyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...PROPS_GRADE} />
              <XAxis dataKey="year" {...PROPS_EIXO_X} />
              <YAxis {...PROPS_EIXO_Y} tickFormatter={eixoMoeda} />
              <Tooltip cursor={{ fill: 'hsl(var(--chart-grid))' }} content={<TooltipGrafico formatar={moedaCompleta} />} />
              <Bar dataKey="revenue" name="Receita" fill="hsl(var(--chart-1))" radius={RAIO_BARRA} maxBarSize={56} />
            </BarChart>
          </ResponsiveContainer>
        )
      }
    </ChartCard>
  );
};

export default AnnualGrowthChart;
