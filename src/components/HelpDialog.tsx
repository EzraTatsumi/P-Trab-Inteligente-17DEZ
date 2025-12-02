import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HelpCircle, Shield, Mail, Info } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export const HelpDialog = () => {
  const [open, setOpen] = useState(false);
  
  // Hardcoded version for now
  const appVersion = "v1.0.0-beta"; 

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <HelpCircle className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Shield className="h-5 w-5" />
            Sobre o PTrab Inteligente
          </DialogTitle>
          <DialogDescription>
            Informações sobre a versão atual e suporte.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="flex justify-between items-center">
            <span className="font-medium text-sm">Versão do Sistema</span>
            <Badge variant="secondary" className="text-base font-bold">
              {appVersion}
            </Badge>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground">
                <Info className="h-4 w-4" />
                Desenvolvimento
            </h4>
            <p className="text-sm text-foreground">
                Plataforma desenvolvida pelo Exército Brasileiro em parceria com a TATSUMI.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                Suporte Técnico
            </h4>
            <p className="text-sm text-foreground">
                Para dúvidas ou problemas, entre em contato:
            </p>
            <a 
                href="mailto:suporte@ptrab.eb.mil.br" 
                className="text-primary hover:underline text-sm font-medium block"
            >
                suporte@ptrab.eb.mil.br
            </a>
          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};