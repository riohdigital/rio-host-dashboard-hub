import React from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import LegendaGrafico from './LegendaGrafico';
import TooltipGrafico from './TooltipGrafico';
import { PROPS_EIXO_X, RAIO_BARRA_H } from './tema';

export interface FatiaGrafico {
  nome: string;
  valor: number;
  cor: string;
}

interface GraficoProporcaoProps {
  fatias: FatiaGrafico[];
  altura: number;
  /** Formata valores completos (tooltip, legenda) */
  formatar?: (v: number) => string;
  /** Formata o total no centro da rosca (curto) */
  formatarTotal?: (v: number) => string;
  rotuloTotal?: string;
}

/**
 * Parte de um todo: rosca com o total no centro até 4 fatias; com mais de 4,
 * barras horizontais ordenadas (rosca com muitas fatias não se lê).
 */
const GraficoProporcao = ({
  fatias,
  altura,
  formatar = (v) => v.toLocaleString('pt-BR'),
  formatarTotal,
  rotuloTotal = 'Total',
}: GraficoProporcaoProps) => {
  const dados = fatias.filter((f) => f.valor > 0);
  const total = dados.reduce((s, f) => s + f.valor, 0);
  const pct = (v: number) => (total > 0 ? `${Math.round((v / total) * 100)}%` : '0%');

  if (dados.length > 4) {
    const ordenadas = [...dados].sort((a, b) => b.valor - a.valor);
    return (
      <ResponsiveContainer width="100%" height={altura}>
        <BarChart data={ordenadas} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={6}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="nome" {...PROPS_EIXO_X} width={96} />
          <Tooltip
            cursor={{ fill: 'hsl(var(--chart-grid))' }}
            content={<TooltipGrafico formatar={(v) => `${formatar(v)} · ${pct(v)}`} />}
          />
          <Bar dataKey="valor" name="Valor" radius={RAIO_BARRA_H}>
            {ordenadas.map((f) => (
              <Cell key={f.nome} fill={f.cor} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  const alturaRosca = altura - 40;
  const externo = Math.max(60, Math.min(alturaRosca / 2 - 4, 110));
  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dados}
              dataKey="valor"
              nameKey="nome"
              cx="50%"
              cy="50%"
              innerRadius={externo * 0.68}
              outerRadius={externo}
              paddingAngle={dados.length > 1 ? 2 : 0}
              stroke="hsl(var(--background))"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {dados.map((f) => (
                <Cell key={f.nome} fill={f.cor} />
              ))}
            </Pie>
            <Tooltip content={<TooltipGrafico formatar={(v) => `${formatar(v)} · ${pct(v)}`} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-gray-500">{rotuloTotal}</span>
          <span className="font-mono text-sm font-semibold tabular-nums text-ink sm:text-base">
            {(formatarTotal ?? formatar)(total)}
          </span>
        </div>
      </div>
      <LegendaGrafico itens={dados.map((f) => ({ nome: f.nome, cor: f.cor, valor: pct(f.valor) }))} />
    </div>
  );
};

export default GraficoProporcao;
