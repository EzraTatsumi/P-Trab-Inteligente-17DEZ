"use client";

import React from 'react';
import { Input } from "@/components/ui/input";
import { formatCurrencyInput } from "@/lib/formatUtils";

interface CurrencyInputProps {
  value: number;
  rawDigits: string;
  onChange: (value: number) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  id?: string; // Adicionado para suporte a labels e acessibilidade
}

const CurrencyInput = ({ value, rawDigits, onChange, onKeyDown, placeholder, className, id }: CurrencyInputProps) => {
  const { formatted } = formatCurrencyInput(rawDigits);

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        className={`pl-8 ${className}`}
        value={value === 0 && rawDigits.length === 0 ? "" : formatted}
        onChange={(e) => {
          const { numericValue } = formatCurrencyInput(e.target.value);
          onChange(numericValue);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
      />
    </div>
  );
};

export default CurrencyInput;