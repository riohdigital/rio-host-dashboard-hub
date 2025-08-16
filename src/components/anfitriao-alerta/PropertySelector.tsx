import React from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProperties } from '@/hooks/useProperties';
import { useDestinationProperties } from '@/hooks/useDestinationProperties';

interface PropertySelectorProps {
  destinationId: string;
}

const PropertySelector = ({ destinationId }: PropertySelectorProps) => {
  const { properties, loading: propertiesLoading } = useProperties();
  const { links, linkProperty, unlinkProperty, loading: linksLoading } = useDestinationProperties(destinationId);

  const isLinked = (propertyId: string) => {
    return links.some(link => link.property_id === propertyId);
  };

  const handleToggle = async (propertyId: string) => {
    if (isLinked(propertyId)) {
      await unlinkProperty(propertyId);
    } else {
      await linkProperty(propertyId);
    }
  };

  if (propertiesLoading || linksLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Carregando propriedades...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Propriedades Vinculadas</h3>
        <p className="text-sm text-muted-foreground">
          Selecione quais propriedades este destinatário deve receber alertas
        </p>
      </div>

      {properties.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma propriedade encontrada
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {properties.map((property) => {
            const linked = isLinked(property.id);
            return (
              <Card key={property.id} className={linked ? 'border-primary' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{property.name}</CardTitle>
                    <Button
                      variant={linked ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleToggle(property.id)}
                      className="gap-2"
                    >
                      {linked ? (
                        <>
                          <Check className="h-4 w-4" />
                          Vinculado
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4" />
                          Vincular
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                {property.address && (
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">{property.address}</p>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PropertySelector;