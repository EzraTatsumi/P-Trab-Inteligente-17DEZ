"use client";

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
import { Link, Copy, Mail, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ptrab: Tables<'p_trab'>;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({
  open,
  onOpenChange,
  ptrab,
}) => {
  const [shareLink, setShareLink] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && ptrab.id && ptrab.share_token) {
      // Gera o link de compartilhamento usando a URL base da aplicação
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/share?ptrabId=${ptrab.id}&token=${ptrab.share_token}`;
      setShareLink(link);
      setLoading(false);
    } else if (!open) {
      setShareLink('');
      setLoading(true);
    }
  }, [open, ptrab]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success("Link de compartilhamento copiado!");
  };

  const generateMessage = (platform: 'email' | 'whatsapp') => {
    const subject = `Compartilhamento de P Trab: ${ptrab.numero_ptrab} - ${ptrab.nome_operacao}`;
    const body = `Olá! Estou compartilhando o Plano de Trabalho "${ptrab.numero_ptrab} - ${ptrab.nome_operacao}" com você para colaboração.

Para obter acesso, por favor, clique no link abaixo. Você será redirecionado para a plataforma PTrab Inteligente, onde poderá solicitar a vinculação.

Link de Acesso: ${shareLink}

Aguardarei sua solicitação de vinculação na plataforma.

Atenciosamente,
[Seu Nome]`;

    if (platform === 'email') {
      return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } else if (platform === 'whatsapp') {
      // O WhatsApp Web/Mobile usa um formato simples de texto
      const whatsappText = `*${subject}*\n\n${body.replace(/\n/g, '%0A')}`;
      return `https://wa.me/?text=${whatsappText}`;
    }
    return '#';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5 text-primary" />
            Compartilhar P Trab
          </DialogTitle>
          <DialogDescription>
            Gere e compartilhe o link de acesso para permitir a colaboração neste Plano de Trabalho.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="share-link">Link de Compartilhamento (Token de Acesso)</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="share-link"
                value={loading ? "Gerando link..." : shareLink}
                readOnly
                disabled={loading}
                className="truncate"
              />
              <Button 
                type="button" 
                size="icon" 
                onClick={handleCopy} 
                disabled={loading}
                aria-label="Copiar Link"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <div className="space-y-2 pt-2">
            <Label>Compartilhar via:</Label>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 gap-2"
                asChild
                disabled={loading}
              >
                <a href={generateMessage('email')} target="_blank" rel="noopener noreferrer">
                  <Mail className="h-4 w-4" />
                  E-mail
                </a>
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 gap-2"
                asChild
                disabled={loading}
              >
                <a href={generateMessage('whatsapp')} target="_blank" rel="noopener noreferrer">
                  <MessageSquare className="h-4 w-4 text-green-500 fill-green-500" />
                  WhatsApp
                </a>
              </Button>
            </div>
          </div>
          
          <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">Instruções:</p>
            <p>O usuário de destino deve clicar no link ou copiá-lo e colá-lo na seção "Vincular P Trab" na plataforma.</p>
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