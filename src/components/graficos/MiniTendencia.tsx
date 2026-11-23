/**
 * MiniTendencia — mini-linha (sparkline) de 24px de altura, sem eixo, com um
 * ponto no último valor. Vai ao lado de um número para mostrar a direção
 * (ex.: lucro dos últimos 6 meses na FaixaResumo).
 *
 *   <MiniTendencia valores={[3, 4, 4, 6, 9, 8]} />
 *
 * Cor "auto": verde se o último valor é maior ou igual ao primeiro, vermelho
 * se caiu. Decorativa por padrão (aria-hidden); passe `rotulo` para leitor de
 * tela quando ela trouxer informação que não está escrita ao lado.
 */
import React from 'react';
import { cn } from '@/lib/utils';
import { corDoTom, type TomGrafico } from './cores';

interface MiniTendenciaProps {
  valores: number[];
  largura?: number;
  altura?: number;
  cor?: TomGrafico | 'auto';
  rotulo?: string;
  className?: string;
}

const MiniTendencia = ({ valores, largura = 84, altura = 24, cor = 'auto', rotulo, className }: MiniTendenciaProps) => {
  if (valores.length < 2) return null;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const faixa = max - min || 1;
  const m = 3; // respiro para o ponto e a espessura da linha
  const pts = valores.map((v, i) => [
    m + (i / (valores.length - 1)) * (largura - 2 * m),
    m + (1 - (v - min) / faixa) * (altura - 2 * m),
  ]);
  const tom = cor === 'auto' ? (valores[valores.length - 1] >= valores[0] ? 'success' : 'danger') : cor;
  const c = corDoTom(tom);
  const [ux, uy] = pts[pts.length - 1];

  return (
    <svg
      width={largura}
      height={altura}
      viewBox={`0 0 ${largura} ${altura}`}
      className={cn('shrink-0 overflow-visible', className)}
      role={rotulo ? 'img' : undefined}
      aria-label={rotulo}
      aria-hidden={rotulo ? undefined : true}
    >
      <path
        d={'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')}
        fill="none"
        stroke={c}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={ux} cy={uy} r={2.75} fill={c} />
    </svg>
  );
};

export default MiniTendencia;
