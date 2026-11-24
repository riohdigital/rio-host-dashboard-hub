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
 *
 * Opcionais:
 * - `linha(item)` troca a linha de baixo ("Recebido … · a receber …"), para
 *   quando o valor não se divide em recebido/a receber (ex.: comissão por
 *   canal no Painel Gestor, com aReceber = 0).
 * - `detalhe(item)` faz cada canal virar um botão: tocar abre esse texto logo
 *   abaixo da barra (ex.: a regra de recebimento do canal).
 */
import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatarMoedaSemCentavos } from '@/components/comum/formatos';
import { corDoCanalGrafico } from './tema';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';

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
  /** Troca a linha de baixo de cada canal */
  linha?: (item: ItemCanal) => React.ReactNode;
  /** Texto que abre ao tocar no canal */
  detalhe?: (item: ItemCanal) => React.ReactNode;
  /** Guarda na sessão qual canal está aberto (volta depois de recarregar) */
  chave?: string;
  className?: string;
}

const BarrasCanais = ({ itens, formatar = formatarMoedaSemCentavos, legenda = true, linha, detalhe, chave, className }: BarrasCanaisProps) => {
  const [aberto, setAberto] = useEstadoPersistente<string | null>(chave ?? null, null);
  const linhas = itens
    .map((i) => ({ ...i, total: (i.recebido || 0) + (i.aReceber || 0) }))
    .filter((i) => i.total > 0)
    .sort((a, b) => b.total - a.total);
  const maior = linhas[0]?.total || 1;

  const conteudo = (l: (typeof linhas)[number], tocavel: boolean) => {
    const cor = corDoCanalGrafico(l.canal);
    return (
      <>
        <span className="flex items-baseline justify-between gap-2 text-[13px] font-semibold text-gray-900">
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate">{l.canal}</span>
            {tocavel && (
              <ChevronDown
                className={cn('h-3.5 w-3.5 shrink-0 self-center text-gray-400 transition-transform', aberto === l.canal && 'rotate-180')}
                aria-hidden="true"
              />
            )}
          </span>
          <span className="shrink-0 font-mono tabular-nums">{formatar(l.total)}</span>
        </span>
        <span
          className="flex h-2.5 overflow-hidden rounded-full bg-gray-100"
          style={{ width: `${Math.max(4, (l.total / maior) * 100)}%` }}
          role="img"
          aria-label={
            linha ? `${l.canal}: ${formatar(l.total)}` : `${l.canal}: recebido ${formatar(l.recebido)}, a receber ${formatar(l.aReceber)}`
          }
        >
          <span className="h-full" style={{ width: `${(l.recebido / l.total) * 100}%`, background: cor }} />
          <span className="h-full opacity-35" style={{ width: `${(l.aReceber / l.total) * 100}%`, background: cor }} />
        </span>
        <span className="truncate text-[11px] text-gray-500">
          {linha ? (
            linha(l)
          ) : (
            <>
              Recebido <span className="font-mono tabular-nums">{formatar(l.recebido)}</span> · a receber{' '}
              <span className="font-mono tabular-nums">{formatar(l.aReceber)}</span>
            </>
          )}
        </span>
      </>
    );
  };

  return (
    <div className={cn('min-w-0', className)}>
      <ul className="divide-y divide-gray-100">
        {linhas.map((l) => (
            <li key={l.canal} className="py-2.5 first:pt-0.5">
              {detalhe ? (
                <button
                  type="button"
                  onClick={() => setAberto((a) => (a === l.canal ? null : l.canal))}
                  aria-expanded={aberto === l.canal}
                  className="-mx-1 grid w-[calc(100%+0.5rem)] gap-1.5 rounded-lg px-1 py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {conteudo(l, true)}
                </button>
              ) : (
                <div className="grid gap-1.5">{conteudo(l, false)}</div>
              )}
              {detalhe && aberto === l.canal && <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-700">{detalhe(l)}</div>}
            </li>
        ))}
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
