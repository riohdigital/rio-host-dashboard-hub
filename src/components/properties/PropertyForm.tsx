
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Property } from '@/types/property';
import { useAuth } from '@/hooks/useAuth';
import AirbnbImportSection from './AirbnbImportSection';
import { fetchN8n } from '@/lib/n8n';

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
    notes: '',
    default_checkin_time: '15:00',
    default_checkout_time: '11:00'
  });
  // Localização usada na precificação: a esteira encontra pelo endereço; o usuário pode corrigir.
  const [local, setLocal] = useState({ city: '', uf: '', country_code: '' });
  const [localEditado, setLocalEditado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importedData, setImportedData] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

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
        notes: property.notes || '',
        default_checkin_time: property.default_checkin_time || '15:00',
        default_checkout_time: property.default_checkout_time || '11:00'
      });
      setLocal({
        city: property.city || '',
        uf: (property.state_code || '').split('-').pop() || '',
        country_code: property.country_code || '',
      });
      setLocalEditado(false);
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
        notes: formData.notes || null,
        // Localização digitada pelo usuário vale como manual e a esteira não a sobrescreve.
        ...(localEditado && local.city.trim() && local.country_code.trim()
          ? {
              city: local.city.trim(),
              country_code: local.country_code.trim().toUpperCase(),
              state_code: local.uf.trim() ? `${local.country_code.trim().toUpperCase()}-${local.uf.trim().toUpperCase()}` : null,
              geo_status: 'manual',
              geo_source: 'usuario',
              geo_checked_at: new Date().toISOString(),
            }
          : {})
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
  .insert([{ ...dataToSubmit, created_by: user?.id }]);
        error = insertError;
      }

      if (error) throw error;

      // Imóvel com precificação automática: revisa localização, feriados e regras na hora,
      // para uma pendência corrigida aqui sumir da página Precificação sem esperar a próxima hora.
      if (property?.pricing_activated_at) {
        fetchN8n('rioh-host-esteira-precificacao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ property_id: property.id }),
        }).catch(err => console.error('Esteira de precificação não respondeu:', err));
      }

      toast({
        title: "Sucesso",
        description: property
          ? "Propriedade atualizada com sucesso."
          : "Propriedade criada. Ative a precificação automática na página Precificação.",
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

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImportSuccess = (data: Partial<Property>) => {
    setFormData(prev => ({
      ...prev,
      ...data,
      // Manter campos que não devem ser sobrescritos
      status: prev.status,
      commission_rate: prev.commission_rate,
      cleaning_fee: prev.cleaning_fee,
    }));
    setImportedData(true);
    toast({
      title: "✓ Dados importados com sucesso!",
      description: "Revise as informações antes de salvar.",
    });
  };

  const handleImportError = (error: string) => {
    toast({
      title: "✗ Erro na importação",
      description: error,
      variant: "destructive",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Seção de Importação - Apenas em modo de criação */}
      {!property && (
        <AirbnbImportSection
          onImportSuccess={handleImportSuccess}
          onImportError={handleImportError}
        />
      )}

      {importedData && (
        <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
          <p className="text-sm text-foreground flex items-center gap-2">
            <Badge variant="secondary" className="bg-primary/20 text-primary">Importado</Badge>
            <span>Dados importados do Airbnb. Revise antes de salvar.</span>
          </p>
        </div>
      )}

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

        {/* Localização usada na precificação (feriados e eventos da cidade, estado e país) */}
        <div className="rounded-lg border bg-gray-50/60 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-700">Localização para a precificação</span>
            {property?.geo_status === 'ok' && !localEditado && (
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Encontrada pelo endereço</Badge>
            )}
            {(property?.geo_status === 'manual' || localEditado) && (
              <Badge variant="outline" className="text-[10px] bg-indigo-50 text-[#6A6DDF] border-indigo-200">Informada por você</Badge>
            )}
            {property?.geo_status === 'nao_encontrado' && !localEditado && (
              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">Endereço não encontrado no mapa</Badge>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <Label htmlFor="geo_city" className="text-xs">Cidade</Label>
              <Input id="geo_city" value={local.city} placeholder="Ex: Rio de Janeiro"
                onChange={(e) => { setLocal(l => ({ ...l, city: e.target.value })); setLocalEditado(true); }} />
            </div>
            <div>
              <Label htmlFor="geo_uf" className="text-xs">Estado (sigla)</Label>
              <Input id="geo_uf" value={local.uf} maxLength={3} placeholder="Ex: RJ"
                onChange={(e) => { setLocal(l => ({ ...l, uf: e.target.value })); setLocalEditado(true); }} />
            </div>
            <div>
              <Label htmlFor="geo_country" className="text-xs">País (código de 2 letras)</Label>
              <Input id="geo_country" value={local.country_code} maxLength={2} placeholder="Ex: BR"
                onChange={(e) => { setLocal(l => ({ ...l, country_code: e.target.value })); setLocalEditado(true); }} />
            </div>
          </div>
          <p className="text-[11px] text-gray-500">
            Preenchida sozinha a partir do endereço quando a precificação automática está ativa. Só altere se estiver errada:
            o que você digitar aqui passa a valer e não é sobrescrito.
          </p>
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="default_checkin_time">Horário Padrão de Check-in</Label>
            <Input
              id="default_checkin_time"
              type="time"
              value={formData.default_checkin_time}
              onChange={(e) => handleInputChange('default_checkin_time', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="default_checkout_time">Horário Padrão de Check-out</Label>
            <Input
              id="default_checkout_time"
              type="time"
              value={formData.default_checkout_time}
              onChange={(e) => handleInputChange('default_checkout_time', e.target.value)}
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
