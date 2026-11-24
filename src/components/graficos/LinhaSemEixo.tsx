/**
 * LinhaSemEixo — evolução no celular (`blocoCrescimento` do plano): linha
 * com área clara embaixo, sem eixo nem grade. O último valor e o pico ficam
 * marcados; tocar (ou arrastar) num ponto mostra o valor numa linha fixa
 * acima do gráfico. Setas do teclado andam ponto a ponto.
 *
 *   <LinhaSemEixo pontos={[{ rotulo: 'jan', valor: 1200 }, …]} rotulo="Receita por mês em 2026" />
 *
 * Rótulos do eixo X: primeiro, do meio e último. `formatar` muda o formato
 * do valor (padrão: R$ curto, "R$ 34 mil").
 */
import React, { useId } from 'react';
import { cn } from '@/lib/utils';
import { formatarMoedaCurta } from '@/components/comum/formatos';
import { COR_TEXTO_FRACO, COR_TRILHO, FONTE_MONO, corDoTom, type TomGrafico } from './cores';
import { useLargura } from './useLargura';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';

export interface PontoLinha {
  rotulo: string;
  valor: number;
}

interface LinhaSemEixoProps {
  pontos: PontoLinha[];
  /** Descrição para leitor de tela e linha de ajuda (ex.: "Receita por mês em 2026") */
  rotulo: string;
  formatar?: (v: number) => string;
  tom?: TomGrafico;
  altura?: number;
  /** Guarda na sessão o ponto tocado (volta depois de recarregar) */
  chave?: string;
  className?: string;
}

const M = { esq: 8, dir: 8, topo: 22, base: 22 };

const LinhaSemEixo = ({ pontos, rotulo, formatar = formatarMoedaCurta, tom = 'brand', altura = 150, chave, className }: LinhaSemEixoProps) => {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const idGrad = useId().replace(/:/g, '');
  const n = pontos.length;
  const [selGuardado, setSel] = useEstadoPersistente<number | null>(chave ?? null, null, {
    aceita: (v) => v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 0),
  });
  const sel = selGuardado !== null && selGuardado < n ? selGuardado : null;
  if (n === 0) return null;

  const atual = sel ?? n - 1;
  const cor = corDoTom(tom);
  const valores = pontos.map((p) => p.valor);
  const max = Math.max(...valores, 0);
  const min = Math.min(...valores, 0);
  const faixa = max - min || 1;
  const w = Math.max(largura, 120);
  const x = (i: number) => (n === 1 ? w / 2 : M.esq + (i / (n - 1)) * (w - M.esq - M.dir));
  const yBase = altura - M.base;
  const y = (v: number) => M.topo + (1 - (v - min) / faixa) * (yBase - M.topo);
  const iPico = valores.indexOf(max);

  const linha = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.valor).toFixed(1)}`).join(' ');
  const area = `${linha} L${x(n - 1).toFixed(1)} ${yBase} L${x(0).toFixed(1)} ${yBase} Z`;

  const escolher = (clientX: number, alvo: SVGSVGElement) => {
    const r = alvo.getBoundingClientRect();
    const rel = clientX - r.left;
    let melhor = 0;
    for (let i = 1; i < n; i++) if (Math.abs(x(i) - rel) < Math.abs(x(melhor) - rel)) melhor = i;
    setSel(melhor);
  };

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setSel(Math.max(0, atual - 1));
    else if (e.key === 'ArrowRight') setSel(Math.min(n - 1, atual + 1));
    else return;
    e.preventDefault();
  };

  const meio = Math.floor((n - 1) / 2);
  const rotulosX = Array.from(new Set([0, meio, n - 1]));

  return (
    <div ref={ref} className={cn('min-w-0', className)}>
      <p className="h-5 text-right font-mono text-[11px] font-semibold tabular-nums text-gray-900" aria-live="polite">
        {pontos[atual].rotulo} · {formatar(pontos[atual].valor)}
        {atual === iPico && n > 1 && <span className="ml-1 font-normal text-gray-500">(pico)</span>}
      </p>
      <div
        role="group"
        tabIndex={0}
        aria-label={`${rotulo}. Use as setas para ver cada valor.`}
        onKeyDown={teclas}
        className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <svg
          width={w}
          height={altura}
          viewBox={`0 0 ${w} ${altura}`}
          className="block touch-pan-y select-none"
          aria-hidden="true"
          onPointerDown={(e) => escolher(e.clientX, e.currentTarget)}
          onPointerMove={(e) => (e.buttons || e.pointerType === 'mouse') && escolher(e.clientX, e.currentTarget)}
        >
          <defs>
            <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={cor} stopOpacity={0.28} />
              <stop offset="1" stopColor={cor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={`M${M.esq} ${yBase}H${w - M.dir}`} stroke={COR_TRILHO} strokeWidth={1} />
          {n > 1 && <path d={area} fill={`url(#${idGrad})`} />}
          {n > 1 && <path d={linha} fill="none" stroke={cor} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />}
          {sel !== null && (
            <path d={`M${x(atual)} ${M.topo - 6}V${yBase}`} stroke={COR_TEXTO_FRACO} strokeWidth={1} strokeDasharray="3 3" />
          )}
          {/* Pico (quando não é o último) */}
          {iPico !== n - 1 && max > 0 && (
            <>
              <circle cx={x(iPico)} cy={y(max)} r={3.5} fill={cor} />
              <text x={x(iPico)} y={y(max) - 8} textAnchor="middle" fontFamily={FONTE_MONO} fontSize={10} fill={COR_TEXTO_FRACO}>
                {formatar(max)}
              </text>
            </>
          )}
          {/* Último valor */}
          <circle cx={x(n - 1)} cy={y(valores[n - 1])} r={4.5} fill={cor} stroke="hsl(var(--card))" strokeWidth={2} />
          {sel !== null && sel !== n - 1 && <circle cx={x(atual)} cy={y(valores[atual])} r={4} fill={cor} stroke="hsl(var(--card))" strokeWidth={2} />}
          <g fontFamily={FONTE_MONO} fontSize={10} fill={COR_TEXTO_FRACO}>
            {rotulosX.map((i) => (
              <text key={i} x={x(i)} y={altura - 4} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
                {pontos[i].rotulo}
              </text>
            ))}
          </g>
        </svg>
      </div>
      <span className="sr-only">
        {pontos.map((p) => `${p.rotulo}: ${formatar(p.valor)}`).join('; ')}
      </span>
    </div>
  );
};

export default LinhaSemEixo;
