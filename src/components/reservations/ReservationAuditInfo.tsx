import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User, Workflow, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReservationAuditInfoProps {
  createdAt: string;
  createdBy?: string | null;
  createdBySource?: 'manual' | 'n8n_automation' | 'api' | 'import';
  automationMetadata?: Record<string, any> | null;
}

const ReservationAuditInfo = ({ 
  createdAt, 
  createdBy, 
  createdBySource = 'manual',
  automationMetadata 
}: ReservationAuditInfoProps) => {
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCreatorInfo = async () => {
      if (!createdBy) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('full_name, email')
          .eq('user_id', createdBy)
          .single();

        if (!error && data) {
          setCreatorName(data.full_name || data.email);
        }
      } catch (err) {
        console.error('Erro ao buscar informações do criador:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCreatorInfo();
  }, [createdBy]);

  const getSourceBadge = () => {
    const sourceConfig = {
      manual: { label: 'Manual', color: 'bg-blue-100 text-blue-800', icon: User },
      n8n_automation: { label: 'Automação N8N', color: 'bg-purple-100 text-purple-800', icon: Workflow },
      api: { label: 'API Externa', color: 'bg-green-100 text-green-800', icon: Info },
      import: { label: 'Importação', color: 'bg-orange-100 text-orange-800', icon: Info },
    };

    const config = sourceConfig[createdBySource];
    const Icon = config.icon;

    return (
      <Badge variant="outline" className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formattedDate = format(new Date(createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  return (
    <Card className="bg-gray-50 border-gray-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Info className="h-4 w-4" />
          Informações de Auditoria
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        {/* Data de Criação */}
        <div className="flex items-start gap-2">
          <Clock className="h-3.5 w-3.5 text-gray-500 mt-0.5" />
          <div>
            <span className="font-medium text-gray-700">Criada em:</span>
            <span className="ml-1 text-gray-600">{formattedDate}</span>
          </div>
        </div>

        {/* Criado Por */}
        <div className="flex items-start gap-2">
          <User className="h-3.5 w-3.5 text-gray-500 mt-0.5" />
          <div>
            <span className="font-medium text-gray-700">Criado por:</span>
            <span className="ml-1 text-gray-600">
              {loading ? 'Carregando...' : creatorName || 'Não identificado'}
            </span>
          </div>
        </div>

        {/* Origem */}
        <div className="flex items-start gap-2">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="font-medium text-gray-700">Origem:</span>
            {getSourceBadge()}
          </div>
        </div>

        {/* Metadados de Automação (se houver) */}
        {automationMetadata && Object.keys(automationMetadata).length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-200">
            <span className="font-medium text-gray-700 block mb-1">Detalhes da Automação:</span>
            <div className="bg-white rounded p-2 space-y-1">
              {Object.entries(automationMetadata).map(([key, value]) => (
                <div key={key} className="flex justify-between text-xs">
                  <span className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}:</span>
                  <span className="text-gray-800 font-mono">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReservationAuditInfo;
