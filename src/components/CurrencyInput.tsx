"use client";

import React from 'react';
import { Input } from "@/components/ui/input";
import { formatCurrencyInput, numberToRawDigits } from "@/lib/formatUtils";

interface CurrencyInputProps {
  value?: number; // Tornada opcional para evitar erros quando apenas rawDigits é usado inicialmente
  rawDigits?: string;
  onChange: (value: number, digits: string) => void; // Agora passa ambos os valores
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean; // Adicionada para suporte a validação de formulário nativa
}

const CurrencyInput = ({ 
  value = 0, 
  rawDigits, 
  onChange, 
  onKeyDown, 
  placeholder, 
  className, 
  id, 
  disabled,
  required
}: CurrencyInputProps) => {
  // Se rawDigits não for passado, gera a partir do value numérico
  const digitsToUse = rawDigits !== undefined ? rawDigits : numberToRawDigits(value);
  const { formatted } = formatCurrencyInput(digitsToUse);

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        className={`pl-8 ${className}`}
        value={(value === 0 && digitsToUse.length === 0) ? "" : formatted}
        onChange={(e) => {
          const { numericValue, digits } = formatCurrencyInput(e.target.value);
          onChange(numericValue, digits);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
      />
    </div>
  );
};

export default CurrencyInput;