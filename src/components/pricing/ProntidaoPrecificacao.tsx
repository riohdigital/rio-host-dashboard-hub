import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Circle, Loader2, PencilLine, RefreshCw, Sparkles, XCircle, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { fetchN8n } from '@/lib/n8n';
import { Property } from '@/types/property';
import { PipelineStage, PricingRule } from '@/types/pricing';
import { NOME_DO_TIPO, ORIGEM_DA_REGRA, percentual } from './ocupacao';

/**
 * Prontidão e ativação da precificação automática, imóvel a imóvel.
 *
 * Antes de ativar: confere no cadastro o que a esteira precisa (endereço, diária base, imóvel
 * ativo) e só libera o botão quando está tudo lá. Ao ativar, grava a ativação no imóvel (o RLS
 * de properties decide quem pode) e chama a esteira no n8n, que só roda para imóvel ativado.
 * Depois disso tudo é automático: a esteira revisa as etapas de hora em hora e o radar gera as
 * oportunidades todo dia. Etapa bloqueada por falta de dado vira um pedido claro de correção no
 * cadastro, com o motivo que a própria etapa registrou.
 */

// Etapa opcional (eventos da cidade) não vira pendência do anfitrião: sem ela, a precificação
// segue com os feriados oficiais; o bloqueio aparece só como informação.
const ETAPAS: { chave: string; nome: string; descricao: string; opcional?: boolean }[] = [
  { chave: 'E1_localizacao', nome: 'Localização', descricao: 'Cidade, estado e país a partir do endereço' },
  { chave: 'E2_feriados', nome: 'Feriados oficiais', descricao: 'Feriados nacionais, estaduais e prolongados' },
  { chave: 'E3_eventos', nome: 'Eventos da cidade', descricao: 'Shows, festivais, esportes e congressos, com fonte', opcional: true },
  { chave: 'E7_regras', nome: 'Regras de preço', descricao: 'Quanto o imóvel sobe em cada tipo de data, aprendido das suas reservas' },
];
const OBRIGATORIAS = ETAPAS.filter(e => !e.opcional);

interface Requisito {
  ok: boolean;
  texto: string;
  obrigatorio: boolean;
}

const requisitos = (p: Property): Requisito[] => [
  { ok: Boolean(p.address && p.address.trim()), texto: 'Endereço completo (rua, bairro e cidade)', obrigatorio: true },
  { ok: Number(p.base_nightly_price) > 0, texto: 'Diária base', obrigatorio: true },
  { ok: p.status === 'Ativo', texto: 'Imóvel com status Ativo', obrigatorio: true },
  { ok: Boolean(p.airbnb_link || p.booking_link), texto: 'Link do anúncio (Airbnb ou Booking), para comparar com concorrentes', obrigatorio: false },
];

const quando = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;

interface Props {
  properties: Property[];
  regras: PricingRule[];
  /** Chamado quando a esteira termina, para a página recarregar alertas e regras. */
  onAtualizado: () => void;
}

