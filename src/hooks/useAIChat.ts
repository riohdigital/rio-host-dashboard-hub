import { useState, useEffect, useCallback } from 'react';
import { ChatMessage, MessageStatus } from '@/types/chat';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const STORAGE_KEY = 'riohhost_chat_messages';
const N8N_WEBHOOK_URL = 'https://n8n-n8n.dgyrua.easypanel.host/webhook/DashBoard%20RiohHost%20ChatAI';

export const useAIChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

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

    // Verifica se o usuário está autenticado
    if (!user?.id) {
      toast({
        title: 'Erro de autenticação',
        description: 'Você precisa estar logado para usar o chat.',
        variant: 'destructive',
      });
      return;
    }

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
      // Converte anexos para base64
      const attachmentsBase64 = await Promise.all(
        (attachments || []).map(async (file) => {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]); // Remove o prefixo data:image/...;base64,
            };
            reader.readAsDataURL(file);
          });
          
          return {
            name: file.name,
            type: file.type,
            size: file.size,
            data: base64,
          };
        })
      );

      // Prepara payload JSON
      const payload = {
        message: content,
        userId: user.id,
        timestamp: new Date().toISOString(),
        attachments: attachmentsBase64,
      };

      console.log('🚀 Enviando para N8N:', {
        url: N8N_WEBHOOK_URL,
        userId: user.id,
        message: content,
        attachmentsCount: attachmentsBase64.length,
      });

      // Envia para o webhook N8N
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('📥 Resposta N8N:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      });

      // Captura corpo da resposta como texto primeiro
      const responseText = await response.text();
      console.log('📄 Corpo da resposta:', responseText);

      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}: ${responseText}`);
      }

      // Tenta fazer parse do JSON
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('✅ JSON parseado:', data);
      } catch (e) {
        console.error('❌ Erro ao fazer parse do JSON:', e);
        throw new Error(`Resposta inválida do servidor: ${responseText.substring(0, 100)}`);
      }
      
      updateMessageStatus(userMessageId, 'sent');

      // Adiciona resposta da IA
      addMessage({
        role: 'assistant',
        content: data.response || data.message || 'Desculpe, não consegui processar sua solicitação.',
        status: 'sent',
      });

    } catch (error) {
      console.error('❌ Erro completo ao enviar mensagem:', {
        error,
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      updateMessageStatus(userMessageId, 'error');
      
      toast({
        title: 'Erro ao enviar mensagem',
        description: error instanceof Error ? error.message : 'Não foi possível comunicar com a IA. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [addMessage, updateMessageStatus, toast, user]);

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
