import { useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAIChat } from '@/hooks/useAIChat';
import { ChatHeader } from './ChatHeader';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { cn } from '@/lib/utils';

export const AIChat = () => {
  const { isOpen, messages, isLoading, sendMessage, toggleChat, clearChat } = useAIChat();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para última mensagem
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  return (
    <div className="fixed bottom-4 left-4 z-[9999]">
      {/* Botão flutuante quando fechado */}
      {!isOpen && (
        <Button
          onClick={toggleChat}
          size="lg"
          className="rounded-full shadow-lg hover:shadow-xl transition-all gap-2 animate-scale-in"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="font-medium">Chat AI</span>
        </Button>
      )}

      {/* Janela do chat quando aberto */}
      {isOpen && (
        <Card
          className={cn(
            'w-[400px] h-[600px] flex flex-col shadow-2xl',
            'animate-slide-in-right'
          )}
        >
          <ChatHeader onClose={toggleChat} onClear={clearChat} />

          <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <MessageSquare className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Olá! Como posso ajudar?</h3>
                <p className="text-sm text-muted-foreground">
                  Envie uma mensagem ou um print de reserva e eu vou processar automaticamente.
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))
            )}
          </ScrollArea>

          <ChatInput onSend={sendMessage} isLoading={isLoading} />
        </Card>
      )}
    </div>
  );
};
