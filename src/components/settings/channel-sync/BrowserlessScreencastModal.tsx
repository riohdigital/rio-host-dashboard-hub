import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Globe, ShieldCheck, RefreshCw, KeyRound, Monitor,
  AlertCircle, CheckCircle2, Lock, ArrowRight, ExternalLink,
  Send, CornerDownLeft, Target, ArrowRightCircle, Eye, EyeOff, Key
} from 'lucide-react';

import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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

// Timeout de 10 minutos (600.000ms) para permitir resolução calma de captchas e login manual sem desconectar
const WS_BROWSERLESS_URL = 'wss://extra-apps-browserless.dgyrua.easypanel.host/?stealth=true&timeout=600000&--timeout=600000';
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
  const containerRef = useRef<HTMLDivElement | null>(null);
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
  const [quickInput, setQuickInput] = useState<string>('');
  const [isPasswordMode, setIsPasswordMode] = useState<boolean>(false);
  const [reconnectCount, setReconnectCount] = useState<number>(0);
  const [clickIndicator, setClickIndicator] = useState<{ x: number; y: number } | null>(null);
  const [isHolding, setIsHolding] = useState<boolean>(false);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
    sessionIdRef.current = null;
    setConnectionStatus('disconnected');
  }, []);

  const handleReconnect = useCallback(() => {
    stopConnection();
    setReconnectCount((c) => c + 1);
    toast({
      title: 'Reconectando ao Chromium VPS...',
      description: 'Iniciando nova conexão com tempo estendido de 10 minutos.',
    });
  }, [stopConnection, toast]);

  // Foca o campo de input correto (prioriza senha se presente, depois SMS/código, depois login) e dispensa cookies se presentes
  const autoFocusInput = useCallback(async (preferType?: 'password' | 'code' | 'any') => {
    const script = `(() => {
      // Auto-fechar cookies se existirem para não bloquear cliques
      const acceptCookie = document.querySelector('#onetrust-accept-btn-handler, #onetrust-reject-all-handler');
      if (acceptCookie) acceptCookie.click();

      // 1. Se preferência for senha ou se houver campo de senha visível
      const passwordEl = document.querySelector('input[type="password"]:not(#hidden-password), input#password, input[name="password"]:not(#hidden-password)');
      if (passwordEl && passwordEl.offsetParent !== null) {
        passwordEl.focus();
        return { focused: true, id: passwordEl.id, name: passwordEl.name, type: 'password' };
      }

      // 2. Se houver campo de código 2FA/SMS
      const codeEl = document.querySelector('input[autocomplete="one-time-code"], input[name*="code"], input[name="phone-number"]');
      if (codeEl && codeEl.offsetParent !== null) {
        codeEl.focus();
        return { focused: true, id: codeEl.id, name: codeEl.name, type: 'code' };
      }

      // 3. Campo de login/e-mail
      const loginEl = document.querySelector('input#loginname, input[name="loginname"], input[type="email"], input[name="user[email]"]');
      if (loginEl && loginEl.offsetParent !== null) {
        loginEl.focus();
        return { focused: true, id: loginEl.id, name: loginEl.name, type: 'email' };
      }

      // 4. Qualquer input visível e editável
      const anyEl = Array.from(document.querySelectorAll('input:not([type="hidden"]):not(#hidden-password)'))
        .find(el => {
          const s = window.getComputedStyle(el);
          return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled && !el.readOnly;
        });
      if (anyEl) {
        anyEl.focus();
        return { focused: true, id: anyEl.id, name: anyEl.name, type: anyEl.type };
      }

      return { focused: false };
    })()`;
    return sendCdp('Runtime.evaluate', { expression: script, returnByValue: true });
  }, [sendCdp]);

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

      // 3. Configurar viewport e habilitar Page/Network/Runtime
      await sendCdp('Emulation.setDeviceMetricsOverride', {
        width: NATIVE_WIDTH,
        height: NATIVE_HEIGHT,
        deviceScaleFactor: 1,
        mobile: false,
      });

      await sendCdp('Page.enable');
      await sendCdp('Network.enable');
      await sendCdp('Runtime.enable');

      // 4. Iniciar Screencast contínuo
      await sendCdp('Page.startScreencast', {
        format: 'jpeg',
        quality: 75,
        maxWidth: NATIVE_WIDTH,
        maxHeight: NATIVE_HEIGHT,
        everyNthFrame: 1,
      });

      // 5. Iniciar Heartbeat Ping de 10s para manter WebSocket e proxy Traefik vivos indefinidamente
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const pingId = nextReqIdRef.current++;
          ws.send(JSON.stringify({ id: pingId, method: 'Browser.getVersion' }));
        }
      }, 10000);

      setConnectionStatus('connected');

      // Auto focar input após carregamento inicial
      setTimeout(async () => {
        const res = await autoFocusInput();
        if (res?.result?.value?.type === 'password') {
          setIsPasswordMode(true);
        }
      }, 2000);
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
          const { data, sessionId: frameSessionId } = msg.params;
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

          // Acknowledge frame com id válido (evita congelamento do screencast pelo Chrome)
          if (ws.readyState === WebSocket.OPEN && sessionIdRef.current) {
            const ackId = nextReqIdRef.current++;
            ws.send(JSON.stringify({
              id: ackId,
              sessionId: sessionIdRef.current,
              method: 'Page.screencastFrameAck',
              params: { sessionId: frameSessionId },
            }));
          }
        } else if (method === 'Page.frameNavigated') {
          const frame = msg.params?.frame;
          // Ignorar frames filhos/iframes invisíveis (como asanalytics) e focar apenas no frame principal
          if (frame && !frame.parentId && frame.url) {
            setCurrentUrl(frame.url);
            const lower = frame.url.toLowerCase();
            if (session.domain.includes('booking')) {
              if (lower.includes('extranet') || lower.includes('hoteladmin')) {
                setIsLoggedInDetected(true);
              }
            } else {
              if (lower.includes('/hosting') || lower.includes('reservations')) {
                setIsLoggedInDetected(true);
              }
            }

            // Re-iniciar screencast na nova página para garantir stream contínuo imediato
            sendCdp('Page.startScreencast', {
              format: 'jpeg',
              quality: 75,
              maxWidth: NATIVE_WIDTH,
              maxHeight: NATIVE_HEIGHT,
              everyNthFrame: 1,
            });

            // Ao navegar (ex: de username para password), focar campo e auto-fechar cookies
            setTimeout(async () => {
              const res = await autoFocusInput();
              if (res?.result?.value?.type === 'password') {
                setIsPasswordMode(true);
              }
            }, 1000);
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
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      setConnectionStatus('disconnected');
    };

    return () => {
      stopConnection();
    };
  }, [open, session, mode, reconnectCount, getTargetUrl, sendCdp, stopConnection, autoFocusInput]);

  // Interação de Clique no Canvas com suporte nativo CDP
  const handleCanvasClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || connectionStatus !== 'connected') return;

    canvas.focus();
    setIsFocused(true);

    const rect = canvas.getBoundingClientRect();
    const scaleX = NATIVE_WIDTH / rect.width;
    const scaleY = NATIVE_HEIGHT / rect.height;

    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const x = Math.round(clickX * scaleX);
    const y = Math.round(clickY * scaleY);

    setClickIndicator({ x: clickX, y: clickY });
    setTimeout(() => setClickIndicator(null), 400);

    // 1. Envia clique nativo do CDP (mouseMoved + mousePressed + mouseReleased)
    await sendCdp('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x,
      y,
      button: 'none',
    });
    await sendCdp('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });
    await sendCdp('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });

    // 2. Foca input se aplicável (sem disparar el.click() novamente para não gerar duplo clique)
    const focusAtPointScript = `(() => {
      const el = document.elementFromPoint(${x}, ${y});
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        el.focus();
        return { tag: el.tagName, id: el.id, name: el.name };
      }
      return null;
    })()`;
    sendCdp('Runtime.evaluate', { expression: focusAtPointScript });
  };

  // Pressionar e segurar por X segundos (ideal para desafios do tipo Press & Hold / PerimeterX)
  const handlePressAndHold = async (durationSeconds = 3.5) => {
    if (connectionStatus !== 'connected' || isHolding) return;
    try {
      setIsHolding(true);
      toast({
        title: 'Pressionando e Segurando...',
        description: `Mantendo o botão pressionado por ${durationSeconds}s para validar o desafio.`,
      });

      const getCenterScript = `(() => {
        const challengeEl = document.querySelector('#px-captcha, [aria-label*="Press and Hold"], [aria-label*="pressione e segure"], #challenge-stage, .sec-container');
        if (challengeEl) {
          const rect = challengeEl.getBoundingClientRect();
          return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
        }
        return { x: ${Math.round(NATIVE_WIDTH / 2)}, y: ${Math.round(NATIVE_HEIGHT / 2)} };
      })()`;

      const res = await sendCdp('Runtime.evaluate', { expression: getCenterScript, returnByValue: true });
      const pos = res?.result?.value || { x: Math.round(NATIVE_WIDTH / 2), y: Math.round(NATIVE_HEIGHT / 2) };

      await sendCdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos.x, y: pos.y, button: 'none' });
      await sendCdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: 1 });

      await new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000));

      await sendCdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: 1 });

      toast({
        title: 'Clique Liberado',
        description: 'Verificação enviada. O navegador deve avançar em instantes.',
      });
    } catch (e) {
      console.error('Erro no Press & Hold:', e);
    } finally {
      setIsHolding(false);
    }
  };

  // Dispensar banner de cookies da Booking / Airbnb
  const handleDismissCookies = async () => {
    const script = `(() => {
      const selectors = ['#onetrust-accept-btn-handler', '#onetrust-reject-all-handler', 'button[id*="onetrust"]', 'button[aria-label="Accept"]'];
      for (const s of selectors) {
        const el = document.querySelector(s);
        if (el) { el.click(); return true; }
      }
      return false;
    })()`;
    const res = await sendCdp('Runtime.evaluate', { expression: script, returnByValue: true });
    if (res?.result?.value) {
      toast({ title: 'Banner de cookies dispensado' });
    }
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

  // Interação do Teclado no Canvas (USANDO Input.insertText)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (connectionStatus !== 'connected') return;

    if (['ArrowUp', 'ArrowDown', 'Space', 'Tab'].includes(e.code)) {
      e.preventDefault();
    }

    if (e.key === 'Backspace') {
      sendCdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 8, code: 'Backspace', key: 'Backspace' });
      sendCdp('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 8, code: 'Backspace', key: 'Backspace' });
    } else if (e.key === 'Enter') {
      sendCdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 13, code: 'Enter', key: 'Enter' });
      sendCdp('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 13, code: 'Enter', key: 'Enter' });
    } else if (e.key === 'Tab') {
      sendCdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 9, code: 'Tab', key: 'Tab' });
      sendCdp('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 9, code: 'Tab', key: 'Tab' });
    } else if (e.key === 'Escape') {
      sendCdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 27, code: 'Escape', key: 'Escape' });
      sendCdp('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 27, code: 'Escape', key: 'Escape' });
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      sendCdp('Input.insertText', { text: e.key });
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLCanvasElement>) => {
    const text = e.clipboardData.getData('text');
    if (text && connectionStatus === 'connected') {
      sendCdp('Input.insertText', { text });
    }
  };

  // Preenchimento Infalível via DOM Scripting com React Native Value Setter + CDP Fallback
  const handleSendQuickInput = async (pressEnter = false) => {
    if (!quickInput && !pressEnter) return;

    const valueToInsert = quickInput;

    const fillScript = `(() => {
      // 1. Auto-dispensar cookie banner se estiver visível
      const acceptCookie = document.querySelector('#onetrust-accept-btn-handler, #onetrust-reject-all-handler');
      if (acceptCookie) acceptCookie.click();

      const text = ${JSON.stringify(valueToInsert)};
      let target = document.activeElement;

      // Prioridade 1: Campo de senha visível (ignora o honeypot #hidden-password)
      const passwordField = document.querySelector('input[type="password"]:not(#hidden-password), input#password, input[name="password"]:not(#hidden-password)');
      const isPasswordVisible = passwordField && passwordField.offsetParent !== null;

      // Prioridade 2: Campo de código 2FA visível
      const codeField = document.querySelector('input[autocomplete="one-time-code"], input[name*="code"], input[name="phone-number"]');
      const isCodeVisible = codeField && codeField.offsetParent !== null;

      if (isPasswordVisible) {
        target = passwordField;
      } else if (isCodeVisible) {
        target = codeField;
      } else if (!target || target.tagName !== 'INPUT' || target.id === 'hidden-password' || target.offsetParent === null) {
        // Encontrar primeiro campo editável visível na tela
        const visibleInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not(#hidden-password)'))
          .filter(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled && !el.readOnly;
          });
        target = visibleInputs[0] || null;
      }

      if (target && target.tagName === 'INPUT') {
        target.focus();
        if (text) {
          // Usar React Native Setter para garantir que o estado interno do framework seja atualizado
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (nativeSetter) {
            nativeSetter.call(target, text);
          } else {
            target.value = text;
          }
          target.dispatchEvent(new Event('input', { bubbles: true }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
        }

        if (${pressEnter}) {
          // Disparar eventos de tecla Enter no input
          target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          target.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          target.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));

          const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"]'));
          const nextBtn = buttons.find(b => {
            if (b.id && (b.id.includes('onetrust') || b.id.includes('cookie'))) return false;
            const t = (b.innerText || (b as any).value || '').trim().toLowerCase();
            return t === 'sign in' || t === 'entrar' || t === 'fazer login' || t === 'next' || t === 'próximo' || t === 'seguinte' || t === 'continuar' || t === 'avançar' || t === 'continue' || t === 'verify';
          }) || document.querySelector('form button[type="submit"]:not([id*="onetrust"])') || document.querySelector('button[type="submit"]:not([id*="onetrust"])');

          if (nextBtn) {
            (nextBtn as HTMLElement).click();
          } else if (target.form) {
            target.form.submit();
          }
        }
        return { success: true, id: target.id, name: target.name, type: target.type };
      }
      return { success: false };
    })()`;

    const res = await sendCdp('Runtime.evaluate', { expression: fillScript, returnByValue: true });
    const fillResult = res?.result?.value;

    // Se o script não encontrou campo (ex: página puramente estática/canvas), tenta enviar via CDP puro
    if (!fillResult?.success && valueToInsert) {
      await sendCdp('Input.insertText', { text: valueToInsert });
    }
    if (pressEnter) {
      await sendCdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 13, code: 'Enter', key: 'Enter' });
      await sendCdp('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 13, code: 'Enter', key: 'Enter' });
    }

    // Forçar atualização do screencast após submissão para pegar a nova tela na hora
    setTimeout(() => {
      sendCdp('Page.startScreencast', {
        format: 'jpeg',
        quality: 75,
        maxWidth: NATIVE_WIDTH,
        maxHeight: NATIVE_HEIGHT,
        everyNthFrame: 1,
      });
    }, 700);

    setQuickInput('');
    toast({
      title: fillResult?.success ? `Preenchido em #${fillResult.id || fillResult.name || fillResult.type}` : 'Texto Enviado',
      description: pressEnter ? 'Texto inserido e envio acionado.' : 'Texto inserido no campo.',
    });
  };

  const handleFocusPassword = async () => {
    const res = await autoFocusInput('password');
    setIsPasswordMode(true);
    toast({
      title: 'Campo de Senha',
      description: res?.result?.value?.focused ? 'Campo de senha focado com sucesso!' : 'Campo selecionado no navegador.',
    });
  };

  const handleSendKey = async (code: 'Enter' | 'Tab') => {
    if (code === 'Enter') {
      const clickSubmitScript = `(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"]'));
        const nextBtn = buttons.find(b => {
          if (b.id && (b.id.includes('onetrust') || b.id.includes('cookie'))) return false;
          const t = (b.innerText || (b as any).value || '').trim().toLowerCase();
          return t === 'sign in' || t === 'entrar' || t === 'fazer login' || t === 'next' || t === 'próximo' || t === 'seguinte' || t === 'continuar' || t === 'avançar' || t === 'continue';
        }) || document.querySelector('form button[type="submit"]:not([id*="onetrust"])') || document.querySelector('button[type="submit"]:not([id*="onetrust"])');
        if (nextBtn) { (nextBtn as HTMLElement).click(); return true; }
        return false;
      })()`;
      sendCdp('Runtime.evaluate', { expression: clickSubmitScript });
    }

    const keyCode = code === 'Enter' ? 13 : 9;
    await sendCdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: keyCode, code, key: code });
    await sendCdp('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: keyCode, code, key: code });

    if (code === 'Enter') {
      setTimeout(() => {
        sendCdp('Page.startScreencast', {
          format: 'jpeg',
          quality: 75,
          maxWidth: NATIVE_WIDTH,
          maxHeight: NATIVE_HEIGHT,
          everyNthFrame: 1,
        });
      }, 700);
    }
  };

  const handleReload = async () => {
    if (connectionStatus !== 'connected') {
      handleReconnect();
      return;
    }
    await sendCdp('Page.reload');
    await sendCdp('Page.startScreencast', {
      format: 'jpeg',
      quality: 75,
      maxWidth: NATIVE_WIDTH,
      maxHeight: NATIVE_HEIGHT,
      everyNthFrame: 1,
    });
    setTimeout(() => {
      autoFocusInput();
    }, 1500);
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
      <DialogContent className="max-w-5xl h-[92vh] flex flex-col p-0 gap-0 overflow-hidden border-border/80 bg-background">
        <DialogHeader className="p-3.5 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between shrink-0 space-y-0">
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
                  <div className="flex items-center gap-1.5">
                    <Badge variant="destructive" className="text-xs font-normal">
                      Desconectado
                    </Badge>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleReconnect}
                      className="h-6 text-[11px] px-2 gap-1"
                      title="Reconectar sessão interativa"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Reconectar
                    </Button>
                  </div>
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
              title={connectionStatus === 'connected' ? 'Recarregar página no Chromium' : 'Reconectar ao navegador'}
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

        {/* Barra de Digitação Rápida / Controle Direto (Sempre visível em modo Screencast) */}
        {mode === 'screencast' && (
          <div className="bg-neutral-900 border-b border-neutral-800 p-2.5 px-4 flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex-1 min-w-[260px] flex items-center gap-1.5">
              <div className="relative flex-1">
                <Input
                  type={isPasswordMode ? 'password' : 'text'}
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendQuickInput(true);
                    }
                  }}
                  disabled={connectionStatus !== 'connected'}
                  placeholder={
                    connectionStatus !== 'connected'
                      ? 'Navegador desconectado — clique em Reconectar acima...'
                      : isPasswordMode
                      ? 'Digite sua senha aqui (ou cole) e aperte Enviar ↵...'
                      : 'Digite seu e-mail, senha ou código SMS aqui...'
                  }
                  className="h-8 text-xs bg-neutral-950 border-neutral-700 text-white placeholder:text-neutral-500 font-mono pr-8"
                />
                <button
                  type="button"
                  onClick={() => setIsPasswordMode(!isPasswordMode)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  title={isPasswordMode ? 'Mostrar caracteres da senha' : 'Ocultar caracteres (modo senha)'}
                >
                  {isPasswordMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>

              <Button
                size="sm"
                onClick={() => handleSendQuickInput(false)}
                disabled={!quickInput || connectionStatus !== 'connected'}
                className="h-8 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs shrink-0"
                title="Digitar texto no campo focado"
              >
                <Send className="h-3.5 w-3.5 mr-1" />
                Digitar
              </Button>
              <Button
                size="sm"
                onClick={() => handleSendQuickInput(true)}
                disabled={!quickInput || connectionStatus !== 'connected'}
                className="h-8 px-2.5 bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs shrink-0"
                title="Digitar texto e enviar Enter / Sign in"
              >
                <CornerDownLeft className="h-3.5 w-3.5 mr-1" />
                Enviar ↵
              </Button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={handleFocusPassword}
                disabled={connectionStatus !== 'connected'}
                className="h-8 px-2.5 text-xs border-amber-600/50 text-amber-300 hover:bg-amber-950/40"
                title="Focar diretamente o campo de senha na página"
              >
                <Key className="h-3.5 w-3.5 mr-1 text-amber-400" />
                Focar Senha
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => autoFocusInput()}
                disabled={connectionStatus !== 'connected'}
                className="h-8 px-2.5 text-xs border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                title="Focar automaticamente o campo inteligente na página"
              >
                <Target className="h-3.5 w-3.5 mr-1 text-indigo-400" />
                Auto-Focar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDismissCookies}
                disabled={connectionStatus !== 'connected'}
                className="h-8 px-2.5 text-xs border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                title="Fechar banner de cookies da Booking/Airbnb se estiver cobrindo a tela"
              >
                🍪 Cookies
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePressAndHold(3.5)}
                disabled={isHolding || connectionStatus !== 'connected'}
                className="h-8 px-2.5 text-xs border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                title="Pressionar e segurar botão por 3.5 segundos (para desafios tipo Press & Hold / PerimeterX)"
              >
                <ShieldCheck className="h-3.5 w-3.5 mr-1 text-amber-400" />
                {isHolding ? 'Segurando...' : 'Segurar (3.5s)'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSendKey('Enter')}
                disabled={connectionStatus !== 'connected'}
                className="h-8 px-2.5 text-xs border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                title="Pressionar botão de avanço / Sign in / Enter"
              >
                ↵ Sign in
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSendKey('Tab')}
                disabled={connectionStatus !== 'connected'}
                className="h-8 px-2 text-xs border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                title="Pressionar tecla Tab (pular campo)"
              >
                ⇥ Tab
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0 bg-neutral-950">
          <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="flex-1 flex flex-col">
            <div className="bg-muted/30 border-b border-border/40 px-4 py-1.5 flex items-center justify-between shrink-0">
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

            <TabsContent value="screencast" className="flex-1 m-0 p-0 relative flex items-center justify-center overflow-auto bg-neutral-950">
              {connectionStatus === 'connecting' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 z-10 gap-3">
                  <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
                  <p className="text-sm font-medium">Lançando instância limpa do Chromium na VPS...</p>
                  <p className="text-xs text-muted-foreground">Injetando proteções de stealth e preparando a tela de login (sessão estendida de 10 min).</p>
                </div>
              )}

              {connectionStatus === 'disconnected' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/80 z-20 gap-3 text-center p-6 backdrop-blur-[2px]">
                  <AlertCircle className="h-10 w-10 text-amber-400" />
                  <p className="text-base font-semibold text-white">Sessão Interativa Desconectada</p>
                  <p className="text-xs text-neutral-300 max-w-md">
                    O tempo de conexão foi pausado. Clique abaixo para reconectar imediatamente com sessão de 10 minutos.
                  </p>
                  <Button onClick={handleReconnect} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 text-xs">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reconectar Navegador Agora
                  </Button>
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

              <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center p-2 relative overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={NATIVE_WIDTH}
                  height={NATIVE_HEIGHT}
                  tabIndex={0}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onClick={handleCanvasClick}
                  onWheel={handleCanvasWheel}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  className={`w-full max-w-[1000px] h-auto rounded border border-neutral-800 shadow-2xl transition-all cursor-crosshair outline-none ${
                    isFocused ? 'ring-2 ring-indigo-500/80 ring-offset-2 ring-offset-neutral-950' : ''
                  }`}
                  style={{ aspectRatio: `${NATIVE_WIDTH}/${NATIVE_HEIGHT}` }}
                />

                {/* Efeito visual de clique na tela */}
                {clickIndicator && (
                  <span
                    className="absolute h-5 w-5 -ml-2.5 -mt-2.5 rounded-full bg-indigo-500/60 border border-white pointer-events-none animate-ping"
                    style={{ left: clickIndicator.x, top: clickIndicator.y }}
                  />
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
              Ao ver a página principal/painel da Booking ou Airbnb com login concluído, clique em <strong>"Capturar & Salvar Sessão"</strong>.
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
