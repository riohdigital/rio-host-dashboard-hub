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
    // Refetch se a página ficou oculta por mais de 30 segundos
    const timeSinceVisible = Date.now() - lastVisibleTime.current;
    return timeSinceVisible > 30000;
  };

  return {
    isVisible,
    shouldRefetch
  };
};