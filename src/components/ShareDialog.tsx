import React from 'react';
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
import { Share2, Copy, Check } from "lucide-react";
import { toast } from 'sonner';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ptrabId: string | null;
  shareToken: string | null;
  ptrabName: string | null;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({
  open,
  onOpenChange,
  ptrabId,
  shareToken,
  ptrabName,
}) => {
  const [copied, setCopied] = React.useState(false);

  const shareLink = React.useMemo(() => {
    if (!ptrabId || !shareToken) return "";
    // Gera o link de compartilhamento usando o ID e o token
    // O link deve levar a uma página de visualização pública (que precisará ser implementada futuramente)
    // Por enquanto, usaremos a URL base com os parâmetros.
    return `${window.location.origin}/ptrab/share?id=${ptrabId}&token=${shareToken}`;
  }, [ptrabId, shareToken]);

  const handleCopy = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      setCopied(true);
      toast.success("Link de compartilhamento copiado!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Compartilhar Plano de Trabalho
          </DialogTitle>
          <DialogDescription>
            Compartilhe o P Trab <span className="font-semibold">{ptrabName}</span> com outros usuários.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <Label htmlFor="share-link" className="text-sm font-medium">
            Link de Acesso (Somente Leitura)
          </Label>
          <div className="flex space-x-2">
            <Input
              id="share-link"
              value={shareLink}
              readOnly
              className="flex-1"
            />
            <Button 
              type="button" 
              onClick={handleCopy} 
              disabled={copied || !shareLink}
              variant={copied ? "success" : "outline"}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Este link permite que outros visualizem o P Trab, mas não o editem.
          </p>
        </div>
        
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};