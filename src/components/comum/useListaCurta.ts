/**
 * useListaCurta — corta uma lista em `n` itens até a pessoa tocar em
 * "Ver todos" (par do componente VerTodos). Regras 5 e 6 do plano: blocos
 * mostram de 3 a 5 itens e nada rola dentro da página.
 *
 *   const lista = useListaCurta(itens, 5, { soCompacto: true });
 *
 * `soCompacto`: o corte só vale abaixo de 1024px; o computador vê tudo.
 */
import { useState } from 'react';
import { useEhCompacto } from '@/hooks/useMidia';

/** Corta a lista em `n` itens até a pessoa pedir para ver todos */
export function useListaCurta<T>(itens: T[], n = 5, opcoes: { soCompacto?: boolean } = {}) {
  const [expandido, setExpandido] = useState(false);
  const compacto = useEhCompacto();
  const cortar = !expandido && (!opcoes.soCompacto || compacto) && itens.length > n;
  return {
    visiveis: cortar ? itens.slice(0, n) : itens,
    /** Há mais itens do que o corte (mostre o VerTodos) */
    temMais: itens.length > n && (!opcoes.soCompacto || compacto),
    total: itens.length,
    expandido,
    alternar: () => setExpandido((v) => !v),
  };
}
