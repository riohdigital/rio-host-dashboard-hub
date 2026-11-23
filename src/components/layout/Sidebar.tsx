import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import GlobalFilters from './GlobalFilters';
import MarcaRioh from './MarcaRioh';
import { ICONE_GESTOR, type ItemNavegacao, useNavegacao, useSair } from './navegacao';

const classeItem = (ativo: boolean, pequeno = false) =>
  cn(
    'flex items-center gap-3 rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    pequeno ? 'min-h-10 px-3 text-sm' : 'min-h-11 px-3 text-[15px]',
    ativo ? 'bg-brand-accent text-brand-accent-foreground shadow-sm' : 'text-ink hover:bg-surface',
  );

const LinkMenu = ({ item, pequeno }: { item: ItemNavegacao; pequeno?: boolean }) => (
  <NavLink to={item.caminho} end={item.exato} className={({ isActive }) => classeItem(isActive, pequeno)}>
    <item.icone className={pequeno ? 'h-4 w-4 shrink-0' : 'h-5 w-5 shrink-0'} aria-hidden="true" />
    <span className="truncate">{item.nome}</span>
  </NavLink>
);

/**
 * Menu lateral (telas a partir de 1024px). Fica montado também no celular,
 * escondido por CSS, porque o GlobalFilters daqui ajusta a seleção inicial de
 * imóveis dos usuários sem acesso total.
 */
const Sidebar = () => {
  const { itens, itensGestor, mostrarGestor, isCleaner } = useNavegacao();
  const sair = useSair();
  const location = useLocation();

  const secaoGestor = location.pathname.startsWith('/painel-gestor');
  const [gestorAberto, setGestorAberto] = useState(secaoGestor);

  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-gray-200 bg-white lg:flex"
      aria-label="Menu principal"
    >
      <div className="flex h-16 shrink-0 items-center px-5">
        <MarcaRioh />
      </div>

      {/* Filtros globais: ocultos para faxineiras */}
      {!isCleaner && (
        <div className="mx-3 mb-2 rounded-2xl bg-surface py-1">
          <GlobalFilters />
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="space-y-1">
          {itens.map((item) => (
            <li key={item.caminho}>
              <LinkMenu item={item} />
            </li>
          ))}

          {mostrarGestor && (
            <li>
              <button
                type="button"
                onClick={() => setGestorAberto(!gestorAberto)}
                aria-expanded={gestorAberto}
                className={cn(
                  'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors',
                  secaoGestor ? 'bg-brand/10 text-brand' : 'text-ink hover:bg-surface',
                )}
              >
                <ICONE_GESTOR className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="flex-1 text-left">Painel Gestor</span>
                {gestorAberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>

              {gestorAberto && (
                <ul className="ml-5 mt-1 space-y-1 border-l-2 border-brand/20 pl-3">
                  {itensGestor.map((item) => (
                    <li key={item.caminho}>
                      <LinkMenu item={item} pequeno />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )}
        </ul>
      </nav>

      <div className="border-t border-gray-200 p-3">
        <button
          type="button"
          onClick={sair}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-ink transition-colors hover:bg-surface"
        >
          <LogOut className="h-5 w-5" aria-hidden="true" />
          Sair
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
