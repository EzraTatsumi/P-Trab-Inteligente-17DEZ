import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useFormNavigation } from "@/hooks/useFormNavigation"; // Importar o hook

interface ExportPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (password: string) => void;
  title: string;
  description: string;
  confirmButtonText?: string; // Novo prop
}

export const ExportPasswordDialog = ({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmButtonText = "Confirmar Exportação", // Valor padrão
}: ExportPasswordDialogProps) => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { handleEnterToNextField } = useFormNavigation(); // Usar o hook

  const handleConfirm = () => {
    if (password.length < 8) {
      toast.error("A senha de segurança deve ter no mínimo 8 caracteres.");
      return;
    }
    onConfirm(password);
    setPassword(""); // Limpa a senha após a confirmação
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && password.length >= 8) {
      e.preventDefault();
      handleConfirm();
    } else {
      // Permite a navegação padrão do formulário para outros campos se houver
      handleEnterToNextField(e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="export-password">Senha de Segurança (Mín. 8 caracteres)</Label>
            <div className="relative">
              <Input
                id="export-password"
                type={showPassword ? "text" : "password"}
                placeholder="Digite a senha para criptografia"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                className="pr-10"
                onKeyDown={handleKeyDown} // Adicionar o handler de keydown
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onMouseDown={() => setShowPassword(true)}
                onMouseUp={() => setShowPassword(false)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleConfirm} disabled={password.length < 8}>
            {confirmButtonText}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};