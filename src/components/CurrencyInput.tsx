import React, { useMemo, useCallback } from 'react';
import { Input, InputProps } from "@/components/ui/input";
import { formatCurrencyInput } from "@/lib/formatUtils";
import { cn } from "@/lib/utils";

interface CurrencyInputProps extends Omit<InputProps, 'value' | 'onChange' | 'onBlur'> {
  rawDigits: string;
  onChange: (digits: string) => void;
  placeholder?: string;
  className?: string;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ rawDigits, onChange, placeholder = "0,00", className, ...props }, ref) => {
    
    // Calcula o valor formatado com base na prop rawDigits
    const { formatted } = useMemo(() => formatCurrencyInput(rawDigits), [rawDigits]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      
      // 1. Remove tudo que não for dígito
      const newDigits = rawValue.replace(/\D/g, '');
      
      // 2. Notifica o componente pai com os novos dígitos brutos
      onChange(newDigits);
    }, [onChange]);

    const handleInputBlur = useCallback(() => {
      // Se o input estiver vazio, garante que o estado pai receba uma string vazia
      if (rawDigits.length === 0) {
          onChange('');
      }
    }, [rawDigits, onChange]);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type="text"
          inputMode="decimal"
          value={formatted} // Usa a string formatada para exibição
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

export default CurrencyInput;