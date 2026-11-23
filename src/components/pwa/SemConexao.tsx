import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Tela "Sem conexão". Os dados do painel ficam no servidor, então sem
 * internet não há o que mostrar com segurança; a tela some sozinha quando a
 * conexão volta.
 */
const SemConexao = () => {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="alertdialog"
      aria-labelledby="sem-conexao-titulo"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-surface px-6 pb-safe-b pt-safe-t text-center"
    >
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand">
        <WifiOff className="h-8 w-8" aria-hidden="true" />
      </span>
      <h1 id="sem-conexao-titulo" className="font-display text-2xl font-extrabold text-ink">
        Sem conexão
      </h1>
      <p className="max-w-xs text-[15px] text-gray-600">
        Verifique o Wi-Fi ou os dados móveis. O painel volta sozinho quando a internet voltar.
      </p>
      <Button onClick={() => window.location.reload()} className="min-w-40">
        Tentar de novo
      </Button>
    </div>
  );
};

export default SemConexao;
