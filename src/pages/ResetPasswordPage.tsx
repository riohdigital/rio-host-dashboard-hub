import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import MarcaRioh from "@/components/layout/MarcaRioh";

// Destino do link "Redefinir senha" enviado por e-mail (UserEditModal).
// O Supabase devolve a sessão de recuperação no endereço; o cliente a lê
// sozinho (detectSessionInUrl), então aqui basta pedir a senha nova.
const ResetPasswordPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({ title: "Erro", description: "A nova senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "Senha redefinida", description: "Você já está conectado com a senha nova." });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      toast({
        title: "Erro",
        description: (error instanceof Error && error.message) || "Não foi possível redefinir a senha.",
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
        <CardHeader className="text-left">
          <CardTitle className="font-display text-2xl font-extrabold text-ink">
            Redefinir senha
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!user ? (
            <div className="space-y-4 text-center">
              <p className="text-left text-ink">
                Este link é inválido ou já expirou. Peça um novo link ao administrador.
              </p>
              <Button size="lg" onClick={() => navigate('/auth', { replace: true })} className="w-full">
                Ir para o login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="font-mono text-sm text-gray-600">{user.email}</p>
              <div className="space-y-2">
                <label htmlFor="nova-senha" className="block text-sm font-medium text-ink">
                  Nova senha
                </label>
                <div className="relative">
                  <Input
                    id="nova-senha"
                    type={mostrarSenha ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="h-12 pr-12 text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    aria-label={mostrarSenha ? 'Esconder senha' : 'Mostrar senha'}
                    aria-pressed={mostrarSenha}
                    className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-gray-500 hover:text-brand"
                  >
                    {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="confirmar-senha" className="block text-sm font-medium text-ink">
                  Confirmar nova senha
                </label>
                <div className="relative">
                  <Input
                    id="confirmar-senha"
                    type={mostrarSenha ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="h-12 pr-12 text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    aria-label={mostrarSenha ? 'Esconder senha' : 'Mostrar senha'}
                    aria-pressed={mostrarSenha}
                    className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-gray-500 hover:text-brand"
                  >
                    {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <Button type="submit" size="lg" disabled={loading} className="w-full">
                {loading ? 'Salvando...' : 'Salvar nova senha'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
