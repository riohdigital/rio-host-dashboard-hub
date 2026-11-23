import { Trash2, X, Search, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';
import MarcaIA from '@/components/comum/MarcaIA';
import { cn } from '@/lib/utils';

interface ChatHeaderProps {
  onClose: () => void;
  onClear: () => void;
  onExport: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

const categories = [
  { value: 'all', label: 'Todas' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'reservas', label: 'Reservas' },
  { value: 'limpeza', label: 'Limpeza' },
  { value: 'geral', label: 'Geral' },
];

export const ChatHeader = ({
  onClose,
  onClear,
  onExport,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
}: ChatHeaderProps) => {
  // Busca e categorias ficam atrás da lupa
  const [showSearch, setShowSearch] = useState(Boolean(searchQuery) || selectedCategory !== 'all');

  return (
    <div className="shrink-0 border-b bg-background pt-safe-t">
      <div className="flex h-14 items-center justify-between gap-2 px-3">
        <div className="flex min-w-0 items-center gap-2 pl-1">
          <MarcaIA />
          <h2 className="truncate font-display text-base font-bold text-ink">Assistente Rioh Host</h2>
        </div>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-10 w-10', showSearch && 'bg-brand-50 text-brand')}
            onClick={() => setShowSearch(!showSearch)}
            aria-label="Buscar nas mensagens"
            aria-expanded={showSearch}
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={onExport} aria-label="Exportar conversa">
            <Download className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Limpar histórico">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar histórico?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Todo o histórico de conversas será removido.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onClear}>Limpar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={onClose} aria-label="Fechar assistente">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {showSearch && (
        <div className="space-y-2 px-3 pb-3">
          <Input
            type="search"
            placeholder="Buscar mensagens..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10"
            autoFocus
          />
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => onCategoryChange(cat.value)}
                aria-pressed={selectedCategory === cat.value}
                className={cn(
                  'min-h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors',
                  selectedCategory === cat.value ? 'border-brand bg-brand text-brand-foreground' : 'bg-background text-gray-600 hover:bg-surface',
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
