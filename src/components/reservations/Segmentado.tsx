/**
 * Segmentado — escolha única em pílulas que dividem a largura (`.m-seg` do
 * plano). Usado na folha da reserva (situação e pagamento) e nos filtros.
 *
 *   <Segmentado rotulo="Pagamento" valor={status} aoMudar={mudar}
 *     opcoes={[{ valor: 'Pago', rotulo: 'Pago' }, { valor: 'Pendente', rotulo: 'A receber' }]} />
 */
import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OpcaoSegmentado {
  valor: string;
  rotulo: React.ReactNode;
}

interface SegmentadoProps {
  /** Nome do grupo para leitor de tela */
  rotulo: string;
  opcoes: OpcaoSegmentado[];
  valor: string;
  aoMudar: (valor: string) => void;
  /** Mostra o giro na opção que está sendo gravada */
  gravando?: string | null;
  desabilitado?: boolean;
  className?: string;
}

const Segmentado = ({ rotulo, opcoes, valor, aoMudar, gravando, desabilitado, className }: SegmentadoProps) => (
  <div
    role="radiogroup"
    aria-label={rotulo}
    className={cn('grid auto-cols-fr grid-flow-col rounded-full bg-gray-100 p-[3px]', className)}
  >
    {opcoes.map((o) => {
      const ativo = o.valor === valor;
      return (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={ativo}
          disabled={desabilitado || !!gravando}
          onClick={() => !ativo && aoMudar(o.valor)}
          className={cn(
            'inline-flex min-h-9 min-w-0 items-center justify-center gap-1 rounded-full px-0.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed',
            ativo ? 'bg-card text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
          )}
        >
          {gravando === o.valor && <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden="true" />}
          <span className="truncate">{o.rotulo}</span>
        </button>
      );
    })}
  </div>
);

export default Segmentado;
