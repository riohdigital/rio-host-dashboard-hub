import { useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAIChat } from '@/hooks/useAIChat';
import { useChatNotifications } from '@/hooks/useChatNotifications';
import { ChatHeader } from './ChatHeader';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { WelcomeMessage } from './WelcomeMessage';
import { cn } from '@/lib/utils';

export const AIChat = () => {
  const {
    isOpen,
    messages,
    isLoading,
    unreadCount,
    searchQuery,
    selectedCategory,
    setSearchQuery,
    setSelectedCategory,
    sendMessage,
    toggleChat,
    clearChat,
    exportChat,
    addReaction,
  } = useAIChat();

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Habilitar notificações desktop
  useChatNotifications(isOpen, unreadCount);

  // ========== CORREÇÃO DO AUTO-SCROLL ==========
  useEffect(() => {
    if (isOpen && scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        // Usar setTimeout para garantir renderização do DOM
        setTimeout(() => {
          scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: 'smooth',
          });
        }, 100);
      }
    }
  }, [messages, isOpen]); // ← IMPORTANTE: isOpen nas dependências

  return (
    <div className="fixed bottom-4 right-4 z-[9999]">
      {/* Botão flutuante quando fechado */}
      {!isOpen && (
        <Button
          onClick={toggleChat}
          size="lg"
          className="rounded-full shadow-lg hover:shadow-[0_8px_30px_rgba(139,92,246,0.4)] transition-all duration-300 gap-2 animate-pulse-soft hover:scale-110 hover:rotate-3 active:scale-95 bg-gradient-primary text-white border-0 relative"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="font-medium">Chat AI</span>
          {unreadCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center">
              {unreadCount}
            </Badge>
          )}
        </Button>
      )}

      {/* Janela do chat quando aberto */}
      {isOpen && (
        <Card
          className={cn(
            'w-[400px] h-[600px] flex flex-col shadow-2xl shadow-purple-500/20 rounded-2xl',
            'animate-slide-in-right'
          )}
        >
          <ChatHeader
            onClose={toggleChat}
            onClear={clearChat}
            onExport={exportChat}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />

          <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
            {messages.length === 0 ? (
              <WelcomeMessage onQuickReply={sendMessage} />
            ) : (
              <>
                {messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    onReact={addReaction}
                  />
                ))}
                {isLoading && <TypingIndicator />}
              </>
            )}
          </ScrollArea>

          <ChatInput onSend={sendMessage} isLoading={isLoading} />
        </Card>
      )}
    </div>
  );
};
