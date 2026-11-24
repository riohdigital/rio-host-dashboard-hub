import { useCallback } from 'react';
import {
  BarChart3,
  Bell,
  Briefcase,
  Calendar,
  CalendarDays,
  CreditCard,
  FileText,
  Home,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  Sparkles,
  Tag,
  TrendingUp,
  ClipboardList,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { limparEscolhasDaSessao } from '@/lib/escolhasGuardadas';

export interface ItemNavegacao {
  nome: string;
  /** Rótulo curto para a barra inferior do celular */
  curto?: string;
  icone: LucideIcon;
  caminho: string;
  /** Ativo só no caminho exato (sem subrotas) */
  exato?: boolean;
}

/**
 * Itens do menu conforme papel e permissões do usuário. É a mesma regra do
 * menu lateral antigo: faxineira vê só "Minhas Faxinas"; Anfitrião Alerta e
 * Gestão de Faxinas dependem de permissão; Painel Gestor aparece para
 * master, gestor e proprietário.
 */
export function useNavegacao() {
  const { isCleaner, isMaster, isOwner, isGestor } = useUserRole();
  const { hasPermission } = useUserPermissions();

  const mostrarGestor = !isCleaner && (isMaster || isGestor || isOwner);

  const itens: ItemNavegacao[] = isCleaner
    ? [{ nome: 'Minhas Faxinas', icone: Calendar, caminho: '/faxineira-dashboard' }]
    : [
        { nome: 'Dashboard', icone: BarChart3, caminho: '/dashboard' },
        { nome: 'Reservas', icone: ClipboardList, caminho: '/reservas' },
        { nome: 'Calendário', icone: CalendarDays, caminho: '/calendario' },
        { nome: 'Despesas', icone: Tag, caminho: '/despesas' },
        { nome: 'Propriedades', icone: Home, caminho: '/propriedades' },
        { nome: 'Precificação', icone: Sparkles, caminho: '/precificacao' },
        { nome: 'Investimentos & ROI', icone: TrendingUp, caminho: '/investimentos' },
        { nome: 'Relatórios', icone: FileText, caminho: '/relatorios' },
        ...(hasPermission('anfitriao_alerta_view')
          ? [{ nome: 'Anfitrião Alerta', icone: Bell, caminho: '/anfitriao-alerta' }]
          : []),
        ...(hasPermission('gestao_faxinas_view')
          ? [{ nome: 'Gestão de Faxinas', icone: Calendar, caminho: '/gestao-faxinas' }]
          : []),
        { nome: 'Configurações', icone: Settings, caminho: '/configuracoes' },
      ];

  const itensGestor: ItemNavegacao[] = mostrarGestor
    ? [
        { nome: 'Dashboard', icone: LayoutDashboard, caminho: '/painel-gestor', exato: true },
        { nome: 'Pagamentos', icone: CreditCard, caminho: '/painel-gestor/pagamentos' },
      ]
    : [];

  return { itens, itensGestor, mostrarGestor, isCleaner };
}

export const ICONE_GESTOR = Briefcase;

/** Títulos das telas, para a barra superior do celular */
const TITULOS: [RegExp, string][] = [
  [/^\/dashboard/, 'Dashboard'],
  [/^\/reservas/, 'Reservas'],
  [/^\/calendario/, 'Calendário'],
  [/^\/despesas/, 'Despesas'],
  [/^\/propriedades/, 'Propriedades'],
  [/^\/precificacao/, 'Precificação'],
  [/^\/investimentos/, 'Investimentos & ROI'],
  [/^\/relatorios/, 'Relatórios'],
  [/^\/configuracoes/, 'Configurações'],
  [/^\/anfitriao-alerta/, 'Anfitrião Alerta'],
  [/^\/faxineira-dashboard/, 'Minhas Faxinas'],
  [/^\/gestao-faxinas/, 'Gestão de Faxinas'],
  [/^\/painel-gestor\/pagamentos/, 'Pagamentos'],
  [/^\/painel-gestor/, 'Painel Gestor'],
];

export function tituloDaRota(caminho: string): string {
  return TITULOS.find(([re]) => re.test(caminho))?.[1] ?? 'Rioh Host';
}

export function rotaAtiva(caminhoAtual: string, item: ItemNavegacao): boolean {
  if (item.exato) return caminhoAtual === item.caminho;
  return caminhoAtual === item.caminho || caminhoAtual.startsWith(item.caminho + '/');
}

/** Sair: mesmo comportamento do menu antigo */
export function useSair() {
  const { toast } = useToast();
  return useCallback(async () => {
    // Saiu de propósito: o que estava digitado ou aberto nas telas não fica no aparelho
    limparEscolhasDaSessao();
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        const { error } = await supabase.auth.signOut();
        if (error) {
          toast({
            title: 'Erro ao sair',
            description: error.message,
            variant: 'destructive',
          });
        }
      } else {
        window.location.href = '/auth';
      }
    } catch (error) {
      console.error('Erro durante logout:', error);
      window.location.href = '/auth';
    }
  }, [toast]);
}
