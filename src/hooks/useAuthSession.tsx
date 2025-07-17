import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useAuthSession = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;

    const getSession = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Erro ao obter sessão:', error);
          setError(error.message);
          return;
        }

        if (!session) {
          setError('Sessão não encontrada');
          return;
        }

        if (mounted) {
          setSession(session);
          console.log('✅ Sessão carregada:', {
            user_id: session.user.id,
            email: session.user.email,
            expires_at: session.expires_at
          });
        }
      } catch (err: any) {
        console.error('❌ Erro catch ao obter sessão:', err);
        setError(err.message || 'Erro desconhecido');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event, session?.user?.email);
        
        if (mounted) {
          setSession(session);
          setError(session ? null : 'Sessão perdida');
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const ensureValidSession = async (): Promise<boolean> => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('❌ Erro ao verificar sessão:', error);
        toast({
          title: "Erro de Autenticação",
          description: "Erro ao verificar sessão. Faça logout e login novamente.",
          variant: "destructive",
        });
        return false;
      }

      if (!session) {
        console.error('❌ Sessão não encontrada');
        toast({
          title: "Sessão Expirada",
          description: "Sua sessão expirou. Faça login novamente.",
          variant: "destructive",
        });
        return false;
      }

      // Verificar se o token não está expirado
      const now = Date.now() / 1000;
      if (session.expires_at && session.expires_at < now) {
        console.error('❌ Token expirado');
        toast({
          title: "Token Expirado",
          description: "Seu token de autenticação expirou. Faça login novamente.",
          variant: "destructive",
        });
        return false;
      }

      return true;
    } catch (err: any) {
      console.error('❌ Erro ao validar sessão:', err);
      toast({
        title: "Erro de Validação",
        description: "Erro ao validar sessão. Tente novamente.",
        variant: "destructive",
      });
      return false;
    }
  };

  const refreshSession = async (): Promise<boolean> => {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('❌ Erro ao renovar sessão:', error);
        return false;
      }

      if (session) {
        setSession(session);
        console.log('✅ Sessão renovada com sucesso');
        return true;
      }

      return false;
    } catch (err: any) {
      console.error('❌ Erro ao renovar sessão:', err);
      return false;
    }
  };

  return {
    session,
    loading,
    error,
    isAuthenticated: !!session && !error,
    ensureValidSession,
    refreshSession
  };
};