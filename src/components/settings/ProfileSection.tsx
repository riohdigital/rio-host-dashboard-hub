
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const ProfileSection = () => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Aqui você implementaria a atualização do perfil do usuário
      // Por ora, apenas mostramos um toast de sucesso
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Sucesso",
        description: "Perfil atualizado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o perfil.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#6A6DDF] mb-2">Meu Perfil</h2>
        <p className="text-gray-600">Atualize suas informações pessoais.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome Completo</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Digite seu nome completo"
          />
        </div>

        <Button 
          type="submit" 
          disabled={loading}
          className="bg-[#6A6DDF] hover:bg-[#5A5BCF] text-white"
        >
          {loading ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </form>
    </div>
  );
};

export default ProfileSection;
