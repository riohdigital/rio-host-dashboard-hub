import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Trash2, UserCheck, UserRound, UserX } from 'lucide-react';
import type { UserProfile } from '@/types/user-management';
import { useEhCelular } from '@/hooks/useMidia';
import LinhaLista from '@/components/comum/LinhaLista';
import { ListaLinhas } from '@/components/comum/GrupoLista';
import FolhaDetalhes from '@/components/comum/FolhaDetalhes';
import { Etiqueta } from '@/components/comum/Etiquetas';
import { useItemAberto } from '@/hooks/useItemAberto';

interface UserListTableProps {
  users: UserProfile[];
  onEditUser: (user: UserProfile) => void;
  onToggleUserStatus: (user: UserProfile) => void;
  onDeleteUser: (user: UserProfile) => void;
  loading?: boolean;
}

const UserListTable: React.FC<UserListTableProps> = ({
  users,
  onEditUser,
  onToggleUserStatus,
  onDeleteUser,
  loading = false
}) => {
  // Celular: a tabela (6 colunas) passava da tela; vira linhas que abrem uma folha
  const celular = useEhCelular();
  // A folha do usuário volta aberta depois de recarregar (guarda só o id)
  const folha = useItemAberto('usuarios.folha', users, { carregando: loading });
  const aberto = folha.aberto ? folha.item : null;
  const setAberto = (u: UserProfile | null) => (u ? folha.abrir(u) : folha.limpar());
  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'master': return 'default';
      case 'owner': return 'secondary';
      case 'editor': return 'outline';
      case 'viewer': return 'secondary';
      default: return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'master': return 'Mestre';
      case 'owner': return 'Proprietário';
      case 'editor': return 'Editor';
      case 'viewer': return 'Visualizador';
      default: return role;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (celular) {
    const fechar = () => setAberto(null);
    return (
      <>
        {users.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum usuário encontrado</p>
        ) : (
          <ListaLinhas>
            {users.map((user) => (
              <LinhaLista
                key={user.id}
                icone={UserRound}
                tomIcone={user.is_active ? 'brand' : 'neutro'}
                titulo={user.full_name || 'Nome não informado'}
                subtitulo={user.email}
                etiqueta={<Etiqueta tom={user.role === 'master' ? 'brand' : 'neutro'}>{getRoleLabel(user.role)}</Etiqueta>}
                className={user.is_active ? undefined : 'opacity-70'}
                aoTocar={() => setAberto(user)}
              />
            ))}
          </ListaLinhas>
        )}
        <FolhaDetalhes
          aberta={!!aberto}
          aoMudar={(v) => !v && fechar()}
          titulo={aberto?.full_name || 'Nome não informado'}
          etiqueta={aberto ? <Etiqueta tom={aberto.is_active ? 'success' : 'neutro'}>{aberto.is_active ? 'Ativo' : 'Inativo'}</Etiqueta> : undefined}
          subtitulo={aberto?.email}
        >
          {aberto && (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-gray-500">Papel</dt>
                  <dd className="text-gray-900">{getRoleLabel(aberto.role)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Criado em</dt>
                  <dd className="font-mono tabular-nums text-gray-900">{new Date(aberto.created_at).toLocaleDateString('pt-BR')}</dd>
                </div>
              </dl>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="min-h-11 gap-2" onClick={() => { const u = aberto; fechar(); onEditUser(u); }}>
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>
                <Button variant="outline" className="min-h-11 gap-2" onClick={() => { const u = aberto; fechar(); onToggleUserStatus(u); }}>
                  {aberto.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                  {aberto.is_active ? 'Desativar' : 'Ativar'}
                </Button>
              </div>
              {/* Excluir longe de editar; a confirmação é a da própria seção */}
              {aberto.role !== 'master' && (
                <Button
                  variant="ghost"
                  className="min-h-11 w-full text-danger-600 hover:bg-danger-50 hover:text-danger-700"
                  onClick={() => { const u = aberto; fechar(); onDeleteUser(u); }}
                >
                  Excluir usuário
                </Button>
              )}
            </>
          )}
        </FolhaDetalhes>
      </>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Criado em</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">
                {user.full_name || 'Nome não informado'}
              </TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <Badge variant={getRoleBadgeVariant(user.role)}>
                  {getRoleLabel(user.role)}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={user.is_active ? 'default' : 'secondary'}>
                  {user.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
              </TableCell>
              <TableCell>
                {new Date(user.created_at).toLocaleDateString('pt-BR')}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEditUser(user)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onToggleUserStatus(user)}
                  >
                    {user.is_active ? (
                      <UserX className="h-4 w-4" />
                    ) : (
                      <UserCheck className="h-4 w-4" />
                    )}
                  </Button>
                  {user.role !== 'master' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDeleteUser(user)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                Nenhum usuário encontrado
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default UserListTable;