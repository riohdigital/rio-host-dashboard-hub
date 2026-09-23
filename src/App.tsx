import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth, AuthProvider } from "./hooks/useAuth";
import { UserPermissionsProvider } from "@/contexts/UserPermissionsContext";
import { GlobalFiltersProvider } from "@/contexts/GlobalFiltersContext";
import PrivateRoutes from "./components/auth/PrivateRoutes";
import AuthPage from "./components/auth/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import ReservasPage from "./pages/ReservasPage";
import CalendarioPage from "./pages/CalendarioPage";
import DespesasPage from "./pages/DespesasPage";
import PropriedadesPage from "./pages/PropriedadesPage";
import PrecificacaoPage from "./pages/PrecificacaoPage";
import InvestmentsPage from "./pages/InvestmentsPage";
import PropertyInvestmentDetailPage from "./pages/PropertyInvestmentDetailPage";
import RelatoriosPage from "./pages/RelatoriosPage";
import ConfiguracoesPage from "./pages/ConfiguracoesPage";
import FaxineiraDashboard from "./pages/FaxineiraDashboard";
import AnfitriaoAlertaPage from "./pages/AnfitriaoAlertaPage";
import MasterCleaningDashboardPage from "./pages/MasterCleaningDashboardPage";
import PainelGestorPage from "./pages/PainelGestorPage";
import PagamentosPage from "./pages/PagamentosPage";
import NotFound from "./pages/NotFound";
import LandingPage from "./pages/LandingPage";
import { AIChat } from "@/components/chat/AIChat";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      refetchOnWindowFocus: false,
    },
  },
});

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="text-[#6A6DDF] text-lg font-medium animate-pulse">Carregando...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/auth" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage />} />

      {/* Rotas protegidas */}
      <Route
        path="/*"
        element={
          !user ? (
            <Navigate to="/auth" replace />
          ) : (
            <UserPermissionsProvider>
              <GlobalFiltersProvider>
                <AIChat />
                <Routes>
                  <Route element={<PrivateRoutes />}>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/reservas" element={<ReservasPage />} />
                    <Route path="/calendario" element={<CalendarioPage />} />
                    <Route path="/despesas" element={<DespesasPage />} />
                    <Route path="/propriedades" element={<PropriedadesPage />} />
                    <Route path="/precificacao" element={<PrecificacaoPage />} />
                    <Route path="/investimentos" element={<InvestmentsPage />} />
                    <Route path="/investimentos/:propertyId" element={<PropertyInvestmentDetailPage />} />
                    <Route path="/relatorios" element={<RelatoriosPage />} />
                    <Route path="/configuracoes" element={<ConfiguracoesPage />} />
                    <Route path="/anfitriao-alerta" element={<AnfitriaoAlertaPage />} />
                    <Route path="/faxineira-dashboard" element={<FaxineiraDashboard />} />
                    <Route path="/gestao-faxinas" element={<MasterCleaningDashboardPage />} />
                    <Route path="/painel-gestor" element={<PainelGestorPage />} />
                    <Route path="/painel-gestor/pagamentos" element={<PagamentosPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
              </GlobalFiltersProvider>
            </UserPermissionsProvider>
          )
        }
      />
    </Routes>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
