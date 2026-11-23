import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LogOut, MoreHorizontal, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import GlobalFilters from './GlobalFilters';
import MarcaRioh from './MarcaRioh';
import { useResumoFiltros } from './resumoFiltros';
import { ICONE_GESTOR, type ItemNavegacao, rotaAtiva, tituloDaRota, useNavegacao, useSair } from './navegacao';

/** Abas fixas da barra inferior; o resto vai para "Mais" */
const ABAS = ['/dashboard', '/reservas', '/calendario', '/despesas'];

/**
 * Navegação do celular e tablet (abaixo de 1024px): barra superior fina com
 * título e filtros, barra inferior com 4 abas + "Mais" em gaveta.
 */
const NavegacaoCelular = () => {
  const { itens, itensGestor, mostrarGestor, isCleaner } = useNavegacao();
  const sair = useSair();
  const { pathname } = useLocation();
  const resumo = useResumoFiltros();
  const [maisAberto, setMaisAberto] = useState(false);
  const [filtrosAberto, setFiltrosAberto] = useState(false);

  const titulo = tituloDaRota(pathname);

  // Faxineira: só o topo, com o botão de sair
  if (isCleaner) {
    return (
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 pt-safe-t backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <MarcaRioh compacta />
          <Button variant="outline" size="sm" onClick={sair} className="gap-2">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sair
          </Button>
        </div>
      </header>
    );
  }

  const abas = ABAS.map((c) => itens.find((i) => i.caminho === c)).filter(Boolean) as ItemNavegacao[];
  const resto = itens.filter((i) => !ABAS.includes(i.caminho));
  const restoAtivo =
    resto.some((i) => rotaAtiva(pathname, i)) || itensGestor.some((i) => rotaAtiva(pathname, i));

  const linhaMais = (item: ItemNavegacao) => (
    <NavLink
      key={item.caminho}
      to={item.caminho}
      end={item.exato}
      onClick={() => setMaisAberto(false)}
      className={({ isActive }) =>
        cn(
          'flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors',
          isActive ? 'bg-brand-accent text-brand-accent-foreground' : 'text-ink active:bg-surface',
        )
      }
    >
      <item.icone className="h-5 w-5 shrink-0" aria-hidden="true" />
      {item.nome}
    </NavLink>
  );

  return (
    <>
      {/* Barra superior */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 pt-safe-t backdrop-blur lg:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <MarcaRioh compacta className="[&>span:last-child]:hidden" />
          <button
            type="button"
            onClick={() => setFiltrosAberto(true)}
            className="min-w-0 flex-1 text-left"
            aria-label={`Filtros: ${resumo.texto}`}
          >
            <span className="block truncate font-display text-base font-bold leading-tight text-ink">{titulo}</span>
            <span className="block truncate text-xs text-gray-500">{resumo.texto}</span>
          </button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setFiltrosAberto(true)}
            aria-label="Abrir filtros"
            className="relative shrink-0"
          >
            <SlidersHorizontal className="h-5 w-5" />
            {resumo.alterado && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-accent" aria-hidden="true" />
            )}
          </Button>
        </div>
      </header>

      {/* Barra inferior */}
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-safe-b backdrop-blur lg:hidden"
      >
        <div className="mx-auto grid h-tabbar max-w-xl grid-cols-5">
          {abas.map((item) => (
            <NavLink
              key={item.caminho}
              to={item.caminho}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-1 text-[11px] font-medium',
                  isActive ? 'font-semibold text-ink' : 'text-gray-500',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'grid h-7 w-12 place-items-center rounded-full transition-colors',
                      isActive && 'bg-brand-accent text-brand-accent-foreground',
                    )}
                  >
                    <item.icone className="h-5 w-5" aria-hidden="true" />
                  </span>
                  {item.curto ?? item.nome}
                </>
              )}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMaisAberto(true)}
            aria-haspopup="dialog"
            aria-expanded={maisAberto}
            className={cn(
              'flex flex-col items-center justify-center gap-1 text-[11px] font-medium',
              restoAtivo || maisAberto ? 'font-semibold text-ink' : 'text-gray-500',
            )}
          >
            <span
              className={cn(
                'grid h-7 w-12 place-items-center rounded-full transition-colors',
                restoAtivo && 'bg-brand-accent text-brand-accent-foreground',
              )}
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            </span>
            Mais
          </button>
        </div>
      </nav>

      {/* Gaveta "Mais" */}
      <Drawer open={maisAberto} onOpenChange={setMaisAberto} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[85dvh] lg:hidden">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle className="font-display">Mais opções</DrawerTitle>
            <DrawerDescription className="sr-only">Outras telas do painel</DrawerDescription>
          </DrawerHeader>
          <nav aria-label="Mais opções" className="overflow-y-auto overscroll-contain px-3 pb-2">
            <div className="grid gap-1">{resto.filter((i) => i.caminho !== '/configuracoes').map(linhaMais)}</div>

            {mostrarGestor && (
              <div className="mt-3 border-t border-gray-100 pt-3">
                <p className="flex items-center gap-2 px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <ICONE_GESTOR className="h-4 w-4" aria-hidden="true" />
                  Painel Gestor
                </p>
                <div className="grid gap-1">{itensGestor.map(linhaMais)}</div>
              </div>
            )}

            <div className="mt-3 grid gap-1 border-t border-gray-100 pt-3">
              {resto.filter((i) => i.caminho === '/configuracoes').map(linhaMais)}
            </div>
          </nav>
          <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button variant="outline" onClick={sair} className="w-full gap-2">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sair
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Gaveta de filtros */}
      <Drawer open={filtrosAberto} onOpenChange={setFiltrosAberto} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[90dvh] lg:hidden">
          <DrawerHeader className="pb-0 text-left">
            <DrawerTitle className="font-display">Filtros</DrawerTitle>
            <DrawerDescription>{resumo.texto}</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto overscroll-contain pb-2">
            <GlobalFilters variante="gaveta" />
          </div>
          <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button onClick={() => setFiltrosAberto(false)} className="w-full">
              Ver resultados
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default NavegacaoCelular;
