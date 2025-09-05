import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save, Eye } from 'lucide-react';
import { EmailTemplate } from '@/types/email';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const emailTemplateSchema = z.object({
  template_name: z.string().min(1, 'Nome do template é obrigatório'),
  template_type: z.enum(['guest', 'owner', 'cleaner', 'manager']),
  subject: z.string().min(1, 'Assunto é obrigatório'),
  body_html: z.string().min(1, 'Conteúdo é obrigatório'),
  body_text: z.string().optional(),
  is_active: z.boolean().default(true),
});

type EmailTemplateFormData = z.infer<typeof emailTemplateSchema>;

interface EmailTemplateFormProps {
  template?: EmailTemplate | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const EmailTemplateForm = ({ template, onSuccess, onCancel }: EmailTemplateFormProps) => {
  const [loading, setLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<EmailTemplateFormData>({
    resolver: zodResolver(emailTemplateSchema),
    defaultValues: {
      template_name: '',
      template_type: 'guest',
      subject: '',
      body_html: '',
      body_text: '',
      is_active: true,
    },
  });

  const watchedValues = watch();

  useEffect(() => {
    if (template) {
      reset({
        template_name: template.template_name,
        template_type: template.template_type,
        subject: template.subject,
        body_html: template.body_html,
        body_text: template.body_text || '',
        is_active: template.is_active,
      });
    }
  }, [template, reset]);

  const onSubmit = async (data: EmailTemplateFormData) => {
    try {
      setLoading(true);

      if (template) {
        // Atualizar template existente
        const { error } = await supabase
          .from('email_templates')
          .update({
            template_name: data.template_name,
            template_type: data.template_type,
            subject: data.subject,
            body_html: data.body_html,
            body_text: data.body_text || null,
            is_active: data.is_active,
          })
          .eq('id', template.id);

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Template atualizado com sucesso',
        });
      } else {
        // Criar novo template
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        const { error } = await supabase
          .from('email_templates')
          .insert({
            user_id: user.id,
            template_name: data.template_name,
            template_type: data.template_type,
            subject: data.subject,
            body_html: data.body_html,
            body_text: data.body_text || null,
            is_active: data.is_active,
          });

        if (error) throw error;

        toast({
          title: 'Sucesso',
          description: 'Template criado com sucesso',
        });
      }

      onSuccess();
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o template',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const insertVariable = (variable: string) => {
    const currentBody = watchedValues.body_html || '';
    setValue('body_html', currentBody + `{${variable}}`);
  };

  const availableVariables = [
    { key: 'guest_name', label: 'Nome do Hóspede' },
    { key: 'property_name', label: 'Nome da Propriedade' },
    { key: 'checkin_date', label: 'Data de Check-in' },
    { key: 'checkout_date', label: 'Data de Check-out' },
    { key: 'checkin_time', label: 'Horário de Check-in' },
    { key: 'checkout_time', label: 'Horário de Check-out' },
    { key: 'reservation_code', label: 'Código da Reserva' },
    { key: 'property_address', label: 'Endereço da Propriedade' },
    { key: 'guest_phone', label: 'Telefone do Hóspede' },
    { key: 'total_guests', label: 'Total de Hóspedes' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onCancel} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div>
            <h2 className="text-xl font-semibold">
              {template ? 'Editar Template' : 'Novo Template'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {template ? 'Edite as configurações do template' : 'Crie um novo template de e-mail'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPreviewMode(!previewMode)}
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            {previewMode ? 'Editar' : 'Preview'}
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {!previewMode ? (
            <Card>
              <CardHeader>
                <CardTitle>Configurações do Template</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="template_name">Nome do Template *</Label>
                    <Input
                      id="template_name"
                      {...register('template_name')}
                      placeholder="Ex: Boas-vindas ao hóspede"
                    />
                    {errors.template_name && (
                      <span className="text-red-500 text-sm">{errors.template_name.message}</span>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="template_type">Tipo de Destinatário *</Label>
                    <Select
                      value={watchedValues.template_type}
                      onValueChange={(value: any) => setValue('template_type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="guest">Hóspede</SelectItem>
                        <SelectItem value="owner">Proprietário</SelectItem>
                        <SelectItem value="cleaner">Faxineira</SelectItem>
                        <SelectItem value="manager">Gestor</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.template_type && (
                      <span className="text-red-500 text-sm">{errors.template_type.message}</span>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="subject">Assunto do E-mail *</Label>
                  <Input
                    id="subject"
                    {...register('subject')}
                    placeholder="Ex: Bem-vindo à {property_name}!"
                  />
                  {errors.subject && (
                    <span className="text-red-500 text-sm">{errors.subject.message}</span>
                  )}
                </div>

                <div>
                  <Label htmlFor="body_html">Conteúdo do E-mail (HTML) *</Label>
                  <Textarea
                    id="body_html"
                    {...register('body_html')}
                    placeholder="Digite o conteúdo do e-mail aqui..."
                    className="min-h-[300px] font-mono text-sm"
                  />
                  {errors.body_html && (
                    <span className="text-red-500 text-sm">{errors.body_html.message}</span>
                  )}
                </div>

                <div>
                  <Label htmlFor="body_text">Versão em Texto (Opcional)</Label>
                  <Textarea
                    id="body_text"
                    {...register('body_text')}
                    placeholder="Versão alternativa em texto simples..."
                    className="min-h-[150px]"
                  />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Preview do E-mail</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg p-4 bg-white">
                  <div className="border-b pb-2 mb-4">
                    <strong>Assunto:</strong> {watchedValues.subject || 'Sem assunto'}
                  </div>
                  <div
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: watchedValues.body_html || '<p>Nenhum conteúdo</p>'
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Variáveis Disponíveis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Clique em uma variável para inseri-la no conteúdo
              </p>
              <div className="space-y-2">
                {availableVariables.map((variable) => (
                  <Button
                    key={variable.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertVariable(variable.key)}
                    className="w-full justify-start text-left h-auto p-2"
                  >
                    <div>
                      <div className="font-mono text-xs text-blue-600">
                        {`{${variable.key}}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {variable.label}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EmailTemplateForm;