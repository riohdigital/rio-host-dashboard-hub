import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox'; // NOVO: Importar Checkbox
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import PermissionsEditor from './PermissionsEditor';
import PropertyAccessEditor from './PropertyAccessEditor';
import type { UserProfile, UserPermission, UserPropertyAccess } from '@/types/user-management';
import type { Property } from '@/types/property'; // NOVO: Importar tipo Property

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

  // NOVO: Estados para gerenciar propriedades da faxineira
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [cleanerLinkedProperties, setCleanerLinkedProperties] = useState<string[]>([]);

  useEffect(() => {
    if (user && open) {
      // Preenche os dados básicos
      setFullName(user.full_name || '');
      setRole(user.role);
      setIsActive(user.is_active);

      // Busca dados específicos do usuário
      fetchUserPermissions(user.user_id);
      
      // ALTERAÇÃO: Lógica condicional para buscar acessos
      if (user.role === 'faxineira') {
        fetchAllProperties();
        fetchCleanerLinkedProperties(user.user_id);
        setPropertyAccess([]); // Limpa o estado do outro tipo de acesso
      } else {
        fetchPropertyAccess(user.user_id);
        setCleanerLinkedProperties([]); // Limpa o estado de acesso da faxineira
      }
    }
  }, [user, open]);

  // NOVO: Função para buscar TODAS as propriedades do sistema
  const fetchAllProperties = async () => {
    try {
      const { data, error } = await supabase.from('properties').select('id, name, nickname');
      if (error) throw error;
      setAllProperties(data || []);
    } catch (error) {
      console.error('Erro ao buscar todas as propriedades:', error);
    }
  };

  // NOVO: Função para buscar os vínculos específicos da faxineira
  const fetchCleanerLinkedProperties = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('cleaner_properties').select('property_id').eq('user_id', userId);
      if (error) throw error;
      setCleanerLinkedProperties((data || []).map(link => link.property_id));
    } catch (error) {
      console.error('Erro ao buscar propriedades da faxineira:', error);
    }
  };

  const fetchUserPermissions = async (userId: string) => { /* ... (sem alterações) ... */ };
  const fetchPropertyAccess = async (userId: string) => { /* ... (sem alterações) ... */ };

  // NOVO: Handler para o checklist de propriedades da faxineira
  const handleCleanerPropertyToggle = (propertyId: string) => {
    setCleanerLinkedProperties(prev => 
      prev.includes(propertyId)
        ? prev.filter(id => id !== propertyId)
        : [...prev, propertyId]
    );
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Atualizar perfil do usuário (sem alterações)
      await supabase.from('user_profiles').update({
        full_name: fullName, role, is_active: isActive, updated_at: new Date().toISOString()
      }).eq('user_id', user.user_id);

      // 2. Sincronizar permissões (sem alterações)
      await supabase.from('user_permissions').delete().eq('user_id', user.user_id);
      const permissionsToInsert = permissions.filter(p => p.permission_value)
        .map(p => ({ user_id: user.user_id, permission_type: p.permission_type, permission_value: true }));
      if (permissionsToInsert.length > 0) {
        await supabase.from('user_permissions').insert(permissionsToInsert);
      }
      
      // ALTERAÇÃO: Lógica condicional para salvar os acessos
      if (role === 'faxineira') {
        // Se for faxineira, sincroniza a tabela cleaner_properties
        await supabase.from('cleaner_properties').delete().eq('user_id', user.user_id);
        if (cleanerLinkedProperties.length > 0) {
          const linksToInsert = cleanerLinkedProperties.map(propId => ({
            user_id: user.user_id,
            property_id: propId
          }));
          await supabase.from('cleaner_properties').insert(linksToInsert);
        }
      } else {
        // Se for outro role, usa a lógica antiga para user_property_access
        await supabase.from('user_property_access').delete().eq('user_id', user.user_id);
        if (propertyAccess.length > 0) {
          const propertyAccessToInsert = propertyAccess.map(pa => ({
            user_id: user.user_id, property_id: pa.property_id, access_level: pa.access_level
          }));
          await supabase.from('user_property_access').insert(propertyAccessToInsert);
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
        <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Informações Básicas</TabsTrigger>
            <TabsTrigger value="permissions">Permissões</TabsTrigger>
            <TabsTrigger value="properties">Propriedades</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 pt-4">
            {/* ... (código das informações básicas sem alterações) ... */}
          </TabsContent>

          <TabsContent value="permissions" className="space-y-4 pt-4">
            <PermissionsEditor permissions={permissions} onChange={setPermissions} userRole={role} />
          </TabsContent>

          {/* ALTERAÇÃO: Conteúdo da aba "Propriedades" agora é condicional */}
          <TabsContent value="properties" className="space-y-4 pt-4">
            {role === 'faxineira' ? (
              // NOVO: Interface para gerenciar propriedades da faxineira
              <div className="space-y-3">
                <Label className="text-base font-medium">Propriedades Vinculadas</Label>
                <p className="text-sm text-muted-foreground">
                  Selecione as propriedades que esta faxineira poderá ver e ser designada para limpezas.
                </p>
                <div className="max-h-60 overflow-y-auto rounded-md border p-4 space-y-2">
                  {allProperties.map(prop => (
                    <div key={prop.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`prop-${prop.id}`}
                        checked={cleanerLinkedProperties.includes(prop.id)}
                        onCheckedChange={() => handleCleanerPropertyToggle(prop.id)}
                      />
                      <Label htmlFor={`prop-${prop.id}`} className="font-normal">
                        {prop.nickname || prop.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Interface antiga para os outros roles
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
