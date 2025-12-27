import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, Loader2, Check, X, Trash2, AlertTriangle, RefreshCw } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
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
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
  onCancelSharing: (ptrabId: string, userIdToRemove: string, userName: string) => void;
  loading: boolean; // Mantido para desabilitar ações globais
}

const ManageSharingDialog: React.FC<ManageSharingDialogProps> = ({
  open,
  onOpenChange,
  ptrabId,
  ptrabName,
  onApprove,
  onReject,
  onCancelSharing,
  loading: globalLoading,
}) => {
  const [activeSharedUsers, setActiveSharedUsers] = useState<SharedUser[]>([]);
  const [requests, setRequests] = useState<ShareRequest[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [sharedWithIds, setSharedWithIds] = useState<string[]>([]);

  const pendingRequests = useMemo(() => requests.filter(r => r.status === 'pending'), [requests]);

  const formatRequesterName = (profile: ShareRequest['requester_profile']) => {
    if (!profile) return 'Usuário Desconhecido';
    
    // Prioriza last_name (Nome de Guerra), fallback para first_name, fallback final para 'Usuário'
    const name = profile.last_name || profile.first_name || 'Usuário';
    
    // Se o nome for 'Usuário', tenta usar o email do metadata se disponível (apenas para fallback extremo)
    if (name === 'Usuário') {
        const metadata = profile.raw_user_meta_data as { email?: string } | undefined;
        if (metadata?.email) {
            return metadata.email;
        }
    }
    
    // Retorna apenas o nome de guerra/primeiro nome
    return name;
  };
  
  const fetchSharingData = useCallback(async () => {
    if (!ptrabId) return;

    setLoadingLocal(true);
    try {
      // 1. Buscar PTrab para obter a lista de IDs compartilhados
      const { data: ptrabData, error: ptrabError } = await supabase
        .from('p_trab')
        .select('shared_with')
        .eq('id', ptrabId)
        .single();
        
      if (ptrabError || !ptrabData) throw ptrabError || new Error("P Trab não encontrado.");
      
      const currentSharedWith = ptrabData.shared_with || [];
      setSharedWithIds(currentSharedWith);

      // 2. Buscar solicitações (sem nested select de perfil)
      const { data: requestsData, error: requestsError } = await supabase
        .from('ptrab_share_requests')
        .select(`*, requester_id`) // Apenas o ID do solicitante
        .eq('ptrab_id', ptrabId)
        .order('created_at', { ascending: true });
        
      if (requestsError) throw requestsError;
      
      const requesterIds = (requestsData || []).map(r => r.requester_id);
      const allInvolvedIds = Array.from(new Set([...currentSharedWith, ...requesterIds]));
      
      // 3. Buscar perfis de todos os IDs envolvidos (requer a política RLS que criamos)
      let profilesMap: Record<string, ShareRequest['requester_profile']> = {};
      
      if (allInvolvedIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, raw_user_meta_data')
          .in('id', allInvolvedIds);

        if (profilesError) throw profilesError;
        
        (profiles || []).forEach(p => {
            profilesMap[p.id] = p as ShareRequest['requester_profile'];
        });
      }
      
      // 4. Reconstruir a lista de requests com os perfis
      const requestsWithProfiles: ShareRequest[] = (requestsData || []).map(req => ({
          ...req,
          requester_profile: profilesMap[req.requester_id] || null,
      })) as ShareRequest[];
      
      setRequests(requestsWithProfiles);

      // 5. Reconstruir a lista de colaboradores ativos (Simplificado para usar apenas o nome)
      const activeUsers: SharedUser[] = currentSharedWith.map(id => {
          const profile = profilesMap[id];
          
          // Simplificando a extração do nome para corresponder ao formatRequesterName
          const name = profile?.last_name || profile?.first_name || 'Usuário Desconhecido';
          
          // Mantemos os campos om e postoGrad no SharedUser, mas eles não serão exibidos no ManageSharingDialog
          // Apenas para manter a estrutura do tipo SharedUser, mas preenchendo com N/A
          const metadata = profile?.raw_user_meta_data as { posto_graduacao?: string, nome_om?: string } | undefined;
          const postoGrad = metadata?.posto_graduacao || 'N/A';
          const om = metadata?.nome_om || 'N/A';
          
          return {
            id: id,
            name: name,
            om: om,
            postoGrad: postoGrad,
          };
      });
      
      setActiveSharedUsers(activeUsers);

    } catch (e) {
      console.error("Erro ao carregar dados de compartilhamento:", e);
      toast.error("Falha ao carregar solicitações ou colaboradores. Verifique as permissões.");
      setRequests([]);
      setActiveSharedUsers([]);
    } finally {
      setLoadingLocal(false);
    }
  }, [ptrabId]);

  useEffect(() => {
    if (open) {
      fetchSharingData();
    }
  }, [open, fetchSharingData]);
  
  // Funções de ação que recarregam os dados após a conclusão
  const handleApprove = async (requestId: string) => {
    setLoadingLocal(true);
    await onApprove(requestId);
    await fetchSharingData(); // Recarrega os dados após a aprovação
    setLoadingLocal(false);
  };
  
  const handleReject = async (requestId: string) => {
    setLoadingLocal(true);
    await onReject(requestId);
    await fetchSharingData(); // Recarrega os dados após a rejeição
    setLoadingLocal(false);
  };
  
  const handleCancel = async (ptrabId: string, userIdToRemove: string, userName: string) => {
    setLoadingLocal(true);
    await onCancelSharing(ptrabId, userIdToRemove, userName);
    await fetchSharingData(); // Recarrega os dados após o cancelamento
    setLoadingLocal(false);
  };

  const isActionDisabled = globalLoading || loadingLocal;

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
        
        <div className="flex justify-end pt-2">
            <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchSharingData} 
                disabled={isActionDisabled}
            >
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar Dados
            </Button>
        </div>
        
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
              
              {loadingLocal ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Carregando solicitações...</span>
                </div>
              ) : pendingRequests.length === 0 ? (
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
                          onClick={() => handleApprove(req.id)} 
                          disabled={isActionDisabled}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          onClick={() => handleReject(req.id)} 
                          disabled={isActionDisabled}
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
              
              {loadingLocal ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Carregando colaboradores...</span>
                </div>
              ) : activeSharedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum usuário ativo no compartilhamento.</p>
              ) : (
                <div className="space-y-3">
                  {activeSharedUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                      <div className="flex flex-col">
                        {/* Exibe apenas o nome de guerra/primeiro nome */}
                        <span className="text-sm font-medium">{user.name}</span> 
                        <span className="text-xs text-muted-foreground">Colaborador</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        onClick={() => handleCancel(ptrabId, user.id, user.name)} 
                        disabled={isActionDisabled}
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isActionDisabled}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageSharingDialog;