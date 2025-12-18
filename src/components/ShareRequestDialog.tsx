"use client";

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
import { Link, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ShareRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (link: string) => void;
  loading: boolean;
}

export const ShareRequestDialog: React.FC<ShareRequestDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  loading,
}) => {
  const [linkInput, setLinkInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    setError(null);
    if (!linkInput.trim()) {
      setError("O link não pode ser vazio.");
      return;
    }
    
    try {
        const url = new URL(linkInput.trim());
        if (!url.searchParams.has('ptrabId') || !url.searchParams.has('token')) {
            setError("O link parece inválido. Certifique-se de que ele contém o ID do P Trab e o token.");
            return;
        }
        onConfirm(linkInput.trim());
    } catch (e) {
        setError("Formato de URL inválido.");
    }
  };
  
  const handleClose = (open: boolean) => {
    if (!open) {
        setLinkInput('');
        setError(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5 text-primary" />
            Vincular P Trab Compartilhado
          </DialogTitle>
          <DialogDescription>
            Cole o link de compartilhamento fornecido pelo proprietário do Plano de Trabalho.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="share-link-input">Link de Compartilhamento</Label>
            <Input
              id="share-link-input"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="Cole o link completo aqui..."
              disabled={loading}
            />
          </div>
          
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm font-medium">
                {error}
              </AlertDescription>
            </Alert>
          )}
          
          <Alert>
            <Link className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Ao confirmar, você enviará uma solicitação de acesso ao proprietário. Você só poderá editar o P Trab após a aprovação dele.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button 
            onClick={handleConfirm} 
            disabled={loading || !linkInput.trim()}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {loading ? "Processando..." : "Confirmar Vinculação"}
          </Button>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={loading}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};