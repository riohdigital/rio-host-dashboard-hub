
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Users, DollarSign, Link2, Trash2, Edit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import PropertyForm from './PropertyForm';
import { Property } from '@/types/property';

const PropertiesList = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const { toast } = useToast();
  const { hasPermission, canAccessProperty, getAccessibleProperties, isMaster } = useUserPermissions();

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

      // Filter properties based on user permissions
      let filteredProperties = data || [];
      if (!isMaster() && !hasPermission('properties_view_all')) {
        const accessiblePropertyIds = getAccessibleProperties();
        filteredProperties = data?.filter(property => 
          accessiblePropertyIds.includes(property.id)
        ) || [];
      }

      setProperties(filteredProperties);
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

  const handleSuccess = () => {
    fetchProperties();
    setDialogOpen(false);
    setEditingProperty(null);
  };

  const handleCancel = () => {
    setDialogOpen(false);
    setEditingProperty(null);
  };

  const handleEdit = (property: Property) => {
    const accessLevel = canAccessProperty(property.id);
    if (accessLevel === 'full' || (accessLevel === 'read_only' && hasPermission('properties_edit'))) {
      setEditingProperty(property);
      setDialogOpen(true);
    } else {
      toast({
        title: "Erro",
        description: "Você não tem permissão para editar esta propriedade.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (propertyId: string) => {
    const accessLevel = canAccessProperty(propertyId);
    if (accessLevel !== 'full' || !hasPermission('properties_delete')) {
      toast({
        title: "Erro",
        description: "Você não tem permissão para excluir esta propriedade.",
        variant: "destructive",
      });
      return;
    }

    if (!confirm('Tem certeza que deseja excluir esta propriedade?')) return;

    try {
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', propertyId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Propriedade excluída com sucesso.",
      });
      
      fetchProperties();
    } catch (error) {
      console.error('Erro ao excluir propriedade:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a propriedade.",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gradient-primary">Minhas Propriedades</h2>
          <p className="text-gray-600 mt-1">Gerencie suas propriedades de aluguel por temporada</p>
        </div>
        
        {hasPermission('properties_create') && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-[#6A6DDF] hover:bg-[#5A5BCF] text-white"
                onClick={() => setEditingProperty(null)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Propriedade
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-gradient-primary">
                {editingProperty ? 'Editar Propriedade' : 'Nova Propriedade'}
              </DialogTitle>
            </DialogHeader>
            <PropertyForm
              property={editingProperty}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          </DialogContent>
        </Dialog>
        )}
      </div>

      {properties.length === 0 ? (
        <Card className="bg-white">
          <CardContent className="p-12 text-center">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma propriedade cadastrada</h3>
            <p className="text-gray-500 mb-4">Comece adicionando sua primeira propriedade.</p>
            {hasPermission('properties_create') && (
              <Button 
                onClick={() => setDialogOpen(true)}
                className="bg-[#6A6DDF] hover:bg-[#5A5BCF] text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Propriedade
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => (
            <Card key={property.id} className="bg-white hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg text-gradient-primary mb-2">
                      {property.nickname || property.name}
                    </CardTitle>
                    <Badge className={getStatusColor(property.status)}>
                      {property.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {(canAccessProperty(property.id) === 'full' || 
                      (canAccessProperty(property.id) === 'read_only' && hasPermission('properties_edit'))) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(property)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {(canAccessProperty(property.id) === 'full' && hasPermission('properties_delete')) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(property.id)}
                        className="text-red-600 hover:text-red-700 hover:border-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-600">
                    <MapPin className="h-4 w-4 mr-2" />
                    {property.address || 'Endereço não informado'}
                  </div>
                  
                  <div className="flex items-center text-gray-600">
                    <Users className="h-4 w-4 mr-2" />
                    {property.max_guests ? `Até ${property.max_guests} hóspedes` : 'Capacidade não informada'}
                  </div>
                  
                  {property.base_nightly_price && (
                    <div className="flex items-center text-gray-600">
                      <DollarSign className="h-4 w-4 mr-2" />
                      <span className="text-gradient-accent font-medium">
                        R$ {property.base_nightly_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / noite
                      </span>
                    </div>
                  )}
                </div>

                {(property.airbnb_link || property.booking_link) && (
                  <div className="flex gap-2 pt-2 border-t">
                    {property.airbnb_link && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(property.airbnb_link, '_blank')}
                        className="flex-1"
                      >
                        <Link2 className="h-3 w-3 mr-1" />
                        Airbnb
                      </Button>
                    )}
                    {property.booking_link && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(property.booking_link, '_blank')}
                        className="flex-1"
                      >
                        <Link2 className="h-3 w-3 mr-1" />
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
  );
};

export default PropertiesList;
