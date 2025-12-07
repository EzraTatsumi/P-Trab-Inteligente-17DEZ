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
import { Link, Copy, RefreshCw, UserPlus, User, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeError } from "@/lib/errorUtils";
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';

interface SharePTrabDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ptrabId: string;
  initialToken: string;
  ptrabName: string;
  ownerId: string;
  sharedWith: string[];
}

export const SharePTrabDialog: React.FC<SharePTrabDialogProps> = ({
  open,
  onOpenChange,
  ptrabId,
  initialToken,
  ptrabName,
  ownerId,
  sharedWith,
}) => {
  const [shareToken, setShareToken] = useState(initialToken);
  const [loading, setLoading] = useState(false);
  const [collaborators, setCollaborators] = useState<string[]>(sharedWith);
  const queryClient = useQueryClient();
  
  const shareLink = `${window.location.origin}/ptrab/share/${shareToken}`;

  useEffect(() => {
    if (open) {
      setShareToken(initialToken);
      setCollaborators(sharedWith);
    }
  }, [open, initialToken, sharedWith]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success("Link de compartilhamento copiado!");
  };

  const handleGenerateNewToken = async () => {
    if (!confirm("Gerar um novo link invalidará o link atual. Deseja continuar?")) return;
    
    setLoading(true);
    try {
      const newToken = crypto.randomUUID();
      
      const { data, error } = await supabase
        .from('p_trab')
        .update({ share_token: newToken, shared_with: [] }) // Reset shared_with on new token
        .eq('id', ptrabId)
        .select('share_token, shared_with')
        .single();

      if (error) throw error;

      setShareToken(data.share_token);
      setCollaborators(data.shared_with);
      queryClient.invalidateQueries({ queryKey: ['ptrabs'] });
      toast.success("Novo link de compartilhamento gerado!");
    } catch (error) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const handleRemoveCollaborator = async (userIdToRemove: string) => {
    if (!confirm("Tem certeza que deseja remover este colaborador? Ele perderá o acesso imediato ao P Trab.")) return;
    
    setLoading(true);
    try {
      const newSharedWith = collaborators.filter(id => id !== userIdToRemove);
      
      const { data, error } = await supabase
        .from('p_trab')
        .update({ shared_with: newSharedWith })
        .eq('id', ptrabId)
        .select('shared_with')
        .single();

      if (error) throw error;

      setCollaborators(data.shared_with);
      queryClient.invalidateQueries({ queryKey: ['ptrabs'] });
      toast.success("Colaborador removido com sucesso.");
    } catch (error) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };
  
  // Placeholder para buscar nomes de colaboradores (em um app real, isso usaria TanStack Query)
  const fetchCollaboratorNames = async (ids: string[]) => {
    if (ids.length === 0) return [];
    
    // Busca o email dos usuários (apenas para demonstração, pois o nome não está no perfil)
    // Em um cenário real, buscaríamos o nome/email do perfil.
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', ids);
        
    if (error) {
        console.error("Erro ao buscar perfis de colaboradores:", error);
        return ids.map(id => ({ id, name: `Usuário ID: ${id.substring(0, 8)}...` }));
    }
    
    return profiles.map(p => ({
        id: p.id,
        name: p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : `Usuário ID: ${p.id.substring(0, 8)}...`
    }));
  };
  
  const { data: collaboratorDetails, isLoading: isLoadingCollaborators } = useQueryClient().getQueryData(['collaboratorDetails', collaborators]) || { data: [], isLoading: false };
  
  useEffect(() => {
    if (open && collaborators.length > 0) {
        // Simula o fetch de detalhes dos colaboradores
        fetchCollaboratorNames(collaborators).then(details => {
            queryClient.setQueryData(['collaboratorDetails', collaborators], { data: details, isLoading: false });
        });
    }
  }, [open, collaborators, queryClient]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Compartilhar P Trab: {ptrabName}
          </DialogTitle>
          <DialogDescription>
            Compartilhe este link para permitir que outros usuários editem o Plano de Trabalho.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          
          {/* Link de Compartilhamento */}
          <div className="space-y-2">
            <Label htmlFor="share-link" className="font-semibold">Link de Colaboração</Label>
            <div className="flex space-x-2">
              <Input
                id="share-link"
                type="text"
                value={shareLink}
                readOnly
                className="flex-1"
              />
              <Button onClick={handleCopy} type="button" size="icon" disabled={loading}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button onClick={handleGenerateNewToken} type="button" size="icon" variant="outline" disabled={loading}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
                Qualquer usuário autenticado com este link pode editar o P Trab.
            </p>
          </div>
          
          {/* Colaboradores Atuais */}
          <div className="space-y-2 pt-4 border-t">
            <Label className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Colaboradores Ativos ({collaborators.length})
            </Label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
                {collaborators.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum colaborador ativo. O proprietário (você) sempre tem acesso.</p>
                ) : (
                    collaborators.map(id => (
                        <div key={id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                            <span className="text-sm font-medium">
                                {isLoadingCollaborators ? "Carregando..." : collaboratorDetails.find((d: any) => d.id === id)?.name || `Usuário ID: ${id.substring(0, 8)}...`}
                            </span>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleRemoveCollaborator(id)}
                                disabled={loading || id === ownerId}
                                className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                title="Remover acesso"
                            >
                                <XCircle className="h-4 w-4" />
                            </Button>
                        </div>
                    ))
                )}
            </div>
          </div>
          
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};