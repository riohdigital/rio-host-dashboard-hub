import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle, CalendarClock, CheckCircle2, Clock, ExternalLink, Mail,
  Pencil, Plus, RefreshCw, Trash2, XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { useToast } from '@/hooks/use-toast';
import { useProperties } from '@/hooks/useProperties';
import { useChannelSync } from '@/hooks/useChannelSync';
import { PENDING_KIND_LABELS, type ChannelSyncSource } from '@/types/channelSync';
import SourceDialog from './channel-sync/SourceDialog';

const formatDateTime = (value: string | null) =>
  value ? format(new Date(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Nunca';

const statusBadge = (status: string | null) => {
  switch (status) {
    case 'success':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Sincronizado</Badge>;
    case 'partial':
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Parcial</Badge>;
    case 'error':
      return <Badge variant="destructive">Erro</Badge>;
    case 'skipped':
      return <Badge variant="secondary">Sem mudanças</Badge>;
    default:
      return <Badge variant="outline">Aguardando</Badge>;
  }
};

const ChannelSyncSection: React.FC = () => {
  const { toast } = useToast();
  const { properties } = useProperties();
  const {
    sources, runs, pending, loading, syncing, error,
    saveSource, deleteSource, toggleSource, runSync, resolvePending,
    assignPendingProperty,
  } = useChannelSync();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ChannelSyncSource | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChannelSyncSource | null>(null);
  // Propriedade escolhida em cada pendência de "propriedade não identificada".
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});

  const propertyName = useMemo(() => {
    const map = new Map(properties.map((p) => [p.id, p.nickname || p.name]));
    return (id: string | null) => (id ? map.get(id) ?? 'Propriedade removida' : '—');
  }, [properties]);

  const handleSync = async (sourceId?: string) => {
    try {
      const result = await runSync({ sourceId, force: true });
      const totals = result?.totals;
      toast({
        title: 'Sincronização concluída',
        description: totals
          ? `${totals.created} reserva(s) criada(s), ${totals.updated} atualizada(s), ${totals.pending} para conferir.`
          : result?.message ?? 'Nenhuma alteração encontrada.',
      });
    } catch (err) {
      toast({
        title: 'Erro na sincronização',
        description: err instanceof Error ? err.message : 'Tente novamente em alguns minutos.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSource(deleteTarget.id);
      toast({ title: 'Calendário removido' });
    } catch (err) {
      toast({
        title: 'Erro ao remover',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleToggle = async (source: ChannelSyncSource, value: boolean) => {
    try {
      await toggleSource(source.id, value);
    } catch (err) {
      toast({
        title: 'Erro ao atualizar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleAssign = async (id: string) => {
    const propertyId = escolhas[id];
    if (!propertyId) return;

    try {
      await assignPendingProperty(id, propertyId);
      toast({
        title: 'Propriedade vinculada',
        description:
          'O nome do anúncio foi guardado no calendário. A próxima sincronização de e-mail cria a reserva.',
      });
    } catch (err) {
      toast({
        title: 'Erro ao vincular',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handlePending = async (id: string, status: 'resolved' | 'dismissed') => {
    try {
      await resolvePending(id, status);
    } catch (err) {
      toast({
        title: 'Erro ao atualizar pendência',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Sincronização Automática de Reservas</h2>
        <p className="text-gray-600 mt-1">
          Duas fontes trabalham juntas: o <strong>calendário iCal</strong> traz as datas
          ocupadas e o <strong>e-mail das plataformas</strong> completa hóspede, valor e
          cancelamentos.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Não foi possível carregar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ---------------- Calendários iCal ---------------- */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              Calendários conectados
            </CardTitle>
            <CardDescription>
              Um link por anúncio. O sistema lê os feeds e cria as reservas sem intervenção.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleSync()}
              disabled={syncing || sources.length === 0}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              Sincronizar agora
            </Button>
            <Button
              onClick={() => { setEditing(null); setDialogOpen(true); }}
              className="bg-[#6A6DDF] hover:bg-[#5A5BCF]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Conectar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500">Carregando...</p>
          ) : sources.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CalendarClock className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhum calendário conectado</p>
              <p className="text-sm mt-1">
                Exporte o link iCal de cada anúncio no Airbnb e no Booking.com e cole aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{propertyName(source.property_id)}</span>
                      <Badge variant="outline">{source.platform}</Badge>
                      {statusBadge(source.last_sync_status)}
                      {!source.is_active && <Badge variant="secondary">Pausado</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Última leitura: {formatDateTime(source.last_sync_at)}
                      {source.last_sync_message ? ` — ${source.last_sync_message}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={source.is_active}
                      onCheckedChange={(value) => handleToggle(source, value)}
                      aria-label="Ativar sincronização"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSync(source.id)}
                      disabled={syncing}
                      title="Sincronizar este calendário"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setEditing(source); setDialogOpen(true); }}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(source)}
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------------- Canal de e-mail ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Captura por e-mail
          </CardTitle>
          <CardDescription>
            O iCal não informa hóspede nem valor — o Airbnb e o Booking.com removeram esses
            dados dos feeds. Esses campos vêm dos e-mails de confirmação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <p>
            Encaminhe os e-mails das plataformas para a função{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5">ingest-reservation-email</code>.
            O passo a passo (Gmail via Apps Script, gratuito, ou Cloudflare Email Routing)
            está no guia do projeto.
          </p>
          <a
            className="inline-flex items-center gap-1 text-[#6A6DDF] hover:underline"
            href="https://github.com/riohdigital/rio-host-dashboard-hub/blob/main/docs/SINCRONIZACAO-AUTOMATICA.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir o guia de configuração
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </CardContent>
      </Card>

      {/* ---------------- Fila de conferência ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Precisam da sua conferência
            {pending.length > 0 && (
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                {pending.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            A sincronização nunca cancela nem sobrescreve nada por conta própria. O que ficou
            ambíguo aparece aqui.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Nada pendente no momento.
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((item) => (
                <div key={item.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{PENDING_KIND_LABELS[item.kind] ?? item.kind}</Badge>
                    {item.platform && <Badge variant="secondary">{item.platform}</Badge>}
                    <span className="text-xs text-gray-500">
                      {propertyName(item.property_id)} · {formatDateTime(item.created_at)}
                    </span>
                  </div>
                  <p className="text-sm mt-2">{item.summary}</p>

                  {item.kind === 'unmatched_property' && (
                    <div className="mt-3 rounded-md bg-gray-50 p-3 space-y-2">
                      {(item.payload as { listing_name?: string })?.listing_name && (
                        <p className="text-xs text-gray-600">
                          Anúncio no e-mail:{' '}
                          <strong>{(item.payload as { listing_name?: string }).listing_name}</strong>
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        Escolha o imóvel: o nome do anúncio fica guardado no calendário e os
                        próximos e-mails se resolvem sozinhos.
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Select
                          value={escolhas[item.id] ?? ''}
                          onValueChange={(value) =>
                            setEscolhas((atual) => ({ ...atual, [item.id]: value }))}
                        >
                          <SelectTrigger className="sm:w-72">
                            <SelectValue placeholder="Selecione a propriedade" />
                          </SelectTrigger>
                          <SelectContent>
                            {properties.map((property) => (
                              <SelectItem key={property.id} value={property.id}>
                                {property.nickname || property.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          disabled={!escolhas[item.id]}
                          onClick={() => handleAssign(item.id)}
                          className="bg-[#6A6DDF] hover:bg-[#5A5BCF]"
                        >
                          Vincular
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" onClick={() => handlePending(item.id, 'resolved')}>
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Já resolvi
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handlePending(item.id, 'dismissed')}>
                      <XCircle className="h-4 w-4 mr-1" />
                      Ignorar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------------- Histórico ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Últimas execuções
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma execução registrada ainda.</p>
          ) : (
            <div className="divide-y">
              {runs.map((run) => (
                <div key={run.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {statusBadge(run.status)}
                      <span className="text-sm">
                        {run.channel === 'ical' ? 'Calendário' : 'E-mail'}
                        {run.platform ? ` · ${run.platform}` : ''}
                      </span>
                    </div>
                    {run.message && (
                      <p className="text-xs text-gray-500 mt-1 break-words">{run.message}</p>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 text-right">
                    <div>{formatDateTime(run.started_at)}</div>
                    <div>
                      +{run.reservations_created} novas · {run.reservations_updated} atualizadas
                      {run.pending_created > 0 ? ` · ${run.pending_created} p/ conferir` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <SourceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        properties={properties}
        source={editing}
        onSave={saveSource}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover calendário?</AlertDialogTitle>
            <AlertDialogDescription>
              As reservas já importadas continuam no sistema. Apenas a leitura automática
              deste anúncio será desligada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ChannelSyncSection;
