"use client";

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
      // We use a small tolerance check here to prevent infinite loops due to floating point arithmetic
      if (Math.abs(numericValue - value) > 0.001) {
        setRawDigits(numberToRawDigits(value));
      }
    }, [value, numericValue]);

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
      // If the input is empty (rawDigits is empty), ensure the parent state is 0
      if (rawDigits.length === 0 && numericValue !== 0) {
        onChange(0);
      }
    }, [rawDigits, numericValue, onChange]);
    
    // Determine the display value: if rawDigits is empty, show empty string, otherwise show formatted value without R$
    const displayValue = rawDigits.length === 0 ? '' : formatted.replace('R$ ', '');

    return (
      <div className="relative">
        <Input
          ref={ref}
          type="text"
          inputMode="decimal"
          value={displayValue} // Use the formatted string for display
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