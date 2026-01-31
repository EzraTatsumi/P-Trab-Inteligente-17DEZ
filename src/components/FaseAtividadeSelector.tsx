import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FASES_PADRAO } from "@/lib/constants";

interface FaseAtividadeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Componente para selecionar a Fase da Atividade, permitindo múltiplos valores separados por ponto e vírgula.
 */
export const FaseAtividadeSelector: React.FC<FaseAtividadeSelectorProps> = ({ value, onChange, disabled = false }) => {
  
  const selectedFases = value ? value.split(';').map(f => f.trim()).filter(f => f) : [];

  const handleSelectChange = (newFase: string) => {
    const currentFases = value ? value.split(';').map(f => f.trim()).filter(f => f) : [];
    
    if (currentFases.includes(newFase)) {
      // Remove a fase se já estiver selecionada
      const updatedFases = currentFases.filter(f => f !== newFase);
      onChange(updatedFases.join(';'));
    } else {
      // Adiciona a nova fase
      const updatedFases = [...currentFases, newFase];
      onChange(updatedFases.join(';'));
    }
  };
  
  // Renderiza o valor atual como uma string formatada
  const displayValue = selectedFases.join(', ');

  return (
    <Select 
      value={displayValue} 
      onValueChange={handleSelectChange} 
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder="Selecione as fases..." />
      </SelectTrigger>
      <SelectContent>
        {FASES_PADRAO.map((fase) => (
          <SelectItem key={fase} value={fase}>
            {fase} {selectedFases.includes(fase) && ' (Selecionado)'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};