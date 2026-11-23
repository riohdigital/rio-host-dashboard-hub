import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Marca padrão de conteúdo gerado por IA (insights, sugestões, chat) */
const MarcaIA = ({ className, rotulo = 'IA' }: { className?: string; rotulo?: string }) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center gap-1 rounded-md bg-gradient-primary px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase leading-none tracking-wide text-white',
      className,
    )}
  >
    <Sparkles className="h-3 w-3" aria-hidden="true" />
    {rotulo}
  </span>
);

export default MarcaIA;
