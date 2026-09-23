import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Globe, CheckCircle2, AlertTriangle, RefreshCw, KeyRound,
  ShieldCheck, ExternalLink, Sparkles, Monitor
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import BrowserlessScreencastModal from './BrowserlessScreencastModal';

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
  const [screencastOpen, setScreencastOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<AgentBrowserSession | null>(null);

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

  const handleOpenScreencast = (session: AgentBrowserSession) => {
    setSelectedSession(session);
    setScreencastOpen(true);
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
                      onClick={() => handleOpenScreencast(session)}
                      className={!session.is_valid ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}
                    >
                      <Monitor className="h-3.5 w-3.5 mr-1.5" />
                      {session.is_valid ? 'Abrir Navegador VPS' : 'Conectar via Navegador VPS'}
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

      {/* Modal Interativo de Screencast direto da VPS */}
      <BrowserlessScreencastModal
        open={screencastOpen}
        onOpenChange={setScreencastOpen}
        session={selectedSession}
        onSessionUpdated={fetchSessions}
      />
    </Card>
  );
};

export default OTASessionsCard;
