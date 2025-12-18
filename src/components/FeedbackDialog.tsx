import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Bug, Send, Loader2 } from "lucide-react";
import { useSession } from '@/components/SessionContextProvider';
import { toast } from 'sonner';

interface FeedbackDialogProps {
  onOpenChange: (open: boolean) => void;
}

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({ onOpenChange }) => {
  const { user } = useSession();
  const [feedbackText, setFeedbackText] = useState('');
  const [loading, setLoading] = useState(false);
  
  // O e-mail do administrador deve ser configurado aqui. Usarei um placeholder.
  const ADMIN_EMAIL = "suporte@ptrab.eb.mil.br"; 

  const handleSendFeedback = () => {
    if (!feedbackText.trim()) {
      toast.error("Por favor, descreva o feedback ou a falha.");
      return;
    }
    
    setLoading(true);
    
    const userEmail = user?.email || 'N/A';
    const userId = user?.id || 'N/A';
    const appVersion = "1.0"; // Versão do app (pode ser ajustada se houver um controle de versão mais robusto)
    
    const subject = encodeURIComponent(`[FEEDBACK PTrab] - Reporte de ${userEmail}`);
    
    const body = encodeURIComponent(
      `Tipo de Feedback: Melhoria/Falha\n\n` +
      `Descrição:\n${feedbackText}\n\n` +
      `---\n` +
      `Dados do Usuário (Não Alterar):\n` +
      `User ID: ${userId}\n` +
      `Email: ${userEmail}\n` +
      `App Version: ${appVersion}\n` +
      `URL: ${window.location.href}\n`
    );
    
    const mailtoLink = `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`;
    
    // Abre o cliente de e-mail
    window.location.href = mailtoLink;
    
    // Simula o envio e fecha o diálogo
    setTimeout(() => {
        setLoading(false);
        onOpenChange(false);
        setFeedbackText('');
        toast.success("E-mail de feedback preparado! Por favor, envie-o através do seu cliente de e-mail.");
    }, 500);
  };

  return (
    <Dialog onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-destructive" />
            Reportar Falha ou Sugerir Melhoria
          </DialogTitle>
          <DialogDescription>
            Descreva detalhadamente o problema encontrado ou a melhoria que você sugere.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <Textarea
            placeholder="Ex: O cálculo da Classe III para geradores está incorreto quando o consumo é zero..."
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            rows={6}
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">
            O feedback será enviado por e-mail para o suporte técnico, incluindo seu ID de usuário e a URL atual para rastreabilidade.
          </p>
        </div>
        
        <DialogFooter>
          <Button 
            onClick={handleSendFeedback} 
            disabled={loading || !feedbackText.trim()}
            className="bg-destructive hover:bg-destructive/90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar Feedback
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};