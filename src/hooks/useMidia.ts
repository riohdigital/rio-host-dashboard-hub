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
