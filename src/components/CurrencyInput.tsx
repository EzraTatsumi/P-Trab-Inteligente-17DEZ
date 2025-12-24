import React, { useState, useEffect, useCallback } from 'react';
import { Input, InputProps } from "@/components/ui/input";
import { parseInputToNumber, formatInputString, formatNumberToInputString } from "@/lib/formatUtils";
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
    const [displayValue, setDisplayValue] = useState<string>(formatNumberToInputString(value));

    // Sync internal state when external value prop changes (e.g., initial load or reset)
    useEffect(() => {
      // Only update if the numeric value of the display string doesn't match the incoming value
      // This prevents cursor jumping during typing
      if (parseInputToNumber(displayValue) !== value) {
        setDisplayValue(formatNumberToInputString(value));
      }
    }, [value]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      
      // Apply formatting (thousands separator, decimal limit)
      const formattedValue = formatInputString(rawValue);
      
      setDisplayValue(formattedValue);
      
      // Note: We typically update the numeric value on blur for currency inputs
    }, []);

    const handleInputBlur = useCallback(() => {
      // 1. Parse the current display string to a clean number
      const numericValue = parseInputToNumber(displayValue);
      
      // 2. Update the external state (parent component)
      onChange(numericValue);
      
      // 3. Reformat the display value to ensure 2 decimal places are shown (e.g., 10 -> 10,00)
      setDisplayValue(formatNumberToInputString(numericValue));
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