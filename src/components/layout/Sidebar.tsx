
import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  BarChart3, 
  Calendar, 
  Tag, 
  Home, 
  Settings, 
  LogOut,
  TrendingUp,
  FileText,
  Bell,
  Briefcase,
  ChevronDown,
  ChevronRight,
  CreditCard,
  LayoutDashboard
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from '@/hooks/useUserRole';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import GlobalFilters from './GlobalFilters';

const Sidebar = () => {
  const { toast } = useToast();
  const { isCleaner, isMaster, isOwner, isGestor } = useUserRole();
  const { hasPermission } = useUserPermissions();
  const location = useLocation();
  
  const isGestorSection = location.pathname.startsWith('/painel-gestor');
  const [gestorOpen, setGestorOpen] = useState(isGestorSection);

  const handleLogout = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const { error } = await supabase.auth.signOut();
        if (error) {
          toast({
            title: "Erro ao sair",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        window.location.href = '/auth';
      }
    } catch (error) {
      console.error('Erro durante logout:', error);
      window.location.href = '/auth';
    }
  };

  const showGestorMenu = isMaster || isGestor || isOwner;

  const menuItems = isCleaner ? [
    { name: 'Minhas Faxinas', icon: Calendar, path: '/faxineira-dashboard' },
  ] : [
    { name: 'Dashboard', icon: BarChart3, path: '/dashboard' },
    { name: 'Reservas', icon: Calendar, path: '/reservas' },
    { name: 'Calendário', icon: Calendar, path: '/calendario' },
    { name: 'Despesas', icon: Tag, path: '/despesas' },
    { name: 'Propriedades', icon: Home, path: '/propriedades' },
    { name: 'Investimentos & ROI', icon: TrendingUp, path: '/investimentos' },
    { name: 'Relatórios', icon: FileText, path: '/relatorios' },
    ...(hasPermission('anfitriao_alerta_view') ? [{ name: 'Anfitrião Alerta', icon: Bell, path: '/anfitriao-alerta' }] : []),
    ...(hasPermission('gestao_faxinas_view') ? [{ name: 'Gestão de Faxinas', icon: Calendar, path: '/gestao-faxinas' }] : []),
    { name: 'Configurações', icon: Settings, path: '/configuracoes' },
  ];

  return (
    <div className="w-64 bg-white h-screen shadow-lg fixed left-0 top-0 flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold text-[#6A6DDF]">
          Rioh Host Rentals
        </h1>
      </div>
      
      {/* Filtros Globais - ocultar para faxineiras */}
      {!isCleaner && (
        <div className="border-b">
          <GlobalFilters />
        </div>
      )}
      
      <nav className="flex-1 px-4 py-6 overflow-y-auto">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-[#F472B6] text-white'
                      : 'text-[#374151] hover:bg-[#F8F9FA]'
                  }`
                }
              >
                <item.icon className={`mr-3 h-5 w-5`} />
                {item.name}
              </NavLink>
            </li>
          ))}

          {/* Painel Gestor - Collapsible Submenu */}
          {!isCleaner && showGestorMenu && (
            <li>
              <button
                onClick={() => setGestorOpen(!gestorOpen)}
                className={`flex items-center w-full px-4 py-3 rounded-lg transition-colors ${
                  isGestorSection
                    ? 'bg-[#6A6DDF]/10 text-[#6A6DDF]'
                    : 'text-[#374151] hover:bg-[#F8F9FA]'
                }`}
              >
                <Briefcase className="mr-3 h-5 w-5" />
                <span className="flex-1 text-left">Painel Gestor</span>
                {gestorOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>

              {gestorOpen && (
                <ul className="mt-1 ml-4 space-y-1 border-l-2 border-[#6A6DDF]/20 pl-3">
                  <li>
                    <NavLink
                      to="/painel-gestor"
                      end
                      className={({ isActive }) =>
                        `flex items-center px-3 py-2 rounded-lg transition-colors text-sm ${
                          isActive
                            ? 'bg-[#F472B6] text-white'
                            : 'text-[#374151] hover:bg-[#F8F9FA]'
                        }`
                      }
                    >
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                    </NavLink>
                  </li>
                  <li>
                    <NavLink
                      to="/painel-gestor/pagamentos"
                      className={({ isActive }) =>
                        `flex items-center px-3 py-2 rounded-lg transition-colors text-sm ${
                          isActive
                            ? 'bg-[#F472B6] text-white'
                            : 'text-[#374151] hover:bg-[#F8F9FA]'
                        }`
                      }
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      Pagamentos
                    </NavLink>
                  </li>
                </ul>
              )}
            </li>
          )}
        </ul>
      </nav>
      
      <div className="p-4 border-t">
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-4 py-3 text-[#374151] hover:bg-[#F8F9FA] rounded-lg transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Sair
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
