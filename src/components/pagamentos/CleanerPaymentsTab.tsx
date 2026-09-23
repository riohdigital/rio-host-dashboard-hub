import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronUp, User, Phone, Banknote, Calendar, Home, CheckCircle, Clock, RefreshCw, Search, Filter, Receipt } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { CleanerPayment } from '@/hooks/painel-gestor/usePaymentsDashboard';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'Pago':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">✓ Pago</Badge>;
    case 'Próximo Ciclo':
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Próximo Ciclo</Badge>;
    case 'Pagamento na Data':
      return <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">Na Data</Badge>;
    case 'D+1':
      return <Badge className="bg-cyan-100 text-cyan-700 border-cyan-200 text-xs">D+1</Badge>;
    default:
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Pendente</Badge>;
  }
};

const getPlatformColor = (platform: string) => {
  switch (platform) {
    case 'Airbnb': return 'text-rose-600';
    case 'Booking.com': return 'text-blue-600';
    default: return 'text-emerald-600';
  }
};

interface CleanerCardProps {
  cleaner: CleanerPayment;
}

const CleanerCard = ({ cleaner }: CleanerCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const noCleanings = !cleaner.hasCleaningsThisMonth;

  const initials = cleaner.cleanerName
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  return (
    <Card className={`border shadow-sm hover:shadow-md transition-shadow ${noCleanings ? 'opacity-70' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#6A6DDF] to-[#F472B6] flex items-center justify-center text-white font-bold text-sm">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{cleaner.cleanerName}</h3>
                {noCleanings && (
                  <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30">
                    Sem faxinas neste mês
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1">
                {cleaner.phone && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {cleaner.phone}
                  </span>
                )}
                {cleaner.pix && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Banknote className="h-3 w-3" />
                    PIX: {cleaner.pix}
                  </span>
                )}
              </div>
            </div>
          </div>
          {!noCleanings && (
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
        {noCleanings ? (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Faxineira vinculada à propriedade — sem faxinas registradas neste mês
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                <CheckCircle className="h-3 w-3 text-emerald-500" />
                Pago
              </div>
              <div className="font-semibold text-sm text-emerald-600">{fmt(cleaner.totalPaid)}</div>
            </div>
            <div className="text-center border-x">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                <Clock className="h-3 w-3 text-amber-500" />
                Pendente
              </div>
              <div className="font-semibold text-sm text-amber-600">{fmt(cleaner.totalPending)}</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                <RefreshCw className="h-3 w-3 text-blue-500" />
                Próx. Ciclo
              </div>
              <div className="font-semibold text-sm text-blue-600">{fmt(cleaner.totalNextCycle)}</div>
            </div>
          </div>
        )}
      </CardHeader>

      {expanded && !noCleanings && (
        <CardContent className="pt-0">
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Data</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Imóvel</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Plataforma</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Valor</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {cleaner.cleanings.map((cleaning, idx) => (
                  <tr key={cleaning.reservationId} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">
                          {format(parseISO(cleaning.date), 'dd/MM', { locale: ptBR })}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Home className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{cleaning.propertyNickname || cleaning.propertyName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-medium ${getPlatformColor(cleaning.platform)}`}>
                        {cleaning.platform}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {fmt(cleaning.fee)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {getStatusBadge(cleaning.paymentStatus)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 border-t font-semibold">
                  <td colSpan={3} className="px-3 py-2 text-sm">Total</td>
                  <td className="px-3 py-2 text-right text-sm">{fmt(cleaner.total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

interface CleanerPaymentsTabProps {
  cleanerPayments: CleanerPayment[];
  loading: boolean;
  hasFilter?: boolean;
}

const CleanerPaymentsTab = ({ cleanerPayments, loading, hasFilter }: CleanerPaymentsTabProps) => {
  const [search, setSearch] = useState('');
  const [selectedCleaner, setSelectedCleaner] = useState('todas');
  const [showOnlyWithCleanings, setShowOnlyWithCleanings] = useState(false);
  const [cleanerExpenses, setCleanerExpenses] = useState<any[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [showReimbursementsList, setShowReimbursementsList] = useState(false);
  const { toast } = useToast();

  const fetchCleanerExpenses = async () => {
    setExpensesLoading(true);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, property_id, expense_date, description, amount, payment_status, properties(name, nickname)')
        .or('payment_status.eq.Reembolso Pendente,description.ilike.%[Reembolso Faxineira]%')
        .order('expense_date', { ascending: false });
      if (!error && data) {
        setCleanerExpenses(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setExpensesLoading(false);
    }
  };

  useEffect(() => {
    fetchCleanerExpenses();
  }, []);

  const handleMarkAsReimbursed = async (expenseId: string) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ payment_status: 'Pago' })
        .eq('id', expenseId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Reembolso marcado como pago." });
      fetchCleanerExpenses();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const pendingExpenses = useMemo(() => {
    return cleanerExpenses.filter(e => e.payment_status === 'Reembolso Pendente' || (e.description?.includes('[Reembolso Faxineira]') && e.payment_status !== 'Pago'));
  }, [cleanerExpenses]);

  const totalPendingExpenses = useMemo(() => {
    return pendingExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [pendingExpenses]);

  const filtered = useMemo(() => {
    let list = cleanerPayments;
    if (selectedCleaner && selectedCleaner !== 'todas') {
      list = list.filter(c => c.cleanerId === selectedCleaner);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(c => c.cleanerName.toLowerCase().includes(q));
    }
    if (showOnlyWithCleanings) {
      list = list.filter(c => c.hasCleaningsThisMonth);
    }
    return list;
  }, [cleanerPayments, search, selectedCleaner, showOnlyWithCleanings]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!hasFilter && cleanerPayments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Filter className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Selecione uma ou mais propriedades</p>
        <p className="text-sm mt-1">Use o filtro acima para ver os dados de faxineiras deste mês.</p>
      </div>
    );
  }

  if (cleanerPayments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <User className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Nenhuma faxineira vinculada a esta propriedade</p>
        <p className="text-sm mt-1">Vincule faxineiras à propriedade para vê-las aqui.</p>
      </div>
    );
  }

  const withCleanings = cleanerPayments.filter(c => c.hasCleaningsThisMonth);
  const totalPaid = filtered.filter(c => c.hasCleaningsThisMonth).reduce((s, c) => s + c.totalPaid, 0);
  const totalPending = filtered.filter(c => c.hasCleaningsThisMonth).reduce((s, c) => s + c.totalPending, 0);
  const grandTotal = filtered.filter(c => c.hasCleaningsThisMonth).reduce((s, c) => s + c.total, 0);

  return (
    <div className="space-y-4">
      {/* Banner de Reembolsos de Materiais / Faxineiras */}
      {pendingExpenses.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 text-amber-800 rounded-lg">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-amber-900 text-sm">
                      Reembolsos de Materiais de Limpeza Pendentes
                    </h4>
                    <Badge className="bg-amber-500 text-white text-xs">
                      {pendingExpenses.length} comprovante{pendingExpenses.length > 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Compras realizadas pela equipe de limpeza aguardando reembolso do gestor
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center">
                <span className="font-bold text-base text-amber-800">
                  {fmt(totalPendingExpenses)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReimbursementsList(!showReimbursementsList)}
                  className="border-amber-300 text-amber-900 hover:bg-amber-100 text-xs h-8"
                >
                  {showReimbursementsList ? "Ocultar Notas" : "Ver Notas Fiscais"}
                </Button>
              </div>
            </div>

            {showReimbursementsList && (
              <div className="mt-3 pt-3 border-t border-amber-200 space-y-2">
                {pendingExpenses.map(item => (
                  <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white/80 p-2.5 rounded-md border border-amber-100 gap-2 text-xs">
                    <div>
                      <span className="font-semibold text-gray-800">{item.description}</span>
                      <div className="flex items-center gap-3 text-muted-foreground mt-0.5">
                        <span>Data: {item.expense_date ? format(parseISO(item.expense_date), 'dd/MM/yyyy') : 'N/D'}</span>
                        <span>Imóvel: {item.properties?.nickname || item.properties?.name || 'Geral'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <span className="font-bold text-amber-700">{fmt(Number(item.amount) || 0)}</span>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2.5 flex items-center gap-1"
                        onClick={() => handleMarkAsReimbursed(item.id)}
                      >
                        <CheckCircle className="h-3 w-3" />
                        Quitar Reembolso
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar faxineira..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={selectedCleaner} onValueChange={setSelectedCleaner}>
          <SelectTrigger className="h-8 text-sm w-[200px]">
            <SelectValue placeholder="Todas as faxineiras" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as faxineiras</SelectItem>
            {cleanerPayments.map(c => (
              <SelectItem key={c.cleanerId} value={c.cleanerId}>{c.cleanerName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {cleanerPayments.some(c => !c.hasCleaningsThisMonth) && (
          <Button
            variant={showOnlyWithCleanings ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowOnlyWithCleanings(v => !v)}
            className="h-8 text-xs"
          >
            {showOnlyWithCleanings ? 'Mostrar todas' : `Só com faxinas (${withCleanings.length})`}
          </Button>
        )}
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-between bg-muted/30 rounded-lg px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">
          {filtered.length} faxineira{filtered.length !== 1 ? 's' : ''} vinculada{filtered.length !== 1 ? 's' : ''} •{' '}
          {withCleanings.length} com faxinas neste mês •{' '}
          {filtered.reduce((s, c) => s + c.cleanings.length, 0)} faxinas
        </span>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-emerald-600 font-medium">Pago: {fmt(totalPaid)}</span>
          <span className="text-amber-600 font-medium">Pendente: {fmt(totalPending)}</span>
          <span className="font-bold">Total: {fmt(grandTotal)}</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <User className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="font-medium">Nenhuma faxineira corresponde ao filtro</p>
        </div>
      ) : (
        filtered.map(cleaner => (
          <CleanerCard key={cleaner.cleanerId} cleaner={cleaner} />
        ))
      )}
    </div>
  );
};

export default CleanerPaymentsTab;
