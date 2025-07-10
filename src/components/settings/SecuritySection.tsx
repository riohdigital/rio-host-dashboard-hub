
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const SecuritySection = () => {
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwords.new !== passwords.confirm) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem.",
        variant: "destructive",
      });
      return;
    }

    if (passwords.new.length < 6) {
      toast({
        title: "Erro",
        description: "A nova senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.new
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Senha alterada com sucesso.",
      });

      setPasswords({ current: '', new: '', confirm: '' });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível alterar a senha.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof typeof passwords, value: string) => {
    setPasswords(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#6A6DDF] mb-2">Segurança</h2>
        <p className="text-gray-600">Altere sua senha de acesso.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="current-password">Senha Atual</Label>
          <Input
            id="current-password"
            type="password"
            value={passwords.current}
            onChange={(e) => handleInputChange('current', e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-password">Nova Senha</Label>
          <Input
            id="new-password"
            type="password"
            value={passwords.new}
            onChange={(e) => handleInputChange('new', e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
          <Input
            id="confirm-password"
            type="password"
            value={passwords.confirm}
            onChange={(e) => handleInputChange('confirm', e.target.value)}
            required
          />
        </div>

        <Button 
          type="submit" 
          disabled={loading}
          className="bg-[#6A6DDF] hover:bg-[#5A5BCF] text-white"
        >
          {loading ? 'Alterando...' : 'Alterar Senha'}
        </Button>
      </form>
    </div>
  );
};

export default SecuritySection;
