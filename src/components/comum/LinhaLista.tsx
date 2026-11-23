/**
 * LinhaLista — um item de lista no celular (regra 4, `.m-row` do plano):
 * 64–76px de altura, à esquerda a faixa de cor do canal OU um ícone, no meio
 * título + subtítulo (uma linha cada, cortadas com reticências), à direita
 * valor + legenda, e uma etiqueta opcional. A linha inteira é tocável e abre
 * os detalhes (normalmente uma FolhaDetalhes).
 *
 *   <LinhaLista canal="Airbnb" titulo="Ana Souza" subtitulo="Búzios · 27 nov → 1 dez"
 *     valor="R$ 2.938" legenda="A receber" tomLegenda="warning" aoTocar={() => abrir(r)} />
 *
 * `acao` é um botão à direita que funciona sozinho (ex.: "Atribuir"), sem
 * disparar o toque da linha. Use dentro de ListaLinhas/GrupoLista, que põem
 * o divisor entre as linhas.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { corDoCanalGrafico } from '@/components/graficos/tema';
import { ICONE_DO_TOM, TEXTO_DO_TOM, type Tom } from './cores';

export interface LinhaListaProps {
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  /** Nome do canal (Airbnb, Booking…): desenha a faixa colorida à esquerda */
  canal?: string | null;
  /** Cor CSS da faixa, quando não é um canal (ex.: hsl(var(--warning))) */
  corFaixa?: string;
  /** Ícone num quadrado à esquerda (no lugar da faixa) */
  icone?: LucideIcon;
  tomIcone?: Tom;
  /** Valor à direita (mono), já formatado */
  valor?: React.ReactNode;
  /** Legenda abaixo do valor (ex.: "Pago", "A receber") */
  legenda?: React.ReactNode;
  tomLegenda?: Tom;
  /** Etiqueta antes do valor (ex.: <Etiqueta tom="danger">Sem faxineira</Etiqueta>) */
  etiqueta?: React.ReactNode;
  /** Botão independente à direita (ex.: "Atribuir") */
  acao?: React.ReactNode;
  /** Toque na linha */
  aoTocar?: () => void;
  /** Ou: a linha é um link para esta rota */
  para?: string;
  className?: string;
}

const LinhaLista = ({
  titulo,
  subtitulo,
  canal,
  corFaixa,
  icone: Icone,
  tomIcone = 'brand',
  valor,
  legenda,
  tomLegenda = 'neutro',
  etiqueta,
  acao,
  aoTocar,
  para,
  className,
}: LinhaListaProps) => {
  const faixa = corFaixa ?? (canal ? corDoCanalGrafico(canal) : undefined);
  const tocavel = Boolean(aoTocar || para);
  // O alvo do toque cobre a linha inteira (after:inset-0); a `acao` fica acima dele
  const alvo = 'text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none';

  const corpo = (
    <>
      <span className="block truncate text-sm font-semibold text-gray-900">{titulo}</span>
      {subtitulo && <span className="block truncate text-xs text-gray-500">{subtitulo}</span>}
    </>
  );

  return (
    <div
      className={cn(
        'relative -mx-2 flex min-h-16 min-w-0 items-center gap-2.5 rounded-xl px-2 py-2.5',
        tocavel && 'transition-colors has-[.alvo-linha:active]:bg-gray-50 has-[.alvo-linha:focus-visible]:ring-2 has-[.alvo-linha:focus-visible]:ring-brand',
        className,
      )}
    >
      {faixa && <span className="w-1 shrink-0 self-stretch rounded-full" style={{ background: faixa }} aria-hidden="true" />}
      {Icone && !faixa && (
        <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-[10px]', ICONE_DO_TOM[tomIcone])}>
          <Icone className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        {para ? (
          <Link to={para} className={cn('alvo-linha block', alvo)}>
            {corpo}
          </Link>
        ) : aoTocar ? (
          <button type="button" onClick={aoTocar} className={cn('alvo-linha block w-full', alvo)}>
            {corpo}
          </button>
        ) : (
          corpo
        )}
      </div>

      {etiqueta && <div className="shrink-0">{etiqueta}</div>}

      {(valor !== undefined || legenda) && (
        <div className="max-w-[45%] shrink-0 text-right">
          {valor !== undefined && <span className="block truncate font-mono text-sm font-semibold tabular-nums text-gray-900">{valor}</span>}
          {legenda && <span className={cn('block truncate text-xs', tomLegenda === 'neutro' ? 'text-gray-500' : TEXTO_DO_TOM[tomLegenda])}>{legenda}</span>}
        </div>
      )}

      {acao && <div className="relative z-10 shrink-0">{acao}</div>}
    </div>
  );
};

export default LinhaLista;
