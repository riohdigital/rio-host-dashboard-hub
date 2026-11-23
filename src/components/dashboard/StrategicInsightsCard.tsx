import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import MarcaIA from '@/components/comum/MarcaIA';
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Target, Zap, ChevronDown } from 'lucide-react';
import { usePropertyInsights, PropertyInsight, ActionPlanItem } from '@/hooks/usePropertyInsights';
import { cn } from '@/lib/utils';

// Expand Indicator Component with Tooltip
const ExpandIndicator = ({ isExpanded }: { isExpanded: boolean }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <CollapsibleTrigger asChild>
          <div className="w-full flex items-center justify-center gap-3 py-3 group cursor-pointer hover:bg-muted/30 transition-colors rounded-lg">
            <div className="h-px w-12 bg-gradient-to-r from-transparent via-brand-300 to-transparent group-hover:w-16 transition-all duration-300" />
            <ChevronDown 
              className={cn(
                "h-5 w-5 text-brand-500 transition-transform duration-300 chevron-bounce",
                isExpanded && "rotate-180"
              )} 
            />
            <div className="h-px w-12 bg-gradient-to-r from-transparent via-brand-300 to-transparent group-hover:w-16 transition-all duration-300" />
          </div>
        </CollapsibleTrigger>
      </TooltipTrigger>
      <TooltipContent>
        <p>{isExpanded ? "Recolher pensamento da IA" : "Expandir pensamento da IA"}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const SentimentBadge = ({ sentiment }: { sentiment: PropertyInsight['sentiment'] }) => {
  const config = {
    positive: {
      label: 'Bom Desempenho',
      icon: TrendingUp,
      className: 'bg-success-100 text-success-700 border-success-200'
    },
    warning: {
      label: 'Atenção',
      icon: AlertTriangle,
      className: 'bg-warning-100 text-warning-700 border-warning-200'
    },
    critical: {
      label: 'Crítico',
      icon: TrendingDown,
      className: 'bg-danger-100 text-danger-700 border-danger-200'
    }
  };

  const { label, icon: Icon, className } = config[sentiment];

  return (
    <Badge variant="outline" className={cn('flex items-center gap-1 font-medium', className)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
};

const RichActionItem = ({ action, index }: { action: ActionPlanItem; index: number }) => {
  const [checked, setChecked] = useState(false);

  return (
    <div 
      className={cn(
        'p-3 rounded-lg transition-all cursor-pointer border',
        checked 
          ? 'bg-success-50 border-success-200' 
          : 'bg-muted/50 hover:bg-muted border-transparent'
      )}
      onClick={() => setChecked(!checked)}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all mt-0.5',
          checked 
            ? 'bg-success-500 border-success-500' 
            : 'border-muted-foreground/30'
        )}>
          {checked && <CheckCircle2 className="h-3 w-3 text-white" />}
        </div>
        <div className="flex-1 space-y-1">
          <h5 className={cn(
            'font-medium text-sm',
            checked && 'line-through text-muted-foreground'
          )}>
            {action.title}
          </h5>
          <p className={cn(
            'text-xs text-muted-foreground leading-relaxed',
            checked && 'line-through'
          )}>
            {action.description}
          </p>
          {action.expected_impact && (
            <div className="flex items-center gap-1.5 mt-2">
              <Badge variant="secondary" className="text-xs font-normal bg-brand-100 text-brand-700 border-brand-200">
                <Zap className="h-3 w-3 mr-1" />
                {action.expected_impact}
              </Badge>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PropertyPill = ({ 
  name, 
  isActive, 
  onClick,
  sentiment
}: { 
  name: string; 
  isActive: boolean; 
  onClick: () => void;
  sentiment: PropertyInsight['sentiment'];
}) => {
  const sentimentColors = {
    positive: 'bg-success-500',
    warning: 'bg-warning-500',
    critical: 'bg-danger-500'
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2',
        isActive 
          ? 'gradient-primary text-white shadow-md' 
          : 'bg-muted hover:bg-muted/80 text-muted-foreground'
      )}
    >
      <span className={cn('w-2 h-2 rounded-full', sentimentColors[sentiment])} />
      {name}
    </button>
  );
};

const SparkleConstellation = () => (
  <div className="absolute top-3 right-3 opacity-60">
    <Sparkles className="h-4 w-4 text-brand-400 ai-sparkle absolute -top-1 -left-1" />
    <Sparkles className="h-3 w-3 text-info-400 ai-sparkle-delay-1 absolute top-2 left-3" />
    <Sparkles className="h-2 w-2 text-brand-400 ai-sparkle-delay-2 absolute top-0 left-6" />
  </div>
);

const LoadingSkeleton = () => (
  <Card className="ai-card-glow bg-card relative overflow-hidden" aria-busy="true">
    <CardHeader className="pb-4 relative">
      <SparkleConstellation />
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
    </CardHeader>
    <CardContent className="space-y-5">
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </CardContent>
  </Card>
);

/**
 * `semCartao`: só o conteúdo, sem o cartão e sem o título "IA Dicas" — no
 * celular as dicas ficam dentro do BlocoRecolhivel "Dicas da IA" do Dashboard
 * (regra 10: sem cartão dentro de cartão).
 */
export function StrategicInsightsCard({ semCartao = false }: { semCartao?: boolean } = {}) {
  const { 
    insights, 
    currentInsight, 
    activePropertyIndex, 
    goToProperty,
    hasMultipleProperties,
    loading 
  } = usePropertyInsights();
  
  const [animationKey, setAnimationKey] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  // Trigger animation when property changes
  useEffect(() => {
    setAnimationKey(prev => prev + 1);
  }, [activePropertyIndex]);

  if (loading) {
    if (semCartao) {
      return (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      );
    }
    return <LoadingSkeleton />;
  }

  if (!currentInsight) {
    return semCartao ? <p className="text-sm text-gray-500">Nenhuma dica disponível ainda.</p> : null;
  }

  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(currentInsight.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const targetMonthFormatted = new Date(currentInsight.target_period + '-01').toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  });

  // No modo sem cartão, as partes do Card viram blocos simples, sem borda nem respiro próprio
  const Raiz = semCartao ? 'div' : Card;
  const Cabecalho = semCartao ? 'div' : CardHeader;
  const Conteudo = semCartao ? 'div' : CardContent;
  const Rodape = semCartao ? 'div' : CardFooter;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      {/* Borda animada só enquanto carrega (LoadingSkeleton); pronto, o cartão fica quieto */}
      <Raiz className={semCartao ? undefined : 'bg-card relative overflow-hidden mb-6 border-brand-100 shadow-sm'}>
        {/* Header - SEMPRE VISÍVEL */}
        <Cabecalho className={semCartao ? 'pb-3' : 'pb-4 relative'}>

          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <div>
                  {semCartao ? (
                    <Badge variant="secondary" className="text-xs font-normal">
                      {currentInsight.property_name}
                    </Badge>
                  ) : (
                    <h3 className="font-display font-bold text-lg text-ink flex flex-wrap items-center gap-2">
                      <MarcaIA />
                      Dicas
                      <Badge variant="secondary" className="text-xs font-normal">
                        {currentInsight.property_name}
                      </Badge>
                    </h3>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Análise de {targetMonthFormatted} • Atualizado há {daysSinceUpdate} {daysSinceUpdate === 1 ? 'dia' : 'dias'}
                  </p>
                </div>
              </div>
            </div>
            <SentimentBadge sentiment={currentInsight.sentiment} />
          </div>
        </Cabecalho>

        {/* Summary & Diagnosis - SEMPRE VISÍVEIS */}
        <Conteudo key={animationKey} className="ai-card-content-enter pb-0 space-y-4">
          {/* Resumo */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-brand-50 to-info-50 border border-brand-100 dark:from-brand-950/30 dark:to-info-950/30 dark:border-brand-800/30">
            <div className="flex items-start gap-3">
              <Target className="h-5 w-5 text-brand-600 dark:text-brand-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-sm text-brand-900 dark:text-brand-200 mb-1">Resumo</h4>
                <p className="text-sm text-brand-700 dark:text-brand-300 leading-relaxed font-medium">
                  {currentInsight.summary}
                </p>
              </div>
            </div>
          </div>

          {/* Diagnóstico - AGORA SEMPRE VISÍVEL */}
          {currentInsight.diagnosis && (
            <div className="p-4 rounded-xl bg-muted/50 border">
              <h4 className="font-medium text-sm text-foreground mb-2 flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                Diagnóstico
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {currentInsight.diagnosis}
              </p>
            </div>
          )}

          {/* Fade Line */}
          <div className="w-full h-px bg-gradient-to-r from-transparent via-brand-200/60 to-transparent" />

          {/* Expand Indicator */}
          <ExpandIndicator isExpanded={isExpanded} />
        </Conteudo>

        {/* Conteúdo expandido - OCULTO POR PADRÃO */}
        <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
          <Conteudo className={cn('space-y-5', semCartao ? 'pt-1' : 'pt-0')}>

            {/* Opportunity Alert */}
            {currentInsight.opportunity_alert && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-warning-50 to-orange-50 border border-warning-200 dark:from-warning-950/30 dark:to-orange-950/30 dark:border-warning-700/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning-600 dark:text-warning-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-sm text-warning-900 dark:text-warning-200 mb-1">Alerta de Oportunidade</h4>
                    <p className="text-sm text-warning-800 dark:text-warning-300 leading-relaxed">
                      {currentInsight.opportunity_alert}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Strengths & Weaknesses */}
            {(currentInsight.strengths.length > 0 || currentInsight.weaknesses.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strengths */}
                {currentInsight.strengths.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-success-700 dark:text-success-400 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Pontos Fortes
                    </h4>
                    <ul className="space-y-1">
                      {currentInsight.strengths.map((strength, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-success-500 mt-1">•</span>
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Weaknesses */}
                {currentInsight.weaknesses.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-warning-700 dark:text-warning-400 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Pontos de Atenção
                    </h4>
                    <ul className="space-y-1">
                      {currentInsight.weaknesses.map((weakness, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-warning-500 mt-1">•</span>
                          {weakness}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Action Plan */}
            {currentInsight.actionPlan.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand-500" />
                  Plano de Ação Sugerido
                </h4>
                <div className="space-y-2">
                  {currentInsight.actionPlan.map((action, index) => (
                    <RichActionItem key={index} action={action} index={index} />
                  ))}
                </div>
              </div>
            )}
          </Conteudo>
        </CollapsibleContent>

        {/* Footer with property navigation - SEMPRE VISÍVEL */}
        {hasMultipleProperties && (
          <Rodape className={semCartao ? 'mt-3 border-t pt-3' : 'pt-4 border-t bg-muted/30'}>
            <div className="w-full">
              <p className="text-xs text-muted-foreground mb-3">
                Insights disponíveis para {insights.length} propriedades:
              </p>
              <div className="flex flex-wrap gap-2">
                {insights.map((insight, index) => (
                  <PropertyPill
                    key={insight.property_id}
                    name={insight.property_name}
                    isActive={index === activePropertyIndex}
                    onClick={() => goToProperty(index)}
                    sentiment={insight.sentiment}
                  />
                ))}
              </div>
            </div>
          </Rodape>
        )}
      </Raiz>
    </Collapsible>
  );
}
