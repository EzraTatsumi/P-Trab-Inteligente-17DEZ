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
import { Share2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface SharePTrabDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ptrabId: string;
  shareToken: string;
}

export const SharePTrabDialog: React.FC<SharePTrabDialogProps> = ({
  open,
  onOpenChange,
  ptrabId,
  shareToken,
}) => {
  const [copied, setCopied] = useState(false);
  // Gera a URL de compartilhamento usando o token
  const shareUrl = `${window.location.origin}/ptrab/share/${shareToken}`;

  useEffect(() => {
    if (!open) {
      setCopied(false);
    }
  }, [open]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      toast.success("Link de compartilhamento copiado!");
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error("Falha ao copiar o link.");
    });
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
            Compartilhe este link para permitir que outros visualizem (somente leitura) este P Trab.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Label htmlFor="share-link" className="font-semibold">Link de Compartilhamento (Somente Leitura)</Label>
          <div className="flex space-x-2">
            <Input
              id="share-link"
              value={shareUrl}
              readOnly
              className="truncate"
            />
            <Button 
              type="button" 
              onClick={handleCopy} 
              variant="secondary"
              className="shrink-0"
            >
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? "Copiado!" : "Copiar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            O token de compartilhamento é único para este P Trab.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};