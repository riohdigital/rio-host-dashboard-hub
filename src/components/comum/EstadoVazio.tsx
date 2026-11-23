import React from 'react';
import { Inbox, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EstadoVazioProps {
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  icone?: LucideIcon;
  acao?: React.ReactNode;
  className?: string;
}

const EstadoVazio = ({ titulo, descricao, icone: Icone = Inbox, acao, className }: EstadoVazioProps) => (
  <div className={cn('flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-10 text-center', className)}>
    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand">
      <Icone className="h-6 w-6" aria-hidden="true" />
    </span>
    <p className="font-display text-base font-bold text-ink">{titulo}</p>
    {descricao && <p className="max-w-sm text-sm text-gray-600">{descricao}</p>}
    {acao}
  </div>
);

export default EstadoVazio;
