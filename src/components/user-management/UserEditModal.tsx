import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import PermissionsEditor from './PermissionsEditor';
import PropertyAccessEditor from './PropertyAccessEditor';
import type { UserProfile, UserPermission, UserPropertyAccess } from '@/types/user-management';

interface UserEditModalProps {
  user: UserProfile | null;
  open: boolean;
  onClose: () => void;
  onUserUpdated: () => void;
}

const UserEditModal: React.FC<UserEditModalProps> = ({
  user,
  open,
  onClose,
  onUserUpdated
}) => {
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'master' | 'owner' | 'editor' | 'viewer' | 'faxineira'>('viewer');
  const [isActive, setIsActive] = useState(true);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [propertyAccess, setPropertyAccess] = useState<UserPropertyAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user && open) {
      setFullName(user.full_name || '');
      setRole(user.role);
      setIsActive(user.is_active);
      fetchUserPermissions(user.user_id);
      fetchPropertyAccess(user.user_id);
    }
  }, [user, open]);

  const fetchUserPermissions = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId);
      
      setPermissions(data || []);
    } catch (error) {
      console.error('Erro ao buscar permissões:', error);
    }
  };

  const fetchPropertyAccess = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('user_property_access')
        .select('*')
        .eq('user_id', userId);
      
      setPropertyAccess((data || []) as UserPropertyAccess[]);
    } catch (error) {
      console.error('Erro ao buscar acesso a propriedades:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Atualizar perfil do usuário
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          full_name: fullName,
          role,
          is_active: isActive,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.user_id);

      if (profileError) throw profileError;

      // Remover permissões existentes
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', user.user_id);

      // Inserir novas permissões (apenas as que têm valor true)
      const permissionsToInsert = permissions
        .filter(p => p.permission_value)
        .map(p => ({
          user_id: user.user_id,
          permission_type: p.permission_type,
          permission_value: p.permission_value,
          resource_id: p.resource_id
        }));

      if (permissionsToInsert.length > 0) {
        const { error: permissionsError } = await supabase
          .from('user_permissions')
          .insert(permissionsToInsert);

        if (permissionsError) throw permissionsError;
      }

      // Remover acesso a propriedades existente
      await supabase
        .from('user_property_access')
        .delete()
        .eq('user_id', user.user_id);

      // Inserir novo acesso a propriedades
      if (propertyAccess.length > 0) {
        const propertyAccessToInsert = propertyAccess.map(pa => ({
          user_id: user.user_id,
          property_id: pa.property_id,
          access_level: pa.access_level
        }));

        const { error: propertyAccessError } = await supabase
          .from('user_property_access')
          .insert(propertyAccessToInsert);

        if (propertyAccessError) throw propertyAccessError;
      }

      toast({
        title: "Sucesso",
        description: "Usuário atualizado com sucesso.",
      });

      onUserUpdated();
      onClose();
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o usuário.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Informações Básicas</TabsTrigger>
            <TabsTrigger value="permissions">Permissões</TabsTrigger>
            <TabsTrigger value="properties">Propriedades</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user.email}
                  disabled
                  className="bg-muted"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Digite o nome completo"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                 <Select 
                  value={role} 
                  onValueChange={(value) => setRole(value as 'master' | 'owner' | 'editor' | 'viewer' | 'faxineira')}
                  disabled={user.role === 'master'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="master">Mestre</SelectItem>
                    <SelectItem value="owner">Proprietário</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Visualizador</SelectItem>
                    <SelectItem value="faxineira">Faxineira</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="isActive">Status da Conta</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                    disabled={user.role === 'master'}
                  />
                  <Label htmlFor="isActive" className="text-sm">
                    {isActive ? 'Ativo' : 'Inativo'}
                  </Label>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Alterar Senha</Label>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
                      redirectTo: `${window.location.origin}/reset-password`
                    });
                    
                    if (error) throw error;
                    
                    toast({
                      title: "Sucesso",
                      description: "Email de redefinição de senha enviado com sucesso.",
                    });
                  } catch (error) {
                    console.error('Erro ao enviar email de redefinição:', error);
                    toast({
                      title: "Erro",
                      description: "Não foi possível enviar o email de redefinição.",
                      variant: "destructive",
                    });
                  }
                }}
                className="w-full"
              >
                Enviar Email de Redefinição de Senha
              </Button>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Informações da Conta</Label>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Criado em: {new Date(user.created_at).toLocaleDateString('pt-BR')}</p>
                <p>Última atualização: {new Date(user.updated_at).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="permissions" className="space-y-4">
            <PermissionsEditor
              permissions={permissions}
              onChange={setPermissions}
              userRole={role}
            />
          </TabsContent>

          <TabsContent value="properties" className="space-y-4">
            <PropertyAccessEditor
              propertyAccess={propertyAccess}
              onChange={setPropertyAccess}
              userRole={role}
              userId={user.user_id}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserEditModal;