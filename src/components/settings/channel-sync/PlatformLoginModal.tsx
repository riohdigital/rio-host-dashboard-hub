import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, CheckCircle2, Home, KeyRound, Keyboard, Loader2, Lock, Mail, RefreshCw,
  ShieldAlert, ShieldCheck, Wifi, XCircle,
} from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { AgentBrowserSession } from './OTASessionsCard';

/**
 * Login nas plataformas pelo navegador da VPS, através do proxy de login
 * (services/browser-login-proxy). O dashboard só transmite mouse e teclado; o
 * navegador guarda o login num perfil persistente, usado depois pelo
 * keep-alive e pela auditoria.
 *
 * Digitação: uma área de texto oculta recebe o teclado de verdade (acentos,
 * teclas de composição, colar, teclado do celular) e cada caractere vira uma
 * tecla real no site — sem preencher campo por script.
 */

const PROXY_URL =
  (import.meta.env.VITE_BROWSER_LOGIN_PROXY_URL as string | undefined) ??
  'wss://rioh-host-browser-login.dgyrua.easypanel.host/login';

type Passo = 'conectando' | 'carregando' | 'email' | 'senha' | 'codigo' | 'captcha' | 'conectado' | 'salvando' | 'pronto';

const TECLAS_ESPECIAIS = new Set([
  'Enter', 'Backspace', 'Delete', 'Tab', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown',
]);
const SENTINELA = '​';

const ETAPAS = [
  { id: 0, rotulo: 'E-mail', icone: Mail },
  { id: 1, rotulo: 'Senha', icone: Lock },
  { id: 2, rotulo: 'Verificação', icone: KeyRound },
  { id: 3, rotulo: 'Conectado', icone: CheckCircle2 },
];

const etapaDoPasso = (passo: Passo) => {
  if (passo === 'senha') return 1;
  if (passo === 'codigo' || passo === 'captcha') return 2;
  if (passo === 'conectado' || passo === 'salvando' || passo === 'pronto') return 3;
  return 0;
};

const DICAS: Record<Passo, string> = {
  conectando: 'Abrindo um navegador seguro na VPS…',
  carregando: 'Carregando a página da plataforma…',
  email: 'Clique no campo e digite seu e-mail normalmente.',
  senha: 'Digite sua senha direto na tela. Acentos e símbolos funcionam.',
  codigo: 'Digite o código de verificação que a plataforma enviou.',
  captcha: 'A plataforma pediu uma verificação de segurança. Resolva na tela.',
  conectado: 'Conectado! Salvando a sessão…',
  salvando: 'Conectado! Salvando a sessão…',
  pronto: 'Sessão salva. A auditoria e o keep-alive já podem usar este login.',
};

const MOTIVOS_FIM: Record<string, string> = {
  tempo: 'O tempo máximo do login (15 min) acabou. Abra de novo para continuar.',
  ocioso: 'O login ficou parado por muito tempo e foi fechado.',
  falha: 'O navegador encontrou um problema. Tente de novo.',
  reinicio: 'O serviço de login reiniciou. Abra de novo.',
};

interface PlatformLoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: AgentBrowserSession | null;
  onSessionUpdated: () => void;
}

