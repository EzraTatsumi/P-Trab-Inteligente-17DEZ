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

export const CreditInputDialog = ({
  open,
  onOpenChange,
  totalGND3Cost,
  totalGND4Cost,
  initialCreditGND3,
  initialCreditGND4,
  onSave,
}: CreditInputDialogProps) => {
  const [creditGND3, setCreditGND3] = useState<number>(initialCreditGND3);
  const [creditGND4, setCreditGND4] = useState<number>(initialCreditGND4);
  const { handleEnterToNextField } = useFormNavigation();

  // Sincroniza o estado interno com os props iniciais quando o diálogo abre
  useEffect(() => {
    if (open) {
      setCreditGND3(initialCreditGND3);
      setCreditGND4(initialCreditGND4);
    }
  }, [open, initialCreditGND3, initialCreditGND4]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, setCredit: React.Dispatch<React.SetStateAction<number>>) => {
    // Permite apenas números, vírgulas e pontos, e substitui vírgula por ponto para parseFloat
    const value = e.target.value.replace(/[^0-9,.]/g, '').replace(',', '.');
    setCredit(parseFloat(value) || 0);
  };

  const handleSave = () => {
    onSave(creditGND3, creditGND4);
    onOpenChange(false);
  };

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
            <div className="relative">
              <Input
                id="credit-gnd3"
                type="text"
                inputMode="decimal"
                value={creditGND3 === 0 ? "" : creditGND3.toFixed(2).replace('.', ',')}
                onChange={(e) => handleInputChange(e, setCreditGND3)}
                placeholder="0,00"
                className="pl-8 text-lg font-bold"
                onKeyDown={handleEnterToNextField}
              />
              <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                value={creditGND4 === 0 ? "" : creditGND4.toFixed(2).replace('.', ',')}
                onChange={(e) => handleInputChange(e, setCreditGND4)}
                placeholder="0,00"
                className="pl-8 text-lg font-bold"
                onKeyDown={handleEnterToNextField}
              />
              <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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