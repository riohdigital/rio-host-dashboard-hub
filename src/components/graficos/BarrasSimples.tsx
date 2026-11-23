/**
 * BarrasSimples — barras verticais com o valor escrito em cima, sem eixo nem
 * grade (gráfico de comissões do `mPainel` no plano). Meses futuros (ou
 * qualquer item com `futuro`) ficam em tom claro.
 *
 *   <BarrasSimples itens={[{ rotulo: 'set', valor: 4200 }, { rotulo: 'dez', valor: 8100, futuro: true }]}
 *     rotulo="Comissões por mês" aoTocar={(item) => abrirMes(item)} />
 *
 * Com `aoTocar`, cada barra vira um botão (toque ou Enter). Com muitas barras
 * (menos de 34px por barra), só o maior valor fica escrito; os demais vão
 * para o leitor de tela. Formato padrão: "4,2 mil" (diga "em R$" no título).
 */
import React from 'react';
import { cn } from '@/lib/utils';
import { formatarNumeroCurto } from '@/components/comum/formatos';
import { COR_TEXTO_FORTE, COR_TEXTO_FRACO, FONTE_MONO, corDoTom, type TomGrafico } from './cores';
import { useLargura } from './useLargura';

export interface ItemBarra {
  rotulo: string;
  valor: number;
  /** Desenha em tom claro (ex.: mês que ainda não chegou) */
  futuro?: boolean;
}

interface BarrasSimplesProps<T extends ItemBarra> {
  itens: T[];
  /** Descrição para leitor de tela */
  rotulo: string;
  formatar?: (v: number) => string;
  tom?: TomGrafico;
  altura?: number;
  aoTocar?: (item: T, indice: number) => void;
  className?: string;
}

function BarrasSimples<T extends ItemBarra>({
  itens,
  rotulo,
  formatar = formatarNumeroCurto,
  tom = 'brand',
  altura = 150,
  aoTocar,
  className,
}: BarrasSimplesProps<T>) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const n = itens.length;
  if (n === 0) return null;

  const w = Math.max(largura, 120);
  const topo = 18;
  const base = 20;
  const slot = w / n;
  const barra = Math.min(46, slot * 0.72);
  const max = Math.max(...itens.map((i) => i.valor), 0) || 1;
  const iMax = itens.findIndex((i) => i.valor === max);
  const escreverTodos = slot >= 34;
  const cor = corDoTom(tom);

  return (
    <div ref={ref} className={cn('min-w-0', className)}>
      <svg width={w} height={altura} viewBox={`0 0 ${w} ${altura}`} className="block" role="group" aria-label={rotulo}>
        {itens.map((item, i) => {
          const h = Math.max(item.valor > 0 ? 3 : 0, ((item.valor > 0 ? item.valor : 0) / max) * (altura - topo - base - 4));
          const cx = slot * i + slot / 2;
          const yTopo = altura - base - h;
          const texto = `${item.rotulo}: ${formatar(item.valor)}${item.futuro ? ' (previsto)' : ''}`;
          const tocavel = Boolean(aoTocar);
          return (
            <g
              key={`${item.rotulo}-${i}`}
              role={tocavel ? 'button' : 'img'}
              tabIndex={tocavel ? 0 : undefined}
              aria-label={texto}
              className={cn(tocavel && 'cursor-pointer outline-none [&:focus-visible>rect:first-child]:stroke-brand')}
              onClick={tocavel ? () => aoTocar?.(item, i) : undefined}
              onKeyDown={
                tocavel
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        aoTocar?.(item, i);
                      }
                    }
                  : undefined
              }
            >
              {/* Área de toque da coluna inteira */}
              <rect x={slot * i} y={0} width={slot} height={altura} fill="transparent" strokeWidth={2} rx={8} />
              <rect x={cx - barra / 2} y={yTopo} width={barra} height={h} rx={Math.min(6, barra / 4)} fill={cor} opacity={item.futuro ? 0.4 : 1} />
              {(escreverTodos || i === iMax) && (
                <text x={cx} y={yTopo - 6} textAnchor="middle" fontFamily={FONTE_MONO} fontSize={11} fontWeight={600} fill={COR_TEXTO_FORTE}>
                  {formatar(item.valor)}
                </text>
              )}
              <text x={cx} y={altura - 4} textAnchor="middle" fontFamily={FONTE_MONO} fontSize={10} fill={COR_TEXTO_FRACO}>
                {item.rotulo}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default BarrasSimples;
