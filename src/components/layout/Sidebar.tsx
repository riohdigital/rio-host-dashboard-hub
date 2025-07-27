
import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  BarChart3, 
  Calendar, 
  Tag, 
  Home, 
  Settings, 
  LogOut,
  TrendingUp,
  FileText
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import GlobalFilters from './GlobalFilters';

const Sidebar = () => {
  const { toast } = useToast();

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

  const menuItems = [
    { name: 'Dashboard', icon: BarChart3, path: '/dashboard' },
    { name: 'Reservas', icon: Calendar, path: '/reservas' },
    { name: 'Despesas', icon: Tag, path: '/despesas' },
    { name: 'Propriedades', icon: Home, path: '/propriedades' },
    { name: 'Investimentos & ROI', icon: TrendingUp, path: '/investimentos' },
    { name: 'Relatórios', icon: FileText, path: '/relatorios' },
    { name: 'Configurações', icon: Settings, path: '/configuracoes' },
  ];

  return (
    <div className="w-64 bg-white h-screen shadow-lg fixed left-0 top-0 flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold text-[#6A6DDF]">
          Rioh Host Rentals
        </h1>
      </div>
      
      {/* Filtros Globais */}
      <div className="border-b">
        <GlobalFilters />
      </div>
      
      <nav className="flex-1 px-4 py-6">
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
                <item.icon 
                  className={`mr-3 h-5 w-5`}
                />
                {item.name}
              </NavLink>
            </li>
          ))}
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
