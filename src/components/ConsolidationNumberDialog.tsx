import React, { useState, useEffect } from 'react';
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
import { Copy, AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";
import { isPTrabNumberDuplicate } from "@/lib/ptrabNumberUtils";
import { SimplePTrab } from "@/pages/PTrabManager";

interface ConsolidationNumberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestedNumber: string;
  existingNumbers: string[];
  selectedPTrabs: SimplePTrab[];
  onConfirm: (finalMinutaNumber: string) => void;
  loading: boolean;
}

export const ConsolidationNumberDialog: React.FC<ConsolidationNumberDialogProps> = ({
  open,
  onOpenChange,
  suggestedNumber,
  existingNumbers,
  selectedPTrabs,
  onConfirm,
  loading,
}) => {
  const [customNumber, setCustomNumber] = useState(suggestedNumber);

  useEffect(() => {
    if (open) {
      setCustomNumber(suggestedNumber);
    }
  }, [open, suggestedNumber]);

  const isDuplicate = isPTrabNumberDuplicate(customNumber.trim(), existingNumbers);

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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-primary" />
            Confirmar Consolidação
          </DialogTitle>
          <DialogDescription>
            Os {selectedPTrabs.length} P Trabs selecionados serão consolidados em um novo Plano de Trabalho (Minuta).
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
              disabled={loading}
            />
            {isDuplicate && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Este número já existe. Por favor, altere.
              </p>
            )}
          </div>
          
          <div className="space-y-2 border-t pt-4">
            <Label className="text-sm font-semibold">P Trabs a Consolidar:</Label>
            <ul className="text-xs text-muted-foreground max-h-24 overflow-y-auto border p-2 rounded-md">
              {selectedPTrabs.map(p => (
                <li key={p.id} className="truncate">
                  - {p.numero_ptrab} ({p.nome_operacao})
                </li>
              ))}
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleConfirm} disabled={loading || isDuplicate || !customNumber.trim()}>
            {loading ? "Consolidando..." : "Consolidar P Trab"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};