import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Esqueleto de lista/cartões enquanto os dados carregam */
export const EsqueletoLista = ({ linhas = 5, className }: { linhas?: number; className?: string }) => (
  <div className={cn('grid gap-3', className)} aria-busy="true" aria-label="Carregando">
    {Array.from({ length: linhas }).map((_, i) => (
      <div key={i} className="flex flex-col gap-2.5 rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    ))}
  </div>
);

export const EsqueletoIndicadores = ({ quantidade = 4 }: { quantidade?: number }) => (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-busy="true" aria-label="Carregando">
    {Array.from({ length: quantidade }).map((_, i) => (
      <div key={i} className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-6 w-1/2" />
      </div>
    ))}
  </div>
);
