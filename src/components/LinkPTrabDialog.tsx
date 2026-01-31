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
import { Link, Loader2, User, FileText, Check, AlertTriangle } from "lucide-react"; // FIX: Import AlertTriangle
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { fetchSharePreview } from '@/integrations/supabase/api'; // Importar a nova função

interface SharePreview {
    ptrabName: string;
    ownerName: string;
}

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
  loading: globalLoading,
}) => {
  const [previewData, setPreviewData] = useState<SharePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Validação mais robusta: tenta criar um objeto URL e verifica a presença dos parâmetros.
  let isLinkValid = false;
  let ptrabId: string | null = null;
  let token: string | null = null;
  
  try {
    const url = new URL(linkInput);
    ptrabId = url.searchParams.get('ptrabId');
    token = url.searchParams.get('token');
    
    // O link é válido se tiver ambos os parâmetros e não estiver vazio
    isLinkValid = !!ptrabId && !!token;
  } catch (e) {
    isLinkValid = false;
  }
  
  // Efeito para buscar a pré-visualização sempre que o link mudar e for válido
  useEffect(() => {
    setPreviewData(null);
    setValidationError(null);
    
    if (open && isLinkValid && ptrabId && token) {
      setPreviewLoading(true);
      fetchSharePreview(ptrabId, token)
        .then(data => {
          setPreviewData(data);
        })
        .catch(e => {
          // O erro já é tratado com toast dentro de fetchSharePreview, 
          // mas definimos um erro local para desabilitar o botão de confirmação.
          setValidationError("Link inválido ou expirado.");
        })
        .finally(() => {
          setPreviewLoading(false);
        });
    }
  }, [open, isLinkValid, ptrabId, token, linkInput]);

  const handleRequest = () => {
    if (previewData) {
        onRequestLink();
    }
  };

  const isLoading = globalLoading || previewLoading;

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
              disabled={isLoading}
            />
          </div>
          
          {/* Pré-visualização */}
          {linkInput.trim() !== '' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Pré-visualização:</Label>
              <div className="p-4 border rounded-lg bg-muted/50">
                {previewLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verificando link...
                  </div>
                ) : validationError ? (
                  <Alert variant="destructive">
                    <AlertDescription className="text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        {validationError}
                    </AlertDescription>
                  </Alert>
                ) : previewData ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-medium">P Trab:</span> {previewData.ptrabName}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-primary" />
                      <span className="font-medium">Proprietário:</span> {previewData.ownerName}
                    </div>
                    <Alert variant="default" className="mt-3 bg-green-50 border-green-200">
                        <Check className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-xs text-green-700">
                            Link válido. Clique em "Confirmar Vinculação" para enviar a solicitação de acesso ao proprietário.
                        </AlertDescription>
                    </Alert>
                  </div>
                ) : (
                    <p className="text-sm text-muted-foreground">Cole um link válido acima.</p>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button 
            onClick={handleRequest} 
            disabled={isLoading || !previewData} // Desabilita se não houver dados de pré-visualização válidos
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link className="h-4 w-4 mr-2" />}
            {isLoading ? "Enviando Solicitação..." : "Confirmar Vinculação"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LinkPTrabDialog;