import { useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAIChat } from '@/hooks/useAIChat';
import { useChatNotifications } from '@/hooks/useChatNotifications';
import { useEhCelular } from '@/hooks/useMidia';
import { ChatHeader } from './ChatHeader';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { SugestoesIniciais, WelcomeMessage } from './WelcomeMessage';
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
  const celular = useEhCelular();

  // Habilitar notificações desktop
  useChatNotifications(isOpen, unreadCount);

  // Rola até a última mensagem ao abrir e a cada mensagem nova
  useEffect(() => {
    if (isOpen && scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        setTimeout(() => {
          scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
        }, 100);
      }
    }
  }, [messages, isOpen, isLoading]);

  // Celular: a conversa ocupa a tela; trava a rolagem da página por trás
  useEffect(() => {
    if (!(isOpen && celular)) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [isOpen, celular]);

  /** Tentar de novo: reenvia a pergunta que originou a resposta */
  const tentarDeNovo = (idResposta: string) => {
    const i = messages.findIndex((m) => m.id === idResposta);
    for (let j = i - 1; j >= 0; j--) {
      if (messages[j].role === 'user' && messages[j].content.trim()) {
        sendMessage(messages[j].content);
        return;
      }
    }
  };

  const contagem = unreadCount > 0 && (
    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger-600 px-1 font-mono text-[11px] font-semibold text-white">
      {unreadCount}
      <span className="sr-only"> mensagens não lidas</span>
    </span>
  );

  if (!isOpen) {
    return celular ? (
      // Celular: botão redondo só com ícone, acima da barra inferior
      <button
        type="button"
        onClick={toggleChat}
        aria-label="Abrir assistente de IA"
        className="fixed bottom-[calc(theme(spacing.tabbar)+0.75rem+env(safe-area-inset-bottom))] right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-gradient-primary text-white shadow-lg shadow-brand/30 active:scale-95"
      >
        <MessageSquare className="h-6 w-6" aria-hidden="true" />
        {contagem}
      </button>
    ) : (
      <Button
        onClick={toggleChat}
        size="lg"
        className="fixed bottom-6 right-6 z-40 gap-2 border-0 bg-gradient-primary text-white shadow-lg shadow-brand/25 transition-shadow hover:shadow-xl"
      >
        <MessageSquare className="h-5 w-5" aria-hidden="true" />
        Chat IA
        {contagem}
      </Button>
    );
  }

  return (
    <section
      aria-label="Assistente de IA"
      className={cn(
        'fixed z-50 flex flex-col bg-background',
        celular
          ? 'inset-x-0 top-0 h-[100dvh]'
          : 'inset-y-0 right-0 w-[420px] border-l shadow-2xl animate-in slide-in-from-right duration-300',
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

      <ScrollArea ref={scrollAreaRef} className="min-h-0 flex-1 px-4 py-4">
        {messages.length === 0 ? (
          <WelcomeMessage />
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} onReact={addReaction} onRetry={tentarDeNovo} />
            ))}
            {isLoading && <TypingIndicator />}
          </>
        )}
      </ScrollArea>

      {messages.length === 0 && <SugestoesIniciais onQuickReply={sendMessage} />}
      <ChatInput onSend={sendMessage} isLoading={isLoading} />
    </section>
  );
};
