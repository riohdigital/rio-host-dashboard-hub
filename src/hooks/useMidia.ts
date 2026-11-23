import { useEffect, useState } from 'react';

/** Acompanha uma media query (lê o valor já no primeiro render, sem piscar) */
export function useMidia(consulta: string): boolean {
  const [casa, setCasa] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(consulta).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(consulta);
    const mudou = () => setCasa(mql.matches);
    mudou();
    mql.addEventListener('change', mudou);
    return () => mql.removeEventListener('change', mudou);
  }, [consulta]);

  return casa;
}

/** Celular: abaixo de 768px (tabelas viram cartões, janelas viram gavetas) */
export const useEhCelular = () => useMidia('(max-width: 767px)');

/**
 * Tela compacta: abaixo de 1024px (celular e tablet). É o mesmo corte da
 * navegação: aqui aparecem a barra de baixo e o desenho de celular das telas.
 */
export const useEhCompacto = () => useMidia('(max-width: 1023px)');
