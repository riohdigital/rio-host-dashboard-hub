import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Globe, ShieldCheck, RefreshCw, KeyRound, Monitor,
  AlertCircle, CheckCircle2, Lock, ArrowRight, ExternalLink
} from 'lucide-react';

import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { AgentBrowserSession } from './OTASessionsCard';

interface BrowserlessScreencastModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: AgentBrowserSession | null;
  onSessionUpdated: () => void;
}

const WS_BROWSERLESS_URL = 'wss://extra-apps-browserless.dgyrua.easypanel.host/?stealth=true';
const NATIVE_WIDTH = 1200;
const NATIVE_HEIGHT = 750;

export const BrowserlessScreencastModal: React.FC<BrowserlessScreencastModalProps> = ({
  open,
  onOpenChange,
  session,
  onSessionUpdated,
}) => {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const nextReqIdRef = useRef<number>(1);
  const pendingRequestsRef = useRef<Map<number, (res: any) => void>>(new Map());

  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('disconnected');
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [isLoggedInDetected, setIsLoggedInDetected] = useState<boolean>(false);
  const [capturing, setCapturing] = useState<boolean>(false);
  const [mode, setMode] = useState<'screencast' | 'manual'>('screencast');
  const [manualCookies, setManualCookies] = useState<string>('');
  const [manualSaving, setManualSaving] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);

  const getTargetUrl = useCallback(() => {
    if (!session) return 'https://admin.booking.com';
    return session.domain.includes('booking')
      ? 'https://admin.booking.com/hotel/hoteladmin/extranet_ng/manage/home.html'
      : 'https://www.airbnb.com.br/hosting/reservations';
  }, [session]);

  const sendCdp = useCallback((method: string, params: Record<string, any> = {}, useSession = true): Promise<any> => {
    return new Promise((resolve) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        resolve(null);
        return;
      }
      const reqId = nextReqIdRef.current++;
      pendingRequestsRef.current.set(reqId, resolve);

      const payload: any = {
        id: reqId,
        method,
        params,
      };
      if (useSession && sessionIdRef.current) {
        payload.sessionId = sessionIdRef.current;
      }

      ws.send(JSON.stringify(payload));
    });
  }, []);

  const stopConnection = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {
        // ignore
      }
      wsRef.current = null;
    }
    sessionIdRef.current = null;
    setConnectionStatus('disconnected');
  }, []);

  const handleCaptureAndSave = useCallback(async () => {
    if (!session) return;
    try {
      setCapturing(true);
      toast({
        title: 'Extraindo cookies da sessão...',
        description: 'Lendo cookies de autenticação direto do Chromium da VPS.',
      });

      const res = await sendCdp('Network.getAllCookies');
      const cookies = res?.cookies || [];

      if (cookies.length === 0) {
        throw new Error('Nenhum cookie foi retornado pelo navegador. Faça login primeiro na janela.');
      }

      // Salvar em agent_browser_sessions no Supabase
      const { error } = await supabase
        .from('agent_browser_sessions' as any)
        .update({
          cookies_encrypted: JSON.stringify(cookies),
          is_valid: true,
          updated_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      if (error) throw error;

      toast({
        title: 'Sessão Salva com Sucesso!',
        description: `${cookies.length} cookies capturados. O keepalive automático de 12 min assumiu a conexão.`,
      });

      stopConnection();
      onOpenChange(false);
      onSessionUpdated();

      // Disparar teste imediato no webhook n8n
      fetch('https://n8n-n8n.dgyrua.easypanel.host/webhook/rioh-host-testar-sessao-ota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'screencast_login_completed' }),
      }).catch(console.error);
    } catch (err) {
      toast({
        title: 'Erro ao capturar sessão',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setCapturing(false);
    }
  }, [session, sendCdp, stopConnection, onOpenChange, onSessionUpdated, toast]);

  // Inicializar conexão WebSocket e Screencast
  useEffect(() => {
    if (!open || !session || mode !== 'screencast') {
      stopConnection();
      return;
    }

    setConnectionStatus('connecting');
    const startUrl = getTargetUrl();
    setCurrentUrl(startUrl);
    setIsLoggedInDetected(false);

    const ws = new WebSocket(WS_BROWSERLESS_URL);
    wsRef.current = ws;

    ws.onopen = async () => {
      // 1. Criar Target
      const createRes = await sendCdp('Target.createTarget', { url: startUrl }, false);
      const targetId = createRes?.targetId;

      if (!targetId) {
        setConnectionStatus('error');
        return;
      }

      // 2. Attach to Target
      const attachRes = await sendCdp('Target.attachToTarget', { targetId, flatten: true }, false);
      const sessId = attachRes?.sessionId;

      if (!sessId) {
        setConnectionStatus('error');
        return;
      }
      sessionIdRef.current = sessId;

      // 3. Configurar viewport e habilitar Page/Network
      await sendCdp('Emulation.setDeviceMetricsOverride', {
        width: NATIVE_WIDTH,
        height: NATIVE_HEIGHT,
        deviceScaleFactor: 1,
        mobile: false,
      });

      await sendCdp('Page.enable');
      await sendCdp('Network.enable');

      // 4. Iniciar Screencast contínuo
      await sendCdp('Page.startScreencast', {
        format: 'jpeg',
        quality: 75,
        maxWidth: NATIVE_WIDTH,
        maxHeight: NATIVE_HEIGHT,
        everyNthFrame: 1,
      });

      setConnectionStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        // Respostas a comandos pendentes
        if (msg.id && pendingRequestsRef.current.has(msg.id)) {
          const resolver = pendingRequestsRef.current.get(msg.id)!;
          pendingRequestsRef.current.delete(msg.id);
          resolver(msg.result);
          return;
        }

        // Eventos CDP
        const method = msg.method;
        if (method === 'Page.screencastFrame') {
          const { data, metadata, sessionId: frameSessionId } = msg.params;
          if (data && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
              if (ctx) {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              }
            };
            img.src = `data:image/jpeg;base64,${data}`;
          }

          // Acknowledge frame
          if (ws.readyState === WebSocket.OPEN && sessionIdRef.current) {
            ws.send(JSON.stringify({
              sessionId: sessionIdRef.current,
              method: 'Page.screencastFrameAck',
              params: { sessionId: frameSessionId },
            }));
          }
        } else if (method === 'Page.frameNavigated') {
          const newUrl = msg.params?.frame?.url;
          if (newUrl) {
            setCurrentUrl(newUrl);
            const lower = newUrl.toLowerCase();
            if (session.domain.includes('booking')) {
              if (lower.includes('extranet') || lower.includes('hoteladmin')) {
                setIsLoggedInDetected(true);
              }
            } else {
              if (lower.includes('/hosting') || lower.includes('reservations')) {
                setIsLoggedInDetected(true);
              }
            }
          }
        }
      } catch (e) {
        console.error('Erro ao processar mensagem WS:', e);
      }
    };

    ws.onerror = () => {
      setConnectionStatus('error');
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
    };

    return () => {
      stopConnection();
    };
  }, [open, session, mode, getTargetUrl, sendCdp, stopConnection]);

  // Interação do Mouse no Canvas
  const handleCanvasMouseEvent = (e: React.MouseEvent<HTMLCanvasElement>, type: 'mousePressed' | 'mouseReleased' | 'mouseMoved') => {
    const canvas = canvasRef.current;
    if (!canvas || connectionStatus !== 'connected') return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = NATIVE_WIDTH / rect.width;
    const scaleY = NATIVE_HEIGHT / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    sendCdp('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      button: e.button === 2 ? 'right' : 'left',
      clickCount: 1,
    });
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || connectionStatus !== 'connected') return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = NATIVE_WIDTH / rect.width;
    const scaleY = NATIVE_HEIGHT / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    sendCdp('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x,
      y,
      deltaX: e.deltaX,
      deltaY: e.deltaY,
    });
  };

  // Interação do Teclado no Canvas
  const handleKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (connectionStatus !== 'connected') return;

    // Impedir comportamento padrão de scroll para espaço/setas quando focado
    if (['ArrowUp', 'ArrowDown', 'Space', 'Tab'].includes(e.code)) {
      e.preventDefault();
    }

    if (e.key === 'Backspace') {
      sendCdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 8, code: 'Backspace', key: 'Backspace' });
      sendCdp('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 8, code: 'Backspace', key: 'Backspace' });
    } else if (e.key === 'Enter') {
      sendCdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 13, code: 'Enter', key: 'Enter' });
      sendCdp('Input.dispatchKeyEvent', { type: 'char', text: '\r' });
      sendCdp('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 13, code: 'Enter', key: 'Enter' });
    } else if (e.key === 'Tab') {
      sendCdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 9, code: 'Tab', key: 'Tab' });
      sendCdp('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 9, code: 'Tab', key: 'Tab' });
    } else if (e.key.length === 1) {
      sendCdp('Input.dispatchKeyEvent', { type: 'keyDown', text: e.key, unmodifiedText: e.key, key: e.key, code: e.code });
      sendCdp('Input.dispatchKeyEvent', { type: 'char', text: e.key });
      sendCdp('Input.dispatchKeyEvent', { type: 'keyUp', key: e.key, code: e.code });
    }
  };

  const handleReload = () => {
    sendCdp('Page.reload');
  };

  // Salvar manual fallback
  const handleSaveManual = async () => {
    if (!session || !manualCookies.trim()) return;
    try {
      setManualSaving(true);
      let parsedCookies: any[] = [];
      const trimmed = manualCookies.trim();

      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        const parsed = JSON.parse(trimmed);
        parsedCookies = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        const domain = session.domain.includes('booking') ? '.booking.com' : '.airbnb.com.br';
        parsedCookies = trimmed.split(';').map(part => {
          const [name, ...valParts] = part.trim().split('=');
          return {
            name: name.trim(),
            value: valParts.join('=').trim(),
            domain,
            path: '/',
            httpOnly: false,
            secure: true
          };
        }).filter(c => c.name && c.value);
      }

      const { error } = await supabase
        .from('agent_browser_sessions' as any)
        .update({
          cookies_encrypted: JSON.stringify(parsedCookies),
          is_valid: true,
          updated_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      if (error) throw error;

      toast({
        title: 'Cookies Salvos com Sucesso!',
        description: `${parsedCookies.length} cookies inseridos. Keepalive ativado.`,
      });

      onOpenChange(false);
      onSessionUpdated();
    } catch (err) {
      toast({
        title: 'Erro ao salvar cookies manuais',
        description: err instanceof Error ? err.message : 'Verifique os dados.',
        variant: 'destructive',
      });
    } finally {
      setManualSaving(false);
    }
  };

  const platformName = session?.domain.includes('booking') ? 'Booking.com' : 'Airbnb';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border-border/80 bg-background">
        <DialogHeader className="p-4 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between shrink-0 space-y-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
              <Monitor className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                Conexão Interativa — {platformName}
                {connectionStatus === 'connected' ? (
                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-normal text-xs flex items-center gap-1.5 animate-pulse">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Screencast VPS Ativo
                  </Badge>
                ) : connectionStatus === 'connecting' ? (
                  <Badge variant="outline" className="text-xs font-normal text-amber-600 border-amber-300">
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Iniciando Chromium na VPS...
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                    Desconectado
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5 line-clamp-1 font-mono text-muted-foreground">
                {currentUrl || 'Carregando página da plataforma...'}
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 pr-6">
            <Button
              size="sm"
              variant="outline"
              onClick={handleReload}
              disabled={connectionStatus !== 'connected'}
              title="Recarregar página no Chromium"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>

            <Button
              size="sm"
              onClick={handleCaptureAndSave}
              disabled={capturing || connectionStatus !== 'connected'}
              className={`${
                isLoggedInDetected
                  ? 'bg-emerald-600 hover:bg-emerald-700 animate-bounce'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              } text-white shadow-sm transition-all duration-200`}
            >
              <ShieldCheck className="h-4 w-4 mr-1.5" />
              {capturing ? 'Capturando...' : isLoggedInDetected ? 'Login Concluído! Salvar Sessão' : 'Capturar & Salvar Sessão'}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 bg-neutral-950">
          <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="flex-1 flex flex-col">
            <div className="bg-muted/40 border-b border-border/40 px-4 py-1.5 flex items-center justify-between">
              <TabsList className="h-7 text-xs bg-muted/60">
                <TabsTrigger value="screencast" className="text-xs h-6 px-3">
                  <Monitor className="h-3 w-3 mr-1" />
                  Navegador Ao Vivo (Screencast)
                </TabsTrigger>
                <TabsTrigger value="manual" className="text-xs h-6 px-3">
                  <KeyRound className="h-3 w-3 mr-1" />
                  Colar Cookies Manualmente
                </TabsTrigger>
              </TabsList>

              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Lock className="h-3 w-3 text-emerald-500" />
                <span>Stealth Mode Ativo · Zero Detecção de Bot</span>
              </div>
            </div>

            <TabsContent value="screencast" className="flex-1 m-0 p-0 relative flex items-center justify-center overflow-hidden">
              {connectionStatus === 'connecting' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 z-10 gap-3">
                  <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
                  <p className="text-sm font-medium">Lançando instância limpa do Chromium na VPS...</p>
                  <p className="text-xs text-muted-foreground">Injetando proteções de stealth e preparando a tela de login.</p>
                </div>
              )}

              {connectionStatus === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 z-10 gap-3 text-center p-6">
                  <AlertCircle className="h-10 w-10 text-destructive" />
                  <p className="text-base font-semibold">Falha ao conectar com o serviço Browserless</p>
                  <p className="text-xs text-muted-foreground max-w-md">
                    Verifique se o container Browserless está respondendo ou alterne para a aba "Colar Cookies Manualmente".
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setMode('manual')}>
                    Usar Entrada Manual
                  </Button>
                </div>
              )}

              <div className="w-full h-full flex flex-col items-center justify-center p-2 relative">
                <canvas
                  ref={canvasRef}
                  width={NATIVE_WIDTH}
                  height={NATIVE_HEIGHT}
                  tabIndex={0}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onMouseDown={(e) => handleCanvasMouseEvent(e, 'mousePressed')}
                  onMouseUp={(e) => handleCanvasMouseEvent(e, 'mouseReleased')}
                  onMouseMove={(e) => handleCanvasMouseEvent(e, 'mouseMoved')}
                  onWheel={handleCanvasWheel}
                  onKeyDown={handleKeyDown}
                  className={`max-w-full max-h-full object-contain cursor-default outline-none rounded shadow-2xl transition-all duration-150 ${
                    isFocused ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-neutral-950' : 'ring-1 ring-border/40'
                  }`}
                  style={{ aspectRatio: `${NATIVE_WIDTH}/${NATIVE_HEIGHT}` }}
                />

                {!isFocused && connectionStatus === 'connected' && (
                  <div className="absolute bottom-4 bg-background/85 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border/60 shadow-lg text-xs flex items-center gap-2 pointer-events-none">
                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
                    <strong>Dica:</strong> Clique na tela do navegador acima para focar o teclado e digitar sua senha / 2FA.
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="manual" className="flex-1 m-0 p-6 bg-background flex flex-col gap-4">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">Entrada Manual de Cookies</h4>
                <p className="text-xs text-muted-foreground">
                  Se preferir não digitar suas credenciais na tela da VPS, você pode exportar os cookies do seu navegador pessoal e colar aqui:
                </p>
              </div>

              <div className="space-y-2 flex-1 flex flex-col">
                <Label htmlFor="manual-cookies" className="text-xs font-medium">
                  String de Cookies ou JSON
                </Label>
                <Textarea
                  id="manual-cookies"
                  rows={8}
                  value={manualCookies}
                  onChange={(e) => setManualCookies(e.target.value)}
                  placeholder="Cole aqui document.cookie ou JSON de extensão..."
                  className="font-mono text-xs flex-1"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setMode('screencast')}>
                  Voltar para Tela Interativa
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveManual}
                  disabled={manualSaving || !manualCookies.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {manualSaving ? 'Salvando...' : 'Salvar Cookies'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="p-3 bg-muted/30 border-t border-border/60 text-xs text-muted-foreground flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              Ao concluir o login ou autenticação de dois fatores (2FA), clique no botão verde <strong>"Capturar & Salvar Sessão"</strong>.
            </span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BrowserlessScreencastModal;
