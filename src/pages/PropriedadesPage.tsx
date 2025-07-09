
import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Plus, ExternalLink, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import PropertyForm from '@/components/properties/PropertyForm';
import { Property } from '@/types/property';

const PropriedadesPage = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error('Erro ao buscar propriedades:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as propriedades.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (propertyId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta propriedade?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', propertyId);

      if (error) throw error;

      setProperties(properties.filter(p => p.id !== propertyId));
      toast({
        title: "Sucesso",
        description: "Propriedade excluída com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao excluir propriedade:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a propriedade.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (property: Property) => {
    setEditingProperty(property);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setEditingProperty(null);
    fetchProperties();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'ativo':
        return 'bg-green-100 text-green-800';
      case 'inativo':
        return 'bg-red-100 text-red-800';
      case 'em manutenção':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-[#6A6DDF] text-lg">Carregando propriedades...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-[#6A6DDF]">Minhas Propriedades</h1>
          <Dialog open={isFormOpen} onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingProperty(null);
          }}>
            <DialogTrigger asChild>
              <Button className="bg-[#6A6DDF] hover:bg-[#5A5BCF] text-white">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Nova Propriedade
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-[#6A6DDF]">
                  {editingProperty ? 'Editar Propriedade' : 'Nova Propriedade'}
                </DialogTitle>
              </DialogHeader>
              <PropertyForm 
                property={editingProperty} 
                onSuccess={handleFormSuccess}
                onCancel={() => setIsFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {properties.length === 0 ? (
          <Card className="bg-white">
            <CardContent className="p-8 text-center">
              <h3 className="text-lg font-medium text-[#374151] mb-2">
                Nenhuma propriedade cadastrada
              </h3>
              <p className="text-gray-500 mb-4">
                Comece adicionando sua primeira propriedade para gerenciar seus aluguéis.
              </p>
              <Button 
                onClick={() => setIsFormOpen(true)}
                className="bg-[#6A6DDF] hover:bg-[#5A5BCF] text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Primeira Propriedade
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((property) => (
              <Card key={property.id} className="bg-white hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-[#374151] text-lg mb-1">
                        {property.name}
                      </h3>
                      {property.nickname && (
                        <p className="text-sm text-gray-500">
                          {property.nickname}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(property)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(property.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Badge className={getStatusColor(property.status)}>
                    {property.status}
                  </Badge>
                  
                  {property.address && (
                    <p className="text-sm text-gray-600">
                      📍 {property.address}
                    </p>
                  )}
                  
                  {property.property_type && (
                    <p className="text-sm text-gray-600">
                      🏠 {property.property_type}
                    </p>
                  )}
                  
                  {property.max_guests && (
                    <p className="text-sm text-gray-600">
                      👥 Até {property.max_guests} hóspedes
                    </p>
                  )}
                  
                  {property.base_nightly_price && (
                    <p className="text-sm font-medium text-[#10B981]">
                      💰 R$ {property.base_nightly_price}/noite
                    </p>
                  )}
                  
                  {(property.airbnb_link || property.booking_link) && (
                    <div className="flex gap-2 pt-2">
                      {property.airbnb_link && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(property.airbnb_link, '_blank')}
                        >
                          <ExternalLink className="mr-1 h-3 w-3" />
                          Airbnb
                        </Button>
                      )}
                      {property.booking_link && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(property.booking_link, '_blank')}
                        >
                          <ExternalLink className="mr-1 h-3 w-3" />
                          Booking
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default PropriedadesPage;
