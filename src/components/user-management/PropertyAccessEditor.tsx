import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { UserPropertyAccess } from '@/types/user-management';
import type { Property } from '@/types/property';
import { toast } from "sonner";

interface PropertyAccessEditorProps {
  propertyAccess: UserPropertyAccess[];
  onChange: (propertyAccess: UserPropertyAccess[]) => void;
  userRole: string;
  userId?: string;
}

const PropertyAccessEditor: React.FC<PropertyAccessEditorProps> = ({
  propertyAccess,
  onChange,
  userRole,
  userId
}) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<'full' | 'read_only' | 'restricted'>('read_only');

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const { data } = await supabase
        .from('properties')
        .select('id, name, nickname')
        .order('name');
      
      setProperties((data || []) as Property[]);
    } catch (error) {
      console.error('Erro ao buscar propriedades:', error);
    }
  };

  const getPropertyName = (propertyId: string): string => {
    const property = properties.find(p => p.id === propertyId);
    return property ? (property.nickname || property.name) : 'Propriedade não encontrada';
  };

  const getAccessLevelLabel = (level: string): string => {
    switch (level) {
      case 'full': return 'Acesso Total';
      case 'read_only': return 'Somente Leitura';
      case 'restricted': return 'Restrito';
      default: return level;
    }
  };

  const getAccessLevelVariant = (level: string) => {
    switch (level) {
      case 'full': return 'default';
      case 'read_only': return 'secondary';
      case 'restricted': return 'outline';
      default: return 'outline';
    }
  };

  const savePropertyAccess = async (access: UserPropertyAccess) => {
    if (!userId) return;

    try {
      if (access.id) {
        // Atualizar acesso existente
        const { error } = await supabase
          .from('user_property_access')
          .update({ access_level: access.access_level })
          .eq('id', access.id);
        
        if (error) throw error;
      } else {
        // Criar novo acesso
        const { error } = await supabase
          .from('user_property_access')
          .insert({
            user_id: userId,
            property_id: access.property_id,
            access_level: access.access_level
          });
        
        if (error) throw error;
      }
      
      toast.success('Acesso à propriedade salvo com sucesso');
    } catch (error) {
      console.error('Erro ao salvar acesso:', error);
      toast.error('Erro ao salvar acesso à propriedade');
    }
  };

  const deletePropertyAccess = async (accessId: string) => {
    if (!accessId) return;

    try {
      const { error } = await supabase
        .from('user_property_access')
        .delete()
        .eq('id', accessId);
      
      if (error) throw error;
      toast.success('Acesso removido com sucesso');
    } catch (error) {
      console.error('Erro ao remover acesso:', error);
      toast.error('Erro ao remover acesso');
    }
  };

  const addPropertyAccess = async () => {
    if (!selectedPropertyId || !userId) return;

    // Verificar se já existe acesso para esta propriedade
    const existingAccess = propertyAccess.find(pa => pa.property_id === selectedPropertyId);
    if (existingAccess) return;

    const newAccess: UserPropertyAccess = {
      id: '', // Será gerado pelo banco
      user_id: userId,
      property_id: selectedPropertyId,
      access_level: selectedAccessLevel,
      created_at: new Date().toISOString()
    };

    // Salvar no banco
    await savePropertyAccess(newAccess);
    
    // Atualizar estado local
    onChange([...propertyAccess, newAccess]);
    setSelectedPropertyId('');
    setSelectedAccessLevel('read_only');
  };

  const removePropertyAccess = async (propertyId: string) => {
    const access = propertyAccess.find(pa => pa.property_id === propertyId);
    if (access?.id) {
      await deletePropertyAccess(access.id);
    }
    
    const newAccess = propertyAccess.filter(pa => pa.property_id !== propertyId);
    onChange(newAccess);
  };

  const updateAccessLevel = async (propertyId: string, accessLevel: 'full' | 'read_only' | 'restricted') => {
    const access = propertyAccess.find(pa => pa.property_id === propertyId);
    if (access) {
      const updatedAccess = { ...access, access_level: accessLevel };
      await savePropertyAccess(updatedAccess);
    }
    
    const newAccess = propertyAccess.map(pa => 
      pa.property_id === propertyId 
        ? { ...pa, access_level: accessLevel }
        : pa
    );
    onChange(newAccess);
  };

  // Usuário mestre tem acesso a todas as propriedades automaticamente
  if (userRole === 'master') {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Usuário mestre possui acesso total a todas as propriedades automaticamente.
      </div>
    );
  }

  const availableProperties = properties.filter(p => 
    !propertyAccess.some(pa => pa.property_id === p.id)
  );

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-foreground mb-2">
          Acesso a Propriedades Específicas
        </h4>
        <p className="text-xs text-muted-foreground mb-4">
          Configure o acesso a propriedades específicas para este usuário
        </p>
      </div>

      {/* Lista de acessos existentes */}
      <div className="space-y-2">
        {propertyAccess.map((access) => (
          <div key={access.property_id} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex-1">
              <Label className="text-sm font-medium">
                {getPropertyName(access.property_id)}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={access.access_level}
                onValueChange={(value) => 
                  updateAccessLevel(access.property_id, value as 'full' | 'read_only' | 'restricted')
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Acesso Total</SelectItem>
                  <SelectItem value="read_only">Somente Leitura</SelectItem>
                  <SelectItem value="restricted">Restrito</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => removePropertyAccess(access.property_id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {propertyAccess.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-sm">
            Nenhuma propriedade específica configurada
          </div>
        )}
      </div>

      {/* Adicionar nova propriedade */}
      {availableProperties.length > 0 && (
        <div className="flex gap-2">
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Selecione uma propriedade" />
            </SelectTrigger>
            <SelectContent>
              {availableProperties.map((property) => (
                <SelectItem key={property.id} value={property.id}>
                  {property.nickname || property.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedAccessLevel} onValueChange={(value) => setSelectedAccessLevel(value as 'full' | 'read_only' | 'restricted')}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Acesso Total</SelectItem>
              <SelectItem value="read_only">Somente Leitura</SelectItem>
              <SelectItem value="restricted">Restrito</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            onClick={addPropertyAccess}
            disabled={!selectedPropertyId}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default PropertyAccessEditor;