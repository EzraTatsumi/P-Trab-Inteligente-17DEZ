import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TrendingUp, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, numberToRawDigits, formatCurrencyInput } from "@/lib/formatUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import CurrencyInput from "@/components/CurrencyInput";

interface CreditInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalGND3Cost: number;
  totalGND4Cost: number;
  initialCreditGND3: number;
  initialCreditGND4: number;
  onSave: (gnd3: number, gnd4: number) => void;
}

// Função auxiliar para converter dígitos brutos (string) para número (float)
const rawDigitsToNumber = (rawDigits: string): number => {
    if (!rawDigits) return 0;
    // formatCurrencyInput retorna { numericValue, formatted, digits }
    return formatCurrencyInput(rawDigits).numericValue;
};

export const CreditInputDialog = ({
  open,
  onOpenChange,
  totalGND3Cost,
  totalGND4Cost,
  initialCreditGND3,
  initialCreditGND4,
  onSave,
}: CreditInputDialogProps) => {
  // Estado agora armazena os dígitos brutos (string)
  const [rawCreditGND3, setRawCreditGND3] = useState<string>(numberToRawDigits(initialCreditGND3));
  const [rawCreditGND4, setRawCreditGND4] = useState<string>(numberToRawDigits(initialCreditGND4));
  const { handleEnterToNextField } = useFormNavigation();

  // Sincroniza o estado interno com os props iniciais quando o diálogo abre
  useEffect(() => {
    if (open) {
      setRawCreditGND3(numberToRawDigits(initialCreditGND3));
      setRawCreditGND4(numberToRawDigits(initialCreditGND4));
    }
  }, [open, initialCreditGND3, initialCreditGND4]);

  // Converte os dígitos brutos para valores numéricos para cálculo
  const creditGND3 = rawDigitsToNumber(rawCreditGND3);
  const creditGND4 = rawDigitsToNumber(rawCreditGND4);

  const handleSave = () => {
    // Passa os valores numéricos convertidos para o onSave
    onSave(creditGND3, creditGND4);
    onOpenChange(false);
  };

  // Calcula os custos e saldos usando os valores numéricos convertidos
  const saldoGND3 = creditGND3 - totalGND3Cost;
  const saldoGND4 = creditGND4 - totalGND4Cost;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-accent">
            <TrendingUp className="h-5 w-5" />
            Informar Crédito Disponível
          </DialogTitle>
          <DialogDescription>
            Insira os valores orçamentários disponíveis para GND 3 e GND 4.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          
          {/* GND 3 - Custeio (Logística, Operacional, Aviação) */}
          <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
            <Label htmlFor="credit-gnd3" className="font-semibold text-sm">GND 3 - Custeio</Label>
            <CurrencyInput
              id="credit-gnd3"
              rawDigits={rawCreditGND3}
              onChange={setRawCreditGND3}
              onKeyDown={handleEnterToNextField}
            />
            
            <div className="flex justify-between text-xs pt-1">
              <span className="text-muted-foreground">Custo Calculado:</span>
              <span className="font-medium text-foreground">{formatCurrency(totalGND3Cost)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t pt-2">
              <span className="text-foreground">SALDO:</span>
              <span className={saldoGND3 >= 0 ? "text-green-600" : "text-destructive"}>
                {formatCurrency(saldoGND3)}
              </span>
            </div>
          </div>

          {/* GND 4 - Material Permanente */}
          <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
            <Label htmlFor="credit-gnd4" className="font-semibold text-sm">GND 4 - Investimento (Material Permanente)</Label>
            <CurrencyInput
              id="credit-gnd4"
              rawDigits={rawCreditGND4}
              onChange={setRawCreditGND4}
              onKeyDown={handleEnterToNextField}
            />
            
            <div className="flex justify-between text-xs pt-1">
              <span className="text-muted-foreground">Custo Calculado:</span>
              <span className="font-medium text-foreground">{formatCurrency(totalGND4Cost)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t pt-2">
              <span className="text-foreground">SALDO:</span>
              <span className={saldoGND4 >= 0 ? "text-green-600" : "text-destructive"}>
                {formatCurrency(saldoGND4)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Créditos
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};