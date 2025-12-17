import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useNotificationDestinations } from '@/hooks/useNotificationDestinations';
import { useAvailableCleaners } from '@/hooks/useAvailableCleaners';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  destination_name: z.string().min(1, 'Nome é obrigatório'),
  destination_role: z.string().min(1, 'Papel é obrigatório'),
  whatsapp_number: z.string().optional(),
  selected_cleaner_id: z.string().optional(),
});

interface DestinationFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

const DestinationForm = ({ onClose, onSuccess }: DestinationFormProps) => {
  const { createDestination } = useNotificationDestinations();
  const { cleaners, loading: loadingCleaners } = useAvailableCleaners();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      destination_name: '',
      destination_role: '',
      whatsapp_number: '',
      selected_cleaner_id: '',
    },
  });

  const selectedRole = form.watch('destination_role');
  const isFaxineira = selectedRole === 'faxineira';

  const handleCleanerSelect = (cleanerId: string) => {
    const cleaner = cleaners.find(c => c.user_id === cleanerId);
    if (cleaner) {
      form.setValue('selected_cleaner_id', cleanerId);
      form.setValue('destination_name', cleaner.full_name);
      form.setValue('whatsapp_number', cleaner.phone || '');
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const destinationData: any = {
      destination_name: values.destination_name,
      destination_role: values.destination_role,
      whatsapp_number: values.whatsapp_number,
    };

    // Se for faxineira, passar o user_id real da faxineira selecionada
    if (isFaxineira && values.selected_cleaner_id) {
      destinationData.target_user_id = values.selected_cleaner_id;
    }

    const result = await createDestination(destinationData);
    if (result) {
      onSuccess();
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Novo Destinatário</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="destination_role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Papel</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  <FormMessage />
                </FormItem>
              )}
            />

            {isFaxineira && (
              <FormField
                control={form.control}
                name="selected_cleaner_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vincular a Faxineira Existente</FormLabel>
                    <Select onValueChange={handleCleanerSelect} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          {loadingCleaners ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Carregando...</span>
                            </div>
                          ) : (
                            <SelectValue placeholder="Selecione uma faxineira" />
                          )}
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cleaners.length === 0 ? (
                          <SelectItem value="_none" disabled>
                            Todas as faxineiras já têm destinatários
                          </SelectItem>
                        ) : (
                          cleaners.map((cleaner) => (
                            <SelectItem key={cleaner.user_id} value={cleaner.user_id}>
                              {cleaner.full_name} ({cleaner.email})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Selecione a faxineira cadastrada para vincular corretamente os alertas
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="destination_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Destinatário</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ex: João Silva" 
                      {...field} 
                      disabled={isFaxineira}
                    />
                  </FormControl>
                  {isFaxineira && (
                    <FormDescription>
                      Preenchido automaticamente ao selecionar a faxineira
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="whatsapp_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp {!isFaxineira && '(opcional)'}</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ex: +5511999999999" 
                      {...field} 
                      disabled={isFaxineira}
                    />
                  </FormControl>
                  {isFaxineira && (
                    <FormDescription>
                      Preenchido automaticamente ao selecionar a faxineira
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isFaxineira && !form.watch('selected_cleaner_id')}
              >
                Criar Destinatário
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default DestinationForm;
