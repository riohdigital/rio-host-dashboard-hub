import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, Bed, Building, Layers, MapPin, RefreshCw, Star, TrendingDown, TrendingUp, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Property } from '@/types/property';
import { PricingRule } from '@/types/pricing';
import { NOME_DO_TIPO, hojeLocal, percentual } from './ocupacao';

/**
 * Concorrentes escolhidos sozinhos pela esteira (E5/E6): anúncios do Airbnb em volta do imóvel,
 * achados pela busca no mapa feita com o login do próprio anfitrião, e os preços deles nas datas
 * que importam. Cada preço guarda o trecho da página como prova (raw_payload). O usuário pode
 * excluir um concorrente: a esteira não o traz de volta.
 */

interface Concorrente {
  id: string;
  property_id: string | null;
  name: string;
  listing_url: string;
  platform: string;
  bedrooms: number | null;
  current_rating: number | null;
  reviews_count: number | null;
  distance_km: number | null;
  similarity_score: number | null;
  status: string | null;
  last_seen_at: string | null;
}

interface PrecoColetado {
  competitor_listing_id: string | null;
  target_date: string;
  daily_price: number | null;
  raw_payload: { busca?: { tipo?: string } } | null;
}

interface Props {
  propertyId: string;
  properties: Property[];
  selectedProperty: Property | null;
  selectedPropertyIds?: string[];
  /** Regras vigentes dos imóveis da seleção (para mostrar quanto o mercado sobe). */
  regras: PricingRule[];
}

