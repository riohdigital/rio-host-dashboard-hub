/**
 * Escolhas — pílulas de escolha única que quebram linha, para os filtros
 * dentro de uma FolhaDetalhes (Reservas, Auditoria).
 *
 *   <Escolhas rotulo="Pagamento" valor={pagamento} aoMudar={setPagamento}
 *     opcoes={[{ valor: 'all', rotulo: 'Todos' }, { valor: 'Pago', rotulo: 'Pago' }]} />
 *
 * `contagem` mostra quantos itens cada opção tem.
 */
import React from 'react';
import { cn } from '@/lib/utils';

export interface OpcaoEscolha {
  valor: string;
  rotulo: string;
  contagem?: number;
}

interface EscolhasProps {
  rotulo: string;
  opcoes: OpcaoEscolha[];
  valor: string;
  aoMudar: (valor: string) => void;
}

const Escolhas = ({ rotulo, opcoes, valor, aoMudar }: EscolhasProps) => (
  <fieldset className="grid gap-2">
    <legend className="mb-2 text-xs text-gray-500">{rotulo}</legend>
    <div className="flex flex-wrap gap-2">
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={ativo}
            onClick={() => aoMudar(o.valor)}
            className={cn(
              'min-h-9 rounded-full border px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              ativo ? 'border-brand bg-brand text-white' : 'border-gray-200 bg-card text-gray-700 hover:bg-gray-50',
            )}
          >
            {o.rotulo}
            {o.contagem !== undefined && (
              <span className={cn('ml-1.5 font-mono text-xs font-normal tabular-nums', ativo ? 'text-white/80' : 'text-gray-500')}>{o.contagem}</span>
            )}
          </button>
        );
      })}
    </div>
  </fieldset>
);

export default Escolhas;
