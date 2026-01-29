import React, { useCallback, useMemo } from 'react';
import { Input, InputProps } from '@/components/ui/input';
import { formatCurrencyInput } from '@/lib/formatUtils';

interface CurrencyInputProps extends Omit<InputProps, 'value' | 'onChange'> {
  rawDigits: string | null | undefined;
  onChange: (rawDigits: string) => void;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ rawDigits, onChange, ...props }, ref) => {
    
    // Garante que rawDigits é uma string vazia se for null ou undefined
    const safeRawDigits = rawDigits || '';

    const { formatted } = useMemo(() => {
      return formatCurrencyInput(safeRawDigits);
    }, [safeRawDigits]);

    const handleChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const input = event.target.value;
        
        // Remove tudo que não for dígito
        const newDigits = input.replace(/\D/g, '');
        
        // Limita a 15 dígitos para evitar overflow
        if (newDigits.length > 15) {
            return;
        }

        onChange(newDigits);
      },
      [onChange],
    );

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={formatted}
        onChange={handleChange}
        placeholder="0,00"
        className="text-right"
        {...props}
      />
    );
  },
);

CurrencyInput.displayName = 'CurrencyInput';

export default CurrencyInput;