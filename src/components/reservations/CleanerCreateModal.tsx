import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CleanerCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCleanerCreated: (cleanerId: string, cleanerName: string) => void;
  propertyId?: string;
}

const CleanerCreateModal: React.FC<CleanerCreateModalProps> = ({
  open,
  onClose,
  onCleanerCreated,
  propertyId
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || !fullName) {
      toast({
        title: "Erro",
        description: "Email, senha e nome completo são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Criar usuário com role faxineira
      const { error: createError } = await supabase.functions.invoke('create-user', {
        body: {
          email,
          password,
          fullName,
          role: 'faxineira'
        }
      });

      if (createError) throw createError;

      // Buscar o usuário criado para obter o ID
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('email', email)
        .single();

      if (profileError) throw profileError;

      // Por enquanto, apenas criamos o usuário básico
      // As tabelas cleaner_profiles e cleaner_properties serão implementadas posteriormente

      toast({
        title: "Sucesso",
        description: "Faxineira criada com sucesso!",
      });

      // Limpar formulário
      setEmail('');
      setPassword('');
      setFullName('');
      setPhone('');
      setAddress('');
      setNotes('');
      
      onCleanerCreated(userProfile.user_id, fullName);
      onClose();
    } catch (error: any) {
      console.error('Erro ao criar faxineira:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar a faxineira.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setPassword('');
    setFullName('');
    setPhone('');
    setAddress('');
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar Nova Faxineira</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome Completo *</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Digite o nome completo"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha *</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite a senha"
              required
              minLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Endereço completo"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas sobre a faxineira"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} type="button">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Faxineira'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CleanerCreateModal;