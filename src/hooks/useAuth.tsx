import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const isInitialized = useRef(false);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Erro durante signOut:', error);
    } finally {
      setUser(null);
      setSession(null);
    }
  };

  useEffect(() => {
    // 1. Obter sessão persistida no storage local
    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (error) {
        console.error('[Auth] Erro ao recuperar sessão inicial:', error);
      }
      if (initialSession) {
        setSession(initialSession);
        setUser(initialSession.user);
      }
      setLoading(false);
      isInitialized.current = true;
    }).catch(err => {
      console.error('[Auth] Falha crítica ao verificar getSession:', err);
      setLoading(false);
      isInitialized.current = true;
    });

    // 2. Ouvinte único de mudanças de estado de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        console.log(`[Auth] Evento: ${event}`, currentSession?.user ? `(${currentSession.user.email})` : '(Sem sessão)');

        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (currentSession) {
            setSession(currentSession);
            // Mantém a referência estável do objeto user se o ID for idêntico
            // Isso evita re-renderizações e desmontagens em cascata na renovação automática do token
            setUser(prev => (prev?.id === currentSession.user.id ? prev : currentSession.user));
          }
          setLoading(false);
        } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          if (currentSession) {
            setSession(currentSession);
            setUser(currentSession.user);
          }
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
