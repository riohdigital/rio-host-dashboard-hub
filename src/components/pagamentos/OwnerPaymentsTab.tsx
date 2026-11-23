import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronUp, Building2, TrendingDown, ArrowRight, Search, Filter, CalendarX, CheckCircle2, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { OwnerPayment } from '@/hooks/painel-gestor/usePaymentsDashboard';
import LinhaLista from '@/components/comum/LinhaLista';
import { ListaLinhas } from '@/components/comum/GrupoLista';
import FolhaDetalhes from '@/components/comum/FolhaDetalhes';
import { Etiqueta } from '@/components/comum/Etiquetas';
import { formatarMoedaSemCentavos } from '@/components/comum/formatos';
import { useEhCompacto } from '@/hooks/useMidia';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const getPlatformStyle = (platform: string) => {
  switch (platform) {
    case 'Airbnb':
      return { bg: 'bg-danger-50 border-danger-200', badge: 'bg-danger-100 text-danger-700 border-danger-200', dot: 'bg-danger-500' };
    case 'Booking.com':
      return { bg: 'bg-info-50 border-info-200', badge: 'bg-info-100 text-info-700 border-info-200', dot: 'bg-info-500' };
    default:
      return { bg: 'bg-success-50 border-success-200', badge: 'bg-success-100 text-success-700 border-success-200', dot: 'bg-success-500' };
  }
};

const getTransferLabel = (platform: string, status: string) => {
  if (status !== 'received') {
    return { label: 'Pendente', className: 'text-muted-foreground border-muted-foreground/30 bg-muted/50' };
  }
  if (platform === 'Booking.com') {
    return { label: 'A Repassar', className: 'text-warning-700 border-warning-300 bg-warning-50' };
  }
  // Airbnb, Direto, etc.
  return { label: 'Repassado', className: 'bg-success-100 text-success-700 border-success-200' };
};

const isBooking = (platform: string) => platform === 'Booking.com';

const calcTransferTotals = (platformBreakdown: OwnerPayment['platformBreakdown']) => {
  let totalRepassado = 0;
  let totalARepassar = 0;
  for (const p of platformBreakdown) {
    if (p.status === 'received') {
      if (isBooking(p.platform)) {
        totalARepassar += p.netRevenue;
      } else {
        totalRepassado += p.netRevenue;
      }
    }
  }
  return { totalRepassado, totalARepassar };
};

interface OwnerCardProps {
  owner: OwnerPayment;
}

