import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Mail, Edit, Trash2, Power, PowerOff } from 'lucide-react';
import { EmailTemplate } from '@/types/email';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import EmailTemplateCard from './EmailTemplateCard';
import EmailTemplateForm from './EmailTemplateForm';

const EmailTemplatesList = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates((data || []) as EmailTemplate[]);
    } catch (error) {
      console.error('Erro ao buscar templates:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os templates de e-mail',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSuccess = () => {
    fetchTemplates();
    setShowForm(false);
    setEditingTemplate(null);
  };

  const toggleTemplateStatus = async (template: EmailTemplate) => {
    try {
      const { error } = await supabase
        .from('email_templates')
        .update({ is_active: !template.is_active })
        .eq('id', template.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: `Template ${template.is_active ? 'desativado' : 'ativado'} com sucesso`,
      });

      fetchTemplates();
    } catch (error) {
      console.error('Erro ao alterar status do template:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível alterar o status do template',
        variant: 'destructive',
      });
    }
  };

  const deleteTemplate = async (template: EmailTemplate) => {
    if (!confirm('Tem certeza que deseja excluir este template?')) return;

    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', template.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Template excluído com sucesso',
      });

      fetchTemplates();
    } catch (error) {
      console.error('Erro ao excluir template:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o template',
        variant: 'destructive',
      });
    }
  };

  if (showForm) {
    return (
      <EmailTemplateForm
        template={editingTemplate}
        onSuccess={handleTemplateSuccess}
        onCancel={() => {
          setShowForm(false);
          setEditingTemplate(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Templates de E-mail</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie os templates de e-mail para comunicação automatizada
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Novo Template
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">Nenhum template criado</h3>
            <p className="text-muted-foreground mb-4">
              Crie seu primeiro template de e-mail para começar a automatizar a comunicação
            </p>
            <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Criar Primeiro Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <EmailTemplateCard
              key={template.id}
              template={template}
              onEdit={(template) => {
                setEditingTemplate(template);
                setShowForm(true);
              }}
              onToggleStatus={toggleTemplateStatus}
              onDelete={deleteTemplate}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default EmailTemplatesList;