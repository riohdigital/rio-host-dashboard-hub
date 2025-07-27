import { useEffect, useRef, useState } from 'react';

export const usePageVisibility = () => {
  const [isVisible, setIsVisible] = useState(true);
  const lastVisibleTime = useRef(Date.now());

  useEffect(() => {
    const handleVisibilityChange = () => {
      const currentlyVisible = !document.hidden;
      setIsVisible(currentlyVisible);
      
      if (currentlyVisible) {
        lastVisibleTime.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const shouldRefetch = () => {
    // Não fazer refetch automático - deixar usuário controlar quando quer atualizar
    return false;
  };

  return {
    isVisible,
    shouldRefetch
  };
};