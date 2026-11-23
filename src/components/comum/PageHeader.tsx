import React from 'react';
import { MoreVertical, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface AcaoSecundaria {
  rotulo: string;
  icone?: LucideIcon;
  aoClicar: () => void;
  desabilitada?: boolean;
  perigosa?: boolean;
}

interface PageHeaderProps {
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  /** Ação principal (ex.: botão "Nova reserva"); fica sempre visível */
  acao?: React.ReactNode;
  /** Ações extras: botões no desktop, menu ⋮ no celular */
  acoes?: AcaoSecundaria[];
  /** Conteúdo livre à direita, só no desktop (ex.: seletores) */
  extra?: React.ReactNode;
  className?: string;
}

/**
 * Cabeçalho padrão das telas.
 * - Computador (≥ 1024px): título grande, descrição e ações.
 * - Celular e tablet: o nome da tela já está na barra do topo (regra 1 do
 *   plano), então título e descrição saem da vista (ficam só para leitor de
 *   tela); sobram as ações: a principal à mão e as demais no menu ⋮. Sem
 *   ação nenhuma, o cabeçalho não ocupa espaço.
 */
const PageHeader = ({ titulo, descricao, acao, acoes = [], extra, className }: PageHeaderProps) => (
  <div
    className={cn(
      'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
      !acao && acoes.length === 0 && !extra && 'max-lg:sr-only',
      className,
    )}
  >
    <div className="min-w-0 max-lg:sr-only">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{titulo}</h1>
      {descricao && <p className="mt-1 text-sm text-gray-600 sm:text-base">{descricao}</p>}
    </div>
    {(acao || acoes.length > 0 || extra) && (
      <div className="flex items-center gap-2">
        {extra && <div className="hidden items-center gap-2 sm:flex">{extra}</div>}
        {acoes.map((a) => (
          <Button
            key={a.rotulo}
            variant="outline"
            onClick={a.aoClicar}
            disabled={a.desabilitada}
            className={cn('hidden gap-2 sm:inline-flex', a.perigosa && 'text-danger-600')}
          >
            {a.icone && <a.icone className="h-4 w-4" aria-hidden="true" />}
            {a.rotulo}
          </Button>
        ))}
        {acao && <div className="flex-1 sm:flex-none [&>button]:w-full sm:[&>button]:w-auto">{acao}</div>}
        {acoes.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 sm:hidden" aria-label="Mais ações">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              {acoes.map((a) => (
                <DropdownMenuItem
                  key={a.rotulo}
                  onClick={a.aoClicar}
                  disabled={a.desabilitada}
                  className={cn('min-h-11 gap-2', a.perigosa && 'text-danger-600')}
                >
                  {a.icone && <a.icone className="h-4 w-4" aria-hidden="true" />}
                  {a.rotulo}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    )}
  </div>
);

export default PageHeader;
