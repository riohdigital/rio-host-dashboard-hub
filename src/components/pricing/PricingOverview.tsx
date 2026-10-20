import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CircleDot, Home, Info, Moon, Percent, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/types/property';
import {
  EventoLocal,
  ReservaParaOcupacao,
  eventoValeParaImovel,
  eventosFuturos,
  hojeLocal,
  ocupacaoDoImovel,
  situacaoNoEvento,
  somarDias,
} from './ocupacao';

interface PricingOverviewProps {
  /** Imóveis da seleção global, já sem os que não têm diária base (ex.: o imóvel de testes). */
  properties: Property[];
}

interface PrecoDoCalendario {
  property_id: string;
  date: string;
  price_per_night: number | string | null;
  last_scraped_at: string | null;
}

const brl = (v: number | null | undefined, casas = 0) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? '—'
    : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: casas, maximumFractionDigits: casas });
const pct = (v: number) => `${Math.round(v * 100)}%`;
const dataCurta = (d: string) => {
  const [a, m, dia] = d.split('-');
  return `${dia}/${m}${a !== String(new Date().getFullYear()) ? `/${a.slice(2)}` : ''}`;
};
const nomeCurto = (p: Property) => p.nickname || p.name;

const HORIZONTES = [30, 60, 90] as const;
const IMPACTO: Record<string, string> = {
  Crítico: 'bg-red-50 text-red-700 border-red-200',
  Alto: 'bg-amber-50 text-amber-700 border-amber-200',
};
const SITUACAO = {
  livre: { rotulo: 'livre', classe: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  parcial: { rotulo: 'parcial', classe: 'bg-amber-50 text-amber-700 border-amber-200' },
  reservado: { rotulo: 'reservado', classe: 'bg-gray-100 text-gray-500 border-gray-200' },
} as const;

export const PricingOverview: React.FC<PricingOverviewProps> = ({ properties }) => {
  const [horizonte, setHorizonte] = useState<(typeof HORIZONTES)[number]>(60);
  const [reservas, setReservas] = useState<ReservaParaOcupacao[]>([]);
  const [eventos, setEventos] = useState<EventoLocal[]>([]);
  const [calendario, setCalendario] = useState<PrecoDoCalendario[]>([]);
  const [sincronizados, setSincronizados] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);

  const hoje = hojeLocal();
  const ids = useMemo(() => properties.map((p) => p.id), [properties]);

  useEffect(() => {
    if (!ids.length) {
      setCarregando(false);
      return;
    }
    let cancelado = false;
    (async () => {
      setCarregando(true);
      const limite = somarDias(hoje, 180);
      const [r, e, c, s] = await Promise.all([
        supabase
          .from('reservations')
          .select('property_id, check_in_date, check_out_date, total_revenue, cleaning_fee, base_revenue, reservation_status')
          .in('property_id', ids)
          .gte('check_out_date', hoje)
          .lte('check_in_date', limite),
        supabase.from('local_events').select('id, name, start_date, end_date, demand_impact, category, city').gte('end_date', hoje).lte('start_date', limite),
        // Tabela fora dos tipos gerados do Supabase (mesmo padrão de OTASessionsCard).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('property_calendar_prices').select('property_id, date, price_per_night, last_scraped_at').in('property_id', ids).gte('date', hoje),
        supabase.from('channel_sync_sources').select('property_id').in('property_id', ids).eq('is_active', true),
      ]);
      if (cancelado) return;
      setReservas((r.data as ReservaParaOcupacao[]) || []);
      setEventos(eventosFuturos((e.data as EventoLocal[]) || [], hoje));
      setCalendario((c.data as PrecoDoCalendario[]) || []);
      setSincronizados(new Set(((s.data as { property_id: string }[]) || []).map((x) => x.property_id)));
      setCarregando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [ids, hoje]);

  const fim = somarDias(hoje, horizonte);

  const linhas = useMemo(
    () =>
      properties.map((p) => {
        const doImovel = reservas.filter((r) => r.property_id === p.id);
        const o = ocupacaoDoImovel(doImovel, hoje, fim);
        const precos = calendario.filter((c) => c.property_id === p.id && c.date < fim);
        const coletado = calendario.filter((c) => c.property_id === p.id).map((c) => c.last_scraped_at).filter(Boolean).sort().pop() || null;
        const mediaCalendario = precos.length ? precos.reduce((s, c) => s + (Number(c.price_per_night) || 0), 0) / precos.length : null;
        return { p, o, doImovel, mediaCalendario, coletado };
      }),
    [properties, reservas, calendario, hoje, fim],
  );

  const totais = useMemo(() => {
    const noitesNaJanela = linhas.reduce((s, l) => s + l.o.noitesNaJanela, 0);
    const reservadas = linhas.reduce((s, l) => s + l.o.noitesReservadas, 0);
    const receita = linhas.reduce((s, l) => s + l.o.receitaReservada, 0);
    return { noitesNaJanela, reservadas, livres: noitesNaJanela - reservadas, receita, ocupacao: noitesNaJanela ? reservadas / noitesNaJanela : 0, diaria: reservadas ? receita / reservadas : null };
  }, [linhas]);

  const comCalendario = linhas.filter((l) => l.coletado).length;
  // Cada evento só aparece para os imóveis da cidade dele; sem imóvel da cidade, o evento some.
  const eventosNoHorizonte = eventos
    .filter((e) => e.start_date < fim)
    .map((ev) => ({ ev, imoveis: linhas.filter((l) => eventoValeParaImovel(ev, l.p.address)) }))
    .filter((x) => x.imoveis.length > 0);
  const comSincronizacao = properties.filter((p) => sincronizados.has(p.id)).length;
  const eventosDosImoveis = eventos.filter((ev) => linhas.some((l) => eventoValeParaImovel(ev, l.p.address))).length;

  if (!properties.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-gray-500">
          Nenhum imóvel com diária base cadastrada nesta seleção. Cadastre a diária base em Propriedades.
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        {/* De onde vêm os números */}
        <Card className="border-gray-200 shadow-none">
          <CardContent className="p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Fonte
                ok={comSincronizacao === properties.length}
                parcial={comSincronizacao > 0 && comSincronizacao < properties.length}
                titulo="Reservas"
                texto={`${comSincronizacao} de ${properties.length} imóveis com sincronização ativa; os demais, só lançamentos manuais`}
              />
              <Fonte
                ok={comCalendario === properties.length}
                parcial={comCalendario > 0 && comCalendario < properties.length}
                titulo="Diárias no calendário"
                texto={comCalendario ? `${comCalendario} de ${properties.length} imóveis; os demais usam a diária base do cadastro` : 'Ainda não coletadas; usando a diária base do cadastro'}
              />
              <Fonte titulo="Concorrentes" texto="Nenhum concorrente aprovado ainda" />
              <Fonte
                ok={eventosDosImoveis > 0}
                titulo="Feriados e eventos"
                texto={eventosDosImoveis ? `${eventosDosImoveis} nas cidades dos imóveis, nos próximos 6 meses` : 'Nenhum cadastrado para as cidades dos imóveis'}
              />
            </div>
          </CardContent>
        </Card>

        {/* Horizonte + indicadores */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Próximos {horizonte} dias</h2>
            <p className="text-sm text-gray-500">
              {dataCurta(hoje)} a {dataCurta(somarDias(fim, -1))} · {properties.length} {properties.length === 1 ? 'imóvel' : 'imóveis'}
            </p>
          </div>
          <ToggleGroup
            type="single"
            value={String(horizonte)}
            onValueChange={(v) => v && setHorizonte(Number(v) as (typeof HORIZONTES)[number])}
            className="justify-start rounded-lg border border-gray-200 bg-white p-0.5"
          >
            {HORIZONTES.map((h) => (
              <ToggleGroupItem key={h} value={String(h)} className="h-8 px-3 text-xs data-[state=on]:bg-[#6A6DDF] data-[state=on]:text-white">
                {h} dias
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Indicador icone={Percent} rotulo="Ocupação" valor={carregando ? null : pct(totais.ocupacao)} detalhe={`${totais.reservadas} de ${totais.noitesNaJanela} noites reservadas`} />
          <Indicador icone={Moon} rotulo="Noites livres" valor={carregando ? null : String(totais.livres)} detalhe="Somando todos os imóveis da seleção" />
          <Indicador
            icone={TrendingUp}
            rotulo="Diária média reservada"
            valor={carregando ? null : brl(totais.diaria)}
            detalhe="Receita da hospedagem por noite, sem limpeza"
          />
          <Indicador icone={CalendarDays} rotulo="Receita já reservada" valor={carregando ? null : brl(totais.receita)} detalhe="Noites dentro do período, sem limpeza" />
        </div>

        {/* Imóveis */}
        <Card className="border-gray-200 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Home className="h-4 w-4 text-[#6A6DDF]" /> Imóveis
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_minmax(0,1.4fr)] gap-4 border-b border-gray-100 px-6 py-2 text-xs font-medium uppercase tracking-wide text-gray-400 lg:grid">
              <span>Imóvel</span>
              <span className="text-right">Diária base</span>
              <span className="text-right">Diária reservada</span>
              <span>Ocupação</span>
              <span className="text-right">Noites livres</span>
              <span>Próxima janela livre</span>
            </div>
            {linhas.map(({ p, o, mediaCalendario }) => {
              const proxima = o.janelasLivres.find((j) => j.noites >= 2) || o.janelasLivres[0];
              return (
                <div
                  key={p.id}
                  className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-gray-100 px-4 py-4 last:border-0 sm:px-6 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_minmax(0,1.4fr)] lg:items-center"
                >
                  <div className="col-span-2 min-w-0 lg:col-span-1">
                    <p className="truncate font-medium text-gray-900">{nomeCurto(p)}</p>
                    <p className="truncate text-xs text-gray-500">{p.name}</p>
                  </div>
                  <Celula rotulo="Diária base" alinhar>
                    {brl(Number(p.base_nightly_price))}
                    {mediaCalendario !== null && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="ml-1 cursor-help text-xs text-gray-400">({brl(mediaCalendario)})</span>
                        </TooltipTrigger>
                        <TooltipContent>Média das diárias coletadas do calendário do anúncio</TooltipContent>
                      </Tooltip>
                    )}
                  </Celula>
                  <Celula rotulo="Diária reservada" alinhar>
                    {carregando ? <Skeleton className="ml-auto h-4 w-16" /> : brl(o.diariaMediaReservada)}
                  </Celula>
                  <Celula rotulo="Ocupação">
                    {carregando ? (
                      <Skeleton className="h-4 w-24" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Progress value={o.ocupacao * 100} className="h-2 w-full max-w-[96px] bg-gray-100 [&>div]:bg-[#6A6DDF]" />
                        <span className="w-9 text-right text-sm tabular-nums text-gray-700">{pct(o.ocupacao)}</span>
                      </div>
                    )}
                  </Celula>
                  <Celula rotulo="Noites livres" alinhar>
                    {carregando ? <Skeleton className="ml-auto h-4 w-8" /> : o.noitesLivres}
                  </Celula>
                  <Celula rotulo="Próxima janela livre">
                    {carregando ? (
                      <Skeleton className="h-4 w-28" />
                    ) : proxima ? (
                      <span className="text-sm text-gray-700">
                        {dataCurta(proxima.inicio)} · {proxima.noites} {proxima.noites === 1 ? 'noite' : 'noites'}
                      </span>
                    ) : (
                      <span className="text-sm text-emerald-700">Tudo reservado</span>
                    )}
                  </Celula>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Feriados e eventos */}
        <Card className="border-gray-200 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-[#6A6DDF]" /> Feriados e eventos no período
            </CardTitle>
            <p className="text-sm text-gray-500">Imóveis livres nessas datas são as primeiras oportunidades de ajustar a diária ou a estadia mínima.</p>
          </CardHeader>
          <CardContent className="p-0">
            {carregando ? (
              <div className="space-y-2 px-6 pb-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : eventosNoHorizonte.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-gray-500">Nenhum feriado ou evento cadastrado nos próximos {horizonte} dias.</p>
            ) : (
              eventosNoHorizonte.map(({ ev, imoveis }) => (
                <div key={ev.id} className="flex flex-col gap-3 border-t border-gray-100 px-4 py-4 sm:px-6 lg:flex-row lg:items-start">
                  <div className="min-w-0 lg:w-80 lg:shrink-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-gray-900">{ev.name}</p>
                      {ev.demand_impact && (
                        <Badge variant="outline" className={`shrink-0 text-[11px] ${IMPACTO[ev.demand_impact] || 'text-gray-600'}`}>
                          {ev.demand_impact}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {dataCurta(ev.start_date)} a {dataCurta(ev.end_date)}
                      {ev.city ? ` · ${ev.city}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {imoveis.map(({ p, doImovel }) => {
                      const s = situacaoNoEvento(doImovel, ev);
                      const estilo = SITUACAO[s.situacao];
                      return (
                        <Tooltip key={p.id}>
                          <TooltipTrigger asChild>
                            <span className={`inline-flex cursor-default items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${estilo.classe}`}>
                              {nomeCurto(p)}
                              <span className="opacity-70">· {estilo.rotulo}</span>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {s.noitesLivres} de {s.noitesDoEvento} noites livres
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

const Fonte: React.FC<{ titulo: string; texto: string; ok?: boolean; parcial?: boolean }> = ({ titulo, texto, ok, parcial }) => (
  <div className="flex items-start gap-2.5">
    <CircleDot className={`mt-0.5 h-4 w-4 shrink-0 ${ok ? 'text-emerald-500' : parcial ? 'text-amber-500' : 'text-gray-300'}`} />
    <div className="min-w-0">
      <p className="text-sm font-medium text-gray-800">{titulo}</p>
      <p className="text-xs text-gray-500">{texto}</p>
    </div>
  </div>
);

const Indicador: React.FC<{ icone: React.ElementType; rotulo: string; valor: string | null; detalhe: string }> = ({ icone: Icone, rotulo, valor, detalhe }) => (
  <Card className="border-gray-200 shadow-none">
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{rotulo}</p>
        <Icone className="h-4 w-4 text-[#6A6DDF]" />
      </div>
      {valor === null ? <Skeleton className="mt-2 h-7 w-24" /> : <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{valor}</p>}
      <p className="mt-1 text-xs text-gray-500">{detalhe}</p>
    </CardContent>
  </Card>
);

const Celula: React.FC<{ rotulo: string; alinhar?: boolean; children: React.ReactNode }> = ({ rotulo, alinhar, children }) => (
  <div className={`min-w-0 text-sm text-gray-800 ${alinhar ? 'lg:text-right' : ''}`}>
    <p className="text-[11px] uppercase tracking-wide text-gray-400 lg:hidden">{rotulo}</p>
    <div className={`tabular-nums ${alinhar ? 'lg:flex lg:justify-end' : ''}`}>{children}</div>
  </div>
);

export const ConcorrentesEmReconstrucao: React.FC = () => (
  <Card className="border-dashed border-gray-300 shadow-none">
    <CardContent className="mx-auto max-w-2xl space-y-3 py-10 text-center">
      <Info className="mx-auto h-8 w-8 text-[#6A6DDF]" />
      <h3 className="text-lg font-semibold text-gray-900">Nenhum concorrente aprovado ainda</h3>
      <p className="text-sm text-gray-600">
        Os concorrentes de cada imóvel virão de anúncios reais das plataformas, parecidos com ele em localização, quartos e hóspedes. Os preços são lidos do
        próprio anúncio, com o registro do que foi coletado.
      </p>
      <p className="text-sm text-gray-600">Cada lista só passa a valer na comparação de preços depois que você aprovar os concorrentes do imóvel.</p>
    </CardContent>
  </Card>
);

export default PricingOverview;
