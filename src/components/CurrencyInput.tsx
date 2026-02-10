"use client";

import React from 'react';
import { Input } from "@/components/ui/input";
import { formatCurrencyInput, numberToRawDigits } from "@/lib/formatUtils";

interface CurrencyInputProps {
  value: number;
  rawDigits?: string; // Tornada opcional para facilitar o uso simples
  onChange: (value: number) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean; // Adicionada para suportar estados de leitura/carregamento
}

const CurrencyInput = ({ 
  value, 
  rawDigits, 
  onChange, 
  onKeyDown, 
  placeholder, 
  className, 
  id, 
  disabled 
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
          const { numericValue } = formatCurrencyInput(e.target.value);
          onChange(numericValue);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
};

export default CurrencyInput;