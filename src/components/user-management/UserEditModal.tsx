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
import { useAuthSession } from '@/hooks/useAuthSession';
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
  const [role, setRole] = useState<'master' | 'owner' | 'editor' | 'viewer'>('viewer');
  const [isActive, setIsActive] = useState(true);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [propertyAccess, setPropertyAccess] = useState<UserPropertyAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { ensureValidSession, refreshSession, isAuthenticated } = useAuthSession();

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
      console.log('🔍 Fetchando property access para userId:', userId);
      console.log('🔍 Usuário autenticado atual:', (await supabase.auth.getUser()).data.user?.id);
      
      const { data, error } = await supabase
        .from('user_property_access')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Erro ao buscar acesso às propriedades:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        return;
      }

      console.log('✅ Property access carregado:', data);
      setPropertyAccess((data || []) as UserPropertyAccess[]);
    } catch (error) {
      console.error('❌ Erro catch ao buscar acesso às propriedades:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('🚀 Iniciando salvamento do usuário:', user.email);

      // PRIMEIRO: Garantir que temos uma sessão válida
      if (!isAuthenticated) {
        throw new Error('Usuário não está autenticado');
      }

      const sessionValid = await ensureValidSession();
      if (!sessionValid) {
        throw new Error('Sessão inválida ou expirada');
      }

      // Verificar se usuário pode gerenciar acessos
      const { data: canManage } = await supabase.rpc('can_manage_property_access');
      console.log('✅ Pode gerenciar acessos:', canManage);

      if (!canManage) {
        throw new Error('Usuário não tem permissão para gerenciar acessos às propriedades');
      }

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

      if (profileError) {
        console.error('❌ Erro ao atualizar perfil:', profileError);
        throw profileError;
      }
      console.log('✅ Perfil atualizado com sucesso');

      // Remover permissões existentes
      const { error: deletePermissionsError } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', user.user_id);

      if (deletePermissionsError) {
        console.error('❌ Erro ao deletar permissões:', deletePermissionsError);
        throw deletePermissionsError;
      }
      console.log('✅ Permissões antigas removidas');

      // Inserir novas permissões (apenas as que têm valor true)
      const permissionsToInsert = permissions
        .filter(p => p.permission_value)
        .map(p => ({
          user_id: user.user_id,
          permission_type: p.permission_type,
          permission_value: p.permission_value,
          resource_id: p.resource_id
        }));

      console.log('📝 Permissões a inserir:', permissionsToInsert);

      if (permissionsToInsert.length > 0) {
        const { error: permissionsError } = await supabase
          .from('user_permissions')
          .insert(permissionsToInsert);

        if (permissionsError) {
          console.error('❌ Erro ao inserir permissões:', permissionsError);
          throw permissionsError;
        }
        console.log('✅ Permissões inseridas com sucesso');
      }

      // Remover acesso a propriedades existente
      console.log('🗑️ Removendo acessos antigos às propriedades...');
      const { error: deletePropertyAccessError, data: deletedAccess } = await supabase
        .from('user_property_access')
        .delete()
        .eq('user_id', user.user_id)
        .select();

      if (deletePropertyAccessError) {
        console.error('❌ Erro ao deletar acesso às propriedades:', deletePropertyAccessError);
        throw deletePropertyAccessError;
      }
      console.log('✅ Acessos antigos removidos:', deletedAccess);

      // Inserir novo acesso a propriedades
      if (propertyAccess.length > 0) {
        const propertyAccessToInsert = propertyAccess.map(pa => ({
          user_id: user.user_id,
          property_id: pa.property_id,
          access_level: pa.access_level
        }));

        console.log('📝 Inserindo novos acessos:', propertyAccessToInsert);

        const { data: insertedData, error: propertyAccessError } = await supabase
          .from('user_property_access')
          .insert(propertyAccessToInsert)
          .select();

        if (propertyAccessError) {
          console.error('❌ Erro ao inserir acesso às propriedades:', propertyAccessError);
          console.error('❌ Detalhes do erro:', JSON.stringify(propertyAccessError, null, 2));
          
          // Tratar erros RLS específicos
          if (propertyAccessError.code === '42501') {
            throw new Error('Erro de permissão: Verifique se você está logado como usuário master');
          } else if (propertyAccessError.code === 'PGRST301') {
            throw new Error('Erro de autenticação: Faça logout e login novamente');
          }
          
          throw propertyAccessError;
        }
        
        console.log('✅ Novos acessos inseridos:', insertedData);

        // Verificação de integridade - confirmar que os dados foram realmente salvos
        const { data: verificationData, error: verificationError } = await supabase
          .from('user_property_access')
          .select('*')
          .eq('user_id', user.user_id);

        if (verificationError) {
          console.error('❌ Erro na verificação:', verificationError);
        } else {
          console.log('🔍 Verificação de integridade:', verificationData);
          
          if (verificationData.length !== propertyAccess.length) {
            console.warn('⚠️ ATENÇÃO: Número de registros não confere!');
            console.warn('⚠️ Esperado:', propertyAccess.length, 'Encontrado:', verificationData.length);
            
            throw new Error(`Falha na verificação: Esperado ${propertyAccess.length} acessos, mas apenas ${verificationData.length} foram salvos`);
          }
        }
      } else {
        console.log('ℹ️ Nenhuma propriedade para inserir');
      }

      toast({
        title: "Sucesso",
        description: "Usuário atualizado com sucesso! Todos os acessos foram salvos corretamente.",
      });

      onUserUpdated();
      onClose();
    } catch (error: any) {
      console.error('🔴 ERRO ao atualizar usuário:', error);
      
      let errorMessage = "Não foi possível atualizar o usuário.";
      
      // Mensagens específicas baseadas no tipo de erro
      if (error.code === '42501') {
        errorMessage = "Permissão insuficiente. Verifique se você está logado como usuário master.";
      } else if (error.code === 'PGRST301') {
        errorMessage = "Falha na autenticação. Tente fazer logout e login novamente.";
      } else if (error.message?.includes('Sessão de autenticação inválida')) {
        errorMessage = "Sessão expirada. Faça logout e login novamente.";
      } else if (error.message?.includes('Falha na verificação')) {
        errorMessage = error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Erro",
        description: errorMessage,
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
                  onValueChange={(value) => setRole(value as 'master' | 'owner' | 'editor' | 'viewer')}
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