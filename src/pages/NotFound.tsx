import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  const voltar = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/dashboard");
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center max-sm:px-0">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand">
        <Compass className="h-8 w-8" aria-hidden="true" />
      </span>
      <p className="font-mono text-sm font-semibold text-brand">Erro 404</p>
      <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">Página não encontrada</h1>
      <p className="max-w-sm text-gray-600">
        O endereço <span className="break-all font-mono text-sm">{location.pathname}</span> não existe ou mudou de lugar.
      </p>
      {/* Celular: botões em largura total, com 44px de altura */}
      <div className="flex w-full max-w-sm flex-col gap-2 sm:max-w-none sm:flex-row sm:justify-center max-sm:[&>button]:min-h-11">
        <Button onClick={voltar} variant="outline" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={() => navigate("/dashboard")}>Ir para o Dashboard</Button>
      </div>
    </div>
  );
};

export default NotFound;
