import React from 'react';

interface ItemTooltip {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

interface TooltipGraficoProps {
  active?: boolean;
  payload?: ItemTooltip[];
  label?: string | number;
  /** Formata cada valor (padrão: número pt-BR) */
  formatar?: (valor: number, item: ItemTooltip) => string;
  /** Título no lugar do rótulo do eixo */
  titulo?: (label: string | number | undefined, payload: ItemTooltip[]) => React.ReactNode;
}

/** Tooltip padrão: título + uma linha por série, valor completo em mono */
const TooltipGrafico = ({ active, payload, label, formatar, titulo }: TooltipGraficoProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-xl border bg-popover px-3 py-2 text-sm shadow-lg">
      <p className="mb-1.5 font-semibold text-ink">{titulo ? titulo(label, payload) : label}</p>
      <ul className="space-y-1">
        {payload.map((item, i) => (
          <li key={`${item.dataKey ?? item.name}-${i}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-gray-600">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: item.color || (item.payload?.cor as string) || (item.payload?.fill as string) }}
                aria-hidden="true"
              />
              {item.name}
            </span>
            <span className="font-mono font-medium tabular-nums text-ink">
              {formatar ? formatar(Number(item.value) || 0, item) : Number(item.value || 0).toLocaleString('pt-BR')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TooltipGrafico;
