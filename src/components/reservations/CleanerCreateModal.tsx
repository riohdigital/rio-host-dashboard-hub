
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Property } from '@/types/property';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';

interface CleanerCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCleanerCreated: () => void; // Apenas sinaliza o sucesso
  propertyId?: string;
  initialData?: { email: string; fullName: string; password?: string };
}

const CleanerCreateModal: React.FC<CleanerCreateModalProps> = ({
  open,
  onClose,
  onCleanerCreated,
  propertyId,
  initialData
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [accessibleProperties, setAccessibleProperties] = useState<Property[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const { isMaster } = useUserPermissions();

  useEffect(() => {
    if (open) {
      // Pré-preenche com dados do primeiro modal, se existirem
      if (initialData) {
        setEmail(initialData.email || '');
        setFullName(initialData.fullName || '');
        setPassword(initialData.password || '');
      }
      fetchAccessibleProperties();
    }
  }, [open, initialData]);

  useEffect(() => {
    if (propertyId) {
      setSelectedProperties(prev => prev.includes(propertyId) ? prev : [...prev, propertyId]);
    }
  }, [propertyId, open]);
  
  const fetchAccessibleProperties = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const userIsMaster = isMaster();

      if (userIsMaster) {
        const { data, error } = await supabase.from('properties').select('*').order('name');
        if (error) throw error;
        setAccessibleProperties(data || []);
      } else {
        const { data: accessData, error: accessError } = await supabase
          .from('user_property_access').select('property_id').eq('user_id', user.id);
        
        if (accessError) throw accessError;
        const propertyIds = accessData.map(item => item.property_id);
        
        if (propertyIds.length > 0) {
          const { data, error } = await supabase.from('properties').select('*').in('id', propertyIds).order('name');
          if (error) throw error;
          setAccessibleProperties(data || []);
        } else {
          setAccessibleProperties([]);
        }
      }
    } catch (error: any) {
      console.error("Erro ao buscar propriedades acessíveis:", error);
      toast({ title: "Erro", description: "Não foi possível carregar as propriedades.", variant: "destructive" });
    }
  };

  const handlePropertySelection = (propertyId: string) => {
    setSelectedProperties(prev => 
      prev.includes(propertyId) ? prev.filter(id => id !== propertyId) : [...prev, propertyId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      toast({ title: "Erro", description: "Email, senha e nome completo são obrigatórios.", variant: "destructive" });
      return;
    }
    if (selectedProperties.length === 0) {
      toast({ title: "Atenção", description: "Selecione ao menos uma propriedade para vincular à faxineira.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: functionData, error: createError } = await supabase.functions.invoke('create-user', {
        body: { 
          email, 
          password, 
          fullName, 
          role: 'faxineira', 
          phone, 
          address,
          propertyIds: selectedProperties,
          notes: notes?.trim() || null
        }
      });
      if (createError) throw createError;
      
      const newCleanerId = functionData?.user?.id;
      if (!newCleanerId) throw new Error("A função não retornou o ID do novo usuário.");

      // Vinculação de propriedades e atualização de notas agora são feitas dentro da Edge Function (admin).
      toast({ title: "Sucesso", description: "Faxineira criada e vinculada com sucesso!" });
      onCleanerCreated(); // Apenas notifica o pai que a criação foi um sucesso
      handleClose();

    } catch (error: any) {
      console.error('Erro ao criar faxineira:', error);
      toast({ title: "Erro", description: error.message || "Não foi possível criar a faxineira.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail(''); setPassword(''); setFullName(''); setPhone(''); setAddress(''); setNotes('');
    setSelectedProperties([]); setAccessibleProperties([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Cadastrar Nova Faxineira</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName-cleaner">Nome Completo *</Label>
              <Input id="fullName-cleaner" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-cleaner">Email *</Label>
              <Input id="email-cleaner" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="password-cleaner">Senha *</Label>
              <Input id="password-cleaner" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone-cleaner">Telefone</Label>
              <Input id="phone-cleaner" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address-cleaner">Endereço</Label>
            <Input id="address-cleaner" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Vincular Propriedades *</Label>
            <div className="max-h-32 overflow-y-auto rounded-md border p-2 space-y-2">
              {accessibleProperties.length > 0 ? (
                accessibleProperties.map(prop => (
                  <div key={prop.id} className="flex items-center space-x-2">
                    <Checkbox id={`prop-${prop.id}`} checked={selectedProperties.includes(prop.id)} onCheckedChange={() => handlePropertySelection(prop.id)} />
                    <Label htmlFor={`prop-${prop.id}`} className="font-normal">{prop.nickname || prop.name}</Label>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">Nenhuma propriedade acessível encontrada.</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes-cleaner">Observações</Label>
            <Textarea id="notes-cleaner" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} type="button">Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Criando...' : 'Criar e Vincular'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CleanerCreateModal;
