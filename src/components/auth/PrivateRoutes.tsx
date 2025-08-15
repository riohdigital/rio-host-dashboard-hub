import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { Loader2 } from 'lucide-react';

const PrivateRoutes = () => {
  // Usamos seu hook para saber o role e se ele ainda está carregando
  const { role, loading: permissionsLoading } = useUserPermissions();
  const location = useLocation();

  // 1. Enquanto as permissões estiverem carregando, mostramos um loader.
  if (permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <Loader2 className="h-8 w-8 animate-spin text-[#6A6DDF]" />
      </div>
    );
  }

  // 2. NOVO: Se o carregamento terminou mas o role AINDA NÃO foi definido,
  //    esperamos ou mostramos uma mensagem. Isso evita o redirecionamento prematuro.
  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="text-muted-foreground">Verificando perfil do usuário...</div>
      </div>
    );
  }

  // 3. Agora que temos certeza do role, aplicamos as regras de redirecionamento.
  if (role === 'faxineira') {
    // Se for 'faxineira' e tentar acessar qualquer outra página, redireciona.
    if (location.pathname !== '/faxineira-dashboard') {
      return <Navigate to="/faxineira-dashboard" replace />;
    }
  } else {
    // Se NÃO for 'faxineira' e tentar acessar a página dela, redireciona.
    if (location.pathname === '/faxineira-dashboard') {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // 4. Se nenhuma regra de redirecionamento foi aplicada, permite o acesso à rota solicitada.
  return <Outlet />;
};

export default PrivateRoutes;
