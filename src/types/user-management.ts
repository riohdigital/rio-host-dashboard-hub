export interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name?: string;
  role: 'master' | 'owner' | 'editor' | 'viewer' | 'faxineira';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserPermission {
  id: string;
  user_id: string;
  permission_type: string;
  permission_value: boolean;
  resource_id?: string;
  created_at: string;
}

export interface UserPropertyAccess {
  id: string;
  user_id: string;
  property_id: string;
  access_level: 'full' | 'read_only' | 'restricted';
  created_at: string;
}

export type PermissionType = 
  | 'properties_view_all'
  | 'properties_view_assigned'
  | 'properties_create'
  | 'properties_edit'
  | 'properties_delete'
  | 'reservations_view_all'
  | 'reservations_view_assigned'
  | 'reservations_create'
  | 'reservations_edit'
  | 'reservations_delete'
  | 'expenses_view'
  | 'expenses_create'
  | 'expenses_edit'
  | 'investments_view'
  | 'investments_create'
  | 'reports_view'
  | 'reports_create'
  | 'dashboard_revenue'
  | 'dashboard_occupancy'
  | 'dashboard_expenses'
  | 'dashboard_profit'
  | 'users_manage'
  | 'system_settings';

export interface PermissionCategory {
  name: string;
  label: string;
  permissions: {
    type: PermissionType;
    label: string;
    description: string;
  }[];
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    name: 'properties',
    label: 'Propriedades',
    permissions: [
      { type: 'properties_view_all', label: 'Ver todas as propriedades', description: 'Acesso completo a todas as propriedades' },
      { type: 'properties_view_assigned', label: 'Ver propriedades atribuídas', description: 'Ver apenas propriedades específicas' },
      { type: 'properties_create', label: 'Criar propriedades', description: 'Criar novas propriedades' },
      { type: 'properties_edit', label: 'Editar propriedades', description: 'Modificar informações das propriedades' },
      { type: 'properties_delete', label: 'Excluir propriedades', description: 'Remover propriedades do sistema' },
    ]
  },
  {
    name: 'reservations',
    label: 'Reservas',
    permissions: [
      { type: 'reservations_view_all', label: 'Ver todas as reservas', description: 'Acesso completo a todas as reservas' },
      { type: 'reservations_view_assigned', label: 'Ver reservas atribuídas', description: 'Ver reservas das propriedades atribuídas' },
      { type: 'reservations_create', label: 'Criar reservas', description: 'Adicionar novas reservas' },
      { type: 'reservations_edit', label: 'Editar reservas', description: 'Modificar informações das reservas' },
      { type: 'reservations_delete', label: 'Excluir reservas', description: 'Remover reservas do sistema' },
    ]
  },
  {
    name: 'financial',
    label: 'Financeiro',
    permissions: [
      { type: 'expenses_view', label: 'Ver despesas', description: 'Visualizar despesas do sistema' },
      { type: 'expenses_create', label: 'Criar despesas', description: 'Adicionar novas despesas' },
      { type: 'expenses_edit', label: 'Editar despesas', description: 'Modificar despesas existentes' },
      { type: 'investments_view', label: 'Ver investimentos', description: 'Visualizar investimentos' },
      { type: 'investments_create', label: 'Criar investimentos', description: 'Adicionar novos investimentos' },
    ]
  },
  {
    name: 'dashboard',
    label: 'Dashboard',
    permissions: [
      { type: 'dashboard_revenue', label: 'Ver receita', description: 'KPIs de receita e faturamento' },
      { type: 'dashboard_occupancy', label: 'Ver ocupação', description: 'KPIs de taxa de ocupação' },
      { type: 'dashboard_expenses', label: 'Ver despesas', description: 'KPIs de despesas' },
      { type: 'dashboard_profit', label: 'Ver lucro', description: 'KPIs de lucro líquido' },
    ]
  },
  {
    name: 'reports',
    label: 'Relatórios',
    permissions: [
      { type: 'reports_view', label: 'Ver relatórios', description: 'Visualizar relatórios do sistema' },
      { type: 'reports_create', label: 'Criar relatórios', description: 'Gerar e exportar relatórios' },
    ]
  },
  {
    name: 'system',
    label: 'Sistema',
    permissions: [
      { type: 'users_manage', label: 'Gerenciar usuários', description: 'Administrar contas de usuários' },
      { type: 'system_settings', label: 'Configurações do sistema', description: 'Acessar configurações avançadas' },
    ]
  }
];