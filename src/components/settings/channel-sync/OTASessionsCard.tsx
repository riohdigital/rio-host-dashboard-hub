import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Globe, CheckCircle2, AlertTriangle, RefreshCw, KeyRound,
  ShieldCheck, ExternalLink, Sparkles, Terminal, Copy, Check
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export interface AgentBrowserSession {
  id: string;
  domain: string;
  session_name: string;
  cookies_encrypted: string | null;
  is_valid: boolean;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

const KEEPALIVE_WEBHOOK_URL = 'https://n8n-n8n.dgyrua.easypanel.host/webhook/rioh-host-testar-sessao-ota';

const formatDateTime = (value: string | null) =>
  value ? format(new Date(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Nunca';

export const OTASessionsCard: React.FC = () => {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<AgentBrowserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<AgentBrowserSession | null>(null);
  const [cookieInput, setCookieInput] = useState('');
  const [savingCookies, setSavingCookies] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('agent_browser_sessions' as any)
        .select('*')
        .order('domain', { ascending: true });

      if (error) {
        console.warn('Erro ao carregar sessões de navegador:', error);
      } else if (data) {
        setSessions(data as unknown as AgentBrowserSession[]);
      }
    } catch (err) {
      console.error('Falha ao consultar agent_browser_sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleTestSessions = async () => {
    try {
      setTesting(true);
      toast({
        title: 'Verificando Sessões OTA...',
        description: 'O robô Browserless está testando a autenticação no Airbnb e Booking.com em tempo real.',
      });

      const response = await fetch(KEEPALIVE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'dashboard_manual_test' }),
      });

      if (!response.ok) {
        throw new Error(`Falha no webhook: ${response.status}`);
      }

      await fetchSessions();
      toast({
        title: 'Sessões Testadas com Sucesso!',
        description: 'Status atualizados com base na resposta em tempo real das plataformas.',
      });
    } catch (err) {
      toast({
        title: 'Erro ao testar sessões',
        description: err instanceof Error ? err.message : 'Tente novamente em alguns segundos.',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleOpenReconnect = (session: AgentBrowserSession) => {
    setSelectedSession(session);
    setCookieInput('');
    setDialogOpen(true);
  };

  const handleSaveCookies = async () => {
    if (!selectedSession || !cookieInput.trim()) return;

    try {
      setSavingCookies(true);
      let parsedCookies: any[] = [];

      const trimmed = cookieInput.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          parsedCookies = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          throw new Error('O formato JSON dos cookies é inválido.');
        }
      } else if (trimmed.includes('=')) {
        // String no formato chave=valor; chave2=valor2
        const domain = selectedSession.domain.includes('booking') ? '.booking.com' : '.airbnb.com.br';
        parsedCookies = trimmed.split(';').map(part => {
          const [name, ...valParts] = part.trim().split('=');
          return {
            name: name.trim(),
            value: valParts.join('=').trim(),
            domain: domain,
            path: '/',
            httpOnly: false,
            secure: true
          };
        }).filter(c => c.name && c.value);
      }

      if (parsedCookies.length === 0) {
        throw new Error('Nenhum cookie válido pôde ser extraído da entrada.');
      }

      const { error } = await supabase
        .from('agent_browser_sessions' as any)
        .update({
          cookies_encrypted: JSON.stringify(parsedCookies),
          is_valid: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedSession.id);

      if (error) throw error;

      toast({
        title: 'Cookies Atualizados!',
        description: `${parsedCookies.length} cookies salvos. Validando conexão com o assistente...`,
      });

      setDialogOpen(false);
      setCookieInput('');

      // Aciona o keepalive imediatamente para validar os cookies recém-salvos
      handleTestSessions();
    } catch (err) {
      toast({
        title: 'Erro ao salvar cookies',
        description: err instanceof Error ? err.message : 'Verifique os dados colados.',
        variant: 'destructive',
      });
    } finally {
      setSavingCookies(false);
    }
  };

  const copyExtractionSnippet = (domain: string) => {
    const isBooking = domain.includes('booking');
    const snippet = isBooking
      ? `copy(document.cookie)`
      : `copy(document.cookie)`;
    navigator.clipboard.writeText(snippet);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
    toast({
      title: 'Comando copiado!',
      description: 'Cole no console (F12 > Console) da aba aberta na plataforma para copiar os cookies.',
    });
  };

  const getPlatformDetails = (domain: string) => {
    if (domain.includes('booking')) {
      return {
        name: 'Booking.com',
        loginUrl: 'https://admin.booking.com/hotel/hoteladmin/extranet_ng/manage/home.html',
        badgeColor: 'bg-blue-600/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        brandAccent: 'text-blue-600 dark:text-blue-400',
        description: 'Extranet Booking.com para auditoria de comissões e reservas diretas.',
      };
    }
    return {
      name: 'Airbnb',
      loginUrl: 'https://www.airbnb.com.br/hosting/reservations',
      badgeColor: 'bg-rose-600/10 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      brandAccent: 'text-rose-600 dark:text-rose-400',
      description: 'Portal de Anfitrião Airbnb para verificação de extratos e valores líquidos.',
    };
  };

  return (
    <Card className="border border-border/80 shadow-sm overflow-hidden bg-gradient-to-br from-card via-card to-muted/20">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                Sessões das Plataformas (OTA Keepalive)
                <Badge variant="outline" className="text-xs font-normal text-muted-foreground border-border/60">
                  <Sparkles className="h-3 w-3 mr-1 text-amber-500" />
                  Keepalive Ativo (12 min)
                </Badge>
              </CardTitle>
              <CardDescription className="text-sm mt-0.5">
                O robô de IA mantém heartbeat contínuo para evitar que os logins da Booking.com e Airbnb expirem por inatividade.
              </CardDescription>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTestSessions}
          disabled={testing || loading}
          className="hover:border-indigo-300 transition-all duration-200"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${testing ? 'animate-spin text-indigo-600' : ''}`} />
          {testing ? 'Testando...' : 'Testar Conexões'}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Carregando estado das sessões...
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            Nenhuma sessão registrada no banco de dados.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {sessions.map((session) => {
              const platform = getPlatformDetails(session.domain);
              let cookieCount = 0;
              try {
                if (session.cookies_encrypted) {
                  const parsed = JSON.parse(session.cookies_encrypted);
                  cookieCount = Array.isArray(parsed) ? parsed.length : 0;
                }
              } catch {
                cookieCount = 0;
              }

              return (
                <div
                  key={session.id}
                  className="rounded-xl border border-border/70 p-4 bg-background/50 hover:bg-background/80 transition-all duration-200 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base">{platform.name}</span>
                        <Badge variant="outline" className={`text-xs ${platform.badgeColor}`}>
                          {session.domain}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {platform.description}
                      </p>
                    </div>

                    {session.is_valid ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium text-xs flex items-center gap-1 hover:bg-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" />
                        Autenticado
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="font-medium text-xs flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Expirado
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/40">
                    <div className="flex justify-between items-center">
                      <span>Último Keepalive:</span>
                      <strong className="text-foreground">{formatDateTime(session.last_used_at)}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Cookies em Cache:</span>
                      <span className="text-foreground">{cookieCount} cookies rotacionados</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <a
                      href={platform.loginUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 hover:underline"
                    >
                      Acessar Portal
                      <ExternalLink className="h-3 w-3" />
                    </a>

                    <Button
                      size="sm"
                      variant={session.is_valid ? 'outline' : 'default'}
                      onClick={() => handleOpenReconnect(session)}
                      className={!session.is_valid ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}
                    >
                      <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                      {session.is_valid ? 'Atualizar Sessão' : 'Reconectar Sessão'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 bg-indigo-50/40 dark:bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-100/60 dark:border-indigo-900/30">
          <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>
            <strong>Proteção Ativa:</strong> As requisições de keepalive simulam navegação humana pelo Browserless, atualizando automaticamente os tokens de sessão sem necessidade de intervenção diária.
          </span>
        </div>
      </CardContent>

      {/* Dialog para Reconectar / Atualizar Cookies */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-indigo-600" />
              Sincronizar Sessão — {selectedSession && getPlatformDetails(selectedSession.domain).name}
            </DialogTitle>
            <DialogDescription>
              Cole os cookies de sessão ativos para revalidar a conexão do agente de IA com a plataforma.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground space-y-2 border border-border/50">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-indigo-600" />
                Como extrair em 10 segundos:
              </p>
              <ol className="list-decimal list-inside space-y-1 pl-1">
                <li>Abra uma aba logada na plataforma ({selectedSession?.domain}).</li>
                <li>Pressione <kbd className="px-1 py-0.5 bg-background rounded border text-[10px]">F12</kbd> &gt; abra a aba <strong>Console</strong>.</li>
                <li>Digite ou copie o comando abaixo e tecle Enter:</li>
              </ol>

              <div className="flex items-center justify-between bg-background p-2 rounded border font-mono text-[11px] mt-1.5">
                <code>copy(document.cookie)</code>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() => selectedSession && copyExtractionSnippet(selectedSession.domain)}
                >
                  {copiedScript ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                *Você também pode colar o JSON completo exportado por extensões como <em>EditThisCookie</em>.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cookie-input" className="text-sm font-medium">
                Cookies da Sessão
              </Label>
              <Textarea
                id="cookie-input"
                rows={5}
                placeholder="Cole aqui a string de cookies ou o array JSON exportado..."
                value={cookieInput}
                onChange={(e) => setCookieInput(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveCookies}
              disabled={savingCookies || !cookieInput.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {savingCookies ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar e Testar Conexão'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default OTASessionsCard;
