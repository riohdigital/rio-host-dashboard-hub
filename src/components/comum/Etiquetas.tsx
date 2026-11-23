import React from 'react';
import { cn } from '@/lib/utils';
import { corDoCanal, type Tom, TONS, tomDoStatus } from './cores';

export const Etiqueta = ({
  tom = 'neutro',
  className,
  children,
}: {
  tom?: Tom;
  className?: string;
  children: React.ReactNode;
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold',
      TONS[tom],
      className,
    )}
  >
    {children}
  </span>
);

export const EtiquetaStatus = ({ status, className }: { status?: string | null; className?: string }) => (
  <Etiqueta tom={tomDoStatus(status)} className={className}>
    {status || 'Pendente'}
  </Etiqueta>
);

export const EtiquetaPlataforma = ({ plataforma, className }: { plataforma?: string | null; className?: string }) => {
  const cor = corDoCanal(plataforma);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold',
        cor.fundo,
        cor.texto,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cor.ponto)} aria-hidden="true" />
      {plataforma || '—'}
    </span>
  );
};
