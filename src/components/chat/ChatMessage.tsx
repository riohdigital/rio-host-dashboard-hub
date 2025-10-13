import { ChatMessage as ChatMessageType } from '@/types/chat';
import { Bot, User, Clock, AlertCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: ChatMessageType;
}

export const ChatMessage = ({ message }: ChatMessageProps) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const getStatusIcon = () => {
    if (!message.status) return null;
    
    switch (message.status) {
      case 'sending':
        return <Clock className="w-3 h-3 text-muted-foreground" />;
      case 'sent':
        return <Check className="w-3 h-3 text-muted-foreground" />;
      case 'error':
        return <AlertCircle className="w-3 h-3 text-destructive" />;
      default:
        return null;
    }
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
                  <code className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono">
                    {children}
                  </code>
                ),
                h1: ({ children }) => (
                  <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>
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
                <div key={attachment.id} className="rounded overflow-hidden">
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

        {/* Timestamp and Status */}
        <div className={cn('flex items-center gap-1 mt-1 px-1', isUser && 'flex-row-reverse')}>
          <span className="text-xs text-muted-foreground">
            {message.timestamp.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {getStatusIcon()}
        </div>
      </div>
    </div>
  );
};
