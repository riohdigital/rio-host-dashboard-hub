import { useState, useEffect, useCallback } from 'react';
import { ChatMessage, MessageStatus } from '@/types/chat';
import { useToast } from '@/hooks/use-toast';

const STORAGE_KEY = 'riohhost_chat_messages';
const N8N_WEBHOOK_URL = 'https://n8n-n8n.dgyrua.easypanel.host/webhook/DashBoard%20RiohHost%20ChatAI';

export const useAIChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Carregar mensagens do localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setMessages(parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        })));
      } catch (error) {
        console.error('Erro ao carregar histórico do chat:', error);
      }
    }
  }, []);

  // Salvar mensagens no localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage.id;
  }, []);

  const updateMessageStatus = useCallback((messageId: string, status: MessageStatus) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId ? { ...msg, status } : msg
      )
    );
  }, []);

  const sendMessage = useCallback(async (content: string, attachments?: File[]) => {
    if (!content.trim() && !attachments?.length) return;

    // Adiciona mensagem do usuário
    const userMessageId = addMessage({
      role: 'user',
      content,
      status: 'sending',
      attachments: attachments?.map(file => ({
        id: crypto.randomUUID(),
        type: 'image',
        url: URL.createObjectURL(file),
        name: file.name,
        size: file.size,
      })),
    });

    setIsLoading(true);

    try {
      // Prepara dados para o webhook
      const formData = new FormData();
      formData.append('message', content);
      formData.append('timestamp', new Date().toISOString());
      
      if (attachments) {
        attachments.forEach((file, index) => {
          formData.append(`attachment_${index}`, file);
        });
      }

      // Envia para o webhook N8N
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Erro ao comunicar com a IA');
      }

      const data = await response.json();
      
      updateMessageStatus(userMessageId, 'sent');

      // Adiciona resposta da IA
      addMessage({
        role: 'assistant',
        content: data.response || 'Desculpe, não consegui processar sua solicitação.',
        status: 'sent',
      });

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      updateMessageStatus(userMessageId, 'error');
      
      toast({
        title: 'Erro ao enviar mensagem',
        description: 'Não foi possível comunicar com a IA. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [addMessage, updateMessageStatus, toast]);

  const toggleChat = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    toast({
      title: 'Histórico limpo',
      description: 'Todas as mensagens foram removidas.',
    });
  }, [toast]);

  return {
    isOpen,
    messages,
    isLoading,
    sendMessage,
    toggleChat,
    clearChat,
  };
};
