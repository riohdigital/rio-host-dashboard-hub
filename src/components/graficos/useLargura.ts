/**
 * useLargura — largura real de um elemento, em px, acompanhando mudanças.
 * Os gráficos do celular desenham o SVG no tamanho exato (texto não estica).
 */
import { useEffect, useRef, useState } from 'react';

export function useLargura<T extends HTMLElement>(inicial = 320) {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(inicial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setLargura(Math.max(0, Math.round(el.getBoundingClientRect().width)));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, largura] as const;
}
