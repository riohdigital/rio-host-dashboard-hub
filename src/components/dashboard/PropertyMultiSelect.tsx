import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button"; // Importe o componente de Botão
import { Property } from '@/types/property';

interface PropertyMultiSelectProps {
  properties: Property[];
  selectedProperties: string[];
  onSelectionChange: (selected: string[]) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const PropertyMultiSelect = ({ 
  properties, 
  selectedProperties, 
  onSelectionChange, 
  isOpen, 
  onToggle 
}: PropertyMultiSelectProps) => {
  // Estado local para guardar as seleções antes de "Aplicar"
  const [localSelection, setLocalSelection] = useState(selectedProperties);
  const wrapperRef = useRef<HTMLDivElement>(null); // Ref para detectar cliques fora

  // Sincroniza o estado local se o estado global mudar por outro motivo
  useEffect(() => {
    setLocalSelection(selectedProperties);
  }, [selectedProperties]);

  // Efeito para detectar cliques fora do componente e fechar o menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        if (isOpen) {
          // Ao fechar, aplica as seleções que estavam pendentes
          onSelectionChange(localSelection);
          onToggle();
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, localSelection, onToggle, onSelectionChange]);

  const handleSelectAll = () => {
    if (localSelection.includes('todas')) {
      setLocalSelection([]);
    } else {
      setLocalSelection(['todas', ...properties.map(p => p.id)]);
    }
  };

  const handlePropertyToggle = (propertyId: string) => {
    const newSelection = localSelection.includes(propertyId)
      ? localSelection.filter(id => id !== propertyId)
      : [...localSelection, propertyId];

    // Se "todas" for desmarcado, remove-a da seleção
    if (propertyId !== 'todas' && newSelection.includes('todas')) {
      setLocalSelection(newSelection.filter(id => id !== 'todas'));
    } else {
      setLocalSelection(newSelection);
    }
  };
  
  const handleApply = () => {
    onSelectionChange(localSelection); // Envia o estado local para o componente pai
    onToggle(); // Fecha o menu
  };

  const getSelectedText = () => {
    // A lógica para exibir o texto permanece a mesma
    if (selectedProperties.length === 0) return "Selecionar Propriedades";
    if (selectedProperties.includes('todas')) return "Todas as Propriedades";
    if (selectedProperties.length === 1) {
      const property = properties.find(p => p.id === selectedProperties[0]);
      return property?.nickname || property?.name || "1 propriedade";
    }
    return `${selectedProperties.length} propriedades`;
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={onToggle}
        className="w-48 px-4 py-2 text-left bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center justify-between transition-all duration-200 hover:border-primary/50"
      >
        <span className="text-gradient-primary font-medium">{getSelectedText()}</span>
        <svg className={`w-4 h-4 transition-transform text-gradient-primary ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {isOpen && (
        <Card className="absolute top-full left-0 w-64 mt-1 z-50 shadow-lg bg-white">
          <CardContent className="p-4 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2 pb-2 border-b">
                <Checkbox id="select-all" checked={localSelection.includes('todas')} onCheckedChange={handleSelectAll} />
                <label htmlFor="select-all" className="text-sm font-medium text-gradient-primary cursor-pointer">Selecionar Todas</label>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                {properties.map((property) => (
                  <div key={property.id} className="flex items-center space-x-2">
                    <Checkbox id={property.id} checked={localSelection.includes(property.id)} onCheckedChange={() => handlePropertyToggle(property.id)} />
                    <label htmlFor={property.id} className="text-sm cursor-pointer hover:text-gradient-primary transition-colors text-gray-700">{property.nickname || property.name}</label>
                  </div>
                ))}
              </div>
            </div>
            <Button onClick={handleApply} className="w-full bg-primary hover:bg-primary/90">Aplicar</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PropertyMultiSelect;
