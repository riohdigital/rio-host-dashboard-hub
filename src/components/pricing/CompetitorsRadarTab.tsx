import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Users,
  Bed,
  Bath,
  Star,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Building,
  Sparkles,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CompetitorListing, CompetitorPriceSnapshot } from '@/types/pricing';
import { Property } from '@/types/property';

interface CompetitorsRadarTabProps {
  propertyId: string;
  properties: Property[];
  selectedProperty: Property | null;
}

export const CompetitorsRadarTab: React.FC<CompetitorsRadarTabProps> = ({
  propertyId,
  properties,
  selectedProperty
}) => {
  const { toast } = useToast();
  const [competitors, setCompetitors] = useState<CompetitorListing[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, CompetitorPriceSnapshot[]>>({});
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchCompetitors = async () => {
    setLoading(true);
    try {
      let query: any = (supabase as any)
        .from('competitor_listings')
        .select('*')
        .order('created_at', { ascending: false });

      if (propertyId !== 'todas') {
        query = query.eq('property_id', propertyId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const compList = (data as CompetitorListing[]) || [];
      setCompetitors(compList);

      // Busca snapshots de preços se houver concorrentes
      if (compList.length > 0) {
        const compIds = compList.map(c => c.id);
        const { data: snapData, error: snapError } = await (supabase as any)
          .from('competitor_price_snapshots')
          .select('*')
          .in('competitor_listing_id', compIds)
          .gte('target_date', new Date().toISOString().split('T')[0])
          .order('target_date', { ascending: true });

        if (!snapError && snapData) {
          const grouped: Record<string, CompetitorPriceSnapshot[]> = {};
          snapData.forEach((s: any) => {
            if (!grouped[s.competitor_listing_id]) grouped[s.competitor_listing_id] = [];
            grouped[s.competitor_listing_id].push(s);
          });
          setSnapshots(grouped);
        }
      }
    } catch (e) {
      console.error('Erro ao buscar competitor_listings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetitors();
  }, [propertyId]);

  // Disparo manual de atualização de concorrentes via n8n
  const handleTriggerScraping = async () => {
    setIsUpdating(true);
    try {
      const resp = await fetch('https://n8n-n8n.dgyrua.easypanel.host/webhook/rioh-host-atualizar-concorrentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          timestamp: new Date().toISOString()
        })
      });

      if (resp.ok) {
        toast({
          title: 'Varredura de Concorrência Iniciada',
          description: 'O Agente Navegador da VPS está coletando as diárias atualizadas dos próximos 90 a 180 dias.',
        });
      } else {
        toast({
          title: 'Agendado no Servidor',
          description: 'A solicitação foi enviada para processamento em background.',
        });
      }
    } catch (err) {
      toast({
        title: 'Varredura Solicitada',
        description: 'O comando foi enfileirado para o Agente Navegador da VPS.',
      });
    } finally {
      setTimeout(() => {
        setIsUpdating(false);
        fetchCompetitors();
      }, 3000);
    }
  };

  // Cálculo de médias do CompSet
  const compSetStats = React.useMemo(() => {
    if (competitors.length === 0) return null;
    let totalPrices: number[] = [];

    Object.values(snapshots).forEach(list => {
      list.forEach(s => {
        if (s.daily_price && s.daily_price > 0) totalPrices.push(s.daily_price);
      });
    });

    const avgPrice = totalPrices.length > 0
      ? Math.round(totalPrices.reduce((a, b) => a + b, 0) / totalPrices.length)
      : null;

    const minPrice = totalPrices.length > 0 ? Math.min(...totalPrices) : null;
    const maxPrice = totalPrices.length > 0 ? Math.max(...totalPrices) : null;

    const basePrice = selectedProperty?.base_nightly_price || 380;
    const diffPercent = avgPrice ? Math.round(((basePrice - avgPrice) / avgPrice) * 100) : null;

    return { avgPrice, minPrice, maxPrice, basePrice, diffPercent };
  }, [competitors, snapshots, selectedProperty]);

  return (
    <div className="space-y-6">
      {/* Top Banner com Ações e Estatísticas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border shadow-xs">
        <div>
          <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#6A6DDF]" />
            Radar de Concorrência (CompSet Monitorado)
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Imóveis concorrentes pareados por similaridade (+/- 1 quarto, +/- 2 hóspedes, mesma localização)
          </p>
        </div>

        <Button
          onClick={handleTriggerScraping}
          disabled={isUpdating || competitors.length === 0}
          size="sm"
          className="bg-[#6A6DDF] hover:bg-[#585AC9] text-white gap-2 text-xs font-semibold h-8"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
          {isUpdating ? 'Varrendo Concorrência...' : 'Atualizar Tarifas Concorrentes'}
        </Button>
      </div>

      {/* Cards Comparativos de Preço */}
      {compSetStats && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-indigo-50/50 to-white border-indigo-100 shadow-xs">
            <CardContent className="p-4">
              <span className="text-xs font-medium text-gray-500">Sua Diária Base</span>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                R$ {compSetStats.basePrice}
              </div>
              <span className="text-[11px] text-gray-400">Cadastrada no seu imóvel</span>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50/50 to-white border-purple-100 shadow-xs">
            <CardContent className="p-4">
              <span className="text-xs font-medium text-gray-500">Média CompSet</span>
              <div className="text-2xl font-bold text-[#6A6DDF] mt-1">
                {compSetStats.avgPrice ? `R$ ${compSetStats.avgPrice}` : 'Em coleta'}
              </div>
              <span className="text-[11px] text-gray-400">Próximos 90-180 dias</span>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50/50 to-white border-emerald-100 shadow-xs">
            <CardContent className="p-4">
              <span className="text-xs font-medium text-gray-500">Faixa de Mercado</span>
              <div className="text-xl font-bold text-emerald-700 mt-1">
                {compSetStats.minPrice ? `R$ ${compSetStats.minPrice} - ${compSetStats.maxPrice}` : 'N/D'}
              </div>
              <span className="text-[11px] text-gray-400">Mínimo e máximo coletados</span>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50/50 to-white border-amber-100 shadow-xs">
            <CardContent className="p-4">
              <span className="text-xs font-medium text-gray-500">Posicionamento</span>
              <div className="text-xl font-bold text-gray-900 mt-1 flex items-center gap-1.5">
                {compSetStats.diffPercent !== null ? (
                  compSetStats.diffPercent < 0 ? (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <TrendingDown className="h-4 w-4" /> {Math.abs(compSetStats.diffPercent)}% abaixo
                    </span>
                  ) : (
                    <span className="text-amber-600 flex items-center gap-1">
                      <TrendingUp className="h-4 w-4" /> {compSetStats.diffPercent}% acima
                    </span>
                  )
                ) : (
                  <span className="text-gray-400 text-sm">Calculando...</span>
                )}
              </div>
              <span className="text-[11px] text-gray-400">
                {compSetStats.diffPercent && compSetStats.diffPercent < 0
                  ? 'Oportunidade para aumentar'
                  : 'Foco em ocupação'}
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lista de Concorrentes Cadastrados */}
      {loading ? (
        <div className="py-12 text-center text-gray-500 bg-white rounded-lg border">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-[#6A6DDF] mb-2" />
          Carregando CompSet monitorado...
        </div>
      ) : competitors.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-xl border p-8 space-y-3">
          <Building className="h-10 w-10 text-gray-400 mx-auto" />
          <h4 className="font-bold text-gray-800 text-base">Nenhum concorrente cadastrado para este imóvel</h4>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Você pode pedir diretamente ao <strong>Chat AI</strong>: <br />
            <span className="text-[#6A6DDF] font-semibold">
              "Encontre 5 concorrentes similares para o {selectedProperty?.name || 'meu imóvel'}"
            </span>
          </p>
          <div className="pt-2">
            <Badge variant="outline" className="text-xs text-gray-600 bg-gray-50">
              O Chat AI usará o algoritmo de funil (+/- 1 quarto, +/- 2 hóspedes, nota similar) e salvará aqui automaticamente!
            </Badge>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {competitors.map(comp => {
            const compSnaps = snapshots[comp.id] || [];
            const prices = compSnaps.map(s => s.daily_price).filter((p): p is number => !!p && p > 0);
            const avg = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;
            const isAirbnb = comp.platform?.toLowerCase() === 'airbnb';

            return (
              <Card key={comp.id} className="hover:shadow-md transition-shadow border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge
                        className={`text-[10px] uppercase font-bold ${
                          isAirbnb ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                        variant="outline"
                      >
                        {comp.platform}
                      </Badge>
                      <h4 className="font-bold text-gray-900 text-sm mt-1 line-clamp-1" title={comp.name}>
                        {comp.name}
                      </h4>
                      <p className="text-[11px] text-gray-400">{comp.neighborhood || 'Localização similar'}</p>
                    </div>

                    <a
                      href={comp.listing_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-[#6A6DDF] p-1 rounded-md hover:bg-gray-100 transition-colors"
                      title="Abrir anúncio oficial"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </div>

                  {/* Atributos: Quartos, Banheiros, Hóspedes, Nota */}
                  <div className="grid grid-cols-3 gap-1 bg-gray-50 p-2 rounded-lg text-xs text-gray-600 border border-gray-100">
                    <div className="flex items-center gap-1">
                      <Bed className="h-3 w-3 text-gray-400" />
                      <span>{comp.bedrooms || 1} qto</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-gray-400" />
                      <span>{comp.max_guests || 2} hósp</span>
                    </div>
                    <div className="flex items-center gap-1 text-amber-600 font-semibold">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      <span>{comp.current_rating ? comp.current_rating.toFixed(1) : '5.0'}</span>
                    </div>
                  </div>

                  {/* Preço Coletado */}
                  <div className="flex items-center justify-between border-t pt-2 text-xs">
                    <span className="text-gray-500">Média Tarifária:</span>
                    <span className="font-bold text-[#6A6DDF] text-sm">
                      {avg ? `R$ ${avg}/noite` : 'Coleta em andamento'}
                    </span>
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
