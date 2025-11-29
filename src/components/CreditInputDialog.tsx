import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeError } from "@/lib/errorUtils";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, parseInputToNumber } from "@/lib/formatUtils";

interface CreditInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreditUpdate: () => void;
}

export function CreditInputDialog({ open, onOpenChange, onCreditUpdate }: CreditInputDialogProps) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    // Permite apenas números, vírgulas e pontos
    let cleaned = rawValue.replace(/[^\d,.]/g, '');
    
    // Substitui vírgula por ponto para parseamento
    const numericValue = parseInputToNumber(cleaned);
    
    // Atualiza o estado com a string limpa
    setAmount(cleaned);
  };

  const handleAddCredit = async () => {
    if (!user) {
      toast.error("Usuário não autenticado.");
      return;
    }
    
    const numericAmount = parseInputToNumber(amount);

    if (numericAmount <= 0) {
      toast.error("O valor deve ser positivo.");
      return;
    }

    setLoading(true);
    try {
      // Chamada para a função RPC de adicionar crédito
      const { error } = await supabase.rpc('add_user_credit', {
        p_user_id: user.id,
        p_amount: numericAmount,
      });

      if (error) throw error;

      toast.success(`Crédito de ${formatCurrency(numericAmount)} adicionado com sucesso!`);
      onCreditUpdate();
      onOpenChange(false);
      setAmount("");
    } catch (error) {
      console.error("Erro ao adicionar crédito:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Adicionar Crédito
          </DialogTitle>
          <DialogDescription>
            Insira o valor do crédito a ser adicionado à sua conta.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              id="amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={handleAmountChange}
              placeholder="Ex: 50,00"
              disabled={loading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button 
            onClick={handleAddCredit} 
            disabled={loading || parseInputToNumber(amount) <= 0}
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Adicionando..." : "Confirmar Adição"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}