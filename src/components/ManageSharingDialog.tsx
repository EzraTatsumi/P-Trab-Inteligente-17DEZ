import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, Loader2, Check, X, Trash2, AlertTriangle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tables } from '@/integrations/supabase/types';
import { Json } from '@/integrations/supabase/types'; // Importar o tipo Json

// NOVO TIPO: Para gerenciar solicitações
interface ShareRequest extends Tables<'ptrab_share_requests'> {
  requester_profile: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    raw_user_meta_data: Json | null; // Usar o tipo Json
  } | null;
}

interface SharedUser {
    id: string;
    name: string;
    om: string;
    postoGrad: string;
}

interface ManageSharingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ptrabId: string;
  ptrabName: string;
  sharedWith: string[] | null;
  requests: ShareRequest[];
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
  onCancelSharing: (ptrabId: string, userIdToRemove: string, userName: string) => void;
  loading: boolean;
}

const ManageSharingDialog: React.FC<ManageSharingDialogProps> = ({
  open,
  onOpenChange,
  ptrabId,
  ptrabName,
  sharedWith,
  requests,
  onApprove,
  onReject,
  onCancelSharing,
  loading,
}) => {
  const [activeSharedUsers, setActiveSharedUsers] = useState<SharedUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const pendingRequests = useMemo(() => requests.filter(r => r.status === 'pending'), [requests]);
  const activeSharedIds = useMemo(() => new Set(sharedWith || []), [sharedWith]);

  // Função para buscar os perfis dos usuários compartilhados
  const fetchSharedUsers = async () => {
    if (!sharedWith || sharedWith.length === 0) {
      setActiveSharedUsers([]);
      setLoadingUsers(false);
      return;
    }

    setLoadingUsers(true);
    try {
      // A política profiles_select_sharing_related permite que o dono veja os perfis
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, raw_user_meta_data')
        .in('id', sharedWith);

      if (error) throw error;

      const users: SharedUser[] = (profiles || []).map(p => {
        // Acessar raw_user_meta_data como objeto
        const metadata = p.raw_user_meta_data as { posto_graduacao?: string, nome_om?: string } | undefined;
        const name = p.last_name || p.first_name || 'Usuário Desconhecido';
        const postoGrad = metadata?.posto_graduacao || '';
        const om = metadata?.nome_om || 'OM Desconhecida';
        
        return {
          id: p.id,
          name: name,
          om: om,
          postoGrad: postoGrad,
        };
      });
      
      setActiveSharedUsers(users);

    } catch (e) {
      console.error("Erro ao carregar usuários compartilhados:", e);
      toast.error("Erro ao carregar lista de colaboradores.");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchSharedUsers();
    }
  }, [open, sharedWith]);

  const formatRequesterName = (profile: ShareRequest['requester_profile']) => {
    if (!profile) return 'Usuário Desconhecido';
    
    // Acessar raw_user_meta_data como objeto
    const metadata = profile.raw_user_meta_data as { posto_graduacao?: string, nome_om?: string } | undefined;
    const name = profile.last_name || profile.first_name || 'Usuário';
    const postoGrad = metadata?.posto_graduacao || '';
    const om = metadata?.nome_om || '';
    
    // Se o nome for 'Usuário' e não houver posto/graduação, tenta usar o email do metadata se disponível
    if (name === 'Usuário' && !postoGrad && metadata?.email) {
        return metadata.email;
    }
    
    return `${postoGrad} ${name} (${om})`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            Gerenciar Compartilhamento
          </DialogTitle>
          <DialogDescription>
            P Trab: <span className="font-medium text-foreground">{ptrabName}</span>
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 py-4 pr-4">
          <div className="space-y-6">
            
            {/* Seção de Solicitações Pendentes */}
            <div className="space-y-3">
              <h3 className="text-base font-semibold flex items-center gap-2">
                Solicitações Pendentes 
                <Badge variant="destructive" className="ml-1">
                    {pendingRequests.length}
                </Badge>
              </h3>
              
              {pendingRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map((req) => (
                    <div key={req.id} className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50/50">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{formatRequesterName(req.requester_profile)}</span>
                        <span className="text-xs text-muted-foreground">Solicitado em: {new Date(req.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="default" 
                          onClick={() => onApprove(req.id)} 
                          disabled={loading}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          onClick={() => onReject(req.id)} 
                          disabled={loading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <Separator />
            
            {/* Seção de Usuários Ativos */}
            <div className="space-y-3">
              <h3 className="text-base font-semibold flex items-center gap-2">
                Colaboradores Ativos 
                <Badge variant="secondary" className="ml-1 bg-indigo-100 text-indigo-700 border-indigo-300">
                    {activeSharedUsers.length}
                </Badge>
              </h3>
              
              {loadingUsers ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : activeSharedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum usuário ativo no compartilhamento.</p>
              ) : (
                <div className="space-y-3">
                  {activeSharedUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{user.postoGrad} {user.name}</span>
                        <span className="text-xs text-muted-foreground">{user.om}</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        onClick={() => onCancelSharing(ptrabId, user.id, `${user.postoGrad} ${user.name}`)} 
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remover
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageSharingDialog;