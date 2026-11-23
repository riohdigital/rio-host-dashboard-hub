/**
 * BarrasCanais — receita por canal no celular (`blocoCanais` do plano): uma
 * barra horizontal por canal, parte cheia = recebido, parte clara = a
 * receber, valor escrito ao lado do nome, sem eixo. A barra mais longa é a
 * do maior canal; as outras são proporcionais a ela. Cor fixa por canal.
 *
 *   <BarrasCanais itens={[{ canal: 'Airbnb', recebido: 37300, aReceber: 15343 }, …]} />
 *
 * Use dentro de um Bloco (o título e o total ficam no Bloco). `formatar`
 * troca o formato dos valores (padrão: R$ sem centavos).
 */
import React from 'react';
import { cn } from '@/lib/utils';
import { formatarMoedaSemCentavos } from '@/components/comum/formatos';
import { corDoCanalGrafico } from './tema';

export interface ItemCanal {
  canal: string;
  recebido: number;
  aReceber: number;
}

interface BarrasCanaisProps {
  itens: ItemCanal[];
  formatar?: (v: number) => string;
  /** Mostra a legenda Recebido / A receber no pé (padrão: sim) */
  legenda?: boolean;
  className?: string;
}

const BarrasCanais = ({ itens, formatar = formatarMoedaSemCentavos, legenda = true, className }: BarrasCanaisProps) => {
  const linhas = itens
    .map((i) => ({ ...i, total: (i.recebido || 0) + (i.aReceber || 0) }))
    .filter((i) => i.total > 0)
    .sort((a, b) => b.total - a.total);
  const maior = linhas[0]?.total || 1;

  return (
    <div className={cn('min-w-0', className)}>
      <ul className="divide-y divide-gray-100">
        {linhas.map((l) => {
          const cor = corDoCanalGrafico(l.canal);
          return (
            <li key={l.canal} className="grid gap-1.5 py-2.5 first:pt-0.5">
              <div className="flex items-baseline justify-between gap-2 text-[13px] font-semibold text-gray-900">
                <span className="min-w-0 truncate">{l.canal}</span>
                <span className="shrink-0 font-mono tabular-nums">{formatar(l.total)}</span>
              </div>
              <div
                className="flex h-2.5 overflow-hidden rounded-full bg-gray-100"
                style={{ width: `${Math.max(4, (l.total / maior) * 100)}%` }}
                role="img"
                aria-label={`${l.canal}: recebido ${formatar(l.recebido)}, a receber ${formatar(l.aReceber)}`}
              >
                <span className="h-full" style={{ width: `${(l.recebido / l.total) * 100}%`, background: cor }} />
                <span className="h-full opacity-35" style={{ width: `${(l.aReceber / l.total) * 100}%`, background: cor }} />
              </div>
              <span className="truncate text-[11px] text-gray-500">
                Recebido <span className="font-mono tabular-nums">{formatar(l.recebido)}</span> · a receber{' '}
                <span className="font-mono tabular-nums">{formatar(l.aReceber)}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {legenda && linhas.length > 0 && (
        <div className="mt-2 flex gap-3 text-[11px] text-gray-500" aria-hidden="true">
          <span className="flex items-center gap-1">
            <i className="inline-block h-2 w-3.5 rounded-sm bg-gray-500" />
            Recebido
          </span>
          <span className="flex items-center gap-1">
            <i className="inline-block h-2 w-3.5 rounded-sm bg-gray-500 opacity-35" />A receber
          </span>
        </div>
      )}
    </div>
  );
};

export default BarrasCanais;
