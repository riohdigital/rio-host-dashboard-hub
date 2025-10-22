import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { UserPermissionsProvider } from "@/contexts/UserPermissionsContext";
import { GlobalFiltersProvider } from "@/contexts/GlobalFiltersContext";
import PrivateRoutes from "./components/auth/PrivateRoutes";
import AuthPage from "./components/auth/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import ReservasPage from "./pages/ReservasPage";
import CalendarioPage from "./pages/CalendarioPage";
import DespesasPage from "./pages/DespesasPage";
import PropriedadesPage from "./pages/PropriedadesPage";
import InvestmentsPage from "./pages/InvestmentsPage";
import PropertyInvestmentDetailPage from "./pages/PropertyInvestmentDetailPage";
import RelatoriosPage from "./pages/RelatoriosPage";
import ConfiguracoesPage from "./pages/ConfiguracoesPage";
import FaxineiraDashboard from "./pages/FaxineiraDashboard";
import AnfitriaoAlertaPage from "./pages/AnfitriaoAlertaPage";
import MasterCleaningDashboardPage from "./pages/MasterCleaningDashboardPage";
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

const App = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="text-[#6A6DDF] text-lg">Carregando...</div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {!user ? (
              // Rotas públicas para usuários não logados
              <>
                <Route path="/" element={<LandingPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            ) : (
              // Rotas privadas para usuários logados
              <Route
                path="/*"
                element={
                  <UserPermissionsProvider>
                    <GlobalFiltersProvider>
                      <AIChat />
                      {/* O PrivateRoutes agora envolve todas as páginas internas */}
                      <Routes>
                        <Route element={<PrivateRoutes />}>
                          <Route path="/" element={<Navigate to="/dashboard" replace />} />
                          <Route path="/dashboard" element={<DashboardPage />} />
                          <Route path="/reservas" element={<ReservasPage />} />
                          <Route path="/calendario" element={<CalendarioPage />} />
                          <Route path="/despesas" element={<DespesasPage />} />
                          <Route path="/propriedades" element={<PropriedadesPage />} />
                          <Route path="/investimentos" element={<InvestmentsPage />} />
                          <Route path="/investimentos/:propertyId" element={<PropertyInvestmentDetailPage />} />
                          <Route path="/relatorios" element={<RelatoriosPage />} />
                          <Route path="/configuracoes" element={<ConfiguracoesPage />} />
                          <Route path="/anfitriao-alerta" element={<AnfitriaoAlertaPage />} />
                          <Route path="/faxineira-dashboard" element={<FaxineiraDashboard />} />
                          <Route path="/gestao-faxinas" element={<MasterCleaningDashboardPage />} />
                          <Route path="/auth" element={<Navigate to="/dashboard" replace />} />
                          <Route path="*" element={<NotFound />} />
                        </Route>
                      </Routes>
                    </GlobalFiltersProvider>
                  </UserPermissionsProvider>
                }
              />
            )}
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
