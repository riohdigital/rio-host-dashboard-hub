/**
 * AjudaInfo — ícone "i" que guarda um texto de ajuda (regra 8: explicações
 * longas saem da tela). Tocar abre um balão com o texto; a área de toque tem
 * 44px mesmo com o ícone pequeno.
 *
 *   <AjudaInfo titulo="Como calculamos">Comissão = total × percentual…</AjudaInfo>
 */
import React from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface AjudaInfoProps {
  /** Texto da ajuda */
  children: React.ReactNode;
  /** Título em negrito no topo do balão (opcional) */
  titulo?: React.ReactNode;
  /** Nome para leitor de tela; padrão "Ajuda" */
  rotulo?: string;
  className?: string;
}

const AjudaInfo = ({ children, titulo, rotulo = 'Ajuda', className }: AjudaInfoProps) => (
  <Popover>
    <PopoverTrigger asChild>
      <button
        type="button"
        aria-label={rotulo}
        className={cn(
          // 44px de área de toque; o ícone visível tem 18px
          '-m-3 inline-grid h-11 w-11 shrink-0 place-items-center rounded-full text-gray-500 transition-colors hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
          className,
        )}
      >
        <Info className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>
    </PopoverTrigger>
    <PopoverContent
      align="end"
      collisionPadding={16}
      className="w-80 max-w-[calc(100vw-2rem)] rounded-2xl p-4 text-sm leading-relaxed text-gray-700"
    >
      {titulo && <p className="mb-1 font-display text-base font-bold text-gray-900">{titulo}</p>}
      {children}
    </PopoverContent>
  </Popover>
);

export default AjudaInfo;
