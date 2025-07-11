
import React from 'react';
import { TrendingUp, TrendingDown, Calendar, DollarSign, Target, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PropertyROI } from '@/types/investment';

interface ROICardProps {
  roi: PropertyROI;
}

const ROICard = ({ roi }: ROICardProps) => {
  const getROIColor = (percentage: number) => {
    if (percentage >= 20) return 'text-green-600';
    if (percentage >= 10) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getROIBadgeVariant = (percentage: number) => {
    if (percentage >= 20) return 'default';
    if (percentage >= 10) return 'secondary';
    return 'destructive';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPaybackTime = (months: number) => {
    if (months === 0) return 'N/A';
    if (months < 12) return `${months} meses`;
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) return `${years} ano${years > 1 ? 's' : ''}`;
    return `${years}a ${remainingMonths}m`;
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold truncate">
            {roi.property_name}
            {roi.property_nickname && (
              <span className="text-sm text-gray-500 ml-2">({roi.property_nickname})</span>
            )}
          </CardTitle>
          <Badge variant={getROIBadgeVariant(roi.roi_percentage)}>
            {roi.is_profitable ? (
              <TrendingUp className="h-3 w-3 mr-1" />
            ) : (
              <TrendingDown className="h-3 w-3 mr-1" />
            )}
            {roi.roi_percentage.toFixed(1)}%
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Investment Recovery Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Recuperação do Investimento</span>
            <span className="font-medium">
              {Math.min(roi.investment_recovered_percentage, 100).toFixed(1)}%
            </span>
          </div>
          <Progress 
            value={Math.min(roi.investment_recovered_percentage, 100)} 
            className="h-2"
          />
        </div>

        {/* Financial Metrics */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-gray-600">
              <DollarSign className="h-3 w-3" />
              <span>Investimento</span>
            </div>
            <div className="font-semibold text-red-600">
              {formatCurrency(roi.total_investment)}
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-gray-600">
              <TrendingUp className="h-3 w-3" />
              <span>Receita Líquida</span>
            </div>
            <div className="font-semibold text-green-600">
              {formatCurrency(roi.net_revenue)}
            </div>
          </div>
        </div>

        {/* Payback and Break-even */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-gray-600">
              <Calendar className="h-3 w-3" />
              <span>Payback</span>
            </div>
            <div className="font-medium">
              {formatPaybackTime(roi.payback_months)}
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-gray-600">
              <Target className="h-3 w-3" />
              <span>Break-even</span>
            </div>
            <div className="font-medium">
              {roi.break_even_date 
                ? new Date(roi.break_even_date).toLocaleDateString('pt-BR')
                : 'N/A'
              }
            </div>
          </div>
        </div>

        {/* Status Alert */}
        {!roi.is_profitable && (
          <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded-lg text-yellow-800 text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>Investimento ainda não foi recuperado</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ROICard;
