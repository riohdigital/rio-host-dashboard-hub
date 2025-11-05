import { Bot, Trash2, X, Search, Download, Filter } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState } from 'react';

interface ChatHeaderProps {
  onClose: () => void;
  onClear: () => void;
  onExport: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

export const ChatHeader = ({
  onClose,
  onClear,
  onExport,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
}: ChatHeaderProps) => {
  const [showSearch, setShowSearch] = useState(false);

  const categories = [
    { value: 'all', label: 'Todas' },
    { value: 'financeiro', label: 'Financeiro' },
    { value: 'reservas', label: 'Reservas' },
    { value: 'limpeza', label: 'Limpeza' },
    { value: 'geral', label: 'Geral' },
  ];

  return (
    <div className="bg-gradient-primary rounded-t-2xl">
      {/* Linha 1: Título e ações */}
      <div className="flex items-center justify-between p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-white/20 backdrop-blur-sm">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Assistente RiohHost</h3>
            <p className="text-xs text-white/80">Sempre pronto para ajudar</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20">
                <Filter className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {categories.map(cat => (
                <DropdownMenuItem
                  key={cat.value}
                  onClick={() => onCategoryChange(cat.value)}
                  className={selectedCategory === cat.value ? 'bg-accent' : ''}
                >
                  {cat.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={onExport}
          >
            <Download className="w-4 h-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20">
                <Trash2 className="w-4 h-4" />
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
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Linha 2: Busca (condicional) */}
      {showSearch && (
        <div className="p-3 border-b border-white/10">
          <Input
            placeholder="Buscar mensagens..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
          />
        </div>
      )}
    </div>
  );
};
