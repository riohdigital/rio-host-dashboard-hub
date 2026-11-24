import { type ReactNode } from 'react';
import { ChatMessage as ChatMessageType } from '@/types/chat';
import { Clock, AlertCircle, Check, ThumbsUp, ThumbsDown, Copy, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import MarcaIA from '@/components/comum/MarcaIA';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';

interface ChatMessageProps {
  message: ChatMessageType;
  onReact?: (messageId: string, reaction: 'thumbs_up' | 'thumbs_down') => void;
  onRetry?: (messageId: string) => void;
}

/** Texto puro dos filhos de uma célula (para saber se é número) */
const textoDe = (n: ReactNode): string => {
  if (n === null || n === undefined || typeof n === 'boolean') return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(textoDe).join('');
  if (typeof n === 'object' && 'props' in n) return textoDe((n as { props: { children?: ReactNode } }).props.children);
  return '';
};
const pareceNumero = (t: string) => /^[\s+\-−]*(R\$\s*)?[\d.,\s]+%?\s*$/.test(t) && /\d/.test(t);

const categoryConfig: Record<string, { label: string; color: string }> = {
  financeiro: { label: 'Financeiro', color: 'bg-success-50 text-success-700' },
  reservas: { label: 'Reservas', color: 'bg-info-50 text-info-700' },
  limpeza: { label: 'Limpeza', color: 'bg-brand-50 text-brand-700' },
  geral: { label: 'Geral', color: 'bg-gray-100 text-gray-600' },
};

export const ChatMessage = ({ message, onReact, onRetry }: ChatMessageProps) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  // A imagem ampliada volta aberta depois de recarregar (endereços temporários do navegador não são guardados)
  const [imagemAberta, setImagemAberta] = useEstadoPersistente<{ url: string; nome: string } | null>(`chat.imagem.${message.id}`, null, {
    aceita: (v) => v === null || (typeof v === 'object' && /^https?:/.test(String((v as { url?: unknown }).url ?? ''))),
  });

  const getStatusIcon = () => {
    switch (message.status) {
      case 'sending':
        return <Clock className="h-3 w-3 text-muted-foreground" aria-label="Enviando" />;
      case 'sent':
        return <Check className="h-3 w-3 text-muted-foreground" aria-label="Enviada" />;
      case 'error':
        return <AlertCircle className="h-3 w-3 text-destructive" aria-label="Erro ao enviar" />;
      default:
        return null;
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success('Resposta copiada');
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const hora = message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const categoria = message.category ? categoryConfig[message.category] : null;

  const anexos = message.attachments && message.attachments.length > 0 && (
    <div className="mt-2 flex flex-wrap gap-2">
      {message.attachments.map((a) =>
        a.type === 'image' ? (
          <button
            key={a.id}
            type="button"
            onClick={() => setImagemAberta({ url: a.url, nome: a.name })}
            className="overflow-hidden rounded-xl border"
            aria-label={`Ampliar imagem ${a.name}`}
          >
            <img src={a.url} alt={a.name} className="h-28 w-auto max-w-[220px] object-cover" />
          </button>
        ) : null,
      )}
    </div>
  );

  const janelaImagem = (
    <Dialog open={!!imagemAberta} onOpenChange={(a) => !a && setImagemAberta(null)}>
      <DialogContent className="max-w-[95vw] border-0 bg-transparent p-0 shadow-none sm:max-w-3xl">
        <DialogTitle className="sr-only">{imagemAberta?.nome}</DialogTitle>
        {imagemAberta && (
          <img src={imagemAberta.url} alt={imagemAberta.nome} className="max-h-[85dvh] w-full rounded-xl object-contain" />
        )}
      </DialogContent>
    </Dialog>
  );

  // Mensagem da pessoa: balão roxo à direita, sem avatar
  if (isUser) {
    return (
      <div className="mb-4 flex flex-col items-end animate-fade-in">
        {message.content && (
          <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-brand px-3.5 py-2.5 text-[15px] leading-relaxed text-brand-foreground">
            {message.content}
          </div>
        )}
        {anexos}
        <div className="mt-1 flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          {categoria && <Badge variant="outline" className={cn('border-0 text-[10px]', categoria.color)}>{categoria.label}</Badge>}
          <span className="font-mono">{hora}</span>
          {getStatusIcon()}
        </div>
        {janelaImagem}
      </div>
    );
  }

  // Resposta da IA: bloco largo à esquerda, com a marca "IA"
  return (
    <div className="mb-5 animate-fade-in">
      <div className="mb-1.5 flex items-center gap-2">
        <MarcaIA />
        {categoria && <Badge variant="outline" className={cn('border-0 text-[10px]', categoria.color)}>{categoria.label}</Badge>}
        <span className="font-mono text-xs text-muted-foreground">{hora}</span>
      </div>

      <div className="prose prose-sm max-w-none break-words text-[15px] text-ink prose-p:my-0">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
            ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1 marker:text-muted-foreground">{children}</ul>,
            ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1 marker:text-muted-foreground">{children}</ol>,
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
            em: ({ children }) => <em className="italic">{children}</em>,
            code: ({ children }) => (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[13px] before:content-none after:content-none">{children}</code>
            ),
            // Tabelas: rolam de lado, só linhas horizontais, números à direita em mono
            table: ({ children }) => (
              <div className="no-scrollbar -mx-1 my-3 overflow-x-auto px-1">
                <table className="my-0 w-full border-collapse text-sm">{children}</table>
              </div>
            ),
            th: ({ children }) => (
              <th className={cn('whitespace-nowrap border-b-2 border-gray-200 px-2.5 py-2 font-semibold text-gray-600', pareceNumero(textoDe(children)) ? 'text-right' : 'text-left')}>
                {children}
              </th>
            ),
            td: ({ children }) => {
              const numero = pareceNumero(textoDe(children));
              return (
                <td className={cn('border-b border-gray-100 px-2.5 py-2', numero && 'whitespace-nowrap text-right font-mono tabular-nums')}>
                  {children}
                </td>
              );
            },
            img: ({ src, alt }) => (
              <button type="button" onClick={() => src && setImagemAberta({ url: src, nome: alt || 'Imagem' })} className="block">
                <img src={src} alt={alt} className="max-h-64 rounded-xl" />
              </button>
            ),
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
      {anexos}

      {isAssistant && (
        <div className="mt-1.5 flex items-center gap-0.5 text-muted-foreground">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={copiar} aria-label="Copiar resposta">
            <Copy className="h-4 w-4" />
          </Button>
          {onRetry && (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onRetry(message.id)} aria-label="Tentar de novo">
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
          {onReact && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-9 w-9', message.reaction === 'thumbs_up' && 'text-success-600')}
                onClick={() => onReact(message.id, 'thumbs_up')}
                aria-label="Resposta útil"
                aria-pressed={message.reaction === 'thumbs_up'}
              >
                <ThumbsUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-9 w-9', message.reaction === 'thumbs_down' && 'text-danger-600')}
                onClick={() => onReact(message.id, 'thumbs_down')}
                aria-label="Resposta não ajudou"
                aria-pressed={message.reaction === 'thumbs_down'}
              >
                <ThumbsDown className="h-4 w-4" />
              </Button>
            </>
          )}
          {getStatusIcon()}
        </div>
      )}
      {janelaImagem}
    </div>
  );
};
