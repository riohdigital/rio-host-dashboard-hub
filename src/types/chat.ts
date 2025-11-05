export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'sending' | 'sent' | 'error';
export type MessageCategory = 'financeiro' | 'reservas' | 'limpeza' | 'geral';
export type MessageReaction = 'thumbs_up' | 'thumbs_down' | null;

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  status?: MessageStatus;
  attachments?: ChatAttachment[];
  category?: MessageCategory;
  reaction?: MessageReaction;
}

export interface ChatAttachment {
  id: string;
  type: 'image' | 'file';
  url: string;
  name: string;
  size: number;
}

export interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface ChatConversation {
  id: string;
  title: string;
  lastMessage: string;
  lastMessageDate: Date;
  messageCount: number;
  category?: MessageCategory;
}

export interface QuickReply {
  id: string;
  text: string;
  icon?: string;
}
