import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Search, UserPlus, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import UserListTable from '@/components/user-management/UserListTable';
import UserEditModal from '@/components/user-management/UserEditModal';
import UserInviteForm from '@/components/user-management/UserInviteForm';
import type { UserProfile } from '@/types/user-management';

const UserManagementSection = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  
  // CORREÇÃO 1: Acessando o estado de loading do hook de permissões
  const { hasPermission, loading: permissionsLoading } = useUserPermissions();
  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers((data || []) as UserProfile[]);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a lista de usuários.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // CORREÇÃO 2: A busca de usuários agora só ocorre DEPOIS que as permissões foram carregadas
    if (!permissionsLoading) {
      if (hasPermission('users_manage')) {
        fetchUsers();
      } else {
        // Se não tem permissão, não precisa fazer nada, o componente já tratará a exibição
        setLoading(false); // Garante que o loading principal pare
      }
    }
  }, [permissionsLoading]);

  useEffect(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    const filtered = users.filter(user => 
      user.email?.toLowerCase().includes(lowercasedFilter) ||
      user.full_name?.toLowerCase().includes(lowercasedFilter)
    );
    setFilteredUsers(filtered);
  }, [users, searchTerm]);

  const handleEditUser = (user: UserProfile) => {
    setSelectedUser(user);
    setEditModalOpen(true);
  };

  const handleToggleUserStatus = async (user: UserProfile) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          is_active: !user.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.user_id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Usuário ${!user.is_active ? 'ativado' : 'desativado'} com sucesso.`,
      });

      fetchUsers();
    } catch (error: any) {
      console.error('Erro ao alterar status do usuário:', error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = (user: UserProfile) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      // Idealmente, isso seria uma única chamada a uma função no Supabase Edge Functions para garantir atomicidade.
      await supabase.from('user_permissions').delete().eq('user_id', userToDelete.user_id);
      await supabase.from('user_property_access').delete().eq('user_id', userToDelete.user_id);
      const { error } = await supabase.from('user_profiles').delete().eq('user_id', userToDelete.user_id);
      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Usuário removido com sucesso.",
      });

      fetchUsers();
    } catch (error: any) {
      console.error('Erro ao deletar usuário:', error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  // CORREÇÃO 3: Verificação do estado de loading ANTES de verificar as permissões.
  if (permissionsLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Verificando permissões...</span>
      </div>
    );
  }

  // A verificação de permissão agora acontece apenas depois do loading.
  if (!hasPermission('users_manage')) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">
          Você não tem permissão para acessar o gerenciamento de usuários.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-primary mb-2">Gerenciamento de Usuários</h2>
        <p className="text-muted-foreground">
          Gerencie usuários, permissões e acesso às funcionalidades do sistema.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2">
          <Button onClick={() => setShowInviteForm(!showInviteForm)}>
            <UserPlus className="h-4 w-4 mr-2" />
            {showInviteForm ? 'Ocultar Convite' : 'Convidar Usuário'}
          </Button>
          <Button variant="outline" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar por email ou nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {showInviteForm && (
        <UserInviteForm onUserInvited={() => {
          fetchUsers();
          setShowInviteForm(false);
        }} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Usuários Cadastrados</CardTitle>
          <CardDescription>
            Total de {filteredUsers.length} usuário(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserListTable
            users={filteredUsers}
            onEditUser={handleEditUser}
            onToggleUserStatus={handleToggleUserStatus}
            onDeleteUser={handleDeleteUser}
            loading={loading}
          />
        </CardContent>
      </Card>

      <UserEditModal
        user={selectedUser}
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedUser(null);
        }}
        onUserUpdated={fetchUsers}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o usuário <strong>{userToDelete?.email}</strong>?
              Esta ação não pode ser desfeita e todas as permissões e acessos serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteUser} className="bg-destructive hover:bg-destructive/90">
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserManagementSection;
