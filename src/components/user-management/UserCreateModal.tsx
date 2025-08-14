import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UserCreateModalProps {
  open: boolean;
  onClose: () => void;
  onUserCreated: () => void;
  // NOVO: Prop para iniciar o fluxo de criação de faxineira
  onSwitchToCleanerFlow: (data: { email: string, fullName: string, password?: string }) => void;
}

const UserCreateModal: React.FC<UserCreateModalProps> = ({
  open,
  onClose,
  onUserCreated,
  onSwitchToCleanerFlow // <-- NOVA PROP
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'master' | 'owner' | 'editor' | 'viewer' | 'faxineira'>('viewer');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      toast({ title: "Erro", description: "Todos os campos são obrigatórios.", variant: "destructive" });
      return;
    }

    // ALTERAÇÃO: Lógica condicional baseada no role
    if (role === 'faxineira') {
      // Se for faxineira, não cria o usuário aqui. Apenas passa os dados para o próximo modal.
      onSwitchToCleanerFlow({ email, password, fullName });
      return; // Interrompe a execução aqui
    }
    
    // A lógica abaixo só executa para os outros roles (master, owner, etc.)
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('create-user', {
        body: { email, password, fullName, role }
      });
      if (error) throw error;

      toast({ title: "Sucesso", description: "Usuário criado com sucesso!" });
      onUserCreated();
      handleClose();
    } catch (error: any) {
      console.error('Erro ao criar usuário:', error);
      toast({ title: "Erro", description: error.message || "Não foi possível criar o usuário.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setPassword('');
    setFullName('');
    setRole('viewer');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Adicionar Novo Usuário</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" required/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="fullName">Nome Completo</Label>
                    <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Digite o nome completo" required/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Digite a senha" required minLength={6}/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="role">Tipo de Usuário</Label>
                    <Select value={role} onValueChange={(value) => setRole(value as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="viewer">Visualizador</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="owner">Proprietário</SelectItem>
                            <SelectItem value="master">Mestre</SelectItem>
                            <SelectItem value="faxineira">Faxineira</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} type="button">Cancelar</Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Avançando...' : (role === 'faxineira' ? 'Avançar para Detalhes' : 'Criar Usuário')}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
  );
};

export default UserCreateModal;
