import { Bot, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

interface ChatHeaderProps {
  onClose: () => void;
  onClear: () => void;
}

export const ChatHeader = ({ onClose, onClear }: ChatHeaderProps) => {
  return (
    <div className="flex items-center justify-between p-5 border-b bg-gradient-primary rounded-t-2xl">
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
  );
};
