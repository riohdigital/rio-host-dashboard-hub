import { useEffect, useCallback } from 'react';

interface UseFormPersistenceOptions<T> {
  key: string;
  values: T;
  setValue: (field: keyof T, value: any) => void;
  enabled?: boolean;
}

export const useFormPersistence = <T extends Record<string, any>>({
  key,
  values,
  setValue,
  enabled = true
}: UseFormPersistenceOptions<T>) => {
  
  // Salvar dados automaticamente quando mudarem
  useEffect(() => {
    if (!enabled) return;
    
    const timeoutId = setTimeout(() => {
      sessionStorage.setItem(key, JSON.stringify(values));
    }, 500); // Debounce de 500ms
    
    return () => clearTimeout(timeoutId);
  }, [key, values, enabled]);

  // Restaurar dados salvos
  const restoreData = useCallback(() => {
    if (!enabled) return;
    
    try {
      const savedData = sessionStorage.getItem(key);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        Object.keys(parsedData).forEach((field) => {
          if (parsedData[field] !== undefined && parsedData[field] !== null) {
            setValue(field as keyof T, parsedData[field]);
          }
        });
      }
    } catch (error) {
      console.error('Erro ao restaurar dados do formulário:', error);
    }
  }, [key, setValue, enabled]);

  // Limpar dados salvos
  const clearSavedData = useCallback(() => {
    sessionStorage.removeItem(key);
  }, [key]);

  return {
    restoreData,
    clearSavedData
  };
};