import React, { useState, useCallback, forwardRef, InputHTMLAttributes, Ref } from 'react';
import { Input } from "@/components/ui/input";
import { formatCurrencyInput, numberToRawDigits } from "@/lib/formatUtils";

interface CurrencyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  // Aceita o valor numérico (para exibição inicial)
  value?: number; 
  // Aceita os dígitos brutos (para controle de cursor)
  rawDigits?: string; 
  // Retorna os dígitos brutos no onChange
  onChange: (rawDigits: string) => void;
}

const CurrencyInput = forwardRef(({ value, rawDigits, onChange, ...props }: CurrencyInputProps, ref: Ref<HTMLInputElement>) => {
  
  // Estado interno para gerenciar os dígitos brutos se rawDigits não for fornecido
  const [internalRawDigits, setInternalRawDigits] = useState(() => {
    if (rawDigits !== undefined) return rawDigits;
    return numberToRawDigits(value || 0);
  });
  
  // Se rawDigits for fornecido, usamos ele como fonte de verdade
  const currentRawDigits = rawDigits !== undefined ? rawDigits : internalRawDigits;

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { digits } = formatCurrencyInput(e.target.value);
    
    if (rawDigits === undefined) {
      setInternalRawDigits(digits);
    }
    
    onChange(digits);
  }, [onChange, rawDigits]);

  const displayValue = formatCurrencyInput(currentRawDigits).formatted;

  return (
    <Input
      ref={ref}
      type="text"
      inputMode="numeric"
      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      value={displayValue}
      onChange={handleChange}
      {...props}
    />
  );
});

CurrencyInput.displayName = "CurrencyInput";

export default CurrencyInput;