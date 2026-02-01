import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { useSession } from "@/components/SessionContextProvider";
import { numberToRawDigits, formatCurrencyInput } from "@/lib/formatUtils";
import CurrencyInput from "@/components/CurrencyInput"; // Importar o CurrencyInput

interface CreditInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCreditGND3: number;
  currentCreditGND4: number;
  onSave: () => void;
}

export function CreditInputDialog({ open, onOpenChange, currentCreditGND3, currentCreditGND4, onSave }: CreditInputDialogProps) {
  const { user } = useSession();
  const [loading, setLoading] = useState(false);
  
  // Usando rawDigits para controle preciso do CurrencyInput
  const [rawCreditGND3, setRawCreditGND3] = useState(numberToRawDigits(currentCreditGND3));
  const [rawCreditGND4, setRawCreditGND4] = useState(numberToRawDigits(currentCreditGND4));
  
  const { handleEnterToNextField } = useFormNavigation();

  useEffect(() => {
    if (open) {
      setRawCreditGND3(numberToRawDigits(currentCreditGND3));
      setRawCreditGND4(numberToRawDigits(currentCreditGND4));
    }
  }, [open, currentCreditGND3, currentCreditGND4]);

  const handleSaveCredits = useCallback(async () => {
    if (!user) {
      toast.error("Usuário não autenticado.");
      return;
    }

    setLoading(true);
    
    // Converte rawDigits de volta para valor numérico
    const creditGND3 = formatCurrencyInput(rawCreditGND3).numericValue;
    const creditGND4 = formatCurrencyInput(rawCreditGND4).numericValue;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          credit_gnd3: creditGND3, 
          credit_gnd4: creditGND4 
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success("Créditos atualizados com sucesso!");
      onSave();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar créditos:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  }, [user, rawCreditGND3, rawCreditGND4, onOpenChange, onSave]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Gerenciar Créditos Orçamentários</DialogTitle>
          <DialogDescription>
            Defina os valores de crédito orçamentário disponíveis para o seu perfil.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="credit-gnd3">Crédito GND 3 (R$)</Label>
            <CurrencyInput
              id="credit-gnd3"
              rawDigits={rawCreditGND3}
              onChange={setRawCreditGND3}
              onKeyDown={handleEnterToNextField}
              placeholder="0,00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="credit-gnd4">Crédito GND 4 (R$)</Label>
            <CurrencyInput
              id="credit-gnd4"
              rawDigits={rawCreditGND4}
              onChange={setRawCreditGND4}
              onKeyDown={handleEnterToNextField}
              placeholder="0,00"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSaveCredits} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}