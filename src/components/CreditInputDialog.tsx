import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, TrendingUp, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/formatUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";

interface CreditInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalGND3Cost: number;
  totalGND4Cost: number;
  initialCreditGND3: number;
  initialCreditGND4: number;
  onSave: (gnd3: number, gnd4: number) => void;
}

// Função auxiliar para formatar o número para exibição no input (usando vírgula)
const formatNumberForInput = (num: number): string => {
  if (num === 0) return "";
  // Converte para string, substitui ponto por vírgula
  return num.toFixed(2).replace('.', ',');
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
  // Usamos strings para o estado interno dos inputs para permitir a digitação de vírgulas
  const [inputGND3, setInputGND3] = useState<string>(formatNumberForInput(initialCreditGND3));
  const [inputGND4, setInputGND4] = useState<string>(formatNumberForInput(initialCreditGND4));
  const { handleEnterToNextField } = useFormNavigation();

  // Sincroniza o estado interno com os props iniciais quando o diálogo abre
  useEffect(() => {
    if (open) {
      setInputGND3(formatNumberForInput(initialCreditGND3));
      setInputGND4(formatNumberForInput(initialCreditGND4));
    }
  }, [open, initialCreditGND3, initialCreditGND4]);

  const parseInputToNumber = (input: string): number => {
    // 1. Remove todos os caracteres que não são dígitos, vírgula ou ponto
    let cleaned = input.replace(/[^0-9,.]/g, '');
    
    // 2. Substitui a vírgula por ponto para que parseFloat funcione corretamente
    cleaned = cleaned.replace(',', '.');
    
    // 3. Garante que apenas o último ponto seja mantido (para evitar 1.2.3)
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    
    return parseFloat(cleaned) || 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, setInput: React.Dispatch<React.SetStateAction<string>>) => {
    const rawValue = e.target.value;
    
    // Permite a entrada de vírgula e ponto, mas limita a formatação
    let cleanedValue = rawValue.replace(/[^0-9,.]/g, '');
    
    // Se o usuário digitar vírgula ou ponto, permite, mas não formata automaticamente
    setInput(cleanedValue);
  };

  const handleSave = () => {
    const finalGND3 = parseInputToNumber(inputGND3);
    const finalGND4 = parseInputToNumber(inputGND4);
    
    onSave(finalGND3, finalGND4);
    onOpenChange(false);
  };

  // Calcula os custos e saldos usando os valores numéricos parseados
  const currentCreditGND3 = parseInputToNumber(inputGND3);
  const currentCreditGND4 = parseInputToNumber(inputGND4);
  
  const saldoGND3 = currentCreditGND3 - totalGND3Cost;
  const saldoGND4 = currentCreditGND4 - totalGND4Cost;

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
            <div className="relative">
              <Input
                id="credit-gnd3"
                type="text"
                inputMode="decimal"
                value={inputGND3}
                onChange={(e) => handleInputChange(e, setInputGND3)}
                placeholder=""
                className="pl-8 text-lg font-bold"
                onKeyDown={handleEnterToNextField}
              />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground font-bold">R$</span>
            </div>
            
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
            <div className="relative">
              <Input
                id="credit-gnd4"
                type="text"
                inputMode="decimal"
                value={inputGND4}
                onChange={(e) => handleInputChange(e, setInputGND4)}
                placeholder=""
                className="pl-8 text-lg font-bold"
                onKeyDown={handleEnterToNextField}
              />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground font-bold">R$</span>
            </div>
            
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Créditos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};