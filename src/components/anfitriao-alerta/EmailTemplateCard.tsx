import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Power, PowerOff, Mail, User, Briefcase, Users } from 'lucide-react';
import { EmailTemplate } from '@/types/email';
import { useEhCompacto } from '@/hooks/useMidia';
import LinhaLista from '@/components/comum/LinhaLista';
import FolhaDetalhes from '@/components/comum/FolhaDetalhes';
import { Etiqueta } from '@/components/comum/Etiquetas';

interface EmailTemplateCardProps {
  template: EmailTemplate;
  onEdit: (template: EmailTemplate) => void;
  onToggleStatus: (template: EmailTemplate) => void;
  onDelete: (template: EmailTemplate) => void;
}

const EmailTemplateCard = ({ template, onEdit, onToggleStatus, onDelete }: EmailTemplateCardProps) => {
  // Celular: uma linha; tocar abre a folha com Editar, Ativar/Desativar e Excluir (longe de editar)
  const compacto = useEhCompacto();
  const [folha, setFolha] = useState(false);
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'guest':
        return <User className="h-4 w-4" />;
      case 'owner':
        return <Briefcase className="h-4 w-4" />;
      case 'cleaner':
        return <Users className="h-4 w-4" />;
      case 'manager':
        return <Users className="h-4 w-4" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'guest':
        return 'Hóspede';
      case 'owner':
        return 'Proprietário';
      case 'cleaner':
        return 'Faxineira';
      case 'manager':
        return 'Gestor';
      default:
        return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'guest':
        return 'bg-info-100 text-info-800 border-info-200';
      case 'owner':
        return 'bg-success-100 text-success-800 border-success-200';
      case 'cleaner':
        return 'bg-brand-100 text-brand-800 border-brand-200';
      case 'manager':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (compacto) {
    const status = <Etiqueta tom={template.is_active ? 'success' : 'neutro'}>{template.is_active ? 'Ativo' : 'Inativo'}</Etiqueta>;
    return (
      <>
        <LinhaLista
          icone={Mail}
          tomIcone={template.is_active ? 'brand' : 'neutro'}
          titulo={template.template_name}
          subtitulo={`${getTypeLabel(template.template_type)} · ${template.subject}`}
          etiqueta={status}
          aoTocar={() => setFolha(true)}
        />
        <FolhaDetalhes
          aberta={folha}
          aoMudar={setFolha}
          titulo={template.template_name}
          etiqueta={status}
          subtitulo={`${getTypeLabel(template.template_type)} · criado em ${new Date(template.created_at).toLocaleDateString('pt-BR')}`}
        >
          <div>
            <p className="text-xs text-gray-500">Assunto</p>
            <p className="text-sm text-gray-900">{template.subject}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="min-h-11 gap-2" onClick={() => { setFolha(false); onEdit(template); }}>
              <Edit className="h-4 w-4" />
              Editar
            </Button>
            <Button variant="outline" className="min-h-11 gap-2" onClick={() => { setFolha(false); onToggleStatus(template); }}>
              {template.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
              {template.is_active ? 'Desativar' : 'Ativar'}
            </Button>
          </div>
          {/* A confirmação do excluir é a da própria lista */}
          <Button
            variant="ghost"
            className="min-h-11 w-full text-danger-600 hover:bg-danger-50 hover:text-danger-700"
            onClick={() => { setFolha(false); onDelete(template); }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir template
          </Button>
        </FolhaDetalhes>
      </>
    );
  }

  return (
    <Card className={`transition-all hover:shadow-md ${!template.is_active ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base font-medium line-clamp-2">
            {template.template_name}
          </CardTitle>
          <div className="flex items-center gap-1">
            {template.is_active ? (
              <Power className="h-4 w-4 text-success-500" />
            ) : (
              <PowerOff className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className={`text-xs flex items-center gap-1 ${getTypeColor(template.template_type)}`}
          >
            {getTypeIcon(template.template_type)}
            {getTypeLabel(template.template_type)}
          </Badge>
          <Badge variant={template.is_active ? 'default' : 'secondary'} className="text-xs">
            {template.is_active ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Assunto:</p>
            <p className="text-sm line-clamp-2">{template.subject}</p>
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground">
              Criado em {new Date(template.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>

          <div className="flex justify-between pt-2 border-t">
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(template)}
                className="h-8 px-2"
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggleStatus(template)}
                className={`h-8 px-2 ${template.is_active ? 'text-orange-600 hover:text-orange-700' : 'text-success-600 hover:text-success-700'}`}
              >
                {template.is_active ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(template)}
              className="h-8 px-2 text-danger-600 hover:text-danger-700"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmailTemplateCard;