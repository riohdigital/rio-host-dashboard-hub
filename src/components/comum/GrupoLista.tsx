/**
 * GrupoLista — um grupo de uma lista principal (`.m-mes` + cartão do plano):
 * o título do grupo (ex.: "Novembro 2026") com a contagem/subtotal à direita
 * e, abaixo, um cartão com as LinhaLista separadas por um fio.
 *
 *   <GrupoLista titulo="Novembro 2026" resumo="10 reservas · R$ 21.480">
 *     {reservas.map((r) => <LinhaLista key={r.id} … />)}
 *   </GrupoLista>
 *
 * `rodape` fica dentro do cartão, depois das linhas (ex.: <VerTodos />).
 * `ListaLinhas` é só o recheio (linhas + fios), para usar dentro de um Bloco.
 */
import React from 'react';
import { cn } from '@/lib/utils';

/** Linhas com um fio entre elas (sem cartão) */
export const ListaLinhas = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('divide-y divide-gray-100', className)}>{children}</div>
);

interface GrupoListaProps {
  titulo: React.ReactNode;
  /** À direita do título: contagem e/ou subtotal (mono, cinza) */
  resumo?: React.ReactNode;
  children: React.ReactNode;
  /** Dentro do cartão, depois das linhas (ex.: VerTodos) */
  rodape?: React.ReactNode;
  className?: string;
}

const GrupoLista = ({ titulo, resumo, children, rodape, className }: GrupoListaProps) => (
  <section className={cn('min-w-0', className)}>
    <div className="mb-1.5 flex items-baseline justify-between gap-2 px-0.5">
      <h3 className="min-w-0 truncate font-display text-[13px] font-bold capitalize text-gray-900">{titulo}</h3>
      {resumo && <span className="shrink-0 font-mono text-xs tabular-nums text-gray-500">{resumo}</span>}
    </div>
    <div className="rounded-2xl border bg-card px-3.5 py-1 shadow-sm">
      <ListaLinhas>{children}</ListaLinhas>
      {rodape}
    </div>
  </section>
);

export default GrupoLista;
