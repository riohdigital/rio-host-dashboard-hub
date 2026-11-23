import React from 'react';
import { cn } from '@/lib/utils';

export interface ItemLegenda {
  nome: string;
  cor: string;
  /** Valor ou % ao lado do nome (opcional) */
  valor?: React.ReactNode;
  /** Linha tracejada/serie secundária */
  linha?: boolean;
}

/** Legenda embaixo do gráfico; a cor marca, o texto fica na cor de texto */
const LegendaGrafico = ({ itens, className }: { itens: ItemLegenda[]; className?: string }) => (
  <ul className={cn('flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-3 text-xs text-gray-600', className)}>
    {itens.map((i) => (
      <li key={i.nome} className="flex items-center gap-1.5">
        <span
          className={cn('shrink-0', i.linha ? 'h-0.5 w-3.5 rounded-full' : 'h-2.5 w-2.5 rounded-full')}
          style={{ background: i.cor }}
          aria-hidden="true"
        />
        <span>{i.nome}</span>
        {i.valor !== undefined && <span className="font-mono tabular-nums text-ink">{i.valor}</span>}
      </li>
    ))}
  </ul>
);

export default LegendaGrafico;
