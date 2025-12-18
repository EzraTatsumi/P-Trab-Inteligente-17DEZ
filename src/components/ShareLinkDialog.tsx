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
import { Copy, Share2, Mail, MessageSquare, Check } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface ShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ptrabName: string;
  shareLink: string;
}

const ShareLinkDialog: React.FC<ShareLinkDialogProps> = ({
  open,
  onOpenChange,
  ptrabName,
  shareLink,
}) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success("Link copiado para a área de transferência!");
  };

  const generateMessage = (service: 'email' | 'whatsapp') => {
    const message = `Olá! Estou compartilhando o Plano de Trabalho "${ptrabName}" com você para colaboração.

Para ter acesso e poder editar, siga estes passos:
1. Copie o link abaixo.
2. No PTrab Inteligente, vá em Configurações (ícone de engrenagem) > Vincular P Trab.
3. Cole o link e envie a solicitação.

Link de Compartilhamento: ${shareLink}

Aguarde minha aprovação para começar a editar.`;

    if (service === 'email') {
      return `mailto:?subject=Compartilhamento do P Trab: ${ptrabName}&body=${encodeURIComponent(message)}`;
    } else if (service === 'whatsapp') {
      return `https://wa.me/?text=${encodeURIComponent(message)}`;
    }
    return '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Compartilhar P Trab: {ptrabName}
          </DialogTitle>
          <DialogDescription>
            Compartilhe este link seguro com o usuário que deseja convidar para colaborar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="share-link">Link de Compartilhamento</Label>
            <div className="flex space-x-2">
              <Input id="share-link" readOnly value={shareLink} className="flex-1" />
              <Button 
                type="button" 
                onClick={handleCopy} 
                size="icon" 
                className="bg-primary hover:bg-primary/90 text-white" // Cor azul escuro padrão
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Alert variant="default" className="bg-gray-50 border-gray-200">
            <Check className="h-4 w-4 text-green-600" />
            <AlertTitle>Instruções Importantes</AlertTitle>
            <AlertDescription>
              O usuário de destino deve usar a opção "Vincular P Trab" no menu de configurações para solicitar acesso.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Enviar via:</Label>
            <div className="flex gap-3">
              <Button asChild className={cn("flex-1 bg-blue-600 hover:bg-blue-700 text-white")}>
                <a href={generateMessage('email')} target="_blank" rel="noopener noreferrer">
                  <Mail className="h-4 w-4 mr-2" /> Email
                </a>
              </Button>
              <Button asChild className={cn("flex-1 bg-green-600 hover:bg-green-700 text-white")}>
                <a href={generateMessage('whatsapp')} target="_blank" rel="noopener noreferrer">
                  <MessageSquare className="h-4 w-4 mr-2" /> WhatsApp
                </a>
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

export default ShareLinkDialog;