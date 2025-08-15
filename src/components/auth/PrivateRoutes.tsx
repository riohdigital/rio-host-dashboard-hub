import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { Loader2 } from 'lucide-react';

const PrivateRoutes = () => {
  // Usamos seu hook para saber o role e se ele ainda está carregando
  const { role, loading: permissionsLoading } = useUserPermissions();
  const location = useLocation();

  // Se as permissões ainda estiverem carregando, mostramos um loader para evitar um "flash" da página errada
  if (permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <Loader2 className="h-8 w-8 animate-spin text-[#6A6DDF]" />
      </div>
    );
  }

  // Lógica de Redirecionamento para FAXINEIRA
  if (role === 'faxineira' && location.pathname !== '/faxineira-dashboard') {
    // Se o usuário é 'faxineira' e NÃO está no dashboard dela, força o redirecionamento para lá.
    return <Navigate to="/faxineira-dashboard" replace />;
  }

  // Lógica de Proteção DO DASHBOARD DA FAXINEIRA
  if (role !== 'faxineira' && location.pathname === '/faxineira-dashboard') {
    // Se o usuário NÃO é 'faxineira' mas tenta acessar o dashboard dela,
    // redireciona para o dashboard principal.
    return <Navigate to="/dashboard" replace />;
  }

  // Se nenhuma das regras de redirecionamento acima for atendida, o usuário tem permissão
  // para ver a página que solicitou. O <Outlet /> renderiza a rota filha correspondente.
  return <Outlet />;
};

export default PrivateRoutes;
