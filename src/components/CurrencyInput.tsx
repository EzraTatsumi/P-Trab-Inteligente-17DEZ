import React, { useState, useCallback, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { formatCurrencyInput, numberToRawDigits } from "@/lib/formatUtils";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'placeholder'> {
  value: number; // Valor numérico real
  onChange: (rawDigits: string) => void; // Retorna apenas os dígitos brutos
  placeholder?: string;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, placeholder = "0,00", className, onKeyDown, ...props }, ref) => {
    
    // Estado interno para armazenar os dígitos brutos (sem R$, pontos ou vírgulas)
    const [rawDigits, setRawDigits] = useState<string>(numberToRawDigits(value));
    
    // Efeito para sincronizar o estado interno quando o 'value' externo muda
    useEffect(() => {
      const newRawDigits = numberToRawDigits(value);
      if (newRawDigits !== rawDigits) {
        setRawDigits(newRawDigits);
      }
    }, [value]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      const { digits } = formatCurrencyInput(input);
      
      setRawDigits(digits);
      onChange(digits);
    }, [onChange]);

    // Formatação para exibição
    const { formatted: displayValue } = formatCurrencyInput(rawDigits);
    
    // Adiciona o prefixo R$
    const finalDisplayValue = displayValue.length > 0 ? `R$ ${displayValue}` : '';
    
    // Placeholder com prefixo "R$ "
    const finalPlaceholder = placeholder.startsWith("Ex.:") 
        ? `R$ ${placeholder.replace("Ex.: ", "")}` 
        : `R$ ${placeholder}`;

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        className={`text-right pr-3 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className}`}
        value={finalDisplayValue}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        placeholder={finalPlaceholder}
        {...props}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

export default CurrencyInput;