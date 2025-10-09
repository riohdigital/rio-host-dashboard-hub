import { ChatMessage as ChatMessageType } from '@/types/chat';
import { Bot, User, Clock, AlertCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

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
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          
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
