/**
 * FaixaResumo — o topo de cada tela no celular (regra 2): um número em
 * destaque (28px mono) e de 2 a 4 números de apoio numa linha abaixo
 * (`.m-strip` + `.m-kv` do plano). Opcionalmente, uma mini-linha de
 * tendência ao lado do destaque e o ícone de ajuda.
 *
 *   <FaixaResumo rotulo="Lucro líquido do período" valor="R$ 95.367" tendencia={[1,2,3]}
 *     apoio={[{ rotulo: 'Receita', valor: 'R$ 125.490' }, { rotulo: 'Despesas', valor: 'R$ 5.025', tom: 'danger' }]} />
 *
 * Os valores chegam já formatados (formatarMoeda/formatarMoedaSemCentavos).
 *
 * `acao`: um botão à direita do destaque (ex.: "+ Novo"), no lugar da tendência.
 */
import React from 'react';
import { cn } from '@/lib/utils';
import MiniTendencia from '@/components/graficos/MiniTendencia';
import AjudaInfo from './AjudaInfo';
import { TEXTO_DO_TOM, type Tom } from './cores';

export interface ValorApoio {
  rotulo: React.ReactNode;
  valor: React.ReactNode;
  /** Cor do valor: success (recebido), warning (a receber), danger (despesa)… */
  tom?: Tom;
}

interface FaixaResumoProps {
  /** Rótulo do número principal (12px, cinza) */
  rotulo: React.ReactNode;
  /** Número principal, já formatado */
  valor: React.ReactNode;
  tomValor?: Tom;
  /** De 2 a 4 números de apoio */
  apoio?: ValorApoio[];
  /** Valores para a mini-linha ao lado do destaque (ex.: últimos 6 meses) */
  tendencia?: number[];
  /** Texto de ajuda atrás do ícone "i" */
  ajuda?: React.ReactNode;
  /** Conteúdo livre abaixo dos apoios (ex.: uma BarraProgresso) */
  children?: React.ReactNode;
  /** Botão à direita do número principal (ex.: "+ Novo") */
  acao?: React.ReactNode;
  className?: string;
}

const FaixaResumo = ({ rotulo, valor, tomValor = 'neutro', apoio = [], tendencia, ajuda, children, acao, className }: FaixaResumoProps) => (
  <section className={cn('min-w-0 rounded-2xl border bg-card p-3.5 shadow-sm', className)}>
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="truncate">{rotulo}</span>
          {ajuda && <AjudaInfo titulo={typeof rotulo === 'string' ? rotulo : undefined}>{ajuda}</AjudaInfo>}
        </div>
        <p className={cn('truncate font-mono text-[28px] font-semibold leading-tight tracking-tight tabular-nums', TEXTO_DO_TOM[tomValor])}>
          {valor}
        </p>
      </div>
      {tendencia && tendencia.length > 1 && <MiniTendencia valores={tendencia} className="mb-1.5" />}
      {acao && <div className="mb-0.5 shrink-0">{acao}</div>}
    </div>

    {apoio.length > 0 && (
      <dl
        className="mt-3 grid gap-2.5 border-t border-gray-100 pt-3"
        style={{ gridTemplateColumns: `repeat(${apoio.length}, minmax(0, 1fr))` }}
      >
        {apoio.map((a, i) => (
          <div key={i} className="min-w-0">
            <dt className="truncate text-xs text-gray-500">{a.rotulo}</dt>
            <dd className={cn('truncate font-mono text-sm font-semibold tabular-nums', TEXTO_DO_TOM[a.tom ?? 'neutro'])}>{a.valor}</dd>
          </div>
        ))}
      </dl>
    )}
    {children}
  </section>
);

export default FaixaResumo;
