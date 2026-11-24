import { useState, useRef, KeyboardEvent } from 'react';
import { Paperclip, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';

interface ChatInputProps {
  onSend: (content: string, attachments?: File[]) => void;
  isLoading: boolean;
}

export const ChatInput = ({ onSend, isLoading }: ChatInputProps) => {
  // O texto ainda não enviado volta depois de recarregar (anexos não: arquivo não cabe no storage)
  const [message, setMessage] = useEstadoPersistente('chat.rascunho', '');
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (message.trim() || attachments.length > 0) {
      onSend(message, attachments);
      setMessage('');
      setAttachments([]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="shrink-0 border-t bg-background px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
      {/* Preview de anexos */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((file, index) => (
            <div
              key={index}
              className="relative group rounded-lg overflow-hidden border bg-muted"
            >
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="w-20 h-20 object-cover"
              />
              <button
                onClick={() => removeAttachment(index)}
                className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground"
                aria-label="Remover anexo"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input e botões */}
      <div className="flex gap-2 items-end">
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 flex-shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          aria-label="Anexar imagem"
        >
          <Paperclip className="w-4 h-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte ou envie um print..."
          rows={1}
          className={cn(
            'min-h-[44px] max-h-[120px] resize-none rounded-2xl py-2.5',
            'focus-visible:ring-2 focus-visible:ring-brand-500'
          )}
          disabled={isLoading}
        />

        <Button
          onClick={handleSend}
          disabled={isLoading || (!message.trim() && attachments.length === 0)}
          size="icon"
          className="h-11 w-11 flex-shrink-0 border-0 bg-brand text-brand-foreground hover:bg-brand-hover"
          aria-label="Enviar mensagem"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      <p className="mt-1.5 hidden text-xs text-muted-foreground sm:block">
        Enter para enviar • Shift+Enter para nova linha
      </p>
    </div>
  );
};
