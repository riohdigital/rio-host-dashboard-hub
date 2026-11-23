/**
 * Bloco — o cartão padrão das telas de celular (`.m-card` do plano), com o
 * título no padrão único: 16px Manrope, negrito, cor do texto forte, sem
 * emoji. À direita do título cabe um texto curto (`extra`, ex.: "seg, 23 nov"
 * ou o total) e o ícone de ajuda (`ajuda`).
 *
 *   <Bloco titulo="Últimas reservas" extra="3 de 12" ajuda="Texto…">…linhas…</Bloco>
 *
 * Use `tom="alerta"` para o bloco vermelho de pendências (ex.: saídas sem
 * faxineira). Não coloque um Bloco dentro de outro (regra 10).
 * `TituloBloco` sozinho serve para títulos fora de cartão.
 */
import React from 'react';
import { cn } from '@/lib/utils';
import AjudaInfo from './AjudaInfo';

/** Classes do título de bloco: use também em CardTitle/h2 que não usam o Bloco */
export const CLASSE_TITULO_BLOCO = 'font-display text-base font-bold leading-tight tracking-normal text-gray-900';

interface TituloBlocoProps {
  children: React.ReactNode;
  /** Texto curto à direita (12px, cinza) */
  extra?: React.ReactNode;
  /** Texto de ajuda atrás do ícone "i" */
  ajuda?: React.ReactNode;
  /** Nível do título; padrão h2 */
  como?: 'h2' | 'h3' | 'h4';
  className?: string;
  classeTitulo?: string;
}

export const TituloBloco = ({ children, extra, ajuda, como: Tag = 'h2', className, classeTitulo }: TituloBlocoProps) => (
  <div className={cn('mb-2 flex min-w-0 items-center justify-between gap-2', className)}>
    <Tag className={cn(CLASSE_TITULO_BLOCO, 'min-w-0 truncate', classeTitulo)}>{children}</Tag>
    {(extra || ajuda) && (
      <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-gray-500">
        {extra}
        {ajuda && <AjudaInfo titulo={typeof children === 'string' ? children : undefined}>{ajuda}</AjudaInfo>}
      </div>
    )}
  </div>
);

interface BlocoProps extends Omit<TituloBlocoProps, 'children' | 'className'> {
  titulo?: React.ReactNode;
  children: React.ReactNode;
  /** "alerta": borda e título vermelhos, para pendências */
  tom?: 'padrao' | 'alerta';
  /** Tira o respiro de cima/baixo (listas de linhas encostadas) */
  compacto?: boolean;
  className?: string;
  id?: string;
}

const Bloco = ({ titulo, children, tom = 'padrao', compacto, className, id, ...titulo_ }: BlocoProps) => (
  <section
    id={id}
    className={cn(
      'min-w-0 rounded-2xl border bg-card px-3.5 shadow-sm',
      compacto ? 'py-1' : 'py-3.5',
      tom === 'alerta' && 'border-danger-200 bg-danger-50/40',
      className,
    )}
  >
    {titulo && (
      <TituloBloco {...titulo_} className={compacto ? 'mb-0 pt-2.5' : undefined} classeTitulo={cn(tom === 'alerta' && 'text-danger-700', titulo_.classeTitulo)}>
        {titulo}
      </TituloBloco>
    )}
    {children}
  </section>
);

export default Bloco;
