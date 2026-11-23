import React from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface BlocoFormularioProps {
  titulo: string;
  icone?: LucideIcon;
  /** Resumo mostrado ao lado do título quando o bloco está fechado */
  resumo?: React.ReactNode;
  aberto: boolean;
  aoAlternar: (aberto: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Bloco recolhível de formulário longo. O conteúdo continua montado quando
 * fechado (só fica oculto), para não perder campos nem validações.
 */
const BlocoFormulario = ({ titulo, icone: Icone, resumo, aberto, aoAlternar, children, className }: BlocoFormularioProps) => (
  <Collapsible open={aberto} onOpenChange={aoAlternar} className={cn('rounded-2xl border bg-card', className)}>
    <CollapsibleTrigger className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-left">
      {Icone && (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand">
          <Icone className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
      <span className="font-display text-base font-bold text-ink">{titulo}</span>
      {!aberto && resumo && <span className="min-w-0 flex-1 truncate text-right text-sm text-gray-500">{resumo}</span>}
      <ChevronDown
        className={cn('ml-auto h-5 w-5 shrink-0 text-gray-400 transition-transform', aberto && 'rotate-180')}
        aria-hidden="true"
      />
    </CollapsibleTrigger>
    <CollapsibleContent forceMount className="space-y-4 px-4 pb-4 pt-1 data-[state=closed]:hidden">
      {children}
    </CollapsibleContent>
  </Collapsible>
);

export default BlocoFormulario;
