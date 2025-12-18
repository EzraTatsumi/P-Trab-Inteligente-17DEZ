import React, { useState, useMemo } from 'react';
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
import { Link, Copy, Mail, Send, Share2, Check, AlertTriangle, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

// Tipo simplificado do PTrab para o diálogo
interface PTrabShareData {
    id: string;
    numero_ptrab: string;
    nome_operacao: string;
    share_token: string;
    nome_om: string;
}

interface SharePTrabDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ptrab: PTrabShareData | null;
}

export const SharePTrabDialog: React.FC<SharePTrabDialogProps> = ({
  open,
  onOpenChange,
  ptrab,
}) => {
  const [copied, setCopied] = useState(false);

  // 1. Geração do Link de Compartilhamento
  const shareUrl = useMemo(() => {
    if (!ptrab?.share_token) return "";
    // O link de compartilhamento deve levar para a página de processamento do token
    return `${window.location.origin}/share?ptrabId=${ptrab.id}&token=${ptrab.share_token}`;
  }, [ptrab]);
  
  // 2. Geração do Texto de Compartilhamento
  const shareText = useMemo(() => {
    if (!ptrab) return "";
    return `Acesso Colaborativo ao P Trab: ${ptrab.numero_ptrab} - ${ptrab.nome_operacao} (${ptrab.nome_om}). Clique no link para aceitar o convite: ${shareUrl}`;
  }, [ptrab, shareUrl]);

  // 3. Handlers de Ação
  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      toast.success("Link copiado para a área de transferência!");
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error("Falha ao copiar o link.");
    });
  };
  
  const handleEmail = () => {
    const subject = `Convite de Colaboração: P Trab ${ptrab?.numero_ptrab}`;
    const body = shareText;
    // Usar 'window.location.href' para garantir que o link seja aberto na mesma janela/aba
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  
  const handleWhatsApp = () => {
    // Usar 'window.open' para abrir em uma nova aba/janela
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  if (!ptrab) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Compartilhar Plano de Trabalho
          </DialogTitle>
          <DialogDescription>
            Conceda acesso de edição a outros usuários através deste link seguro.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          
          {/* Informações do P Trab */}
          <div className="p-3 bg-muted/50 rounded-lg border">
            <p className="text-sm font-semibold text-foreground">
              {ptrab.numero_ptrab} - {ptrab.nome_operacao}
            </p>
            <p className="text-xs text-muted-foreground">
              OM: {ptrab.nome_om}
            </p>
          </div>
          
          {/* Link Explícito */}
          <div className="space-y-2">
            <Label htmlFor="share-link" className="flex items-center gap-1">
                <Link className="h-4 w-4" />
                Link de Acesso Colaborativo
            </Label>
            <div className="flex space-x-2">
              <Input
                id="share-link"
                value={shareUrl}
                readOnly
                className="flex-1 bg-muted"
              />
              <Button 
                type="button" 
                onClick={handleCopy} 
                variant={copied ? "success" : "outline"}
                className={cn(copied ? "bg-green-600 text-white hover:bg-green-700" : "border-primary text-primary hover:bg-primary/10")}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                O link concede acesso total de edição. Compartilhe com cautela.
            </p>
          </div>
          
          {/* Opções de Envio */}
          <div className="space-y-2 pt-4">
            <Label className="block font-semibold">Enviar por:</Label>
            <div className="grid grid-cols-2 gap-4">
              <Button 
                type="button" 
                onClick={handleEmail} 
                variant="secondary"
                className="gap-2"
              >
                <Mail className="h-4 w-4" />
                E-mail
              </Button>
              <Button 
                type="button" 
                onClick={handleWhatsApp} 
                variant="secondary"
                className="gap-2 bg-green-500 hover:bg-green-600 text-white"
              >
                <MessageSquare className="h-4 w-4" />
                WhatsApp
              </Button>
            </div>
          </div>
          
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