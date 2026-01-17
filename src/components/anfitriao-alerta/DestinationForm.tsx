import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useNotificationDestinations } from '@/hooks/useNotificationDestinations';
import { useAvailableUsers } from '@/hooks/useAvailableUsers';
import { Loader2, Search, UserPlus, Users } from 'lucide-react';

const formSchema = z.object({
  destination_role: z.string().min(1, 'Papel é obrigatório'),
  user_type: z.enum(['existing', 'external']),
  selected_user_id: z.string().optional(),
  destination_name: z.string().optional(),
  whatsapp_number: z.string().optional(),
}).refine(data => {
  if (data.user_type === 'existing') {
    return !!data.selected_user_id;
  }
  return !!data.destination_name;
}, {
  message: 'Selecione um usuário ou preencha o nome do destinatário',
  path: ['destination_name'],
});

interface DestinationFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  proprietario: 'Proprietário',
  'co-anfitriao': 'Co-Anfitrião',
  gestor: 'Gestor',
  faxineira: 'Faxineira',
  outro: 'Outro',
};

const DestinationForm = ({ onClose, onSuccess }: DestinationFormProps) => {
  const { createDestination } = useNotificationDestinations();
  const { users, loading: loadingUsers, searchTerm, setSearchTerm } = useAvailableUsers();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      destination_role: '',
      user_type: 'existing',
      selected_user_id: '',
      destination_name: '',
      whatsapp_number: '',
    },
  });

  const userType = form.watch('user_type');
  const selectedUserId = form.watch('selected_user_id');

  const handleUserSelect = (userId: string) => {
    const selectedUser = users.find(u => u.user_id === userId);
    if (selectedUser) {
      form.setValue('selected_user_id', userId);
      form.setValue('destination_name', selectedUser.full_name);
      form.setValue('whatsapp_number', selectedUser.phone || '');
      // Se o usuário selecionado for faxineira, definir o papel automaticamente
      if (selectedUser.role === 'faxineira') {
        form.setValue('destination_role', 'faxineira');
      }
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const destinationData = {
        destination_name: values.destination_name || '',
        destination_role: values.destination_role,
        whatsapp_number: values.whatsapp_number,
        existing_user_id: values.user_type === 'existing' ? values.selected_user_id : undefined,
        is_external_contact: values.user_type === 'external',
      };

      const result = await createDestination(destinationData);
      if (result) {
        onSuccess();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedUser = users.find(u => u.user_id === selectedUserId);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Destinatário</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Tipo de destinatário */}
            <FormField
              control={form.control}
              name="user_type"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Tipo de Destinatário</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col gap-3"
                    >
                      <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                        <RadioGroupItem value="existing" id="existing" />
                        <Label htmlFor="existing" className="flex items-center gap-2 cursor-pointer flex-1">
                          <Users className="h-4 w-4 text-primary" />
                          <div>
                            <span className="font-medium">Usuário do sistema</span>
                            <p className="text-xs text-muted-foreground">Vincular a um usuário já cadastrado</p>
                          </div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                        <RadioGroupItem value="external" id="external" />
                        <Label htmlFor="external" className="flex items-center gap-2 cursor-pointer flex-1">
                          <UserPlus className="h-4 w-4 text-orange-500" />
                          <div>
                            <span className="font-medium">Contato externo</span>
                            <p className="text-xs text-muted-foreground">Pessoa que não tem acesso ao sistema</p>
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Seleção de usuário existente */}
            {userType === 'existing' && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar usuário por nome ou email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <FormField
                  control={form.control}
                  name="selected_user_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Selecionar Usuário</FormLabel>
                      <Select onValueChange={handleUserSelect} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            {loadingUsers ? (
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Carregando...</span>
                              </div>
                            ) : (
                              <SelectValue placeholder="Selecione um usuário" />
                            )}
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {users.length === 0 ? (
                            <SelectItem value="_none" disabled>
                              {searchTerm ? 'Nenhum usuário encontrado' : 'Nenhum usuário disponível'}
                            </SelectItem>
                          ) : (
                            users.map((user) => (
                              <SelectItem key={user.user_id} value={user.user_id}>
                                <div className="flex flex-col">
                                  <span>{user.full_name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {user.email} • {ROLE_LABELS[user.role] || user.role}
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Selecione um usuário cadastrado no sistema
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedUser && (
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    <p><strong>Nome:</strong> {selectedUser.full_name}</p>
                    <p><strong>Email:</strong> {selectedUser.email}</p>
                    <p><strong>Papel no sistema:</strong> {ROLE_LABELS[selectedUser.role] || selectedUser.role}</p>
                    {selectedUser.phone && <p><strong>Telefone:</strong> {selectedUser.phone}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Campos para contato externo */}
            {userType === 'external' && (
              <>
                <FormField
                  control={form.control}
                  name="destination_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Destinatário *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: João Silva" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="whatsapp_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WhatsApp</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: +5511999999999" {...field} />
                      </FormControl>
                      <FormDescription>
                        Número para receber alertas via WhatsApp
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* Papel do destinatário */}
            <FormField
              control={form.control}
              name="destination_role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Papel do Destinatário *</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={userType === 'existing' && selectedUser?.role === 'faxineira'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o papel" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="proprietario">Proprietário</SelectItem>
                      <SelectItem value="co-anfitriao">Co-Anfitrião</SelectItem>
                      <SelectItem value="gestor">Gestor</SelectItem>
                      <SelectItem value="faxineira">Faxineira</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Define o tipo de alertas que este destinatário receberá
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || (userType === 'existing' && !selectedUserId)}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Destinatário'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default DestinationForm;
