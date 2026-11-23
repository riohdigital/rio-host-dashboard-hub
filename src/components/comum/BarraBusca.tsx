/**
 * BarraBusca — a linha do topo das listas no celular (`.m-busca` do plano):
 * o campo de busca arredondado (44px) ocupando o espaço livre e, à direita,
 * os botões da tela (filtros, "+", "Nova") numa linha só.
 *
 *   <BarraBusca valor={busca} aoMudar={setBusca} placeholder="Buscar hóspede">
 *     <BotaoBarra icone={SlidersHorizontal} rotulo="Filtros" contagem={2} aoClicar={abrirFiltros} />
 *     <BotaoBarra icone={Plus} rotulo="Nova reserva" primario aoClicar={nova} />
 *   </BarraBusca>
 *
 * `BotaoBarra` é redondo (44px, só ícone) ou, com `texto`, uma pílula
 * ("+ Nova"). `contagem` mostra o número de filtros ativos no canto.
 */
import React from 'react';
import { Search, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BarraBuscaProps {
  valor: string;
  aoMudar: (valor: string) => void;
  placeholder?: string;
  /** Nome do campo para leitor de tela; padrão = placeholder */
  rotulo?: string;
  /** Botões à direita do campo (BotaoBarra) */
  children?: React.ReactNode;
  className?: string;
}

const BarraBusca = ({ valor, aoMudar, placeholder = 'Buscar', rotulo, children, className }: BarraBuscaProps) => (
  <div className={cn('flex min-w-0 items-center gap-2', className)}>
    <label className="relative flex h-11 min-w-0 flex-1 items-center rounded-full border border-gray-200 bg-card focus-within:ring-2 focus-within:ring-brand">
      <Search className="pointer-events-none absolute left-3.5 h-[18px] w-[18px] text-gray-400" aria-hidden="true" />
      <input
        type="search"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder={placeholder}
        aria-label={rotulo ?? placeholder}
        className="h-full w-full min-w-0 rounded-full bg-transparent pl-10 pr-10 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none sm:text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      {valor && (
        <button
          type="button"
          onClick={() => aoMudar('')}
          aria-label="Limpar busca"
          className="absolute right-0 grid h-11 w-11 place-items-center rounded-full text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </label>
    {children}
  </div>
);

interface BotaoBarraProps {
  icone: LucideIcon;
  /** Nome do botão (leitor de tela; também o title) */
  rotulo: string;
  /** Texto visível ao lado do ícone (vira pílula: "+ Nova") */
  texto?: React.ReactNode;
  /** Botão cheio na cor da marca */
  primario?: boolean;
  /** Número no canto (ex.: filtros ativos); some quando 0 */
  contagem?: number;
  aoClicar: () => void;
  className?: string;
}

export const BotaoBarra = ({ icone: Icone, rotulo, texto, primario, contagem, aoClicar, className }: BotaoBarraProps) => (
  <button
    type="button"
    onClick={aoClicar}
    aria-label={contagem ? `${rotulo} (${contagem} ativos)` : texto ? undefined : rotulo}
    title={rotulo}
    className={cn(
      'relative inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 active:scale-95',
      texto ? 'px-4' : 'w-11',
      primario ? 'bg-brand text-white hover:bg-brand-hover' : 'border border-gray-200 bg-card text-gray-700 hover:bg-gray-50',
      className,
    )}
  >
    <Icone className={texto ? 'h-[18px] w-[18px]' : 'h-5 w-5'} aria-hidden="true" />
    {texto}
    {!!contagem && (
      <span
        className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-accent px-1 font-mono text-[10px] font-semibold leading-none text-white"
        aria-hidden="true"
      >
        {contagem}
      </span>
    )}
  </button>
);

export default BarraBusca;
