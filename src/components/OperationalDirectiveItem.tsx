import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrencyInput, numberToRawDigits } from "@/lib/formatUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";

// Tipo para o item de configuração (copiado de CustosOperacionaisPage)
interface OperationalField {
  key: string;
  label: string;
  type: 'currency' | 'factor';
  placeholder: string;
}

interface OperationalDirectiveItemProps {
  field: OperationalField;
  value: number;
  onCurrencyChange: (field: string, rawValue: string) => void;
  onFactorChange: (field: string, value: string) => void;
}

const OperationalDirectiveItem: React.FC<OperationalDirectiveItemProps> = ({
  field,
  value,
  onCurrencyChange,
  onFactorChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [rawInput, setRawInput] = useState<string>(numberToRawDigits(value));
  const { handleEnterToNextField } = useFormNavigation();

  // Atualiza o rawInput quando o valor externo (value) muda (ex: ao trocar o ano)
  React.useEffect(() => {
    setRawInput(numberToRawDigits(value));
  }, [value]);

  const handleLocalCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { numericValue, digits } = formatCurrencyInput(e.target.value);
    setRawInput(digits);
    onCurrencyChange(field.key, digits); // Chama o handler pai com os dígitos brutos
  };

  const handleLocalFactorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFactorChange(field.key, e.target.value);
  };

  const displayValue = useMemo(() => {
    if (field.type === 'currency') {
      const { formatted } = formatCurrencyInput(rawInput);
      return value === 0 && rawInput.length === 0 ? "" : formatted;
    }
    // Para fatores, exibe o valor numérico diretamente
    return value === 0 ? "" : value;
  }, [field.type, value, rawInput]);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg bg-card text-card-foreground shadow-sm">
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm md:text-base">{field.label}</span>
          </div>
          {isOpen ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t p-4 bg-muted/20">
        <div className="space-y-2">
          <Label htmlFor={field.key}>{field.label}</Label>
          {field.type === 'currency' ? (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
              <Input
                id={field.key}
                type="text"
                inputMode="numeric"
                className="pl-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={displayValue}
                onChange={handleLocalCurrencyChange}
                onKeyDown={handleEnterToNextField}
                placeholder={field.placeholder}
              />
            </div>
          ) : (
            <Input
              id={field.key}
              type="number"
              step="0.01"
              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={displayValue}
              onChange={handleLocalFactorChange}
              placeholder={field.placeholder}
              onKeyDown={handleEnterToNextField}
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default OperationalDirectiveItem;