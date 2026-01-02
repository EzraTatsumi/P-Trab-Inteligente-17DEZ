"use client";

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Activity } from 'lucide-react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { formatCurrencyInput, numberToRawDigits } from "@/lib/formatUtils";
import { Tables } from "@/integrations/supabase/types";

// Tipo derivado da nova tabela
type DiretrizOperacional = Tables<'diretrizes_operacionais'>;

// Mapeamento de campos para rótulos e tipo de input (R$ ou Fator)
interface OperationalField {
  key: keyof DiretrizOperacional;
  label: string;
  type: 'currency' | 'factor';
  placeholder: string;
}

interface OperationalCostSectionProps {
  title: string;
  icon: React.ReactNode;
  fields: OperationalField[];
  diretrizes: Partial<DiretrizOperacional>;
  rawInputs: Record<string, string>;
  handleCurrencyChange: (field: keyof DiretrizOperacional, rawValue: string) => void;
  handleFactorChange: (field: keyof DiretrizOperacional, value: string) => void;
}

const OperationalCostSection: React.FC<OperationalCostSectionProps> = ({
  title,
  icon,
  fields,
  diretrizes,
  rawInputs,
  handleCurrencyChange,
  handleFactorChange,
}) => {
  const [isOpen, setIsOpen] = useState(true); // Começa aberto por padrão
  const { handleEnterToNextField } = useFormNavigation();

  // Função para renderizar um campo de diretriz
  const renderDiretrizField = (field: OperationalField) => {
    const value = diretrizes[field.key] as number;
    
    if (field.type === 'currency') {
      const rawDigits = rawInputs[field.key as string] || numberToRawDigits(value);
      const { formatted: displayValue } = formatCurrencyInput(rawDigits);
      
      return (
        <div className="space-y-2">
          <Label htmlFor={field.key as string}>{field.label}</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
            <Input
              id={field.key as string}
              type="text"
              inputMode="numeric"
              className="pl-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={value === 0 && rawDigits.length === 0 ? "" : displayValue}
              onChange={(e) => handleCurrencyChange(field.key, e.target.value)}
              onKeyDown={handleEnterToNextField}
              placeholder={field.placeholder}
            />
          </div>
        </div>
      );
    } else { // type === 'factor'
      return (
        <div className="space-y-2">
          <Label htmlFor={field.key as string}>{field.label}</Label>
          <Input
            id={field.key as string}
            type="number"
            step="0.01"
            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            value={value === 0 ? "" : value}
            onChange={(e) => handleFactorChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            onKeyDown={handleEnterToNextField}
          />
        </div>
      );
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-t pt-4 mt-6">
      <CollapsibleTrigger asChild>
        <div 
          className="flex items-center justify-between cursor-pointer py-2" 
        >
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {icon}
            {title}
          </h3>
          {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {fields.map(field => (
            <div key={field.key as string} className="col-span-1">
              {renderDiretrizField(field)}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default OperationalCostSection;