export const PlatformLoginModal: React.FC<PlatformLoginModalProps> = ({ open, onOpenChange, session, onSessionUpdated }) => {
  const { toast } = useToast();
  const plataforma = session?.domain.includes('booking') ? 'booking' : 'airbnb';
  const nome = plataforma === 'booking' ? 'Booking.com' : 'Airbnb';
  const corMarca = plataforma === 'booking' ? 'from-blue-600 to-sky-500' : 'from-rose-500 to-pink-500';

  const [passo, setPasso] = useState<Passo>('conectando');
  const [erro, setErro] = useState<string | null>(null);
  const [latencia, setLatencia] = useState<number | null>(null);
  const [focado, setFocado] = useState(false);
  const [temImagem, setTemImagem] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textoRef = useRef<HTMLTextAreaElement | null>(null);
  const tamanhoRef = useRef({ w: 1280, h: 860 });
  const passoRef = useRef<Passo>('conectando');
  const ultimoMovimento = useRef(0);

  const enviar = useCallback((msg: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const mudarPasso = useCallback((novo: Passo) => {
    passoRef.current = novo;
    setPasso(novo);
  }, []);

  // Conexão com o proxy de login.
  useEffect(() => {
    if (!open || !session) return;
    let encerrado = false;
    let ping: ReturnType<typeof setInterval> | undefined;
    let renovacao: ReturnType<typeof setInterval> | undefined;
    mudarPasso('conectando');
    setErro(null);
    setTemImagem(false);
    setLatencia(null);

    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setErro('Sua sessão no dashboard expirou. Entre de novo para conectar a plataforma.');
        return;
      }
      if (encerrado) return;

      const ws = new WebSocket(PROXY_URL);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ t: 'auth', token, plataforma }));
        ping = setInterval(() => enviar({ t: 'ping', id: Date.now() }), 3000);
        // O proxy grava a sessão em nome do Dono: mantém o token do dashboard em dia.
        renovacao = setInterval(async () => {
          const { data: atual } = await supabase.auth.getSession();
          if (atual.session?.access_token) enviar({ t: 'token', v: atual.session.access_token });
        }, 120_000);
      };

      ws.onmessage = async (ev) => {
        if (ev.data instanceof ArrayBuffer) {
          const canvas = canvasRef.current;
          if (!canvas) return;
          try {
            const imagem = await createImageBitmap(new Blob([ev.data], { type: 'image/jpeg' }));
            requestAnimationFrame(() => {
              canvas.getContext('2d')?.drawImage(imagem, 0, 0, canvas.width, canvas.height);
              imagem.close();
            });
            setTemImagem(true);
          } catch {
            // Quadro corrompido: o próximo chega em seguida.
          }
          return;
        }
        let msg: { t: string; passo?: Passo; w?: number; h?: number; id?: number; msg?: string; motivo?: string };
        try {
          msg = JSON.parse(ev.data as string);
        } catch {
          return;
        }
        if (msg.t === 'state' && msg.passo) {
          mudarPasso(msg.passo);
          if (msg.passo === 'pronto') {
            toast({ title: `${nome} conectado`, description: 'Sessão salva no navegador da VPS.' });
            onSessionUpdated();
            setTimeout(() => onOpenChange(false), 2200);
          }
        } else if (msg.t === 'meta' && msg.w && msg.h) {
          tamanhoRef.current = { w: msg.w, h: msg.h };
          if (canvasRef.current) {
            canvasRef.current.width = msg.w;
            canvasRef.current.height = msg.h;
          }
        } else if (msg.t === 'pong' && msg.id) {
          setLatencia(Date.now() - msg.id);
        } else if (msg.t === 'erro') {
          setErro(msg.msg || 'Não foi possível conectar.');
        } else if (msg.t === 'fim' && msg.motivo && msg.motivo !== 'cancelado') {
          setErro(MOTIVOS_FIM[msg.motivo] || 'O login foi encerrado.');
        }
      };

      ws.onclose = () => {
        if (ping) clearInterval(ping);
        if (renovacao) clearInterval(renovacao);
        if (!encerrado && passoRef.current !== 'pronto') {
          setErro((atual) => atual ?? 'A conexão com o navegador caiu. Tente de novo.');
        }
      };
    })();

    return () => {
      encerrado = true;
      if (ping) clearInterval(ping);
      if (renovacao) clearInterval(renovacao);
      const ws = wsRef.current;
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'cancel' }));
        ws.close();
      }
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session?.id, tentativa]);

  // ---- Mouse e toque ------------------------------------------------------
  const ponto = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const { w, h } = tamanhoRef.current;
    return { x: Math.round(((clientX - r.left) * w) / r.width), y: Math.round(((clientY - r.top) * h) / r.height) };
  };
  const focarTeclado = () => {
    const el = textoRef.current;
    if (!el) return;
    if (!el.value) el.value = SENTINELA;
    el.focus({ preventScroll: true });
  };
  const aoPressionar = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    focarTeclado();
    const b = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left';
    enviar({ t: 'mouse', a: 'down', ...ponto(e.clientX, e.clientY), b, c: Math.max(1, e.detail || 1) });
  };
  const aoSoltar = (e: React.PointerEvent) => {
    const b = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left';
    enviar({ t: 'mouse', a: 'up', ...ponto(e.clientX, e.clientY), b, c: Math.max(1, e.detail || 1) });
  };
  const aoMover = (e: React.PointerEvent) => {
    const agora = performance.now();
    if (agora - ultimoMovimento.current < 33) return;
    ultimoMovimento.current = agora;
    enviar({ t: 'mouse', a: 'move', ...ponto(e.clientX, e.clientY) });
  };
  const aoRolar = (e: React.WheelEvent) => {
    enviar({ t: 'wheel', ...ponto(e.clientX, e.clientY), dx: e.deltaX, dy: e.deltaY });
  };

  // ---- Teclado --------------------------------------------------------------
  const aoTeclar = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      enviar({ t: 'select_all' });
      return;
    }
    if (ctrl) return; // colar chega pelo evento paste
    if (TECLAS_ESPECIAIS.has(e.key)) {
      e.preventDefault();
      enviar({ t: 'key', k: e.key, shift: e.shiftKey });
    }
  };
  const repor = (el: HTMLTextAreaElement) => {
    el.value = SENTINELA;
    el.setSelectionRange(1, 1);
  };
  const aoDigitar = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const nativo = e.nativeEvent as InputEvent;
    if (nativo.isComposing) return;
    // Teclado de celular: Backspace e Enter chegam como edição do texto, não como tecla.
    if (nativo.inputType?.startsWith('delete')) enviar({ t: 'key', k: 'Backspace' });
    else if (nativo.inputType === 'insertLineBreak') enviar({ t: 'key', k: 'Enter' });
    else {
      const texto = el.value.split(SENTINELA).join('').replace(/[\r\n]+/g, '');
      if (texto) enviar({ t: 'text', v: texto });
    }
    repor(el);
  };
  const aoComporFim = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const texto = (el.value.split(SENTINELA).join('') || e.data || '').replace(/[\r\n]+/g, '');
    if (texto) enviar({ t: 'text', v: texto });
    repor(el);
  };
  const aoColar = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const texto = e.clipboardData.getData('text').replace(/[\r\n]+/g, '');
    if (texto) enviar({ t: 'text', v: texto });
  };

  const etapaAtual = etapaDoPasso(passo);
  const corLatencia = latencia === null ? 'bg-muted-foreground/40' : latencia < 150 ? 'bg-emerald-500' : latencia < 400 ? 'bg-amber-500' : 'bg-red-500';
  const ativo = !erro && passo !== 'pronto';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[1180px] p-0 gap-0 overflow-hidden border-border/60 bg-background">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br ${corMarca} grid place-items-center text-white shadow-sm`}>
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold leading-tight">Conectar {nome}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Você digita direto no site oficial. A senha não é guardada pelo dashboard.
              </DialogDescription>
            </div>
          </div>

          <ol className="flex items-center gap-1.5 text-xs" aria-label="Etapas do login">
            {ETAPAS.map((etapa, i) => {
              const feita = i < etapaAtual || passo === 'pronto';
              const atual = i === etapaAtual && passo !== 'pronto';
              const Icone = etapa.icone;
              return (
                <li key={etapa.id} className="flex items-center gap-1.5">
                  <span
                    className={[
                      'flex items-center gap-1 rounded-full px-2.5 py-1 border transition-all duration-300',
                      feita ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400' : '',
                      atual ? 'bg-primary/10 border-primary/40 text-foreground font-medium' : '',
                      !feita && !atual ? 'border-border/60 text-muted-foreground' : '',
                    ].join(' ')}
                  >
                    {feita ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icone className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">{etapa.rotulo}</span>
                  </span>
                  {i < ETAPAS.length - 1 && <span className="h-px w-3 bg-border" aria-hidden />}
                </li>
              );
            })}
          </ol>
        </div>

        {/* Tela do navegador */}
        <div
          className="relative w-full bg-neutral-950 select-none touch-none"
          style={{ aspectRatio: `${tamanhoRef.current.w} / ${tamanhoRef.current.h}`, maxHeight: '72vh' }}
          onPointerDown={ativo ? aoPressionar : undefined}
          onPointerUp={ativo ? aoSoltar : undefined}
          onPointerMove={ativo ? aoMover : undefined}
          onWheel={ativo ? aoRolar : undefined}
          onContextMenu={(e) => e.preventDefault()}
        >
          <canvas ref={canvasRef} width={1280} height={860} className="absolute inset-0 h-full w-full object-contain cursor-default" />

          {/* Recebe o teclado de verdade; fica invisível sobre a tela. */}
          <textarea
            ref={textoRef}
            aria-label={`Digitar no ${nome}`}
            className="absolute inset-0 h-full w-full resize-none opacity-0 pointer-events-none"
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            defaultValue={SENTINELA}
            onKeyDown={aoTeclar}
            onInput={aoDigitar}
            onCompositionEnd={aoComporFim}
            onPaste={aoColar}
            onFocus={() => setFocado(true)}
            onBlur={() => setFocado(false)}
          />

          {!temImagem && !erro && (
            <div className="absolute inset-0 grid place-items-center">
              <div className="flex flex-col items-center gap-3 text-neutral-300">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm">{DICAS[passo]}</span>
              </div>
            </div>
          )}

          {ativo && temImagem && !focado && (
            <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white shadow-lg backdrop-blur animate-in fade-in">
              <Keyboard className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
              Clique na tela para digitar
            </div>
          )}

          {passo === 'captcha' && ativo && (
            <div className="pointer-events-none absolute left-1/2 bottom-3 -translate-x-1/2 rounded-full bg-amber-500/90 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
              <ShieldAlert className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
              Resolva a verificação de segurança na tela
            </div>
          )}

          {(passo === 'conectado' || passo === 'salvando' || passo === 'pronto') && (
            <div className="absolute inset-0 grid place-items-center bg-emerald-950/70 backdrop-blur-sm animate-in fade-in duration-300">
              <div className="flex flex-col items-center gap-3 text-white text-center px-6">
                {passo === 'pronto' ? (
                  <CheckCircle2 className="h-14 w-14 text-emerald-400 animate-in zoom-in duration-300" />
                ) : (
                  <Loader2 className="h-12 w-12 animate-spin text-emerald-300" />
                )}
                <p className="text-lg font-semibold">{passo === 'pronto' ? `${nome} conectado` : 'Conectado! Salvando a sessão…'}</p>
                <p className="text-sm text-emerald-100/80 max-w-sm">{DICAS[passo]}</p>
              </div>
            </div>
          )}

          {erro && (
            <div className="absolute inset-0 grid place-items-center bg-neutral-950/85 backdrop-blur-sm animate-in fade-in">
              <div className="flex max-w-md flex-col items-center gap-3 px-6 text-center text-white">
                <XCircle className="h-12 w-12 text-red-400" />
                <p className="text-base font-medium">{erro}</p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => setTentativa((n) => n + 1)}>
                    <RefreshCw className="h-4 w-4 mr-1.5" />
                    Tentar de novo
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => onOpenChange(false)}>
                    Fechar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-border/60 bg-muted/30">
          <div className="flex items-center gap-3 min-w-0 text-sm">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0" title="Latência até o navegador da VPS">
              <span className={`h-2 w-2 rounded-full ${corLatencia}`} />
              <Wifi className="h-3.5 w-3.5" />
              {latencia === null ? '—' : `${latencia} ms`}
            </span>
            <span className="text-muted-foreground truncate">{erro ? 'Login interrompido.' : DICAS[passo]}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" disabled={!ativo} onClick={() => enviar({ t: 'nav', para: 'voltar' })} title="Voltar uma página">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" disabled={!ativo} onClick={() => enviar({ t: 'nav', para: 'recarregar' })} title="Recarregar a página">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" disabled={!ativo} onClick={() => enviar({ t: 'nav', para: 'inicio' })} title="Voltar ao início do login">
              <Home className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
              {passo === 'pronto' ? 'Fechar' : 'Cancelar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlatformLoginModal;
