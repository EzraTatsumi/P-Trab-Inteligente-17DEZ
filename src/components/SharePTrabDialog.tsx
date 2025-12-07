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
import { Share2, Copy, Loader2 } from "lucide-react";
import { toast } from 'sonner';

interface SharePTrabDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ptrabId: string;
  ptrabNumber: string;
  shareToken: string | null;
  onGenerateToken: () => void;
}

const SharePTrabDialog: React.FC<SharePTrabDialogProps> = ({
  open,
  onOpenChange,
  ptrabId,
  ptrabNumber,
  shareToken,
  onGenerateToken,
}) => {
  const [shareLink, setShareLink] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && shareToken) {
      // Assuming the share link format is based on the token
      const baseUrl = window.location.origin;
      // Note: The actual route for sharing/viewing needs to be implemented later
      setShareLink(`${baseUrl}/ptrab/share/${shareToken}`);
    } else if (open && !shareToken) {
      setShareLink('');
    }
  }, [open, shareToken]);

  const handleCopy = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      toast.success("Link de compartilhamento copiado!");
    }
  };
  
  const handleGenerate = async () => {
      setLoading(true);
      try {
          await onGenerateToken();
      } catch (e) {
          // Error handled by parent component
      } finally {
          setLoading(false);
      }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Compartilhar P Trab {ptrabNumber}
          </DialogTitle>
          <DialogDescription>
            Gere um link único para compartilhar este Plano de Trabalho com outros usuários.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {shareToken ? (
            <div className="space-y-2">
              <Label htmlFor="share-link">Link de Compartilhamento</Label>
              <div className="flex space-x-2">
                <Input
                  id="share-link"
                  value={shareLink}
                  readOnly
                  className="truncate"
                />
                <Button type="button" onClick={handleCopy} size="icon" title="Copiar Link">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                O link permite que outros usuários visualizem e editem o P Trab (se permitido).
              </p>
            </div>
          ) : (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">
                Nenhum token de compartilhamento gerado para este P Trab.
              </p>
              <Button 
                onClick={handleGenerate} 
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                    <Share2 className="h-4 w-4 mr-2" />
                )}
                {loading ? "Gerando Token..." : "Gerar Link de Compartilhamento"}
              </Button>
            </div>
          )}
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

export default SharePTrabDialog;