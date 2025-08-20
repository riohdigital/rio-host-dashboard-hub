import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UserInviteFormProps {
  onUserInvited: () => void;
}

const UserInviteForm: React.FC<UserInviteFormProps> = ({ onUserInvited }) => {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'owner' | 'gestor'>('gestor');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast({
        title: "Erro",
        description: "Email é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Verificar se o usuário já existe
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('email', email.toLowerCase())
        .single();

      if (existingProfile) {
        toast({
          title: "Erro",
          description: "Usuário com este email já existe.",
          variant: "destructive",
        });
        return;
      }

      // Convidar usuário através do Supabase Auth
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: fullName,
          role: role
        },
        redirectTo: `${window.location.origin}/auth`
      });

      if (error) {
        throw error;
      }

      // Criar perfil do usuário convidado
      if (data.user) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: data.user.id,
            email: email.toLowerCase(),
            full_name: fullName || null,
            role: role,
            is_active: true
          });

        if (profileError) {
          console.error('Erro ao criar perfil:', profileError);
        }
      }

      toast({
        title: "Sucesso",
        description: "Convite enviado com sucesso! O usuário receberá um email com instruções.",
      });

      // Limpar formulário
      setEmail('');
      setFullName('');
      setRole('gestor');
      
      onUserInvited();
    } catch (error: any) {
      console.error('Erro ao convidar usuário:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível enviar o convite.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Convidar Novo Usuário</CardTitle>
        <CardDescription>
          Envie um convite por email para um novo usuário se juntar ao sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleInvite} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Email *</Label>
              <Input
                id="inviteEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@exemplo.com"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="inviteFullName">Nome Completo</Label>
              <Input
                id="inviteFullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nome do usuário"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inviteRole">Role Inicial</Label>
            <Select value={role} onValueChange={(value) => setRole(value as 'owner' | 'gestor')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Proprietário</SelectItem>
                <SelectItem value="gestor">Gestor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Enviando Convite...' : 'Enviar Convite'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default UserInviteForm;