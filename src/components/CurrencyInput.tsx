import React, { useState, useEffect, useCallback } from 'react';
import { Input, InputProps } from "@/components/ui/input";
import { parseInputToNumber, formatNumberForInput } from "@/lib/formatUtils";
import { cn } from "@/lib/utils";

interface CurrencyInputProps extends Omit<InputProps, 'value' | 'onChange' | 'onBlur'> {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, placeholder = "0,00", className, ...props }, ref) => {
    // Internal state holds the formatted string representation
    // Usamos formatNumberForInput para garantir a formatação inicial
    const [displayValue, setDisplayValue] = useState<string>(formatNumberForInput(value));

    // Sync internal state when external value prop changes (e.g., initial load or reset)
    useEffect(() => {
      // Apenas atualiza se o valor numérico do display string não corresponder ao valor de entrada
      if (parseInputToNumber(displayValue) !== value) {
        setDisplayValue(formatNumberForInput(value));
      }
    }, [value]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      
      // 1. Remove tudo exceto dígitos, ponto e vírgula
      let cleaned = rawValue.replace(/[^\d,.]/g, '');

      // 2. Garante que haja apenas uma vírgula (decimal separator)
      const parts = cleaned.split(',');
      if (parts.length > 2) {
        cleaned = parts[0] + ',' + parts.slice(1).join('');
      }
      
      // 3. Remove pontos (separadores de milhar) para simplificar a entrada
      cleaned = cleaned.replace(/\./g, '');
      
      setDisplayValue(cleaned);
      
      // Atualiza o valor numérico no onChange para feedback imediato
      onChange(parseInputToNumber(cleaned));
      
    }, [onChange]);

    const handleInputBlur = useCallback(() => {
      // 1. Parse the current display string to a clean number
      const numericValue = parseInputToNumber(displayValue);
      
      // 2. Update the external state (parent component)
      onChange(numericValue);
      
      // 3. Reformat the display value to ensure 2 decimal places are shown (e.g., 10 -> 10,00)
      setDisplayValue(formatNumberForInput(numericValue));
    }, [displayValue, onChange]);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          className={cn("pl-12 text-lg", className)}
          {...props}
        />
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-lg text-foreground">R$</span>
      </div>
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";