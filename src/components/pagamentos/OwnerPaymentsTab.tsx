import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronUp, Building2, TrendingDown, ArrowRight, Search, Filter } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { OwnerPayment } from '@/hooks/painel-gestor/usePaymentsDashboard';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const getPlatformStyle = (platform: string) => {
  switch (platform) {
    case 'Airbnb':
      return { bg: 'bg-rose-50 border-rose-200', badge: 'bg-rose-100 text-rose-700 border-rose-200', dot: 'bg-rose-500' };
    case 'Booking.com':
      return { bg: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' };
    default:
      return { bg: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
  }
};

interface OwnerCardProps {
  owner: OwnerPayment;
}

const OwnerCard = ({ owner }: OwnerCardProps) => {
  const [expanded, setExpanded] = useState(false);

  const initials = (owner.nickname || owner.propertyName)
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  return (
    <Card className="border shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
              {initials}
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                {owner.nickname || owner.propertyName}
              </h3>
              {owner.nickname && (
                <p className="text-xs text-muted-foreground">{owner.propertyName}</p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-4 gap-3 mt-3 pt-3 border-t">
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Receita Bruta</div>
            <div className="font-semibold text-sm">
              {fmt(owner.platformBreakdown.reduce((s, p) => s + p.totalRevenue, 0))}
            </div>
          </div>
          <div className="text-center border-x">
            <div className="text-xs text-muted-foreground mb-1">Comissão</div>
            <div className="font-semibold text-sm text-[#6A6DDF]">{fmt(owner.totalCommission)}</div>
          </div>
          <div className="text-center border-r">
            <div className="text-xs text-muted-foreground mb-1">Investimentos</div>
            <div className="font-semibold text-sm text-red-500">
              {owner.investments > 0 ? `-${fmt(owner.investments)}` : fmt(0)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Repasse</div>
            <div className={`font-bold text-sm ${owner.totalToTransfer >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {fmt(Math.max(0, owner.totalToTransfer))}
            </div>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Por Plataforma
            </h4>
            {owner.platformBreakdown.map(plat => {
              const style = getPlatformStyle(plat.platform);
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
                    <Badge
                      variant={plat.status === 'received' ? 'default' : 'outline'}
                      className={plat.status === 'received'
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200 text-xs'
                        : 'text-amber-700 border-amber-300 text-xs'
                      }
                    >
                      {plat.status === 'received' ? 'Recebido' : 'A Receber'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Total</div>
                      <div className="font-medium">{fmt(plat.totalRevenue)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Comissão</div>
                      <div className="font-medium text-[#6A6DDF]">{fmt(plat.commission)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Proprietário</div>
                      <div className="font-medium text-emerald-600">{fmt(plat.netRevenue)}</div>
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
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor Líquido Proprietário</span>
                  <span className="font-medium">{fmt(owner.totalOwner)}</span>
                </div>
                {owner.investments > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span className="flex items-center gap-1">
                      <TrendingDown className="h-3 w-3" />
                      Investimentos do Mês
                    </span>
                    <span className="font-medium">- {fmt(owner.investments)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-1.5 mt-1.5">
                  <span className="flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" />
                    A Repassar
                  </span>
                  <span className={owner.totalToTransfer >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    {fmt(Math.max(0, owner.totalToTransfer))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

interface OwnerPaymentsTabProps {
  ownerPayments: OwnerPayment[];
  loading: boolean;
  hasFilter?: boolean;
}

const OwnerPaymentsTab = ({ ownerPayments, loading, hasFilter }: OwnerPaymentsTabProps) => {
  const [search, setSearch] = useState('');

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
        <p className="font-medium">Nenhuma propriedade com reservas neste período</p>
      </div>
    );
  }

  const totalCommission = filtered.reduce((s, o) => s + o.totalCommission, 0);
  const totalTransfer = filtered.reduce((s, o) => s + Math.max(0, o.totalToTransfer), 0);
  const totalInvestments = filtered.reduce((s, o) => s + o.investments, 0);

  return (
    <div className="space-y-4">
      {/* Search filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar imóvel..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 rounded-lg px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">
          {filtered.length} imóvel{filtered.length !== 1 ? 's' : ''}
        </span>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-[#6A6DDF] font-medium">Comissão: {fmt(totalCommission)}</span>
          {totalInvestments > 0 && (
            <span className="text-red-500 font-medium">Investimentos: -{fmt(totalInvestments)}</span>
          )}
          <span className="font-bold text-emerald-600">Repasse: {fmt(totalTransfer)}</span>
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
