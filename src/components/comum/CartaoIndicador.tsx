import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tom } from './cores';

const COR_VALOR: Record<Tom, string> = {
  brand: 'text-brand-700',
  success: 'text-success-700',
  warning: 'text-warning-700',
  danger: 'text-danger-600',
  info: 'text-info-700',
  neutro: 'text-ink',
};

const COR_ICONE: Record<Tom, string> = {
  brand: 'bg-brand-50 text-brand',
  success: 'bg-success-50 text-success-600',
  warning: 'bg-warning-50 text-warning-600',
  danger: 'bg-danger-50 text-danger-600',
  info: 'bg-info-50 text-info-600',
  neutro: 'bg-gray-100 text-gray-600',
};

interface CartaoIndicadorProps {
  titulo: React.ReactNode;
  valor: React.ReactNode;
  icone?: LucideIcon;
  detalhe?: React.ReactNode;
  tom?: Tom;
  className?: string;
}

/** Indicador (número em destaque, fonte mono). Use dentro de GradeIndicadores. */
export const CartaoIndicador = ({ titulo, valor, icone: Icone, detalhe, tom = 'neutro', className }: CartaoIndicadorProps) => (
  <div className={cn('flex min-w-0 flex-col gap-1.5 rounded-2xl border bg-card p-3.5 shadow-sm sm:p-5', className)}>
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs font-medium leading-tight text-gray-600 sm:text-sm">{titulo}</span>
      {Icone && (
        <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-xl', COR_ICONE[tom])}>
          <Icone className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
    </div>
    <span className={cn('break-words font-mono text-lg font-semibold tabular-nums leading-tight sm:text-2xl', COR_VALOR[tom])}>
      {valor}
    </span>
    {detalhe && <span className="text-xs text-gray-500">{detalhe}</span>}
  </div>
);

/** Grade de indicadores: 2 colunas no celular, até 4 no desktop */
export const GradeIndicadores = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4', className)}>{children}</div>
);
