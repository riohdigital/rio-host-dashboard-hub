import { useEffect } from 'react';

export const useChatNotifications = (isOpen: boolean, unreadCount: number) => {
  useEffect(() => {
    // Solicitar permissão para notificações
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!isOpen && unreadCount > 0 && Notification.permission === 'granted') {
      new Notification('Nova mensagem no Chat RiohHost', {
        body: `Você tem ${unreadCount} mensagem${unreadCount > 1 ? 's' : ''} não lida${unreadCount > 1 ? 's' : ''}`,
        icon: '/LOGO RIOH HOST.png',
        badge: '/LOGO RIOH HOST.png',
      });
    }
  }, [unreadCount, isOpen]);
};
