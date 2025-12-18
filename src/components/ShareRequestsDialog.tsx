"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X, Users, AlertTriangle, User, Trash2, Link, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/pages/PTrabManager"; // Reutilizando a função de formatação
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tables } from "@/integrations/supabase/types";

// Tipos para a solicitação de compartilhamento (incluindo dados do solicitante)
interface ShareRequest {
  id: string;
  ptrab_id: string;
  requester_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  created_at: string;
  
  // Dados do Solicitante (JOIN)
  profiles: {
    last_name: string | null;
    raw_user_meta_data: any | null;
  } | null;
  
  // Dados do PTrab (JOIN)
  p_trab: {
    numero_ptrab: string;
    nome_operacao: string;
    nome_om: string;
    shared_with: string[] | null;
  } | null;
}

interface SharedUser {
    id: string;
    name: string;
    om: string;
    shared_since: string; // Data de aprovação (aproximada, ou data de criação do registro 'approved')
}

interface ShareRequestsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ptrabId: string;
  onUpdate: () => void; // Callback para recarregar a lista de PTrabs no Manager
}

export const ShareRequestsDialog: React.FC<ShareRequestsDialogProps> = ({
  open,
  onOpenChange,
  ptrabId,
  onUpdate,
}) => {
  const { user } = useSession();
  const [requests, setRequests] = useState<ShareRequest[]>([]);
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'requests' | 'shared'>('requests');

  const getRequesterName = (profile: ShareRequest['profiles']) => {
    if (!profile) return 'Usuário Desconhecido';
    
    const nomeGuerra = profile.last_name || '';
    const postoGraduacao = (profile.raw_user_meta_data as any)?.posto_graduacao || '';
    
    if (postoGraduacao && nomeGuerra) {
        return `${postoGraduacao} ${nomeGuerra}`;
    }
    return nomeGuerra || 'Usuário Desconhecido';
  };

  const fetchRequestsAndSharedUsers = useCallback(async () => {
    if (!user?.id || !ptrabId) return;
    setLoading(true);
    
    try {
      // 1. Busca todas as solicitações (pendentes e aprovadas)
      const { data: allRequests, error: requestsError } = await supabase
        .from('ptrab_share_requests')
        .select(`
          id, ptrab_id, requester_id, status, created_at,
          profiles (last_name, raw_user_meta_data),
          p_trab (numero_ptrab, nome_operacao, nome_om, shared_with)
        `)
        .eq('ptrab_id', ptrabId)
        .order('created_at', { ascending: true });

      if (requestsError) throw requestsError;
      
      const typedRequests = allRequests as unknown as ShareRequest[];
      
      // 2. Separa solicitações pendentes
      const pendingRequests = typedRequests.filter(r => r.status === 'pending');
      setRequests(pendingRequests);
      
      // 3. Identifica usuários já compartilhados
      const ptrabData = typedRequests.find(r => r.p_trab)?.p_trab;
      const sharedUserIds = ptrabData?.shared_with || [];
      
      // 4. Busca perfis dos usuários compartilhados
      if (sharedUserIds.length > 0) {
          const { data: sharedProfiles, error: profilesError } = await supabase
              .from('profiles')
              .select('id, last_name, raw_user_meta_data');
              
          if (profilesError) throw profilesError;
          
          const sharedUsersList: SharedUser[] = sharedUserIds.map(userId => {
              const profile = sharedProfiles.find(p => p.id === userId);
              const approvedRequest = typedRequests.find(r => r.requester_id === userId && r.status === 'approved');
              
              return {
                  id: userId,
                  name: getRequesterName(profile as any),
                  om: ptrabData?.nome_om || 'OM Desconhecida',
                  shared_since: approvedRequest ? formatDateTime(approvedRequest.created_at) : 'Desconhecida',
              };
          });
          setSharedUsers(sharedUsersList);
      } else {
          setSharedUsers([]);
      }
      
      // Se não houver pendências, muda para a aba de compartilhados
      if (pendingRequests.length === 0) {
          setActiveTab('shared');
      } else {
          setActiveTab('requests');
      }
      
    } catch (e) {
      console.error("Error fetching share data:", e);
      toast.error("Erro ao carregar dados de compartilhamento.");
      setRequests([]);
      setSharedUsers([]);
    } finally {
      setLoading(false);
    }
  }, [user, ptrabId]);

  useEffect(() => {
    if (open) {
      fetchRequestsAndSharedUsers();
    }
  }, [open, fetchRequestsAndSharedUsers]);
  
  const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
    setProcessingId(requestId);
    
    try {
      const rpcFunction = action === 'approve' ? 'approve_ptrab_share' : 'reject_ptrab_share';
      
      const { data: success, error } = await supabase.rpc(rpcFunction, {
        p_request_id: requestId,
      });

      if (error) throw error;
      
      if (success === false) {
          throw new Error(`Falha ao ${action === 'approve' ? 'aprovar' : 'rejeitar'} a solicitação. Verifique se você é o proprietário.`);
      }

      toast.success(`Solicitação ${action === 'approve' ? 'aprovada' : 'rejeitada'} com sucesso!`);
      
      // Recarrega os dados e notifica o Manager
      await fetchRequestsAndSharedUsers();
      onUpdate(); 
      
    } catch (e: any) {
      console.error(`Error during ${action}:`, e);
      toast.error(e.message || `Erro ao ${action === 'approve' ? 'aprovar' : 'rejeitar'} a solicitação.`);
    } finally {
      setProcessingId(null);
    }
  };
  
  // NOVO: Função para remover (cancelar) o compartilhamento (Passo 5)
  const handleRevokeAccess = async (userToRemoveId: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja CANCELAR o compartilhamento com ${userName}? Este usuário perderá o acesso imediatamente.`)) return;
    
    setProcessingId(userToRemoveId);
    
    try {
        const { data: success, error } = await supabase.rpc('remove_user_from_shared_with', {
            p_ptrab_id: ptrabId,
            p_user_to_remove_id: userToRemoveId,
        });
        
        if (error) throw error;
        
        if (success === false) {
            throw new Error("Falha ao cancelar o compartilhamento. Você deve ser o proprietário.");
        }
        
        toast.success(`Compartilhamento com ${userName} cancelado com sucesso.`);
        
        // Recarrega os dados e notifica o Manager
        await fetchRequestsAndSharedUsers();
        onUpdate();
        
    } catch (e: any) {
        console.error("Error revoking access:", e);
        toast.error(e.message || "Erro ao cancelar o compartilhamento.");
    } finally {
        setProcessingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            Gerenciar Compartilhamento
          </DialogTitle>
          <DialogDescription>
            {requests.length > 0 ? (
                `P Trab: ${requests[0].p_trab?.numero_ptrab} - ${requests[0].p_trab?.nome_operacao}`
            ) : sharedUsers.length > 0 ? (
                `P Trab: ${sharedUsers[0].om} - ${sharedUsers[0].name}`
            ) : (
                "Carregando dados do P Trab..."
            )}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'requests' | 'shared')} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="requests" className="flex items-center gap-2">
                    Solicitações Pendentes 
                    {requests.length > 0 && (
                        <Badge className="bg-red-500 text-white hover:bg-red-600">{requests.length}</Badge>
                    )}
                </TabsTrigger>
                <TabsTrigger value="shared" className="flex items-center gap-2">
                    Usuários Compartilhados
                    {sharedUsers.length > 0 && (
                        <Badge variant="secondary">{sharedUsers.length}</Badge>
                    )}
                </TabsTrigger>
            </TabsList>
            
            <TabsContent value="requests" className="flex-1 mt-4 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="ml-2 text-muted-foreground">Carregando solicitações...</span>
                    </div>
                ) : requests.length === 0 ? (
                    <div className="text-center py-10">
                        <Check className="h-10 w-10 mx-auto text-green-500" />
                        <p className="text-lg font-semibold mt-2">Nenhuma solicitação pendente.</p>
                    </div>
                ) : (
                    <ScrollArea className="h-full border rounded-md">
                        <div className="divide-y">
                            {requests.map((request) => (
                            <div key={request.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                                <div className="flex items-start gap-4 text-left">
                                    <User className="h-5 w-5 text-muted-foreground mt-1" />
                                    <div>
                                        <p className="font-semibold text-foreground flex items-center gap-2">
                                            {getRequesterName(request.profiles)}
                                            <Badge variant="outline" className="text-xs">
                                                {request.p_trab?.nome_om || 'OM Desconhecida'}
                                            </Badge>
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Solicitado em: {formatDateTime(request.created_at)}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="flex gap-2 flex-shrink-0">
                                <Button 
                                    size="sm" 
                                    variant="default" 
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => handleAction(request.id, 'approve')}
                                    disabled={processingId === request.id}
                                >
                                    {processingId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                    {processingId === request.id ? "Aprovando..." : "Aprovar"}
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="text-destructive border-destructive hover:bg-destructive/10"
                                    onClick={() => handleAction(request.id, 'reject')}
                                    disabled={processingId === request.id}
                                >
                                    <X className="h-4 w-4" />
                                    Rejeitar
                                </Button>
                                </div>
                            </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </TabsContent>
            
            <TabsContent value="shared" className="flex-1 mt-4 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="ml-2 text-muted-foreground">Carregando usuários compartilhados...</span>
                    </div>
                ) : sharedUsers.length === 0 ? (
                    <div className="text-center py-10">
                        <Link className="h-10 w-10 mx-auto text-muted-foreground" />
                        <p className="text-lg font-semibold mt-2">Nenhum usuário tem acesso colaborativo.</p>
                        <p className="text-sm text-muted-foreground">Compartilhe o link na aba "Ações" para convidar colaboradores.</p>
                    </div>
                ) : (
                    <ScrollArea className="h-full border rounded-md">
                        <div className="divide-y">
                            {sharedUsers.map((sharedUser) => (
                                <div key={sharedUser.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                                    <div className="flex items-start gap-4 text-left">
                                        <User className="h-5 w-5 text-green-600 mt-1" />
                                        <div>
                                            <p className="font-semibold text-foreground flex items-center gap-2">
                                                {sharedUser.name}
                                                <Badge variant="secondary" className="text-xs">
                                                    {sharedUser.om}
                                                </Badge>
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Acesso concedido em: {sharedUser.shared_since}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <Button 
                                        size="sm" 
                                        variant="destructive" 
                                        className="flex gap-2"
                                        onClick={() => handleRevokeAccess(sharedUser.id, sharedUser.name)}
                                        disabled={processingId === sharedUser.id}
                                    >
                                        {processingId === sharedUser.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        {processingId === sharedUser.id ? "Cancelando..." : "Cancelar Acesso"}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </TabsContent>
        </Tabs>

        <DialogFooter>
            <Button 
                variant="outline" 
                onClick={() => {
                    // Se houver solicitações pendentes, força o usuário a voltar para a aba de requests
                    if (requests.length > 0 && activeTab === 'shared') {
                        setActiveTab('requests');
                        toast.warning("Ainda há solicitações pendentes para aprovação.");
                    } else {
                        onOpenChange(false);
                    }
                }}
            >
                Fechar
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};