import { ChatMessage as ChatMessageType } from '@/types/chat';
import { Bot, User, Clock, AlertCircle, Check, ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ChatMessageProps {
  message: ChatMessageType;
  onReact?: (messageId: string, reaction: 'thumbs_up' | 'thumbs_down') => void;
}

export const ChatMessage = ({ message, onReact }: ChatMessageProps) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const getStatusIcon = () => {
    if (!message.status) return null;

    switch (message.status) {
      case 'sending':
        return <Clock className="w-3 h-3 text-muted-foreground animate-spin" />;
      case 'sent':
        return <Check className="w-3 h-3 text-muted-foreground" />;
      case 'error':
        return <AlertCircle className="w-3 h-3 text-destructive" />;
      default:
        return null;
    }
  };

  const getCategoryBadge = () => {
    if (!message.category) return null;

    const categoryConfig: Record<string, { label: string; color: string }> = {
      financeiro: { label: 'Financeiro', color: 'bg-green-500/10 text-green-500' },
      reservas: { label: 'Reservas', color: 'bg-blue-500/10 text-blue-500' },
      limpeza: { label: 'Limpeza', color: 'bg-purple-500/10 text-purple-500' },
      geral: { label: 'Geral', color: 'bg-gray-500/10 text-gray-500' },
    };

    const config = categoryConfig[message.category];
    return (
      <Badge variant="outline" className={cn('text-xs', config.color)}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div
      className={cn(
        'flex gap-3 mb-4 animate-fade-in',
        isUser && 'flex-row-reverse'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser && 'bg-gradient-accent',
          isAssistant && 'bg-muted'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {/* Message Content */}
      <div className={cn('flex-1 max-w-[70%]', isUser && 'flex flex-col items-end')}>
        {/* Category Badge */}
        {message.category && (
          <div className={cn('mb-1', isUser && 'flex justify-end')}>
            {getCategoryBadge()}
          </div>
        )}

        <div
          className={cn(
            'rounded-lg p-3 break-words transition-all duration-200 hover:shadow-md',
            isUser && 'bg-gradient-primary text-white',
            isAssistant && 'bg-muted text-foreground border border-border/50'
          )}
        >
          <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="ml-4 mb-2 space-y-1 list-disc marker:text-muted-foreground">
                    {children}
                  </ul>
                ),
                li: ({ children }) => (
                  <li className="leading-relaxed">{children}</li>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-foreground">{children}</strong>
                ),
                em: ({ children }) => (
                  <em className="italic">{children}</em>
                ),
                code: ({ children }) => (
                  <code className="px-1.5 py-0.5 rounded bg-muted/50 text-sm font-mono border border-border/50">
                    {children}
                  </code>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-2">
                    <table className="w-full border-collapse border border-border rounded-lg">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-border bg-muted px-3 py-2 text-left font-semibold">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-border px-3 py-2">
                    {children}
                  </td>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
          
          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map((attachment) => (
                <div key={attachment.id} className="rounded overflow-hidden border border-border">
                  {attachment.type === 'image' && (
                    <img
                      src={attachment.url}
                      alt={attachment.name}
                      className="max-w-full h-auto rounded"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timestamp, Status e Reações */}
        <div className={cn('flex items-center gap-2 mt-1 px-1', isUser && 'flex-row-reverse')}>
          <span className="text-xs text-muted-foreground">
            {message.timestamp.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {getStatusIcon()}

          {/* Botões de Reação (só para mensagens do assistente) */}
          {isAssistant && onReact && (
            <div className="flex gap-1 ml-2">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-6 w-6',
                  message.reaction === 'thumbs_up' && 'text-green-500'
                )}
                onClick={() => onReact(message.id, 'thumbs_up')}
              >
                <ThumbsUp className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-6 w-6',
                  message.reaction === 'thumbs_down' && 'text-red-500'
                )}
                onClick={() => onReact(message.id, 'thumbs_down')}
              >
                <ThumbsDown className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
