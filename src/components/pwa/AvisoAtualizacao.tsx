import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

/** Confere se há versão nova a cada hora, além de ao abrir o app */
const INTERVALO_VERIFICACAO = 60 * 60 * 1000;

/**
 * Registra o service worker e avisa quando há versão nova:
 * "Nova versão disponível · Atualizar". Só atualiza quando a pessoa toca,
 * para não recarregar no meio de um formulário.
 */
const AvisoAtualizacao = () => {
  const {
    needRefresh: [novaVersao, setNovaVersao],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      if (!registro) return;
      setInterval(() => {
        if (navigator.onLine) void registro.update();
      }, INTERVALO_VERIFICACAO);
    },
  });

  if (!novaVersao) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(theme(spacing.tabbar)+0.75rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-xl lg:bottom-6"
    >
      <RefreshCw className="h-4 w-4 shrink-0 text-brand-300" aria-hidden="true" />
      <span className="flex-1">Nova versão disponível</span>
      <button
        type="button"
        onClick={() => void updateServiceWorker(true)}
        className="min-h-10 rounded-full bg-brand px-4 font-semibold text-brand-foreground hover:bg-brand-hover"
      >
        Atualizar
      </button>
      <button
        type="button"
        onClick={() => setNovaVersao(false)}
        aria-label="Fechar aviso"
        className="grid h-10 w-10 place-items-center rounded-full text-gray-300 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default AvisoAtualizacao;
