import { Home } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Marca da Rioh Host: selo com a casa + nome em Manrope */
const MarcaRioh = ({ compacta = false, className }: { compacta?: boolean; className?: string }) => (
  <span className={cn('flex items-center gap-2.5', className)}>
    <span
      aria-hidden="true"
      className={cn(
        'grid place-items-center rounded-xl bg-gradient-primary text-white shadow-sm',
        compacta ? 'h-8 w-8' : 'h-9 w-9',
      )}
    >
      <Home className={compacta ? 'h-4 w-4' : 'h-[18px] w-[18px]'} strokeWidth={2.2} />
    </span>
    <span className={cn('font-display font-extrabold tracking-tight text-ink', compacta ? 'text-base' : 'text-lg')}>
      Rioh <span className="text-brand">Host</span>
    </span>
  </span>
);

export default MarcaRioh;
