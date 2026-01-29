import React from 'react';
import { Input } from "@/components/ui/input";
import { formatCurrencyInput } from "@/lib/formatUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";

interface CurrencyInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** A string de dígitos brutos (ex: "123456" para R$ 1.234,56). */
  rawDigits: string;
  /** Callback chamado com a nova string de dígitos brutos. */
  onChange: (digits: string) => void;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ rawDigits, onChange, onKeyDown, ...props }, ref) => {
    const { formatted } = formatCurrencyInput(rawDigits);
    const { handleEnterToNextField } = useFormNavigation();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Remove tudo que não for dígito
      const newDigits = e.target.value.replace(/\D/g, '');
      onChange(newDigits);
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleEnterToNextField(e);
        }
        if (onKeyDown) {
            onKeyDown(e);
        }
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        // Exibe o valor formatado, mas usa o rawDigits para controle
        value={formatted}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        {...props}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

export default CurrencyInput;