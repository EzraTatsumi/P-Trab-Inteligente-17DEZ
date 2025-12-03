import React from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle } from "lucide-react";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { PTrab } from "@/hooks/usePTrabManager";

interface PTrabApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ptrabToApprove: PTrab | null;
  suggestedApproveNumber: string;
  setSuggestedApproveNumber: React.Dispatch<React.SetStateAction<string>>;
  onApprove: (newNumber: string) => Promise<void>;
  loading: boolean;
}

export const PTrabApproveDialog: React.FC<PTrabApproveDialogProps> = ({
  open,
  onOpenChange,
  ptrabToApprove,
  suggestedApproveNumber,
  setSuggestedApproveNumber,
  onApprove,
  loading,
}) => {
  const { handleEnterToNextField } = useFormNavigation();
  const currentYear = new Date().getFullYear();

  const handleConfirm = () => {
    onApprove(suggestedApproveNumber);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Aprovar e Numerar P Trab
          </DialogTitle>
          <DialogDescription>
            Atribua o número oficial ao P Trab "{ptrabToApprove?.nome_operacao}".
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); handleConfirm(); }} className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="approve-number">Número Oficial do P Trab *</Label>
            <Input
              id="approve-number"
              value={suggestedApproveNumber}
              onChange={(e) => setSuggestedApproveNumber(e.target.value)}
              placeholder={`Ex: 1/${currentYear}/${ptrabToApprove?.nome_om}`}
              maxLength={50}
              onKeyDown={handleEnterToNextField}
            />
            <p className="text-xs text-muted-foreground">
              Padrão sugerido: Número/Ano/Sigla da OM.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || !suggestedApproveNumber.trim()}>
              {loading ? "Aguarde..." : "Confirmar Aprovação"}
            </Button>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};