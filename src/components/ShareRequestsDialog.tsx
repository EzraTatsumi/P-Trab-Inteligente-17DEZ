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
import { Loader2, Check, X, User, FileText, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/pages/PTrabManager'; // Reutilizando formatDateTime

// Tipo de dados consolidado para a solicitação
interface ShareRequestData extends Tables<'ptrab_share_requests'> {
    ptrab: {
        numero_ptrab: string;
        nome_operacao: string;
    };
    requester_profile: {
        first_name: string;
        last_name: string;
        raw_user_meta_data: any;
    };
}

interface ShareRequestsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprovalSuccess: () => void; // Para recarregar a lista de PTrabs
}

export const ShareRequestsDialog: React.FC<ShareRequestsDialogProps> = ({
  open,
  onOpenChange,
  onApprovalSuccess,
}) => {
  const [requests, setRequests] = useState<ShareRequestData[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Buscar solicitações pendentes onde o PTrab pertence ao usuário logado
      const { data: requestsData, error: requestsError } = await supabase
        .from('ptrab_share_requests')
        .select(`
          *,
          ptrab:ptrab_id (numero_ptrab, nome_operacao),
          requester_profile:requester_id (first_name, last_name, raw_user_meta_data)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (requestsError) throw requestsError;
      
      // 2. Filtrar e tipar os dados
      const typedRequests = (requestsData || []).map(req => ({
          ...req,
          ptrab: req.ptrab as { numero_ptrab: string; nome_operacao: string; },
          requester_profile: req.requester_profile as { first_name: string; last_name: string; raw_user_meta_data: any; },
      })) as ShareRequestData[];
      
      setRequests(typedRequests);
      
    } catch (e) {
      console.error("Error fetching share requests:", e);
      toast.error("Erro ao carregar solicitações de compartilhamento.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchRequests();
    }
  }, [open, fetchRequests]);
  
  const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
    setProcessingId(requestId);
    
    try {
        const rpcName = action === 'approve' ? 'approve_ptrab_share' : 'reject_ptrab_share';
        
        const { data: success, error } = await supabase.rpc(rpcName, {
            p_request_id: requestId,
        });
        
        if (error) throw error;
        
        if (success === false) {
            throw new Error("Ação falhou. Verifique se você é o proprietário do P Trab.");
        }
        
        toast.success(`Solicitação ${action === 'approve' ? 'aprovada' : 'rejeitada'} com sucesso!`);
        
        // Se aprovado, notifica o manager para recarregar a lista de PTrabs
        if (action === 'approve') {
            onApprovalSuccess();
        }
        
        // Remove a solicitação da lista local
        setRequests(prev => prev.filter(req => req.id !== requestId));
        
    } catch (e: any) {
        console.error(`Error during ${action}:`, e);
        toast.error(e.message || `Falha ao ${action === 'approve' ? 'aprovar' : 'rejeitar'} solicitação.`);
    } finally {
        setProcessingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Gerenciar Solicitações de Compartilhamento
          </DialogTitle>
          <DialogDescription>
            Aprove ou rejeite pedidos de acesso aos seus Planos de Trabalho.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Carregando solicitações...</span>
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-10">
              <Check className="h-10 w-10 text-green-600 mb-3" />
              <p className="text-lg font-semibold">Nenhuma solicitação pendente.</p>
              <p className="text-sm text-muted-foreground">Seus P Trabs estão seguros.</p>
            </div>
          ) : (
            <ScrollArea className="h-full pr-4">
              <div className="space-y-4">
                {requests.map((req) => {
                  const profile = req.requester_profile;
                  const meta = profile.raw_user_meta_data;
                  const requesterName = `${profile.first_name} ${profile.last_name}`;
                  const isProcessing = processingId === req.id;
                  
                  return (
                    <div key={req.id} className="p-4 border rounded-lg flex items-center justify-between bg-muted/30">
                      <div className="space-y-1 flex-1 min-w-0">
                        {/* Linha 1: Solicitante e PTrab */}
                        <div className="flex items-center gap-3">
                            <User className="h-4 w-4 text-primary" />
                            <span className="font-semibold text-sm truncate">{requesterName}</span>
                            <Badge variant="outline" className="text-xs flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {req.ptrab.numero_ptrab} - {req.ptrab.nome_operacao}
                            </Badge>
                        </div>
                        
                        {/* Linha 2: Detalhes Institucionais */}
                        <div className="text-xs text-muted-foreground pl-7 flex flex-wrap gap-x-4">
                            <span>Posto/Grad: <span className="font-medium text-foreground">{meta?.posto_graduacao || 'N/A'}</span></span>
                            <span>OM: <span className="font-medium text-foreground">{meta?.sigla_om || 'N/A'}</span></span>
                            <span>Função: <span className="font-medium text-foreground">{meta?.funcao_om || 'N/A'}</span></span>
                        </div>
                        
                        {/* Linha 3: Data da Solicitação */}
                        <div className="text-xs text-muted-foreground pl-7 flex items-center gap-1 pt-1">
                            <Clock className="h-3 w-3" />
                            Solicitado em: {formatDateTime(req.created_at)}
                        </div>
                      </div>
                      
                      {/* Ações */}
                      <div className="flex gap-2 shrink-0 ml-4">
                        <Button
                          size="sm"
                          onClick={() => handleAction(req.id, 'approve')}
                          disabled={isProcessing}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {isProcessing && action === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          {isProcessing && action === 'approve' ? 'Aprovando...' : 'Aprovar'}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleAction(req.id, 'reject')}
                          disabled={isProcessing}
                        >
                          {isProcessing && action === 'reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                          {isProcessing && action === 'reject' ? 'Rejeitando...' : 'Rejeitar'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
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