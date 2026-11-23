/**
 * RolagemComputador — caixa com altura fixa e rolagem própria SÓ no
 * computador (≥ 1024px), como era antes. Abaixo disso vira um bloco comum,
 * que cresce com o conteúdo (regra 6: só a página rola). Use junto com
 * useListaCurta + VerTodos para não despejar uma lista longa no celular.
 *
 *   <RolagemComputador className="h-[400px] px-6">…</RolagemComputador>
 *
 * `className` vale para os dois casos; a altura fixa só pega no computador.
 */
import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEhCompacto } from '@/hooks/useMidia';
import { cn } from '@/lib/utils';

interface RolagemComputadorProps {
  children: React.ReactNode;
  /** Classes da caixa (ex.: "h-[400px] px-6"); alturas são ignoradas no celular */
  className?: string;
}

const RolagemComputador = ({ children, className }: RolagemComputadorProps) => {
  const compacto = useEhCompacto();
  if (compacto) return <div className={cn(className, 'h-auto max-h-none')}>{children}</div>;
  return <ScrollArea className={className}>{children}</ScrollArea>;
};

export default RolagemComputador;
