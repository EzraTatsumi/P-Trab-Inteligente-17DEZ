import React, { useState, useEffect } from 'react';
import { Input as ShadcnInput } from "@/components/ui/input";
import { formatCurrencyInput, numberToRawDigits } from '@/lib/formatUtils';
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  value: number | null | undefined;
  onChange: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const CurrencyInput = ({ value, onChange, placeholder = "0,00", disabled, className }: CurrencyInputProps) => {
  const [displayValue, setDisplayValue] = useState("");

  useEffect(() => {
    if (value === null || value === undefined) {
      setDisplayValue("");
      return;
    }
    
    const rawDigits = numberToRawDigits(value);
    const { formatted } = formatCurrencyInput(rawDigits);
    setDisplayValue(formatted);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value || "";
    const { formatted, numericValue } = formatCurrencyInput(inputValue);
    setDisplayValue(formatted);
    onChange(numericValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
    }
  };

  return (
    <div className="relative flex items-center">
      <span className="absolute left-3 text-muted-foreground text-sm pointer-events-none select-none">
        R$
      </span>
      <ShadcnInput
        type="text"
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={cn("pl-9", className)}
      />
    </div>
  );
};

export default CurrencyInput;