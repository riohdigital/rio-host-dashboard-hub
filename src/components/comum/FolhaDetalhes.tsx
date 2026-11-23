/**
 * FolhaDetalhes — os detalhes e as ações de um item (regras 4 e 12,
 * `.m-sheet` do plano). Abaixo de 1024px é uma folha que sobe de baixo
 * (Drawer/vaul); no computador, a janela de sempre (JanelaResponsiva).
 *
 *   <FolhaDetalhes aberta={!!sel} aoMudar={(v) => !v && setSel(null)}
 *     titulo={sel.guest_name} etiqueta={<EtiquetaPlataforma plataforma={sel.platform} />}
 *     subtitulo="Búzios · 27 nov → 1 dez · 4 noites"
 *     acoes={<><Button variant="outline">Recibo</Button><Button variant="outline">Editar</Button></>}
 *     excluir={{ rotulo: 'Excluir reserva', aoConfirmar: excluirReserva }}>
 *     …campos…
 *   </FolhaDetalhes>
 *
 * `acoes` ficam numa grade no pé (até 3 por linha). `excluir` fica sozinho,
 * por último e longe de editar, e sempre pede confirmação antes de agir.
 */
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useEhCompacto } from '@/hooks/useMidia';
import { cn } from '@/lib/utils';
import JanelaResponsiva from './JanelaResponsiva';

export interface AcaoExcluir {
  /** Texto do botão (ex.: "Excluir reserva") */
  rotulo: string;
  aoConfirmar: () => void | Promise<void>;
  /** Pergunta da confirmação; padrão "Excluir?" */
  titulo?: string;
  /** Explicação na confirmação; padrão "Esta ação não pode ser desfeita." */
  descricao?: React.ReactNode;
}

interface FolhaDetalhesProps {
  aberta: boolean;
  aoMudar: (aberta: boolean) => void;
  titulo: React.ReactNode;
  /** Ao lado do título (ex.: canal) */
  etiqueta?: React.ReactNode;
  /** Uma linha abaixo do título (imóvel · datas · código) */
  subtitulo?: React.ReactNode;
  children?: React.ReactNode;
  /** Botões de ação (Editar, Recibo…) */
  acoes?: React.ReactNode;
  excluir?: AcaoExcluir;
  /** Largura da janela no computador */
  largura?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

/** O botão "Excluir" com a confirmação, para usar fora da folha (ex.: dentro de um formulário) */
export const BotaoExcluir = ({ excluir }: { excluir: AcaoExcluir }) => {
  const [confirmando, setConfirmando] = useState(false);
  const [trabalhando, setTrabalhando] = useState(false);

  const confirmar = async () => {
    setTrabalhando(true);
    try {
      await excluir.aoConfirmar();
      setConfirmando(false);
    } finally {
      setTrabalhando(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setConfirmando(true)}
        className="min-h-11 w-full text-danger-600 hover:bg-danger-50 hover:text-danger-700"
      >
        {excluir.rotulo}
      </Button>
      <AlertDialog open={confirmando} onOpenChange={(v) => !trabalhando && setConfirmando(v)}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{excluir.titulo ?? 'Excluir?'}</AlertDialogTitle>
            <AlertDialogDescription>{excluir.descricao ?? 'Esta ação não pode ser desfeita.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={trabalhando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmar();
              }}
              disabled={trabalhando}
              className="bg-danger-600 text-white hover:bg-danger-700"
            >
              {trabalhando && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {excluir.rotulo}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const FolhaDetalhes = ({
  aberta,
  aoMudar,
  titulo,
  etiqueta,
  subtitulo,
  children,
  acoes,
  excluir,
  largura = 'md',
  className,
}: FolhaDetalhesProps) => {
  const compacto = useEhCompacto();

  const pe = (acoes || excluir) && (
    <div className="grid gap-2">
      {acoes && <div className="grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-2 [&>*]:min-h-11 [&>*]:w-full">{acoes}</div>}
      {excluir && <BotaoExcluir excluir={excluir} />}
    </div>
  );

  if (compacto) {
    return (
      <Drawer open={aberta} onOpenChange={aoMudar} shouldScaleBackground={false}>
        <DrawerContent className={cn('max-h-[92dvh] rounded-t-[22px]', className)}>
          <DrawerHeader className="gap-0.5 px-4 pb-2 pt-3 text-left">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <DrawerTitle className="min-w-0 truncate font-display text-lg font-bold text-gray-900">{titulo}</DrawerTitle>
              {etiqueta && <div className="shrink-0">{etiqueta}</div>}
            </div>
            {subtitulo ? (
              <DrawerDescription className="truncate text-xs text-gray-500">{subtitulo}</DrawerDescription>
            ) : (
              <DrawerDescription className="sr-only">Detalhes</DrawerDescription>
            )}
          </DrawerHeader>
          <div className="grid min-h-0 flex-1 gap-3.5 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {children}
            {pe}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <JanelaResponsiva
      aberta={aberta}
      aoMudar={aoMudar}
      largura={largura}
      className={className}
      titulo={
        <span className="flex items-center gap-2">
          <span className="min-w-0 truncate">{titulo}</span>
          {etiqueta}
        </span>
      }
      descricao={subtitulo}
    >
      <div className="grid gap-4">
        {children}
        {pe}
      </div>
    </JanelaResponsiva>
  );
};

export default FolhaDetalhes;
