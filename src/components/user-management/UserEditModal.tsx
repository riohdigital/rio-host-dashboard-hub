import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import PermissionsEditor from './PermissionsEditor';
import PropertyAccessEditor from './PropertyAccessEditor';
import CleanerPropertyAccessEditor from './CleanerPropertyAccessEditor';
import type { UserProfile, UserPermission, UserPropertyAccess } from '@/types/user-management';
import type { Property } from '@/types/property';

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
  const [role, setRole] = useState<'master' | 'owner' | 'gestor' | 'faxineira'>('gestor');
  const [isActive, setIsActive] = useState(true);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [propertyAccess, setPropertyAccess] = useState<UserPropertyAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [cleanerLinkedProperties, setCleanerLinkedProperties] = useState<string[]>([]);

  useEffect(() => {
    if (user && open) {
      setFullName(user.full_name || '');
      setRole(user.role);
      setIsActive(user.is_active);
      fetchUserPermissions(user.user_id);
      
      if (user.role === 'faxineira') {
        fetchAllProperties();
        fetchCleanerLinkedProperties(user.user_id);
        setPropertyAccess([]);
      } else {
        fetchPropertyAccess(user.user_id);
        setCleanerLinkedProperties([]);
        setAllProperties([]);
      }
    }
  }, [user, open]);

  const fetchAllProperties = async () => {
    try {
      const { data, error } = await supabase.from('properties').select('*');
      if (error) throw error;
      setAllProperties(data || []);
    } catch (error) {
      console.error('Erro ao buscar todas as propriedades:', error);
    }
  };

  const fetchCleanerLinkedProperties = async (userId: string) => {
    try {
      const { data, error } = await (supabase as any).from('cleaner_properties').select('property_id').eq('user_id', userId);
      if (error) throw error;
      setCleanerLinkedProperties((data || []).map((link: any) => link.property_id));
    } catch (error) {
      console.error('Erro ao buscar propriedades da faxineira:', error);
    }
  };

  const fetchUserPermissions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId);
      
      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error('Erro ao buscar permissões:', error);
    }
  };

  const fetchPropertyAccess = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_property_access')
        .select('*')
        .eq('user_id', userId);
      
      if (error) throw error;
      setPropertyAccess((data || []) as UserPropertyAccess[]);
    } catch (error) {
      console.error('Erro ao buscar acesso a propriedades:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Atualizar perfil do usuário
      const { error: profileError } = await supabase.from('user_profiles').update({
        full_name: fullName,
        role,
        is_active: isActive,
        updated_at: new Date().toISOString()
      }).eq('user_id', user.user_id);
      if (profileError) throw profileError;

      // 2. Sincronizar permissões
      await supabase.from('user_permissions').delete().eq('user_id', user.user_id);
      const permissionsToInsert = permissions
        .filter(p => p.permission_value)
        .map(p => ({
          user_id: user.user_id,
          permission_type: p.permission_type,
          permission_value: p.permission_value,
          resource_id: p.resource_id
        }));
      if (permissionsToInsert.length > 0) {
        const { error: permissionsError } = await supabase.from('user_permissions').insert(permissionsToInsert);
        if (permissionsError) throw permissionsError;
      }
      
      // 3. Lógica condicional para salvar os acessos
      if (role === 'faxineira') {
        await (supabase as any).from('cleaner_properties').delete().eq('user_id', user.user_id);
        if (cleanerLinkedProperties.length > 0) {
          const linksToInsert = cleanerLinkedProperties.map(propId => ({
            user_id: user.user_id,
            property_id: propId
          }));
          const { error: cleanerAccessError } = await (supabase as any).from('cleaner_properties').insert(linksToInsert);
          if (cleanerAccessError) throw cleanerAccessError;
        }
      } else {
        await supabase.from('user_property_access').delete().eq('user_id', user.user_id);
        if (propertyAccess.length > 0) {
          const propertyAccessToInsert = propertyAccess.map(pa => ({
            user_id: user.user_id,
            property_id: pa.property_id,
            access_level: pa.access_level
          }));
          const { error: propertyAccessError } = await supabase.from('user_property_access').insert(propertyAccessToInsert);
          if (propertyAccessError) throw propertyAccessError;
        }
      }

      toast({ title: "Sucesso", description: "Usuário atualizado com sucesso." });
      onUserUpdated();
      onClose();
    } catch (error: any) {
      console.error('Erro ao atualizar usuário:', error);
      toast({ title: "Erro", description: error.message || "Não foi possível atualizar o usuário.", variant: "destructive" });
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

          <TabsContent value="basic" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user.email} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Digite o nome completo" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={(value) => setRole(value as 'master' | 'owner' | 'gestor' | 'faxineira')} disabled={user.role === 'master'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="master">Mestre</SelectItem>
                    <SelectItem value="owner">Proprietário</SelectItem>
                    <SelectItem value="gestor">Gestor</SelectItem>
                    <SelectItem value="faxineira">Faxineira</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="isActive">Status da Conta</Label>
                <div className="flex items-center space-x-2 pt-2">
                  <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} disabled={user.role === 'master'} />
                  <Label htmlFor="isActive" className="text-sm">{isActive ? 'Ativo' : 'Inativo'}</Label>
                </div>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Alterar Senha</Label>
              <Button variant="outline" className="w-full" onClick={async () => {
                try {
                  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
                    redirectTo: `${window.location.origin}/reset-password`
                  });
                  if (error) throw error;
                  toast({ title: "Sucesso", description: "Email de redefinição de senha enviado." });
                } catch (error) {
                  toast({ title: "Erro", description: "Não foi possível enviar o email.", variant: "destructive" });
                }
              }}>
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

          <TabsContent value="permissions" className="space-y-4 pt-4">
            <PermissionsEditor permissions={permissions} onChange={setPermissions} userRole={role} />
          </TabsContent>

          <TabsContent value="properties" className="space-y-4 pt-4">
            {role === 'faxineira' ? (
              <CleanerPropertyAccessEditor
                allProperties={allProperties}
                linkedPropertyIds={cleanerLinkedProperties}
                onChange={setCleanerLinkedProperties}
              />
            ) : (
              <PropertyAccessEditor
                propertyAccess={propertyAccess}
                onChange={setPropertyAccess}
                userRole={role}
                userId={user.user_id}
              />
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserEditModal;
