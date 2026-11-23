/**
 * BlocoRecolhivel — detalhe que fica fechado (regra 7, `.m-fold` do plano):
 * um cartão de uma linha com título, resumo de uma linha e a seta; tocar
 * abre o conteúdo dentro do mesmo cartão.
 *
 *   <BlocoRecolhivel titulo="Detalhamento da receita" resumo="Bruto, comissão, líquido e despesas">
 *     …conteúdo…
 *   </BlocoRecolhivel>
 *
 * `etiqueta` vai ao lado do título (ex.: <Etiqueta tom="brand">IA</Etiqueta>).
 * O conteúdo só é montado quando aberto (consultas pesadas não rodam antes).
 */
import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface BlocoRecolhivelProps {
  titulo: React.ReactNode;
  /** Uma linha que diz o que há dentro */
  resumo?: React.ReactNode;
  etiqueta?: React.ReactNode;
  children: React.ReactNode;
  /** Começa aberto */
  abertoInicial?: boolean;
  /** Controle externo (opcional) */
  aberto?: boolean;
  aoMudar?: (aberto: boolean) => void;
  className?: string;
}

const BlocoRecolhivel = ({ titulo, resumo, etiqueta, children, abertoInicial = false, aberto, aoMudar, className }: BlocoRecolhivelProps) => {
  const [interno, setInterno] = useState(abertoInicial);
  const estaAberto = aberto ?? interno;
  const mudar = (v: boolean) => {
    setInterno(v);
    aoMudar?.(v);
  };

  return (
    <Collapsible open={estaAberto} onOpenChange={mudar} asChild>
      <section className={cn('min-w-0 rounded-2xl border bg-card shadow-sm', className)}>
        <CollapsibleTrigger className="flex min-h-[60px] w-full items-center justify-between gap-3 rounded-2xl p-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate font-display text-[15px] font-bold text-gray-900">{titulo}</span>
              {etiqueta}
            </span>
            {resumo && <span className="block truncate text-xs text-gray-500">{resumo}</span>}
          </span>
          <ChevronRight
            className={cn('h-[18px] w-[18px] shrink-0 text-gray-500 transition-transform', estaAberto && 'rotate-90')}
            aria-hidden="true"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3.5 pb-3.5">{children}</CollapsibleContent>
      </section>
    </Collapsible>
  );
};

export default BlocoRecolhivel;
