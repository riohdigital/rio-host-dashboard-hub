import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useEhCelular } from '@/hooks/useMidia';
import { cn } from '@/lib/utils';

interface JanelaResponsivaProps {
  aberta: boolean;
  aoMudar: (aberta: boolean) => void;
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  children: React.ReactNode;
  /** Rodapé fixo (botões). No celular fica colado embaixo. */
  rodape?: React.ReactNode;
  /** Formulários longos: tela cheia no celular */
  telaCheia?: boolean;
  /** Largura no desktop */
  largura?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const LARGURAS = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

/**
 * Janela que se adapta: Dialog no desktop; no celular, gaveta que sobe de
 * baixo (ou tela cheia, para formulários longos).
 */
const JanelaResponsiva = ({
  aberta,
  aoMudar,
  titulo,
  descricao,
  children,
  rodape,
  telaCheia = false,
  largura = 'md',
  className,
}: JanelaResponsivaProps) => {
  const celular = useEhCelular();

  if (celular && !telaCheia) {
    return (
      <Drawer open={aberta} onOpenChange={aoMudar} shouldScaleBackground={false}>
        <DrawerContent className={cn('max-h-[92dvh]', className)}>
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-display">{titulo}</DrawerTitle>
            {descricao ? (
              <DrawerDescription>{descricao}</DrawerDescription>
            ) : (
              <DrawerDescription className="sr-only">{titulo}</DrawerDescription>
            )}
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
          {rodape && (
            <div className="flex flex-col-reverse gap-2 border-t bg-background px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 [&>*]:w-full">
              {rodape}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={aberta} onOpenChange={aoMudar}>
      <DialogContent
        className={cn(
          'flex max-h-[90vh] flex-col gap-0 p-0',
          LARGURAS[largura],
          // Celular em tela cheia
          telaCheia &&
            'max-sm:inset-0 max-sm:h-dvh max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0',
          'sm:rounded-2xl',
          className,
        )}
      >
        <DialogHeader className="shrink-0 border-b px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))] text-left sm:px-6 sm:pt-5">
          <DialogTitle className="pr-8 font-display text-lg font-bold">{titulo}</DialogTitle>
          {descricao ? (
            <DialogDescription>{descricao}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{titulo}</DialogDescription>
          )}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">{children}</div>
        {rodape && (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t bg-background px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:justify-end sm:px-6 sm:pb-4">
            {rodape}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default JanelaResponsiva;
