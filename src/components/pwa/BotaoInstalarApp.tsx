import React from 'react';
import { Download, PlusSquare, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { useInstalacaoApp } from '@/lib/pwa';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';

interface Props {
  /** linha: item da gaveta "Mais"; botao: botão comum (Configurações) */
  variante?: 'linha' | 'botao';
  className?: string;
  /** Chamado antes de abrir a instrução/prompt (ex.: fechar a gaveta) */
  aoClicar?: () => void;
}

/**
 * "Instalar app": no Android/Chrome abre o pedido de instalação do navegador;
 * no iPhone mostra o caminho Compartilhar → Adicionar à Tela de Início.
 * Some quando o app já está instalado ou o navegador não oferece instalação.
 */
const BotaoInstalarApp = ({ variante = 'botao', className, aoClicar }: Props) => {
  const { estado, instalar } = useInstalacaoApp();
  const [instrucaoIOS, setInstrucaoIOS] = useEstadoPersistente<boolean>(`pwa.instrucaoIOS.${variante}`, false);

  if (estado === 'instalado' || estado === 'indisponivel') return null;

  const clicar = () => {
    aoClicar?.();
    if (estado === 'ios') setInstrucaoIOS(true);
    else void instalar();
  };

  return (
    <>
      {variante === 'linha' ? (
        <button
          type="button"
          onClick={clicar}
          className={cn(
            'flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium text-ink active:bg-surface',
            className,
          )}
        >
          <Download className="h-5 w-5 shrink-0" aria-hidden="true" />
          Instalar app
        </button>
      ) : (
        <Button type="button" variant="outline" onClick={clicar} className={cn('gap-2', className)}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Instalar app
        </Button>
      )}

      <Drawer open={instrucaoIOS} onOpenChange={setInstrucaoIOS} shouldScaleBackground={false}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-display">Instalar no iPhone</DrawerTitle>
            <DrawerDescription>O Rioh Host abre como um app, em tela cheia, direto da Tela de Início.</DrawerDescription>
          </DrawerHeader>
          <ol className="grid gap-3 px-4 text-[15px] text-ink">
            <li className="flex items-center gap-3 rounded-2xl bg-surface p-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand font-mono text-sm text-brand-foreground">1</span>
              <span>
                No Safari, toque em <b>Compartilhar</b>{' '}
                <Share className="inline h-4 w-4 align-[-2px] text-info-600" aria-label="ícone Compartilhar" />
              </span>
            </li>
            <li className="flex items-center gap-3 rounded-2xl bg-surface p-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand font-mono text-sm text-brand-foreground">2</span>
              <span>
                Escolha <b>Adicionar à Tela de Início</b>{' '}
                <PlusSquare className="inline h-4 w-4 align-[-2px]" aria-hidden="true" />
              </span>
            </li>
            <li className="flex items-center gap-3 rounded-2xl bg-surface p-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand font-mono text-sm text-brand-foreground">3</span>
              <span>
                Toque em <b>Adicionar</b>
              </span>
            </li>
          </ol>
          <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button onClick={() => setInstrucaoIOS(false)} className="w-full">
              Entendi
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default BotaoInstalarApp;