const reais = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `R$ ${Math.round(v).toLocaleString('pt-BR')}`);
const mediana = (xs: number[]) => {
  const a = xs.filter(x => x > 0).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const ROTULO: Record<string, string> = { comum: 'Semana comum', ...NOME_DO_TIPO };

export const CompetitorsRadarTab: React.FC<Props> = ({ propertyId, properties, selectedProperty, selectedPropertyIds, regras }) => {
  const { toast } = useToast();
  const [concorrentes, setConcorrentes] = useState<Concorrente[]>([]);
  const [precos, setPrecos] = useState<Record<string, PrecoColetado[]>>({});
  const [minhaNoite, setMinhaNoite] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  const ids = useMemo(() => {
    if (propertyId !== 'todas') return [propertyId];
    if (selectedPropertyIds && selectedPropertyIds.length > 0 && !selectedPropertyIds.includes('todas')) return selectedPropertyIds;
    return properties.map(p => p.id);
  }, [propertyId, selectedPropertyIds, properties]);

  const carregar = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('competitor_listings')
        .select('id, property_id, name, listing_url, platform, bedrooms, current_rating, reviews_count, distance_km, similarity_score, status, last_seen_at')
        .in('property_id', ids)
        .eq('status', 'Ativo')
        .order('similarity_score', { ascending: false });
      if (error) throw error;
      const lista = (data as unknown as Concorrente[]) || [];
      setConcorrentes(lista);

      if (lista.length) {
        const { data: snaps } = await supabase
          .from('competitor_price_snapshots')
          .select('competitor_listing_id, target_date, daily_price, raw_payload')
          .in('competitor_listing_id', lista.map(c => c.id))
          .not('raw_payload', 'is', null)
          .gte('target_date', hojeLocal())
          .order('target_date', { ascending: true });
        const agrupado: Record<string, PrecoColetado[]> = {};
        for (const s of (snaps as unknown as PrecoColetado[]) || []) {
          if (!s.competitor_listing_id) continue;
          (agrupado[s.competitor_listing_id] = agrupado[s.competitor_listing_id] || []).push(s);
        }
        setPrecos(agrupado);
      } else {
        setPrecos({});
      }

      // Sua noite comum: o próprio calendário (terça a quinta, 60 dias); senão, a diária base.
      if (selectedProperty) {
        const fim = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
        const { data: cal } = await supabase
          .from('property_calendar_prices')
          .select('date, price_per_night')
          .eq('property_id', selectedProperty.id)
          .gte('date', hojeLocal())
          .lte('date', fim);
        const uteis = ((cal as { date: string; price_per_night: number }[]) || [])
          .filter(c => [2, 3, 4].includes(new Date(`${c.date}T12:00:00Z`).getUTCDay()))
          .map(c => Number(c.price_per_night));
        setMinhaNoite(mediana(uteis) ?? (Number(selectedProperty.base_nightly_price) || null));
      } else {
        setMinhaNoite(null);
      }
    } catch (e) {
      console.error('Erro ao buscar concorrentes:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(','), selectedProperty?.id]);

  const excluir = async (c: Concorrente) => {
    setExcluindo(c.id);
    const { error } = await supabase.from('competitor_listings').update({ status: 'Excluído' }).eq('id', c.id);
    setExcluindo(null);
    if (error) {
      toast({ title: 'Não foi possível excluir', description: 'Você não tem permissão neste imóvel.', variant: 'destructive' });
      return;
    }
    setConcorrentes(prev => prev.filter(x => x.id !== c.id));
    toast({ title: 'Concorrente excluído', description: `${c.name} não entra mais na comparação deste imóvel.` });
  };

  // Mercado em noite comum e quanto sobe: das regras "mercado" que a E5 gravou.
  const mercado = useMemo(() => {
    if (!selectedProperty) return null;
    const minhas = regras.filter(r => r.property_id === selectedProperty.id && r.origem === 'mercado');
    if (!minhas.length) return null;
    const comum = Number((minhas[0].detalhe as { mediana_comum?: number } | null)?.mediana_comum) || null;
    return { comum, regras: minhas };
  }, [regras, selectedProperty]);

  const posicao = minhaNoite && mercado?.comum ? Math.round(((minhaNoite - mercado.comum) / mercado.comum) * 100) : null;
  const nomeDoImovel = (id: string | null) => {
    const p = properties.find(x => x.id === id);
    return p ? p.nickname || p.name : '';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border shadow-xs space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#6A6DDF]" />
            Concorrentes escolhidos automaticamente
          </h3>
          <Badge variant="outline" className="bg-[#6A6DDF]/10 text-[#6A6DDF] border-[#6A6DDF]/20 text-[11px] font-bold">
            {concorrentes.length} acompanhado(s)
          </Badge>
        </div>
        <p className="text-xs text-gray-500 max-w-3xl">
          Anúncios do Airbnb em volta do imóvel, para o mesmo número de hóspedes das suas reservas, escolhidos pela semelhança
          (distância, quartos, nota e preço). Os preços são lidos a cada 3 dias com o seu login, numa semana comum, num fim de
          semana e nos próximos feriados e eventos. Exclua quem não for um concorrente de verdade: ele não volta.
        </p>
      </div>

      {selectedProperty && (minhaNoite || mercado) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-indigo-50/50 to-white border-indigo-100 shadow-xs">
            <CardContent className="p-4">
              <span className="text-xs font-medium text-gray-500">Sua noite comum</span>
              <div className="text-2xl font-bold text-gray-900 mt-1">{reais(minhaNoite)}</div>
              <span className="text-[11px] text-gray-400">Mediana de terça a quinta no seu calendário (próximos 60 dias)</span>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50/50 to-white border-purple-100 shadow-xs">
            <CardContent className="p-4">
              <span className="text-xs font-medium text-gray-500">Mercado em noite comum</span>
              <div className="text-2xl font-bold text-[#6A6DDF] mt-1">{mercado?.comum ? reais(mercado.comum) : 'Em coleta'}</div>
              <span className="text-[11px] text-gray-400">Mediana dos anúncios parecidos numa semana comum</span>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50/50 to-white border-amber-100 shadow-xs">
            <CardContent className="p-4">
              <span className="text-xs font-medium text-gray-500">Posicionamento</span>
              <div className="text-xl font-bold mt-1 flex items-center gap-1.5">
                {posicao === null ? (
                  <span className="text-gray-400 text-sm">Sem dado suficiente</span>
                ) : posicao < -5 ? (
                  <span className="text-emerald-600 flex items-center gap-1"><TrendingDown className="h-4 w-4" /> {Math.abs(posicao)}% abaixo</span>
                ) : posicao > 5 ? (
                  <span className="text-amber-600 flex items-center gap-1"><TrendingUp className="h-4 w-4" /> {posicao}% acima</span>
                ) : (
                  <span className="text-gray-700">No preço do mercado</span>
                )}
              </div>
              <span className="text-[11px] text-gray-400">
                {posicao === null ? '' : posicao < -5 ? 'Espaço para subir a noite comum' : posicao > 5 ? 'Confira se a ocupação acompanha' : 'Alinhado aos parecidos'}
              </span>
            </CardContent>
          </Card>
          {mercado && mercado.regras.length > 0 && (
            <div className="sm:col-span-3 rounded-lg border bg-white px-4 py-2.5 text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
              <span className="font-semibold text-gray-700">Quanto o mercado sobe:</span>
              {mercado.regras.map(r => (
                <span key={r.tipo_data}>{NOME_DO_TIPO[r.tipo_data] || r.tipo_data} <strong className="text-[#6A6DDF]">{percentual(Number(r.fator))}</strong> <span className="text-gray-400">({r.amostras} anúncios)</span></span>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-500 bg-white rounded-lg border">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-[#6A6DDF] mb-2" />
          Carregando concorrentes...
        </div>
      ) : concorrentes.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-xl border p-8 space-y-3">
          <Building className="h-10 w-10 text-gray-400 mx-auto" />
          <h4 className="font-bold text-gray-800 text-base">Nenhum concorrente ainda</h4>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Eles aparecem sozinhos depois que a precificação automática é ativada, com a localização do imóvel conferida e a
            conta do Airbnb conectada em Configurações.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {concorrentes.map(c => {
            const lista = precos[c.id] || [];
            const porTipo = new Map<string, number[]>();
            for (const s of lista) {
              const tipo = s.raw_payload?.busca?.tipo || 'comum';
              if (s.daily_price) porTipo.set(tipo, [...(porTipo.get(tipo) || []), Number(s.daily_price)]);
            }
            return (
              <Card key={c.id} className="hover:shadow-md transition-shadow border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px] uppercase font-bold bg-rose-50 text-rose-700 border-rose-200">{c.platform}</Badge>
                        {c.similarity_score !== null && (
                          <Badge variant="outline" className="text-[10px] bg-indigo-50 text-[#6A6DDF] border-indigo-200">Semelhança {Math.round(Number(c.similarity_score))}</Badge>
                        )}
                      </div>
                      <h4 className="font-bold text-gray-900 text-sm mt-1 line-clamp-1" title={c.name}>{c.name}</h4>
                      {!selectedProperty && <p className="text-[11px] text-gray-400">Concorrente de {nomeDoImovel(c.property_id)}</p>}
                    </div>
                    <a href={c.listing_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#6A6DDF] p-1 rounded-md hover:bg-gray-100" title="Abrir anúncio">
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </div>

                  <div className="grid grid-cols-3 gap-1 bg-gray-50 p-2 rounded-lg text-xs text-gray-600 border border-gray-100">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-gray-400" />{c.distance_km !== null ? `${Number(c.distance_km).toLocaleString('pt-BR')} km` : '—'}</span>
                    <span className="flex items-center gap-1"><Bed className="h-3 w-3 text-gray-400" />{c.bedrooms === null ? '—' : c.bedrooms === 0 ? 'Estúdio' : `${c.bedrooms} qto`}</span>
                    <span className="flex items-center gap-1 text-amber-600 font-semibold">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {c.current_rating ? Number(c.current_rating).toFixed(2).replace('.', ',') : 'Novo'}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    {porTipo.size === 0 ? (
                      <p className="text-gray-400">Sem preço lido nas próximas datas.</p>
                    ) : (
                      [...porTipo.entries()].map(([tipo, valores]) => (
                        <div key={tipo} className="flex items-center justify-between">
                          <span className="text-gray-500">{ROTULO[tipo] || tipo}</span>
                          <span className="font-semibold text-gray-800">{reais(mediana(valores))}/noite</span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t pt-2.5">
                    <span className="text-[10px] text-gray-400">
                      {c.last_seen_at ? `Visto em ${new Date(c.last_seen_at).toLocaleDateString('pt-BR')}` : ''}
                    </span>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-500 hover:text-red-600" disabled={excluindo === c.id} onClick={() => excluir(c)}>
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Não é concorrente
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CompetitorsRadarTab;
