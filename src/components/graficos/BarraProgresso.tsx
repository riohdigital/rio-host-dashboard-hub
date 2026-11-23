/**
 * BarraProgresso — uma barra só, para "X de Y" (ex.: 40 de 60 pagas), com o
 * rótulo à esquerda e a contagem à direita (mono). Sem eixo.
 *
 *   <BarraProgresso valor={40} total={60} rotulo="Pagamentos" sufixo="pagas" detalhe="20 pendentes · R$ 26.472 a receber" />
 *
 * `tom` muda a cor da parte cheia (padrão: success). `semCabecalho` tira a
 * linha de cima (rótulo + "X de Y") quando ela já está no título do Bloco.
 */
import React from 'react';
import { cn } from '@/lib/utils';
import { corDoTom, type TomGrafico } from './cores';

interface BarraProgressoProps {
  valor: number;
  total: number;
  /** Texto à esquerda, acima da barra */
  rotulo?: React.ReactNode;
  /** Palavra depois de "X de Y" (ex.: "pagas") */
  sufixo?: string;
  /** Linha abaixo da barra */
  detalhe?: React.ReactNode;
  tom?: TomGrafico;
  /** Sem a linha de cima (o "X de Y" vai no título do Bloco) */
  semCabecalho?: boolean;
  className?: string;
}

const BarraProgresso = ({ valor, total, rotulo, sufixo, detalhe, tom = 'success', semCabecalho, className }: BarraProgressoProps) => {
  const pct = total > 0 ? Math.min(100, Math.max(0, (valor / total) * 100)) : 0;
  const contagem = `${valor.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}${sufixo ? ` ${sufixo}` : ''}`;
  return (
    <div className={cn('min-w-0', className)}>
      {!semCabecalho && (rotulo || total > 0) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
          {rotulo && <span className="min-w-0 truncate font-semibold text-gray-900">{rotulo}</span>}
          <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-gray-500">{contagem}</span>
        </div>
      )}
      <div
        className="h-2.5 overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={valor}
        aria-valuetext={contagem}
      >
        <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: corDoTom(tom) }} />
      </div>
      {detalhe && <p className="mt-2 text-xs text-gray-500">{detalhe}</p>}
    </div>
  );
};

export default BarraProgresso;
