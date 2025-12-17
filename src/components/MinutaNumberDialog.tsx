import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface MinutaNumberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestedNumber: string;
  originalNumber: string;
  existingNumbers: string[];
  onConfirm: (finalMinutaNumber: string) => void;
}

export const MinutaNumberDialog: React.FC<MinutaNumberDialogProps> = ({
  open,
  onOpenChange,
  suggestedNumber,
  originalNumber,
  existingNumbers,
  onConfirm,
}) => {
  const [customNumber, setCustomNumber] = useState(suggestedNumber);

  React.useEffect(() => {
    if (open) {
      setCustomNumber(suggestedNumber);
    }
  }, [open, suggestedNumber]);

  const isDuplicate = existingNumbers.includes(customNumber.trim());

  const handleConfirm = () => {
    const finalNumber = customNumber.trim();
    if (!finalNumber) {
      toast.error("O número da Minuta não pode ser vazio.");
      return;
    }
    if (isDuplicate) {
      toast.error(`O número "${finalNumber}" já existe. Por favor, escolha outro.`);
      return;
    }
    onConfirm(finalNumber);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-primary" />
            Criar Nova Minuta
          </DialogTitle>
          <DialogDescription>
            O P Trab original ({originalNumber}) será importado como uma nova Minuta.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="minuta-number">Número da Minuta Sugerida</Label>
            <Input
              id="minuta-number"
              value={customNumber}
              onChange={(e) => setCustomNumber(e.target.value)}
              placeholder={suggestedNumber}
            />
            {isDuplicate && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Este número já existe. Por favor, altere.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleConfirm} disabled={isDuplicate || !customNumber.trim()}>
            Confirmar Minuta
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};