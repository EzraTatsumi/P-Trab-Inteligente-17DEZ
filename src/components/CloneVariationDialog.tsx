import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, GitBranch } from "lucide-react";
import { useFormNavigation } from "@/hooks/useFormNavigation";

interface CloneVariationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalNumber: string;
  suggestedCloneNumber: string; // Agora será o número de Minuta
  onConfirm: (versionName: string) => void;
}

export const CloneVariationDialog = ({
  open,
  onOpenChange,
  originalNumber,
  suggestedCloneNumber,
  onConfirm,
}: CloneVariationDialogProps) => {
  const [versionName, setVersionName] = useState("");
  const { handleEnterToNextField } = useFormNavigation();

  useEffect(() => {
    if (open) {
      // Resetar para o valor padrão ao abrir
      setVersionName("");
    }
  }, [open]);

  const handleConfirm = () => {
    if (!versionName.trim()) {
      onConfirm("Variação"); // Usa um nome padrão se o usuário não digitar
    } else {
      onConfirm(versionName.trim());
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-secondary" />
            Clonar como Variação
          </DialogTitle>
          <DialogDescription>
            Crie uma nova versão (Minuta) do P Trab original.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <p className="text-sm text-muted-foreground">
            P Trab Original: <span className="font-medium">{originalNumber}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Próximo Número: <span className="font-medium text-primary">{suggestedCloneNumber}</span>
          </p>
          
          <div className="space-y-2">
            <Label htmlFor="version-name">Nome da Versão (Rótulo) *</Label>
            <Input
              id="version-name"
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder="Ex: Variação 1.0"
              required
              onKeyDown={handleEnterToNextField}
            />
            <p className="text-xs text-muted-foreground">
              Este rótulo será exibido na tabela para identificar a variação.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleConfirm} disabled={!versionName.trim()}>
            <Copy className="h-4 w-4 mr-2" />
            Confirmar Clonagem
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};