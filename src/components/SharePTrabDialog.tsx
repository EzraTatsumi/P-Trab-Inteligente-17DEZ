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
import { Share2, Copy, UserPlus, Trash2, Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from './SessionContextProvider';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Collaborator {
  id: string;
  email: string;
  isOwner: boolean;
}

interface SharePTrabDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ptrabId: string;
  shareToken: string;
  ownerId: string;
  sharedWith: string[];
}

// Função para buscar o email de um usuário
const fetchUserEmail = async (userId: string): Promise<string> => {
  const { data, error } = await supabase.from('profiles').select('id').eq('id', userId).single();
  
  // O email não está na tabela profiles, precisamos buscar na auth.users (que não é acessível diretamente via RLS)
  // Como alternativa, vamos usar a função admin para buscar emails, mas como não temos o service_role_key aqui,
  // vamos simular a busca de email ou usar o ID como fallback.
  
  // Para fins de demonstração e RLS, vamos usar o ID como fallback, mas idealmente usaríamos um Edge Function
  // ou um campo de email na tabela profiles.
  
  // Por enquanto, retornamos o ID formatado
  return userId.substring(0, 8);
};

export const SharePTrabDialog: React.FC<SharePTrabDialogProps> = ({
  open,
  onOpenChange,
  ptrabId,
  shareToken,
  ownerId,
  sharedWith,
}) => {
  const { user } = useSession();
  const [loading, setLoading] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [newCollaboratorEmail, setNewCollaboratorEmail] = useState('');
  const [shareLink, setShareLink] = useState('');

  useEffect(() => {
    if (open && ptrabId && shareToken) {
      generateShareLink();
      loadCollaborators();
    }
  }, [open, ptrabId, shareToken, ownerId, sharedWith]);

  const generateShareLink = () => {
    const baseUrl = window.location.origin;
    // O link de compartilhamento aponta para uma rota de aceitação
    setShareLink(`${baseUrl}/ptrab/share?token=${shareToken}`);
  };

  const loadCollaborators = async () => {
    setLoading(true);
    try {
      const allUserIds = [ownerId, ...sharedWith];
      
      // Em um ambiente real, buscaríamos os emails. Aqui, simulamos.
      const fetchedCollaborators: Collaborator[] = allUserIds.map(id => ({
        id,
        email: id === ownerId ? user?.email || id : id.substring(0, 8), // Simulação de email
        isOwner: id === ownerId,
      }));
      
      // Ordenar: Proprietário primeiro, depois colaboradores
      const sortedCollaborators = fetchedCollaborators.sort((a, b) => {
        if (a.isOwner) return -1;
        if (b.isOwner) return 1;
        return a.email.localeCompare(b.email);
      });
      
      setCollaborators(sortedCollaborators);
    } catch (error) {
      console.error("Erro ao carregar colaboradores:", error);
      toast.error("Erro ao carregar lista de colaboradores.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success("Link de compartilhamento copiado!");
  };

  const handleAddCollaborator = async () => {
    if (!newCollaboratorEmail || loading) return;
    
    setLoading(true);
    
    try {
      // 1. Buscar o ID do usuário pelo email (usando Edge Function ou Admin API)
      // Como não temos acesso direto ao email na tabela auth.users, vamos simular
      // que o email é o ID do usuário para fins de teste.
      
      // Em um cenário real, usaríamos uma Edge Function para buscar o ID do usuário
      // com base no email, usando o service_role_key.
      
      // SIMULAÇÃO: Se o email for um ID válido, usamos. Caso contrário, falha.
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', newCollaboratorEmail) // Assumindo que o email está na profiles (o que não é o caso no schema atual, mas é o ideal)
        .maybeSingle();
        
      let collaboratorId: string | null = null;
      
      // Se o email não for encontrado na profiles, tentamos buscar na auth.users (via Edge Function)
      // Como não podemos fazer isso, vamos forçar um erro se não for encontrado.
      
      if (userError || !userData) {
        toast.error("Usuário não encontrado. Certifique-se de que o email está correto e o usuário está cadastrado.");
        setLoading(false);
        return;
      }
      
      collaboratorId = userData.id;
      
      if (collaboratorId === ownerId || sharedWith.includes(collaboratorId)) {
        toast.warning("Este usuário já é proprietário ou colaborador.");
        setLoading(false);
        return;
      }
      
      // 2. Atualizar a lista shared_with no P Trab
      const newSharedWith = [...sharedWith, collaboratorId];
      
      const { error: updateError } = await supabase
        .from('p_trab')
        .update({ shared_with: newSharedWith })
        .eq('id', ptrabId);
        
      if (updateError) throw updateError;
      
      toast.success(`Colaborador adicionado!`);
      setNewCollaboratorEmail('');
      onOpenChange(false); // Fechar para forçar o reload do PTrabManager
      
    } catch (error) {
      console.error("Erro ao adicionar colaborador:", error);
      toast.error("Falha ao adicionar colaborador.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCollaborator = async (collaboratorId: string) => {
    if (loading || collaboratorId === ownerId) return;
    
    setLoading(true);
    
    try {
      const newSharedWith = sharedWith.filter(id => id !== collaboratorId);
      
      const { error: updateError } = await supabase
        .from('p_trab')
        .update({ shared_with: newSharedWith })
        .eq('id', ptrabId);
        
      if (updateError) throw updateError;
      
      toast.success("Colaborador removido.");
      onOpenChange(false); // Fechar para forçar o reload do PTrabManager
      
    } catch (error) {
      console.error("Erro ao remover colaborador:", error);
      toast.error("Falha ao remover colaborador.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Compartilhar Plano de Trabalho
          </DialogTitle>
          <DialogDescription>
            Permita que outros usuários colaborem neste P Trab.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          
          {/* Seção 1: Link de Compartilhamento */}
          <div className="space-y-2">
            <Label htmlFor="share-link">Link de Acesso Colaborativo</Label>
            <div className="flex space-x-2">
              <Input
                id="share-link"
                value={shareLink}
                readOnly
                className="truncate"
              />
              <Button type="button" onClick={handleCopyLink} size="icon" variant="outline">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Alert className="text-xs py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                    Qualquer usuário com este link e uma conta ativa poderá acessar e editar este P Trab.
                </AlertDescription>
            </Alert>
          </div>
          
          {/* Seção 2: Adicionar Colaborador (por Email) */}
          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="collaborator-email" className="flex items-center gap-1">
                <UserPlus className="h-4 w-4" />
                Adicionar Colaborador (por E-mail)
            </Label>
            <div className="flex space-x-2">
              <Input
                id="collaborator-email"
                type="email"
                value={newCollaboratorEmail}
                onChange={(e) => setNewCollaboratorEmail(e.target.value)}
                placeholder="email@colaborador.com"
                disabled={loading}
              />
              <Button type="button" onClick={handleAddCollaborator} disabled={loading || !newCollaboratorEmail}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          {/* Seção 3: Lista de Colaboradores */}
          <div className="space-y-2 border-t pt-4">
            <Label className="block font-semibold">Colaboradores Atuais</Label>
            <div className="space-y-1">
              {collaborators.map((collab) => (
                <div key={collab.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-sm", collab.isOwner ? "font-bold text-primary" : "text-foreground")}>
                      {collab.email}
                    </span>
                    {collab.isOwner && (
                      <Badge variant="secondary" className="text-xs bg-accent/20 text-accent-foreground">
                        Proprietário
                      </Badge>
                    )}
                  </div>
                  {!collab.isOwner && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleRemoveCollaborator(collab.id)}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              {collaborators.length === 0 && !loading && (
                <p className="text-sm text-muted-foreground">Nenhum colaborador adicionado.</p>
              )}
            </div>
          </div>
          
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};