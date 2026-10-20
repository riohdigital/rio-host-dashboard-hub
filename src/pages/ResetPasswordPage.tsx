import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

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
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
      <Card className="w-full max-w-md bg-white">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-[#6A6DDF]">
            Redefinir senha
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!user ? (
            <div className="space-y-4 text-center">
              <p className="text-[#374151]">
                Este link é inválido ou já expirou. Peça um novo link ao administrador.
              </p>
              <Button
                onClick={() => navigate('/auth', { replace: true })}
                className="w-full bg-[#6A6DDF] hover:bg-[#5A5CCF] text-white"
              >
                Ir para o login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-[#374151] text-center">{user.email}</p>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">
                  Nova senha
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-2">
                  Confirmar nova senha
                </label>
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#6A6DDF] hover:bg-[#5A5CCF] text-white"
              >
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
