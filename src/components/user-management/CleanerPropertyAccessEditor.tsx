import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Property } from '@/types/property';

// Definimos as propriedades (props) que o componente irá receber
interface CleanerPropertyAccessEditorProps {
  // A lista de todas as propriedades do sistema
  allProperties: Pick<Property, 'id' | 'name' | 'nickname'>[];
  // Um array apenas com os IDs das propriedades que a faxineira já tem acesso
  linkedPropertyIds: string[];
  // Uma função para comunicar as mudanças de volta para o componente pai (o modal)
  onChange: (newLinkedIds: string[]) => void;
}

const CleanerPropertyAccessEditor: React.FC<CleanerPropertyAccessEditorProps> = ({
  allProperties,
  linkedPropertyIds,
  onChange,
}) => {
  // Função chamada quando um switch é clicado
  const handleToggle = (propertyId: string) => {
    // Verifica se a propriedade já está na lista de vinculadas
    const isCurrentlyLinked = linkedPropertyIds.includes(propertyId);
    
    let updatedIds: string[];

    if (isCurrentlyLinked) {
      // Se já estava vinculada, remove da lista
      updatedIds = linkedPropertyIds.filter(id => id !== propertyId);
    } else {
      // Se não estava, adiciona na lista
      updatedIds = [...linkedPropertyIds, propertyId];
    }
    
    // Envia a lista atualizada para o componente pai
    onChange(updatedIds);
  };

  return (
    <div className="space-y-3">
      <Label className="text-base font-medium">Propriedades Vinculadas</Label>
      <p className="text-sm text-muted-foreground">
        Ative para vincular a faxineira a uma propriedade. Ela só poderá ver e ser designada para faxinas nessas propriedades.
      </p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Propriedade</TableHead>
              <TableHead className="text-right w-[100px]">Vinculada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allProperties.length > 0 ? (
              allProperties.map((prop) => {
                const isLinked = linkedPropertyIds.includes(prop.id);
                return (
                  <TableRow key={prop.id}>
                    <TableCell className="font-medium">{prop.nickname || prop.name}</TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={isLinked}
                        onCheckedChange={() => handleToggle(prop.id)}
                        aria-label={`Vincular ${prop.nickname || prop.name}`}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  Nenhuma propriedade encontrada no sistema.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default CleanerPropertyAccessEditor;
