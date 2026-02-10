import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/button"; // Note: usually this is from /ui/input, but following project pattern
import { Input as ShadcnInput } from "@/components/ui/input";
import { formatCurrencyInput, numberToRawDigits } from '@/lib/formatUtils';

interface CurrencyInputProps {
  value: number | null | undefined;
  onChange: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const CurrencyInput = ({ value, onChange, placeholder = "0,00", disabled, className }: CurrencyInputProps) => {
  // Estado interno para o texto formatado exibido no input
  const [displayValue, setDisplayValue] = useState("");

  // Sincroniza o estado interno quando o valor externo (number) muda
  useEffect(() => {
    if (value === null || value === undefined) {
      setDisplayValue("");
      return;
    }
    
    // Converte o número para string de dígitos (centavos) e formata
    const rawDigits = numberToRawDigits(value);
    const { formatted } = formatCurrencyInput(rawDigits);
    setDisplayValue(formatted);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value || "";
    
    // O formatCurrencyInput já lida internamente com a limpeza de caracteres não numéricos
    const { formatted, numericValue } = formatCurrencyInput(inputValue);
    
    setDisplayValue(formatted);
    onChange(numericValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Bloqueia setas para cima/baixo para evitar comportamento indesejado em campos monetários
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
    }
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">R$</span>
      <ShadcnInput
        type="text"
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={`pl-9 ${className}`}
      />
    </div>
  );
};

export default CurrencyInput;