export const ProntidaoPrecificacao: React.FC<Props> = ({ properties, regras, onAtualizado }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [etapas, setEtapas] = useState<PipelineStage[]>([]);
  const [ativados, setAtivados] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState<Record<string, boolean>>({});
  const [acompanhando, setAcompanhando] = useState(false);

  const ids = useMemo(() => properties.map(p => p.id), [properties]);
  const atualizar = useRef(onAtualizado);
  atualizar.current = onAtualizado;

  const carregar = useCallback(async () => {
    if (!ids.length) return [] as PipelineStage[];
    const { data, error } = await supabase.from('property_pipeline').select('*').in('property_id', ids);
    if (error) {
      console.error('Erro ao ler a esteira de precificação:', error);
      return [] as PipelineStage[];
    }
    const lidas = (data as unknown as PipelineStage[]) || [];
    setEtapas(lidas);
    return lidas;
  }, [ids]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Enquanto alguma etapa roda, acompanha ao vivo; ao terminar, a página recarrega o resto.
  useEffect(() => {
    if (!acompanhando) return;
    let voltas = 0;
    const t = setInterval(async () => {
      voltas++;
      const lidas = await carregar();
      const rodando = lidas.some(e => e.status === 'rodando' || e.status === 'pendente');
      if ((!rodando && voltas > 1) || voltas > 60) {
        setAcompanhando(false);
        atualizar.current();
      }
    }, 4000);
    return () => clearInterval(t);
  }, [acompanhando, carregar]);

  const ativadoEm = (p: Property) => ativados[p.id] || p.pricing_activated_at || null;

  const rodarEsteira = async (propertyId: string) => {
    const resp = await fetchN8n('rioh-host-esteira-precificacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_id: propertyId }),
    });
    if (!resp.ok) throw new Error(`A esteira respondeu ${resp.status}`);
  };

  const ativar = async (p: Property) => {
    setEnviando(prev => ({ ...prev, [p.id]: true }));
    try {
      if (!ativadoEm(p)) {
        const agora = new Date().toISOString();
        const { data, error } = await supabase
          .from('properties')
          .update({ pricing_activated_at: agora, pricing_activated_by: user?.id ?? null })
          .eq('id', p.id)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) {
          toast({ title: 'Sem permissão', description: 'Você não tem permissão para editar este imóvel.', variant: 'destructive' });
          return;
        }
        setAtivados(prev => ({ ...prev, [p.id]: agora }));
      }
      await rodarEsteira(p.id);
      toast({ title: 'Precificação automática em andamento', description: `${p.nickname || p.name}: localizando o imóvel, buscando feriados e aprendendo as regras de preço.` });
      setAcompanhando(true);
    } catch (e) {
      console.error('Erro ao ativar a precificação:', e);
      toast({ title: 'Não foi possível iniciar', description: 'A ativação ficou salva; a esteira tenta de novo sozinha na próxima hora.', variant: 'destructive' });
    } finally {
      setEnviando(prev => ({ ...prev, [p.id]: false }));
    }
  };

  const linhas = properties.map(p => {
    const reqs = requisitos(p);
    const faltando = reqs.filter(r => r.obrigatorio && !r.ok);
    const minhas = etapas.filter(e => e.property_id === p.id);
    const etapa = (chave: string) => minhas.find(e => e.etapa === chave);
    const bloqueios = OBRIGATORIAS.map(e => etapa(e.chave)).filter((e): e is PipelineStage => Boolean(e && (e.status === 'bloqueado' || e.status === 'falhou')));
    const rodando = minhas.some(e => e.status === 'rodando' || e.status === 'pendente');
    const tudoOk = OBRIGATORIAS.every(e => etapa(e.chave)?.status === 'ok');
    return { p, reqs, faltando, etapa, bloqueios, rodando, tudoOk, ativo: Boolean(ativadoEm(p)) };
  });

  if (!linhas.length) return null;

  const naoAtivados = linhas.filter(l => !l.ativo);
  const comPendencia = linhas.filter(l => l.ativo && (l.bloqueios.length > 0 || l.rodando));
  const emDia = linhas.filter(l => l.ativo && l.tudoOk && !l.rodando);
  const unico = linhas.length === 1;

  // Tudo ativo e em dia: uma linha discreta com o que o sistema aprendeu, sem ocupar a página.
  if (!naoAtivados.length && !comPendencia.length) {
    const ultima = etapas.map(e => e.ultima_ok_em).filter(Boolean).sort().pop();
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/50 px-4 py-2.5 text-xs text-emerald-900">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <span className="font-semibold">Precificação automática ativa</span>
        <span className="text-emerald-800/80">
          {unico ? (linhas[0].p.nickname || linhas[0].p.name) : `${emDia.length} imóveis`} • localização, feriados e regras em dia
          {ultima ? ` • revisado em ${quando(ultima)}` : ''}
        </span>
      </div>
    );
  }

  const regrasDe = (id: string) => regras.filter(r => r.property_id === id && r.tipo_data !== 'fim_de_semana' && Number(r.fator) > 0);

  return (
    <Card className="shadow-xs border-t-2 border-t-[#6A6DDF]">
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="p-2 rounded-lg bg-[#6A6DDF]/10 text-[#6A6DDF]">
              <Zap className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-gray-800">Precificação automática</h3>
              <p className="text-xs text-gray-500 max-w-2xl">
                Ao ativar, o sistema localiza o imóvel, busca os feriados da cidade, do estado e do país e aprende com as suas
                reservas quanto a diária sobe em cada tipo de data. Depois disso tudo se atualiza sozinho, e as oportunidades
                aparecem aqui e no Anfitrião Alerta.
              </p>
            </div>
          </div>
          {naoAtivados.length > 1 && naoAtivados.some(l => !l.faltando.length) && (
            <Button
              size="sm"
              className="bg-[#6A6DDF] hover:bg-[#5A5BCF] text-white shrink-0"
              onClick={() => naoAtivados.filter(l => !l.faltando.length).forEach(l => ativar(l.p))}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Ativar nos {naoAtivados.filter(l => !l.faltando.length).length} imóveis prontos
            </Button>
          )}
        </div>

        <div className="space-y-2.5">
          {[...naoAtivados, ...comPendencia].map(({ p, reqs, faltando, etapa, bloqueios, rodando, ativo }) => (
            <div key={p.id} className="rounded-lg border bg-gray-50/50 p-3.5 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-sm text-gray-800 truncate">{p.nickname || p.name}</span>
                  {!ativo ? (
                    faltando.length || bloqueios.some(b => b.status === 'bloqueado') ? (
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">Cadastro incompleto</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-indigo-50 text-[#6A6DDF] border-indigo-200">Pronto para ativar</Badge>
                    )
                  ) : rodando ? (
                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">Em andamento</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">Precisa de atenção</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(faltando.length > 0 || bloqueios.some(b => b.status === 'bloqueado')) && (
                    <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                      <Link to={`/propriedades?editar=${p.id}`}>
                        <PencilLine className="h-3.5 w-3.5 mr-1.5" /> Atualizar cadastro
                      </Link>
                    </Button>
                  )}
                  {!ativo && !faltando.length && (
                    <Button size="sm" className="h-8 text-xs bg-[#6A6DDF] hover:bg-[#5A5BCF] text-white" disabled={enviando[p.id]} onClick={() => ativar(p)}>
                      {enviando[p.id] ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                      Ativar precificação automática
                    </Button>
                  )}
                  {ativo && !rodando && bloqueios.length > 0 && (
                    <Button size="sm" variant="outline" className="h-8 text-xs" disabled={enviando[p.id]} onClick={() => ativar(p)}>
                      {enviando[p.id] ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                      Tentar de novo
                    </Button>
                  )}
                </div>
              </div>

              {!ativo && bloqueios.some(b => b.status === 'bloqueado' && b.motivo) && (
                <p className="text-[11px] text-amber-800 bg-amber-50/70 border border-amber-200 rounded px-2 py-1.5">
                  {bloqueios.filter(b => b.status === 'bloqueado' && b.motivo).map(b => b.motivo).join(' ')}
                </p>
              )}
              {!ativo ? (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                  {reqs.map(r => (
                    <li key={r.texto} className={`flex items-center gap-1.5 ${r.ok ? 'text-gray-600' : r.obrigatorio ? 'text-amber-700 font-medium' : 'text-gray-400'}`}>
                      {r.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : r.obrigatorio ? <AlertTriangle className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                      {r.texto}{!r.ok && !r.obrigatorio ? ' (recomendado)' : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="space-y-1.5 text-[11px]">
                  {ETAPAS.map(e => {
                    const s = etapa(e.chave);
                    const st = s?.status || 'pendente';
                    return (
                      <li key={e.chave} className="flex items-start gap-2">
                        {st === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5 mt-px text-emerald-600 shrink-0" />
                          : st === 'rodando' || st === 'pendente' ? <Loader2 className="h-3.5 w-3.5 mt-px text-blue-600 animate-spin shrink-0" />
                          : st === 'bloqueado' && e.opcional ? <Circle className="h-3.5 w-3.5 mt-px text-gray-400 shrink-0" />
                          : st === 'bloqueado' ? <AlertTriangle className="h-3.5 w-3.5 mt-px text-amber-600 shrink-0" />
                          : <XCircle className="h-3.5 w-3.5 mt-px text-red-600 shrink-0" />}
                        <div className="min-w-0">
                          <span className="font-semibold text-gray-700">{e.nome}</span>
                          <span className="text-gray-400"> — {e.descricao}</span>
                          {st === 'bloqueado' && s?.motivo && <p className={e.opcional ? 'text-gray-500' : 'text-amber-800'}>{s.motivo}</p>}
                          {st === 'falhou' && (
                            <p className="text-red-700">
                              {s?.motivo || 'Falha passageira.'} Nova tentativa automática{s?.proxima_tentativa_em ? ` em ${quando(s.proxima_tentativa_em)}` : ''}.
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {ativo && regrasDe(p.id).length > 0 && (
                <p className="text-[11px] text-gray-500">
                  Aprendido: {regrasDe(p.id).map(r => `${NOME_DO_TIPO[r.tipo_data] || r.tipo_data} ${percentual(Number(r.fator))}`).join(' • ')}
                  {' '}({ORIGEM_DA_REGRA[regrasDe(p.id)[0].origem] || regrasDe(p.id)[0].origem})
                </p>
              )}
            </div>
          ))}
        </div>

        {emDia.length > 0 && (
          <p className="text-[11px] text-emerald-700 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Em dia: {emDia.map(l => l.p.nickname || l.p.name).join(', ')}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default ProntidaoPrecificacao;
