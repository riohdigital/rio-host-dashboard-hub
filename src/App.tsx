
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { UserPermissionsProvider } from "@/contexts/UserPermissionsContext";
import AuthPage from "./components/auth/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import ReservasPage from "./pages/ReservasPage";
import DespesasPage from "./pages/DespesasPage";
import PropriedadesPage from "./pages/PropriedadesPage";
import InvestmentsPage from "./pages/InvestmentsPage";
import PropertyInvestmentDetailPage from "./pages/PropertyInvestmentDetailPage";
import ConfiguracoesPage from "./pages/ConfiguracoesPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
          {!user ? (
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="*" element={<Navigate to="/auth" replace />} />
            </Routes>
          ) : (
            <UserPermissionsProvider>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/reservas" element={<ReservasPage />} />
                <Route path="/despesas" element={<DespesasPage />} />
                <Route path="/propriedades" element={<PropriedadesPage />} />
                <Route path="/investimentos" element={<InvestmentsPage />} />
                <Route path="/investimentos/:propertyId" element={<PropertyInvestmentDetailPage />} />
                <Route path="/configuracoes" element={<ConfiguracoesPage />} />
                <Route path="/auth" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </UserPermissionsProvider>
          )}
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
