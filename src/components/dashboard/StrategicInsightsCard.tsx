import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Lightbulb, Target } from 'lucide-react';
import { usePropertyInsights, PropertyInsight } from '@/hooks/usePropertyInsights';
import { cn } from '@/lib/utils';

const SentimentBadge = ({ sentiment }: { sentiment: PropertyInsight['sentiment'] }) => {
  const config = {
    positive: {
      label: 'Bom Desempenho',
      icon: TrendingUp,
      className: 'bg-emerald-100 text-emerald-700 border-emerald-200'
    },
    warning: {
      label: 'Atenção',
      icon: AlertTriangle,
      className: 'bg-amber-100 text-amber-700 border-amber-200'
    },
    critical: {
      label: 'Crítico',
      icon: TrendingDown,
      className: 'bg-red-100 text-red-700 border-red-200'
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

const ActionItem = ({ action, index }: { action: string; index: number }) => {
  const [checked, setChecked] = useState(false);

  return (
    <div 
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg transition-all cursor-pointer',
        checked 
          ? 'bg-emerald-50 border border-emerald-200' 
          : 'bg-muted/50 hover:bg-muted border border-transparent'
      )}
      onClick={() => setChecked(!checked)}
    >
      <div className={cn(
        'flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
        checked 
          ? 'bg-emerald-500 border-emerald-500' 
          : 'border-muted-foreground/30'
      )}>
        {checked && <CheckCircle2 className="h-3 w-3 text-white" />}
      </div>
      <span className={cn(
        'text-sm leading-relaxed',
        checked && 'line-through text-muted-foreground'
      )}>
        {action}
      </span>
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
    positive: 'bg-emerald-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500'
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
    <Sparkles className="h-4 w-4 text-violet-400 ai-sparkle absolute -top-1 -left-1" />
    <Sparkles className="h-3 w-3 text-blue-400 ai-sparkle-delay-1 absolute top-2 left-3" />
    <Sparkles className="h-2 w-2 text-purple-400 ai-sparkle-delay-2 absolute top-0 left-6" />
  </div>
);

export function StrategicInsightsCard() {
  const { 
    insights, 
    currentInsight, 
    activePropertyIndex, 
    goToProperty,
    hasMultipleProperties 
  } = usePropertyInsights();
  
  const [animationKey, setAnimationKey] = useState(0);

  // Trigger animation when property changes
  useEffect(() => {
    setAnimationKey(prev => prev + 1);
  }, [activePropertyIndex]);

  if (!currentInsight) {
    return null;
  }

  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(currentInsight.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  const targetMonthFormatted = new Date(currentInsight.targetMonth + '-01').toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  });

  return (
    <Card className="ai-card-glow bg-card relative overflow-hidden">
      {/* Header */}
      <CardHeader className="pb-4 relative">
        <SparkleConstellation />
        
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg gradient-primary">
                <Lightbulb className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-gradient-primary flex items-center gap-2">
                  Dicas da IA
                  <Badge variant="secondary" className="text-xs font-normal">
                    Business Insight
                  </Badge>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Análise de {targetMonthFormatted} • Atualizado há {daysSinceUpdate} {daysSinceUpdate === 1 ? 'dia' : 'dias'}
                </p>
              </div>
            </div>
          </div>
          <SentimentBadge sentiment={currentInsight.sentiment} />
        </div>
      </CardHeader>

      {/* Content with animation */}
      <CardContent key={animationKey} className="space-y-5 ai-card-content-enter">
        {/* Summary */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-100">
          <div className="flex items-start gap-3">
            <Target className="h-5 w-5 text-violet-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-sm text-violet-900 mb-1">Diagnóstico</h4>
              <p className="text-sm text-violet-700 leading-relaxed">
                {currentInsight.summary}
              </p>
            </div>
          </div>
        </div>

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Strengths */}
          {currentInsight.strengths.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-emerald-700 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Pontos Fortes
              </h4>
              <ul className="space-y-1">
                {currentInsight.strengths.map((strength, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-emerald-500 mt-1">•</span>
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weaknesses */}
          {currentInsight.weaknesses.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-amber-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Pontos de Atenção
              </h4>
              <ul className="space-y-1">
                {currentInsight.weaknesses.map((weakness, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-amber-500 mt-1">•</span>
                    {weakness}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Action Plan */}
        <div className="space-y-3">
          <h4 className="font-medium text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            Plano de Ação Sugerido
          </h4>
          <div className="space-y-2">
            {currentInsight.actionPlan.map((action, index) => (
              <ActionItem key={index} action={action} index={index} />
            ))}
          </div>
        </div>
      </CardContent>

      {/* Footer with property navigation */}
      {hasMultipleProperties && (
        <CardFooter className="pt-4 border-t bg-muted/30">
          <div className="w-full">
            <p className="text-xs text-muted-foreground mb-3">
              Insights disponíveis para {insights.length} propriedades:
            </p>
            <div className="flex flex-wrap gap-2">
              {insights.map((insight, index) => (
                <PropertyPill
                  key={insight.propertyId}
                  name={insight.propertyName}
                  isActive={index === activePropertyIndex}
                  onClick={() => goToProperty(index)}
                  sentiment={insight.sentiment}
                />
              ))}
            </div>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
