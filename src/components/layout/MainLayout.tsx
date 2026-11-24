import React from 'react';
import Sidebar from './Sidebar';
import NavegacaoCelular from './NavegacaoCelular';
import LembrarRolagem from './LembrarRolagem';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: React.ReactNode;
}

/**
 * Casca das telas logadas.
 * - A partir de 1024px: menu lateral fixo.
 * - Abaixo: barra superior fina + barra inferior com abas (faxineira só tem o
 *   topo), margem lateral de 16px e 12px no topo. A classe `casca` liga as
 *   regras de celular do index.css (títulos de bloco iguais, 12px entre blocos).
 */
const MainLayout = ({ children }: MainLayoutProps) => {
  const { isCleaner } = useUserRole();

  return (
    <div className="min-h-screen min-h-dvh bg-surface">
      <Sidebar />
      <NavegacaoCelular />
      <LembrarRolagem />
      <div className="lg:pl-64">
        <main
          className={cn(
            'casca mx-auto w-full min-w-0 max-w-[1600px] px-4 pt-3 lg:p-8',
            // Espaço para a barra inferior do celular
            isCleaner ? 'pb-[calc(1.5rem+env(safe-area-inset-bottom))]' : 'pb-[calc(theme(spacing.tabbar)+1.5rem+env(safe-area-inset-bottom))]',
            'lg:pb-8',
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
