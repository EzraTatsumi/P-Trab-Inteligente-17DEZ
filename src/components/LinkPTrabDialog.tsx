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
import { Link, Loader2 } from "lucide-react";

interface LinkPTrabDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkInput: string;
  onLinkInputChange: (value: string) => void;
  onRequestLink: () => void;
  loading: boolean;
}

const LinkPTrabDialog: React.FC<LinkPTrabDialogProps> = ({
  open,
  onOpenChange,
  linkInput,
  onLinkInputChange,
  onRequestLink,
  loading,
}) => {
  const isLinkValid = linkInput.startsWith(window.location.origin) && linkInput.includes('?id=') && linkInput.includes('&token=');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5 text-primary" />
            Vincular P Trab Compartilhado
          </DialogTitle>
          <DialogDescription>
            Cole o link de compartilhamento fornecido pelo usuário de origem.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="share-link-input">Link de Compartilhamento</Label>
            <Input
              id="share-link-input"
              value={linkInput}
              onChange={(e) => onLinkInputChange(e.target.value)}
              placeholder="Cole o link aqui..."
              disabled={loading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button 
            onClick={onRequestLink} 
            disabled={loading || !isLinkValid}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link className="h-4 w-4 mr-2" />}
            {loading ? "Enviando Solicitação..." : "Confirmar Vinculação"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LinkPTrabDialog;