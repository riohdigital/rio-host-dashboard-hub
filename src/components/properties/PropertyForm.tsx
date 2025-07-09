
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Property } from '@/types/property';

interface PropertyFormProps {
  property?: Property | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const PropertyForm = ({ property, onSuccess, onCancel }: PropertyFormProps) => {
  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    address: '',
    property_type: '',
    status: 'Ativo',
    airbnb_link: '',
    booking_link: '',
    commission_rate: 20,
    cleaning_fee: 0,
    base_nightly_price: 0,
    max_guests: 1,
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (property) {
      setFormData({
        name: property.name || '',
        nickname: property.nickname || '',
        address: property.address || '',
        property_type: property.property_type || '',
        status: property.status || 'Ativo',
        airbnb_link: property.airbnb_link || '',
        booking_link: property.booking_link || '',
        commission_rate: property.commission_rate * 100 || 20, // Convert to percentage
        cleaning_fee: property.cleaning_fee || 0,
        base_nightly_price: property.base_nightly_price || 0,
        max_guests: property.max_guests || 1,
        notes: property.notes || ''
      });
    }
  }, [property]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dataToSubmit = {
        ...formData,
        commission_rate: formData.commission_rate / 100, // Convert back to decimal
        base_nightly_price: formData.base_nightly_price || null,
        max_guests: formData.max_guests || null,
        nickname: formData.nickname || null,
        address: formData.address || null,
        airbnb_link: formData.airbnb_link || null,
        booking_link: formData.booking_link || null,
        notes: formData.notes || null
      };

      let error;
      if (property) {
        const { error: updateError } = await supabase
          .from('properties')
          .update(dataToSubmit)
          .eq('id', property.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('properties')
          .insert([dataToSubmit]);
        error = insertError;
      }

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: property ? "Propriedade atualizada com sucesso." : "Propriedade criada com sucesso.",
      });
      
      onSuccess();
    } catch (error) {
      console.error('Erro ao salvar propriedade:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a propriedade.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Seção 1: Informações Principais */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-[#6A6DDF] border-b pb-2">
          Informações Principais
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Nome da Propriedade *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Ex: Rioh Host - Copacabana"
              required
            />
          </div>
          <div>
            <Label htmlFor="nickname">Apelido</Label>
            <Input
              id="nickname"
              value={formData.nickname}
              onChange={(e) => handleInputChange('nickname', e.target.value)}
              placeholder="Ex: Apê Copa"
            />
          </div>
        </div>
        
        <div>
          <Label htmlFor="address">Endereço Completo</Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => handleInputChange('address', e.target.value)}
            placeholder="Rua, número, bairro, cidade"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="property_type">Tipo de Propriedade *</Label>
            <Select 
              value={formData.property_type} 
              onValueChange={(value) => handleInputChange('property_type', value)}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Apartamento">Apartamento</SelectItem>
                <SelectItem value="Casa">Casa</SelectItem>
                <SelectItem value="Estúdio">Estúdio</SelectItem>
                <SelectItem value="Loft">Loft</SelectItem>
                <SelectItem value="Kitnet">Kitnet</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="status">Status *</Label>
            <Select 
              value={formData.status} 
              onValueChange={(value) => handleInputChange('status', value)}
              required
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
                <SelectItem value="Em Manutenção">Em Manutenção</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Seção 2: Plataformas e Marketing */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-[#6A6DDF] border-b pb-2">
          Plataformas e Marketing
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="airbnb_link">Link do Anúncio no Airbnb</Label>
            <Input
              id="airbnb_link"
              type="url"
              value={formData.airbnb_link}
              onChange={(e) => handleInputChange('airbnb_link', e.target.value)}
              placeholder="https://www.airbnb.com.br/..."
            />
          </div>
          <div>
            <Label htmlFor="booking_link">Link do Anúncio no Booking.com</Label>
            <Input
              id="booking_link"
              type="url"
              value={formData.booking_link}
              onChange={(e) => handleInputChange('booking_link', e.target.value)}
              placeholder="https://www.booking.com/..."
            />
          </div>
        </div>
      </div>

      {/* Seção 3: Configurações Financeiras e Operacionais */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-[#6A6DDF] border-b pb-2">
          Configurações Financeiras e Operacionais
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="base_nightly_price">Preço Base da Diária (R$)</Label>
            <Input
              id="base_nightly_price"
              type="number"
              min="0"
              step="0.01"
              value={formData.base_nightly_price}
              onChange={(e) => handleInputChange('base_nightly_price', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label htmlFor="cleaning_fee">Taxa de Limpeza Padrão (R$) *</Label>
            <Input
              id="cleaning_fee"
              type="number"
              min="0"
              step="0.01"
              value={formData.cleaning_fee}
              onChange={(e) => handleInputChange('cleaning_fee', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              required
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="commission_rate">Comissão do Co-anfitrião (%)</Label>
            <Input
              id="commission_rate"
              type="number"
              min="0"
              max="100"
              step="1"
              value={formData.commission_rate}
              onChange={(e) => handleInputChange('commission_rate', parseFloat(e.target.value) || 0)}
              placeholder="20"
              required
            />
          </div>
          <div>
            <Label htmlFor="max_guests">Número Máximo de Hóspedes</Label>
            <Input
              id="max_guests"
              type="number"
              min="1"
              value={formData.max_guests}
              onChange={(e) => handleInputChange('max_guests', parseInt(e.target.value) || 1)}
              placeholder="1"
            />
          </div>
        </div>
      </div>

      {/* Seção 4: Anotações */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-[#6A6DDF] border-b pb-2">
          Anotações
        </h3>
        <div>
          <Label htmlFor="notes">Anotações Internas</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            placeholder="Informações adicionais sobre a propriedade..."
            rows={4}
          />
        </div>
      </div>

      {/* Botões */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          className="bg-[#6A6DDF] hover:bg-[#5A5BCF] text-white"
          disabled={loading}
        >
          {loading ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
};

export default PropertyForm;
