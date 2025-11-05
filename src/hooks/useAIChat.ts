import { useState, useEffect, useCallback } from 'react';
import { ChatMessage, MessageStatus, MessageReaction } from '@/types/chat';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const N8N_WEBHOOK_URL = 'https://n8n-n8n.dgyrua.easypanel.host/webhook/DashBoard%20RiohHost%20ChatAI';

export const useAIChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();

  // ========== CARREGAR HISTÓRICO DO SUPABASE ==========
  const loadMessages = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('riohhost_chat_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const mappedMessages: ChatMessage[] = (data || []).map(row => {
        const msg = row.message as any;
        return {
          id: row.id.toString(),
          role: msg?.type === 'human' ? 'user' as const : 'assistant' as const,
          content: msg?.content || '',
          timestamp: new Date(row.created_at),
          status: 'sent' as const,
          category: row.category as any,
          reaction: row.reaction as any,
        };
      });

      setMessages(mappedMessages);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      // Fallback para localStorage
      const stored = localStorage.getItem('riohhost_chat_messages');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setMessages(parsed.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          })));
        } catch (e) {
          console.error('Erro ao carregar do localStorage:', e);
        }
      }
    }
  }, [user]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // ========== SALVAR MENSAGEM NO SUPABASE ==========
  const saveMessageToSupabase = async (message: ChatMessage) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('riohhost_chat_history')
        .insert({
          user_id: user.id,
          session_id: user.id,
          message: {
            type: message.role === 'user' ? 'human' : 'ai',
            content: message.content,
            additional_kwargs: {},
            response_metadata: {},
          },
          category: message.category,
          created_at: message.timestamp.toISOString(),
        });

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao salvar mensagem:', error);
      // Fallback para localStorage
      const stored = localStorage.getItem('riohhost_chat_messages');
      const messages = stored ? JSON.parse(stored) : [];
      messages.push(message);
      localStorage.setItem('riohhost_chat_messages', JSON.stringify(messages));
    }
  };

  // ========== ADICIONAR MENSAGEM ==========
  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
    saveMessageToSupabase(newMessage);
    return newMessage.id;
  }, [user]);

  // ========== ATUALIZAR STATUS ==========
  const updateMessageStatus = useCallback((messageId: string, status: MessageStatus) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId ? { ...msg, status } : msg
      )
    );
  }, []);

  // ========== ADICIONAR REAÇÃO ==========
  const addReaction = useCallback(async (messageId: string, reaction: MessageReaction) => {
    if (!user?.id) return;

    try {
      // Atualizar localmente
      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId ? { ...msg, reaction } : msg
        )
      );

      // Atualizar no Supabase
      const { error } = await supabase
        .from('riohhost_chat_history')
        .update({ reaction })
        .eq('id', parseInt(messageId));

      if (error) throw error;

      toast({
        title: 'Feedback registrado',
        description: 'Obrigado por avaliar a resposta!',
      });
    } catch (error) {
      console.error('Erro ao adicionar reação:', error);
    }
  }, [user, toast]);

  // ========== ENVIAR MENSAGEM ==========
  const sendMessage = useCallback(async (content: string, attachments?: File[]) => {
    if (!content.trim() && !attachments?.length) return;

    if (!user?.id) {
      toast({
        title: 'Erro de autenticação',
        description: 'Você precisa estar logado para usar o chat.',
        variant: 'destructive',
      });
      return;
    }

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
      const attachmentsBase64 = await Promise.all(
        (attachments || []).map(async (file) => {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]);
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

      const payload = {
        message: content,
        userId: user.id,
        timestamp: new Date().toISOString(),
        attachments: attachmentsBase64,
      };

      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}: ${responseText}`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Resposta inválida do servidor: ${responseText.substring(0, 100)}`);
      }

      updateMessageStatus(userMessageId, 'sent');

      addMessage({
        role: 'assistant',
        content: data.response || data.message || 'Desculpe, não consegui processar sua solicitação.',
        status: 'sent',
      });

      // Incrementar contador de não lidas se chat estiver fechado
      if (!isOpen) {
        setUnreadCount(prev => prev + 1);
      }

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      updateMessageStatus(userMessageId, 'error');

      toast({
        title: 'Erro ao enviar mensagem',
        description: error instanceof Error ? error.message : 'Não foi possível comunicar com a IA. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [addMessage, updateMessageStatus, toast, user, isOpen]);

  // ========== TOGGLE CHAT ==========
  const toggleChat = useCallback(() => {
    setIsOpen(prev => !prev);
    if (!isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  // ========== LIMPAR CHAT ==========
  const clearChat = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('riohhost_chat_history')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setMessages([]);
      localStorage.removeItem('riohhost_chat_messages');
      toast({
        title: 'Histórico limpo',
        description: 'Todas as mensagens foram removidas.',
      });
    } catch (error) {
      console.error('Erro ao limpar histórico:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível limpar o histórico.',
        variant: 'destructive',
      });
    }
  }, [user, toast]);

  // ========== EXPORTAR CONVERSA ==========
  const exportChat = useCallback(() => {
    const exportText = messages
      .map(msg => {
        const time = msg.timestamp.toLocaleString('pt-BR');
        const sender = msg.role === 'user' ? 'Você' : 'Assistente';
        return `[${time}] ${sender}: ${msg.content}`;
      })
      .join('\n\n');

    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-riohhost-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Conversa exportada',
      description: 'Arquivo baixado com sucesso!',
    });
  }, [messages, toast]);

  // ========== FILTRAR MENSAGENS ==========
  const filteredMessages = messages.filter(msg => {
    const matchesSearch = !searchQuery || 
      msg.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || 
      msg.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return {
    isOpen,
    messages: filteredMessages,
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
  };
};
