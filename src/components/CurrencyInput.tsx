import React, { useState, useEffect, useCallback } from 'react';
import { Input, InputProps } from "@/components/ui/input";
import { formatCurrencyInput, numberToRawDigits } from "@/lib/formatUtils";
import { cn } from "@/lib/utils";

interface CurrencyInputProps extends Omit<InputProps, 'value' | 'onChange' | 'onBlur'> {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, placeholder = "0,00", className, ...props }, ref) => {
    // Internal state holds the raw digits string (e.g., "12345" for 123.45)
    const [rawDigits, setRawDigits] = useState<string>(numberToRawDigits(value));
    
    // Calculate formatted value and numeric value based on rawDigits state
    const { formatted, numericValue } = formatCurrencyInput(rawDigits);

    // Sync internal state when external value prop changes (e.g., initial load or reset)
    useEffect(() => {
      // Only update if the current numeric value derived from rawDigits doesn't match the prop value
      if (numericValue !== value) {
        setRawDigits(numberToRawDigits(value));
      }
    }, [value]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      
      // 1. Remove tudo que não for dígito
      const newDigits = rawValue.replace(/\D/g, '');
      
      // 2. Atualiza o estado interno de dígitos brutos
      setRawDigits(newDigits);
      
      // 3. Calcula o novo valor numérico e notifica o componente pai
      const { numericValue: newNumericValue } = formatCurrencyInput(newDigits);
      onChange(newNumericValue);
      
    }, [onChange]);

    const handleInputBlur = useCallback(() => {
      // No need for complex reformatting on blur, as formatCurrencyInput handles it automatically.
      // We just ensure the parent state is updated (already done in handleInputChange).
      // If the input is empty, we should ensure the value is 0.
      if (rawDigits.length === 0 && numericValue !== 0) {
        onChange(0);
      }
    }, [rawDigits, numericValue, onChange]);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type="text"
          inputMode="decimal"
          value={formatted} // Use the formatted string for display
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