const OwnerCard = ({ owner }: OwnerCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const noPayments = !owner.hasPaymentsThisMonth;

  const initials = (owner.nickname || owner.propertyName)
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  const { totalRepassado, totalARepassar } = useMemo(
    () => calcTransferTotals(owner.platformBreakdown),
    [owner.platformBreakdown]
  );

  return (
    <Card className={`border shadow-sm hover:shadow-md transition-shadow ${noPayments ? 'opacity-70' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-warning-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">
                  {owner.nickname || owner.propertyName}
                </h3>
                {noPayments && (
                  <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30">
                    Sem recebimentos neste mês
                  </Badge>
                )}
              </div>
              {owner.nickname && (
                <p className="text-xs text-muted-foreground">{owner.propertyName}</p>
              )}
            </div>
          </div>
          {!noPayments && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="text-muted-foreground"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}
        </div>

        {/* Summary row */}
        {noPayments ? (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
              <CalendarX className="h-3.5 w-3.5" />
              Nenhuma reserva com recebimento neste mês para esta propriedade
            </p>
          </div>
        ) : (
          <div className="mt-3 pt-3 border-t">
            <div className="grid grid-cols-2 gap-3 font-mono tabular-nums sm:grid-cols-4 [&>*]:min-w-0">
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Receita Bruta</div>
                <div className="font-semibold text-sm">
                  {fmt(owner.platformBreakdown.reduce((s, p) => s + p.totalRevenue, 0))}
                </div>
              </div>
              <div className="text-center sm:border-x">
                <div className="text-xs text-muted-foreground mb-1">Comissão</div>
                <div className="font-semibold text-sm text-brand">{fmt(owner.totalCommission)}</div>
              </div>
              <div className="text-center border-r">
                <div className="text-xs text-muted-foreground mb-1">Investimentos</div>
                <div className="font-semibold text-sm text-danger-500">
                  {owner.investments > 0 ? `-${fmt(owner.investments)}` : fmt(0)}
                </div>
              </div>
              <div className="text-center space-y-1">
                {totalRepassado > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Repassado</div>
                    <div className="font-bold text-sm text-success-600">{fmt(totalRepassado)}</div>
                  </div>
                )}
                {totalARepassar > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">A Repassar</div>
                    <div className="font-bold text-sm text-warning-600">
                      {fmt(Math.max(0, totalARepassar - owner.investments))}
                    </div>
                  </div>
                )}
                {totalRepassado === 0 && totalARepassar === 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Repasse</div>
                    <div className="font-bold text-sm text-success-600">{fmt(0)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      {expanded && !noPayments && (
        <CardContent className="pt-0">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Por Plataforma
            </h4>
            {owner.platformBreakdown.map(plat => {
              const style = getPlatformStyle(plat.platform);
              const transfer = getTransferLabel(plat.platform, plat.status);
              return (
                <div key={plat.platform} className={`rounded-lg border p-3 ${style.bg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${style.dot}`} />
                      <Badge className={`text-xs ${style.badge}`}>{plat.platform}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {plat.reservations} reserva{plat.reservations !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <Badge variant="outline" className={`text-xs ${transfer.className}`}>
                      {transfer.label === 'Repassado' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {transfer.label === 'A Repassar' && <Clock className="h-3 w-3 mr-1" />}
                      {transfer.label}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Total</div>
                      <div className="font-medium">{fmt(plat.totalRevenue)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Comissão</div>
                      <div className="font-medium text-brand">{fmt(plat.commission)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Proprietário</div>
                      <div className="font-medium text-success-600">{fmt(plat.netRevenue)}</div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Calculation breakdown */}
            <div className="bg-muted/30 rounded-lg p-3 mt-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Cálculo do Repasse
              </h4>
              <div className="space-y-1.5 text-sm">
                {totalRepassado > 0 && (
                  <div className="flex justify-between text-success-600">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Repassado (Airbnb/Direto)
                    </span>
                    <span className="font-medium">{fmt(totalRepassado)}</span>
                  </div>
                )}
                {totalARepassar > 0 && (
                  <div className="flex justify-between text-warning-600">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      A Repassar (Booking)
                    </span>
                    <span className="font-medium">{fmt(totalARepassar)}</span>
                  </div>
                )}
                {owner.investments > 0 && (
                  <div className="flex justify-between text-danger-600">
                    <span className="flex items-center gap-1">
                      <TrendingDown className="h-3 w-3" />
                      Investimentos do Mês
                    </span>
                    <span className="font-medium">- {fmt(owner.investments)}</span>
                  </div>
                )}
                {totalARepassar > 0 && (
                  <div className="flex justify-between font-bold border-t pt-1.5 mt-1.5">
                    <span className="flex items-center gap-1">
                      <ArrowRight className="h-3 w-3" />
                      Líquido a Repassar
                    </span>
                    <span className={Math.max(0, totalARepassar - owner.investments) >= 0 ? 'text-warning-600' : 'text-danger-600'}>
                      {fmt(Math.max(0, totalARepassar - owner.investments))}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

/**
 * Celular (plano T9): uma linha por imóvel (reservas e comissão do mês, valor
 * do repasse e situação); tocar abre a folha com o cálculo e cada plataforma.
 */
const ListaProprietariosCelular = ({ imoveis }: { imoveis: OwnerPayment[] }) => {
  const [sel, setSel] = useState<OwnerPayment | null>(null);
  const t = sel ? calcTransferTotals(sel.platformBreakdown) : null;
  return (
    <>
      <div className="rounded-2xl border bg-card px-3.5 py-1 shadow-sm">
        <ListaLinhas>
          {[...imoveis.filter((o) => o.hasPaymentsThisMonth), ...imoveis.filter((o) => !o.hasPaymentsThisMonth)].map((o) => {
            const { totalRepassado, totalARepassar } = calcTransferTotals(o.platformBreakdown);
            const reservas = o.platformBreakdown.reduce((s, p) => s + p.reservations, 0);
            const sit = !o.hasPaymentsThisMonth
              ? undefined
              : totalARepassar > 0
                ? { texto: 'A repassar', tom: 'warning' as const }
                : totalRepassado > 0
                  ? { texto: 'Repassado', tom: 'success' as const }
                  : { texto: 'Pendente', tom: 'neutro' as const };
            return (
              <LinhaLista
                key={o.propertyId}
                icone={Building2}
                tomIcone={o.hasPaymentsThisMonth ? 'warning' : 'neutro'}
                titulo={o.nickname || o.propertyName}
                subtitulo={o.hasPaymentsThisMonth ? `${reservas} ${reservas === 1 ? 'reserva' : 'reservas'} · comissão ${formatarMoedaSemCentavos(o.totalCommission)}` : 'Sem recebimentos neste mês'}
                valor={o.hasPaymentsThisMonth ? fmt(Math.max(0, o.totalToTransfer)) : undefined}
                legenda={sit?.texto}
                tomLegenda={sit?.tom}
                aoTocar={() => setSel(o)}
              />
            );
          })}
        </ListaLinhas>
      </div>

      <FolhaDetalhes
        aberta={!!sel}
        aoMudar={(v) => !v && setSel(null)}
        titulo={sel ? sel.nickname || sel.propertyName : ''}
        subtitulo={sel?.nickname ? sel.propertyName : undefined}
      >
        {sel && t && (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-gray-50 p-3.5">
              {[
                { rotulo: 'Receita bruta', valor: fmt(sel.platformBreakdown.reduce((s, p) => s + p.totalRevenue, 0)), classe: 'text-gray-900' },
                { rotulo: 'Comissão', valor: fmt(sel.totalCommission), classe: 'text-brand-700' },
                { rotulo: 'Investimentos', valor: sel.investments > 0 ? `-${fmt(sel.investments)}` : fmt(0), classe: 'text-danger-600' },
                { rotulo: 'Repassado (Airbnb/Direto)', valor: fmt(t.totalRepassado), classe: 'text-success-700' },
                { rotulo: 'A repassar (Booking)', valor: fmt(t.totalARepassar), classe: 'text-warning-700' },
                { rotulo: 'Líquido a repassar', valor: fmt(Math.max(0, t.totalARepassar - sel.investments)), classe: 'text-gray-900' },
              ].map((c) => (
                <div key={c.rotulo} className="min-w-0">
                  <dt className="truncate text-xs text-gray-500">{c.rotulo}</dt>
                  <dd className={`truncate font-mono text-sm font-semibold tabular-nums ${c.classe}`}>{c.valor}</dd>
                </div>
              ))}
            </dl>
            {sel.platformBreakdown.length > 0 && (
              <ListaLinhas>
                {sel.platformBreakdown.map((p) => {
                  const tr = getTransferLabel(p.platform, p.status);
                  return (
                    <LinhaLista
                      key={p.platform}
                      canal={p.platform}
                      titulo={p.platform}
                      subtitulo={`${p.reservations} ${p.reservations === 1 ? 'reserva' : 'reservas'} · total ${fmt(p.totalRevenue)} · comissão ${fmt(p.commission)}`}
                      valor={fmt(p.netRevenue)}
                      legenda={tr.label}
                      tomLegenda={tr.label === 'Repassado' ? 'success' : tr.label === 'A Repassar' ? 'warning' : 'neutro'}
                    />
                  );
                })}
              </ListaLinhas>
            )}
          </>
        )}
      </FolhaDetalhes>
    </>
  );
};

interface OwnerPaymentsTabProps {
  ownerPayments: OwnerPayment[];
  loading: boolean;
  hasFilter?: boolean;
}

const OwnerPaymentsTab = ({ ownerPayments, loading, hasFilter }: OwnerPaymentsTabProps) => {
  const [search, setSearch] = useState('');
  const compacto = useEhCompacto();

  const filtered = useMemo(() => {
    if (!search.trim()) return ownerPayments;
    const q = search.trim().toLowerCase();
    return ownerPayments.filter(o =>
      o.propertyName.toLowerCase().includes(q) ||
      (o.nickname || '').toLowerCase().includes(q)
    );
  }, [ownerPayments, search]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!hasFilter && ownerPayments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Filter className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Selecione uma ou mais propriedades</p>
        <p className="text-sm mt-1">Use o filtro acima para ver os repasses aos proprietários deste mês.</p>
      </div>
    );
  }

  if (ownerPayments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Nenhuma propriedade encontrada</p>
      </div>
    );
  }

  const withPayments = ownerPayments.filter(o => o.hasPaymentsThisMonth);
  const totalCommission = filtered.filter(o => o.hasPaymentsThisMonth).reduce((s, o) => s + o.totalCommission, 0);
  const totalInvestments = filtered.filter(o => o.hasPaymentsThisMonth).reduce((s, o) => s + o.investments, 0);

  // Global totals split by platform type
  const globalTotals = filtered.filter(o => o.hasPaymentsThisMonth).reduce(
    (acc, o) => {
      const t = calcTransferTotals(o.platformBreakdown);
      acc.repassado += t.totalRepassado;
      acc.aRepassar += t.totalARepassar;
      return acc;
    },
    { repassado: 0, aRepassar: 0 }
  );

  if (compacto) {
    const aRepassarLiquido = Math.max(0, globalTotals.aRepassar - totalInvestments);
    return (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <dl className="grid grid-cols-3 gap-2.5 rounded-2xl border bg-card p-3.5 shadow-sm">
          {[
            { rotulo: 'Comissão', valor: fmt(totalCommission), classe: 'text-brand-700' },
            { rotulo: 'Repassado', valor: fmt(globalTotals.repassado), classe: 'text-success-700' },
            { rotulo: 'A repassar', valor: fmt(aRepassarLiquido), classe: 'text-warning-700' },
          ].map((c) => (
            <div key={c.rotulo} className="min-w-0">
              <dt className="truncate text-xs text-gray-500">{c.rotulo}</dt>
              <dd className={`truncate font-mono text-[13px] font-semibold tabular-nums ${c.classe}`}>{c.valor}</dd>
            </div>
          ))}
        </dl>
        {totalInvestments > 0 && (
          <p className="-mt-1 px-1 text-xs text-gray-500">
            <Etiqueta tom="danger">-{fmt(totalInvestments)}</Etiqueta> de investimentos no mês, já descontados do que falta repassar.
          </p>
        )}
        <ListaProprietariosCelular imoveis={ownerPayments} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search filter */}
      <div className="flex items-center gap-3">
        <div className="relative w-full sm:min-w-[180px] sm:max-w-xs sm:flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar imóvel..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-11 pl-8 text-sm sm:h-8"
          />
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 rounded-lg px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">
          {filtered.length} imóvel{filtered.length !== 1 ? 's' : ''} •{' '}
          {withPayments.length} com recebimentos neste mês
        </span>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-brand font-medium">Comissão: {fmt(totalCommission)}</span>
          {totalInvestments > 0 && (
            <span className="text-danger-500 font-medium">Investimentos: -{fmt(totalInvestments)}</span>
          )}
          {globalTotals.repassado > 0 && (
            <span className="font-bold text-success-600">Repassado: {fmt(globalTotals.repassado)}</span>
          )}
          {globalTotals.aRepassar > 0 && (
            <span className="font-bold text-warning-600">
              A Repassar: {fmt(Math.max(0, globalTotals.aRepassar - totalInvestments))}
            </span>
          )}
          {globalTotals.repassado === 0 && globalTotals.aRepassar === 0 && (
            <span className="font-bold text-success-600">Repasse: {fmt(0)}</span>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="font-medium">Nenhum imóvel corresponde ao filtro</p>
        </div>
      ) : (
        filtered.map(owner => (
          <OwnerCard key={owner.propertyId} owner={owner} />
        ))
      )}
    </div>
  );
};

export default OwnerPaymentsTab;
