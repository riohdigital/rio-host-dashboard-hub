
import React, { useState } from 'react';
import MarcaRioh from '@/components/layout/MarcaRioh';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";

const AuthPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast({
          title: "Login realizado com sucesso!",
          description: "Bem-vindo de volta.",
        });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`
          }
        });
        if (error) throw error;
        toast({
          title: "Conta criada com sucesso!",
          description: "Verifique seu email para confirmar a conta.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro de autenticação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen min-h-dvh flex-col items-center justify-center gap-6 bg-surface px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))]">
      <MarcaRioh />
      <Card className="w-full max-w-md bg-white">
        <CardHeader className="space-y-1.5 text-left">
          <CardTitle className="font-display text-2xl font-extrabold text-ink">
            {isLogin ? 'Entrar no painel' : 'Criar sua conta'}
          </CardTitle>
          <p className="text-sm text-gray-600">
            {isLogin ? 'Use o e-mail e a senha da sua conta Rioh Host.' : 'Preencha e-mail e senha para começar.'}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="auth-email" className="block text-sm font-medium text-ink">
                E-mail
              </label>
              <Input
                id="auth-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 w-full text-base"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="auth-senha" className="block text-sm font-medium text-ink">
                Senha
              </label>
              <div className="relative">
                <Input
                  id="auth-senha"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 w-full pr-12 text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                  className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-gray-500 transition-colors hover:text-brand"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            <Button type="submit" size="lg" disabled={loading} className="w-full">
              {loading ? 'Carregando...' : (isLogin ? 'Entrar' : 'Criar Conta')}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="min-h-11 text-sm font-medium text-brand hover:underline"
            >
              {isLogin ? 'Não tem conta? Criar conta' : 'Já tem conta? Entrar'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
