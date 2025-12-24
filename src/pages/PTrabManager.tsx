import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { useSession } from "@/components/SessionContextProvider";
import { useQueryClient } from "@tanstack/react-query";
import { generateUniqueMinutaNumber, generateVariationPTrabNumber, generateApprovalPTrabNumber, isPTrabNumberDuplicate } from "@/lib/ptrabNumberUtils";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { formatCurrency, formatDateDDMMMAA } from "@/lib/formatUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Pencil, Trash2, Plus, FileText, Loader2, Check, X, Share2, Users, RefreshCw, ArrowLeft, Copy, AlertTriangle, MessageSquare, ClipboardList } from "lucide-react";
import { CloneVariationDialog } from "@/components/CloneVariationDialog";
import ShareLinkDialog from "@/components/ShareLinkDialog";
import ManageSharingDialog from "@/components/ManageSharingDialog";
import UnlinkPTrabDialog from "@/components/UnlinkPTrabDialog";
import LinkPTrabDialog from "@/components/LinkPTrabDialog";
import { sanitizeError } from "@/lib/errorUtils";
import AIChatDrawer from "@/components/AIChatDrawer";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { cn } from "@/lib/utils"; // Importação adicionada
import { Checkbox } from "@/components/ui/checkbox"; // Importação adicionada

// --- DEFINIÇÕES DE TIPOS ---
type PTrab = Tables<'p_trab'>;

export interface SimplePTrab {
  id: string;
  numero_ptrab: string;
  nome_operacao: string;
  status: string;
  origem: string;
  user_id: string;
  shared_with: string[] | null;
  updated_at: string;
}

interface PTrabFormValues extends TablesInsert<'p_trab'> {
  // Campos adicionais para o formulário
  selectedOmId?: string;
}
// --- FIM DEFINIÇÕES DE TIPOS ---


const PTrabManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: loadingSession } = useSession();
  const queryClient = useQueryClient();

  // --- ESTADOS PRINCIPAIS ---
  const [pTrabs, setPTrabs] = useState<SimplePTrab[]>([]);
  const [existingPTrabNumbers, setExistingPTrabNumbers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedOmId, setSelectedOmId] = useState<string | undefined>(undefined);
  const [originalPTrabIdToClone, setOriginalPTrabIdToClone] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [ptrabToDelete, setPTrabToDelete] = useState<SimplePTrab | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [ptrabToApprove, setPTrabToApprove] = useState<SimplePTrab | null>(null);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [ptrabToClone, setPTrabToClone] = useState<SimplePTrab | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [ptrabToShare, setPTrabToShare] = useState<SimplePTrab | null>(null);
  const [showManageSharingDialog, setShowManageSharingDialog] = useState(false);
  const [ptrabToManage, setPTrabToManage] = useState<SimplePTrab | null>(null);
  const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);
  const [ptrabToUnlink, setPTrabToUnlink] = useState<SimplePTrab | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [selectedPTrabs, setSelectedPTrabs] = useState<SimplePTrab[]>([]);
  const [showConsolidationDialog, setShowConsolidationDialog] = useState(false);
  const [consolidationLoading, setConsolidationLoading] = useState(false);
  
  const [formData, setFormData] = useState<PTrabFormValues>({
    numero_ptrab: "",
    comando_militar_area: "",
    nome_om: "",
    nome_om_extenso: "",
    codug_om: "",
    rm_vinculacao: "",
    codug_rm_vinculacao: "",
    nome_operacao: "",
    periodo_inicio: "",
    periodo_fim: "",
    efetivo_empregado: "",
    acoes: "",
    nome_cmt_om: "",
    local_om: "",
    status: "aberto",
    origem: 'original',
    comentario: "",
    rotulo_versao: null,
    user_id: user?.id || "", // Default user_id
    share_token: "", // Default share_token
    shared_with: [], // Default shared_with
  });
  // --- FIM ESTADOS PRINCIPAIS ---

  const { handleEnterToNextField } = useFormNavigation();

  // Função de reset do formulário (usando useCallback para evitar recriação desnecessária)
  const resetForm = useCallback(() => {
    setEditingId(null);
    setSelectedOmId(undefined); // Mantém undefined para novos PTrabs
    setOriginalPTrabIdToClone(null);
    
    const uniqueMinutaNumber = generateUniqueMinutaNumber(existingPTrabNumbers);
    
    setFormData({
      numero_ptrab: uniqueMinutaNumber, 
      comando_militar_area: "",
      nome_om: "",
      nome_om_extenso: "",
      codug_om: "",
      rm_vinculacao: "",
      codug_rm_vinculacao: "",
      nome_operacao: "",
      periodo_inicio: "",
      periodo_fim: "",
      efetivo_empregado: "",
      acoes: "",
      nome_cmt_om: "",
      local_om: "",
      status: "aberto",
      origem: 'original',
      comentario: "",
      rotulo_versao: null,
      user_id: user?.id || "",
      share_token: "",
      shared_with: [],
    });
  }, [existingPTrabNumbers, user?.id]);
  
  // --- FUNÇÃO DE CARREGAMENTO DE DADOS ---
  const loadPTrabs = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Busca PTrabs onde o usuário é o proprietário OU está na lista shared_with
      const { data, error } = await supabase
        .from('p_trab')
        .select('id, numero_ptrab, nome_operacao, status, origem, user_id, shared_with, updated_at')
        .or(`user_id.eq.${user.id},shared_with.cs.{${user.id}}`)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const simplePTrabs = (data || []) as SimplePTrab[];
      setPTrabs(simplePTrabs);
      setExistingPTrabNumbers(simplePTrabs.map(p => p.numero_ptrab));
      
      // Se estiver criando um novo PTrab, atualiza o número de minuta sugerido
      if (!editingId) {
        const uniqueMinutaNumber = generateUniqueMinutaNumber(simplePTrabs.map(p => p.numero_ptrab));
        setFormData(prev => ({ ...prev, numero_ptrab: uniqueMinutaNumber }));
      }

    } catch (error) {
      console.error("Erro ao carregar P Trabs:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  }, [user?.id, editingId]);

  // --- EFEITO DE CARREGAMENTO INICIAL ---
  useEffect(() => {
    if (!loadingSession && user) {
      loadPTrabs();
    } else if (!loadingSession && !user) {
      setLoading(false);
    }
  }, [loadingSession, user, loadPTrabs]);

  // --- FUNÇÃO DE SUBMISSÃO (INSERÇÃO/EDIÇÃO) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      toast.error("Usuário não autenticado.");
      return;
    }

    setLoading(true);
    
    // Validação básica
    if (!formData.nome_om || !formData.nome_operacao || !formData.periodo_inicio || !formData.periodo_fim || !formData.efetivo_empregado) {
      toast.error("Preencha todos os campos obrigatórios.");
      setLoading(false);
      return;
    }
    
    // Validação de duplicidade (apenas se for novo registro ou se o número foi alterado)
    const isDuplicate = isPTrabNumberDuplicate(formData.numero_ptrab, existingPTrabNumbers.filter(n => n !== pTrabs.find(p => p.id === editingId)?.numero_ptrab));
    if (isDuplicate) {
        toast.error(`O número ${formData.numero_ptrab} já existe.`);
        setLoading(false);
        return;
    }

    try {
      const dataToSave: TablesInsert<'p_trab'> | TablesUpdate<'p_trab'> = {
        ...formData,
        user_id: editingId ? formData.user_id : user.id,
        // Garante que o share_token é gerado apenas na inserção se não for edição
        share_token: editingId ? formData.share_token : undefined, 
        // Garante que shared_with é um array vazio na inserção se não for edição
        shared_with: editingId ? formData.shared_with : [],
        // Remove o campo temporário
        selectedOmId: undefined, 
      };

      let result;
      if (editingId) {
        // EDIÇÃO
        const { data, error } = await supabase
          .from('p_trab')
          .update(dataToSave as TablesUpdate<'p_trab'>)
          .eq('id', editingId)
          .select()
          .single();
        if (error) throw error;
        result = data;
        toast.success("P Trab atualizado com sucesso!");
      } else {
        // INSERÇÃO
        const { data, error } = await supabase
          .from('p_trab')
          .insert([dataToSave as TablesInsert<'p_trab'>])
          .select()
          .single();
        if (error) throw error;
        result = data;
        toast.success("P Trab criado com sucesso!");
      }

      setDialogOpen(false);
      resetForm();
      loadPTrabs();
      
      // Redireciona para o formulário de edição do PTrab recém-criado/editado
      navigate(`/ptrab/form?ptrabId=${result.id}`);

    } catch (error: any) {
      console.error("Erro ao salvar P Trab:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  // --- FUNÇÃO DE EDIÇÃO ---
  const handleEdit = (ptrab: PTrab) => {
    setEditingId(ptrab.id);
    
    // NOVO: Força a busca do ID da OM para garantir a exibição correta no OmSelector
    if (ptrab.nome_om && ptrab.codug_om) {
        const lookupOmId = async () => {
            const { data, error } = await supabase
                .from('organizacoes_militares')
                .select('id')
                .eq('nome_om', ptrab.nome_om)
                .eq('codug_om', ptrab.codug_om)
                .maybeSingle();

            if (data && data.id) {
                setSelectedOmId(data.id); // Define o ID para o OmSelector usar a busca robusta
            } else {
                // Se a busca falhar, define como undefined para que o OmSelector use o nome (currentOmName)
                setSelectedOmId(undefined); 
            }
        };
        lookupOmId();
    } else {
        setSelectedOmId(undefined);
    }
    
    setFormData({
      numero_ptrab: ptrab.numero_ptrab,
      comando_militar_area: ptrab.comando_militar_area,
      nome_om: ptrab.nome_om,
      nome_om_extenso: ptrab.nome_om_extenso || "",
      codug_om: ptrab.codug_om || "",
      rm_vinculacao: ptrab.rm_vinculacao || "",
      codug_rm_vinculacao: ptrab.codug_rm_vinculacao || "",
      nome_operacao: ptrab.nome_operacao,
      periodo_inicio: ptrab.periodo_inicio,
      periodo_fim: ptrab.periodo_fim,
      efetivo_empregado: ptrab.efetivo_empregado,
      acoes: ptrab.acoes || "",
      nome_cmt_om: ptrab.nome_cmt_om || "",
      local_om: ptrab.local_om || "",
      status: ptrab.status,
      origem: ptrab.origem,
      comentario: ptrab.comentario || "",
      rotulo_versao: ptrab.rotulo_versao || null,
      user_id: ptrab.user_id,
      share_token: ptrab.share_token,
      shared_with: ptrab.shared_with,
    });
    setDialogOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- FUNÇÃO DE DELEÇÃO ---
  const handleDelete = (ptrab: SimplePTrab) => {
    setPTrabToDelete(ptrab);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!ptrabToDelete) return;
    setLoading(true);
    setShowDeleteDialog(false);
    try {
      const { error } = await supabase
        .from('p_trab')
        .delete()
        .eq('id', ptrabToDelete.id);

      if (error) throw error;

      toast.success(`P Trab ${ptrabToDelete.numero_ptrab} excluído com sucesso!`);
      loadPTrabs();
    } catch (error) {
      console.error("Erro ao excluir P Trab:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
      setPTrabToDelete(null);
    }
  };

  // --- FUNÇÃO DE CLONAGEM ---
  const handleClone = (ptrab: SimplePTrab) => {
    setPTrabToClone(ptrab);
    setShowCloneDialog(true);
  };

  const handleConfirmClone = async (newNumber: string, isVariation: boolean) => {
    if (!ptrabToClone || !user?.id) return;

    setLoading(true);
    setShowCloneDialog(false);

    try {
      // 1. Buscar todos os dados do PTrab original
      const { data: originalPTrab, error: fetchError } = await supabase
        .from('p_trab')
        .select('*')
        .eq('id', ptrabToClone.id)
        .single();

      if (fetchError || !originalPTrab) throw new Error("Falha ao buscar dados originais para clonagem.");

      // 2. Preparar dados para inserção (resetando IDs, tokens, status e user_id)
      const { id, created_at, updated_at, share_token, shared_with, ...restOfPTrab } = originalPTrab;
      
      const newPTrabData: TablesInsert<'p_trab'> = {
        ...restOfPTrab,
        user_id: user.id,
        numero_ptrab: newNumber,
        status: 'aberto', // Clones sempre começam como 'aberto'
        origem: 'clonado',
        rotulo_versao: isVariation ? `Variação de ${ptrabToClone.numero_ptrab}` : null,
        share_token: undefined, // Deixa o DB gerar um novo token
        shared_with: [], // Remove colaboradores
      };

      // 3. Inserir o novo PTrab
      const { data: newPTrab, error: insertError } = await supabase
        .from('p_trab')
        .insert([newPTrabData])
        .select('id')
        .single();

      if (insertError || !newPTrab) throw insertError;

      const newPTrabId = newPTrab.id;
      const originalPTrabId = ptrabToClone.id;

      // 4. Clonar registros relacionados (Classe I, II, III, V, VI, VII, VIII, IX, LPC)
      const tablesToClone = [
        'classe_i_registros', 'classe_ii_registros', 'classe_iii_registros', 
        'classe_v_registros', 'classe_vi_registros', 'classe_vii_registros', 
        'classe_viii_saude_registros', 'classe_viii_remonta_registros', 'classe_ix_registros',
      ];
      
      for (const tableName of tablesToClone) {
        const { data: records, error: recordsError } = await supabase
          .from(tableName as 'classe_i_registros') // Cast para um tipo conhecido
          .select('*')
          .eq('p_trab_id', originalPTrabId);

        if (recordsError) {
          console.error(`Erro ao buscar registros de ${tableName}:`, recordsError);
          continue;
        }

        if (records && records.length > 0) {
          const newRecords = records.map(record => {
            const { id: oldId, created_at: oldCreated, updated_at: oldUpdated, ...restOfRecord } = record;
            return { ...restOfRecord, p_trab_id: newPTrabId };
          });
          
          const { error: insertRecordsError } = await supabase
            .from(tableName as 'classe_i_registros')
            .insert(newRecords as any); // Cast para any para simplificar a inserção
            
          if (insertRecordsError) {
            console.error(`Erro ao inserir registros clonados de ${tableName}:`, insertRecordsError);
          }
        }
      }
      
      // 5. Clonar Referência LPC (se existir)
      const { data: refLPC, error: lpcError } = await supabase
        .from('p_trab_ref_lpc')
        .select('*')
        .eq('p_trab_id', originalPTrabId)
        .maybeSingle();
        
      if (lpcError) console.error("Erro ao buscar LPC para clonagem:", lpcError);
      
      if (refLPC) {
        const { id: oldId, created_at: oldCreated, updated_at: oldUpdated, ...restOfLPC } = refLPC;
        const newLPC = { ...restOfLPC, p_trab_id: newPTrabId };
        await supabase.from('p_trab_ref_lpc').insert([newLPC]);
      }

      toast.success(`P Trab clonado com sucesso! Novo número: ${newNumber}`);
      loadPTrabs();
      navigate(`/ptrab/form?ptrabId=${newPTrabId}`);

    } catch (error) {
      console.error("Erro na clonagem:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
      setPTrabToClone(null);
    }
  };

  // --- FUNÇÃO DE APROVAÇÃO ---
  const handleApprove = (ptrab: SimplePTrab) => {
    setPTrabToApprove(ptrab);
    setShowApproveDialog(true);
  };

  const handleConfirmApprove = async () => {
    if (!ptrabToApprove || !user?.id) return;

    setLoading(true);
    setShowApproveDialog(false);

    try {
      // 1. Buscar dados completos do PTrab para obter nome_om
      const { data: ptrabData, error: fetchError } = await supabase
        .from('p_trab')
        .select('nome_om, codug_om')
        .eq('id', ptrabToApprove.id)
        .single();

      if (fetchError || !ptrabData) throw new Error("Falha ao buscar dados da OM.");
      
      // 2. Gerar o novo número oficial (N/YYYY/OM_SIGLA)
      const omSigla = ptrabData.nome_om.replace(/[^a-zA-Z0-9]/g, ''); // Remove caracteres especiais
      const newOfficialNumber = generateApprovalPTrabNumber(existingPTrabNumbers, omSigla);

      // 3. Atualizar o PTrab com o novo número e status 'aprovado'
      const { error: updateError } = await supabase
        .from('p_trab')
        .update({ 
          numero_ptrab: newOfficialNumber, 
          status: 'aprovado',
          origem: 'original', // Garante que o status de origem é 'original' após aprovação
        })
        .eq('id', ptrabToApprove.id);

      if (updateError) throw updateError;

      toast.success(`P Trab aprovado! Número oficial: ${newOfficialNumber}`);
      loadPTrabs();
    } catch (error) {
      console.error("Erro ao aprovar P Trab:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
      setPTrabToApprove(null);
    }
  };

  // --- FUNÇÃO DE ARQUIVAMENTO/REATIVAÇÃO ---
  const handleToggleArchive = async (ptrab: SimplePTrab) => {
    if (!user?.id || ptrab.user_id !== user.id) {
      toast.error("Apenas o proprietário pode arquivar/reativar.");
      return;
    }
    
    setLoading(true);
    const newStatus = ptrab.status === 'arquivado' 
      ? (ptrab.numero_ptrab.startsWith('Minuta') ? 'aberto' : 'aprovado')
      : 'arquivado';
      
    try {
      const { error } = await supabase
        .from('p_trab')
        .update({ status: newStatus })
        .eq('id', ptrab.id);

      if (error) throw error;

      toast.success(`Status alterado para "${newStatus.toUpperCase()}"!`);
      loadPTrabs();
    } catch (error) {
      console.error("Erro ao alterar status:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  // --- FUNÇÃO DE COMPARTILHAMENTO (GERAR LINK) ---
  const handleShare = async (ptrab: SimplePTrab) => {
    if (ptrab.user_id !== user?.id) {
      toast.error("Apenas o proprietário pode gerar o link de compartilhamento.");
      return;
    }
    
    setLoading(true);
    try {
      let token = ptrab.share_token;
      
      // Se o token não existir, gera um novo (UPDATE)
      if (!token) {
        const { data, error } = await supabase
          .from('p_trab')
          .update({ share_token: undefined }) // Passa undefined para o DB gerar um novo UUID
          .eq('id', ptrab.id)
          .select('share_token')
          .single();
          
        if (error || !data?.share_token) throw error || new Error("Falha ao gerar token.");
        token = data.share_token;
      }
      
      const shareUrl = `${window.location.origin}/share-ptrab?ptrabId=${ptrab.id}&token=${token}`;
      
      setPTrabToShare(ptrab);
      setShareLink(shareUrl);
      setShowShareDialog(true);
      
    } catch (error) {
      console.error("Erro ao gerar link de compartilhamento:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };
  
  // --- FUNÇÃO DE GERENCIAR COMPARTILHAMENTO ---
  const handleManageSharing = (ptrab: SimplePTrab) => {
    if (ptrab.user_id !== user?.id) {
      toast.error("Apenas o proprietário pode gerenciar o compartilhamento.");
      return;
    }
    setPTrabToManage(ptrab);
    setShowManageSharingDialog(true);
  };
  
  // --- FUNÇÕES DE APROVAÇÃO/REJEIÇÃO/CANCELAMENTO (RPC) ---
  const handleApproveRequest = async (requestId: string) => {
    try {
      const { data: success, error } = await supabase.rpc('approve_ptrab_share', { p_request_id: requestId });
      if (error) throw error;
      if (!success) throw new Error("Falha na aprovação. Verifique se você é o proprietário.");
      toast.success("Solicitação aprovada! O colaborador tem acesso.");
    } catch (error) {
      console.error("Erro ao aprovar solicitação:", error);
      toast.error(sanitizeError(error));
    }
  };
  
  const handleRejectRequest = async (requestId: string) => {
    try {
      const { data: success, error } = await supabase.rpc('reject_ptrab_share', { p_request_id: requestId });
      if (error) throw error;
      if (!success) throw new Error("Falha na rejeição. Verifique se você é o proprietário.");
      toast.success("Solicitação rejeitada.");
    } catch (error) {
      console.error("Erro ao rejeitar solicitação:", error);
      toast.error(sanitizeError(error));
    }
  };
  
  const handleCancelSharing = async (ptrabId: string, userIdToRemove: string, userName: string) => {
    try {
      const { data: success, error } = await supabase.rpc('remove_user_from_shared_with', { 
        p_ptrab_id: ptrabId, 
        p_user_to_remove_id: userIdToRemove 
      });
      if (error) throw error;
      if (!success) throw new Error("Falha ao remover acesso. Verifique as permissões.");
      toast.success(`Acesso de ${userName} removido com sucesso.`);
    } catch (error) {
      console.error("Erro ao remover acesso:", error);
      toast.error(sanitizeError(error));
    }
  };
  
  // --- FUNÇÃO DE DESVINCULAR (COLABORADOR) ---
  const handleUnlink = (ptrab: SimplePTrab) => {
    if (ptrab.user_id === user?.id) {
      toast.error("Você é o proprietário. Use a opção 'Excluir' ou 'Gerenciar Compartilhamento'.");
      return;
    }
    setPTrabToUnlink(ptrab);
    setShowUnlinkDialog(true);
  };
  
  const handleConfirmUnlink = async () => {
    if (!ptrabToUnlink || !user?.id) return;
    
    setLoading(true);
    setShowUnlinkDialog(false);
    
    try {
      const { data: success, error } = await supabase.rpc('remove_user_from_shared_with', { 
        p_ptrab_id: ptrabToUnlink.id, 
        p_user_to_remove_id: user.id 
      });
      
      if (error) throw error;
      if (!success) throw new Error("Falha ao desvincular. O P Trab pode não existir mais.");
      
      toast.success(`Você foi desvinculado do P Trab ${ptrabToUnlink.numero_ptrab}.`);
      loadPTrabs();
    } catch (error) {
      console.error("Erro ao desvincular:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
      setPTrabToUnlink(null);
    }
  };
  
  // --- FUNÇÃO DE VINCULAR (COLABORADOR) ---
  const handleRequestLink = async () => {
    if (!user?.id) {
      toast.error("Você precisa estar logado para solicitar acesso.");
      return;
    }
    
    setLoading(true);
    
    try {
      const url = new URL(linkInput);
      const ptrabId = url.searchParams.get('ptrabId');
      const token = url.searchParams.get('token');
      
      if (!ptrabId || !token) {
        throw new Error("Link inválido: ID ou token ausente.");
      }
      
      // Chama a função RPC para registrar a solicitação
      const { data: success, error } = await supabase.rpc('request_ptrab_share', {
        p_ptrab_id: ptrabId,
        p_share_token: token,
        p_user_id: user.id,
      });
      
      if (error) throw error;
      if (!success) throw new Error("Token inválido ou P Trab não encontrado.");
      
      toast.success("Solicitação de acesso enviada com sucesso! Aguarde a aprovação do proprietário.");
      setShowLinkDialog(false);
      setLinkInput("");
      
    } catch (error) {
      console.error("Erro ao solicitar vínculo:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };
  
  // --- FUNÇÃO DE CONSOLIDAÇÃO ---
  const handleConsolidate = () => {
    if (selectedPTrabs.length < 2) {
      toast.error("Selecione pelo menos dois P Trabs para consolidar.");
      return;
    }
    
    // Gera o número de minuta sugerido
    const suggestedNumber = generateUniqueMinutaNumber(existingPTrabNumbers);
    setFormData(prev => ({ ...prev, numero_ptrab: suggestedNumber }));
    
    setShowConsolidationDialog(true);
  };
  
  const handleConfirmConsolidation = async (finalMinutaNumber: string) => {
    if (!user?.id || selectedPTrabs.length < 2) return;
    
    setConsolidationLoading(true);
    setShowConsolidationDialog(false);
    
    try {
      // 1. Criar o novo PTrab (Minuta)
      const firstPTrab = selectedPTrabs[0];
      
      const newPTrabData: TablesInsert<'p_trab'> = {
        user_id: user.id,
        numero_ptrab: finalMinutaNumber,
        nome_operacao: `CONSOLIDAÇÃO - ${firstPTrab.nome_operacao}`,
        periodo_inicio: new Date().toISOString().split('T')[0],
        periodo_fim: new Date().toISOString().split('T')[0],
        efetivo_empregado: '0',
        comando_militar_area: 'CONSOLIDADO',
        nome_om: 'CONSOLIDADO',
        status: 'aberto',
        origem: 'consolidado',
        comentario: `Consolidação dos P Trabs: ${selectedPTrabs.map(p => p.numero_ptrab).join(', ')}`,
        // Campos obrigatórios com valores padrão
        codug_om: '000000',
        rm_vinculacao: 'N/A',
        codug_rm_vinculacao: '000000',
        acoes: 'Consolidação',
        nome_cmt_om: 'N/A',
        local_om: 'N/A',
      };
      
      const { data: newPTrab, error: insertError } = await supabase
        .from('p_trab')
        .insert([newPTrabData])
        .select('id')
        .single();
        
      if (insertError || !newPTrab) throw insertError;
      
      const newPTrabId = newPTrab.id;
      
      // 2. Clonar e consolidar registros
      const tablesToConsolidate = [
        'classe_i_registros', 'classe_ii_registros', 'classe_iii_registros', 
        'classe_v_registros', 'classe_vi_registros', 'classe_vii_registros', 
        'classe_viii_saude_registros', 'classe_viii_remonta_registros', 'classe_ix_registros',
      ];
      
      // NOTA: A consolidação de registros é complexa e requer lógica de agregação.
      // Por enquanto, vamos apenas clonar todos os registros de todas as OMs para o novo PTrab,
      // mantendo a OM original no registro, mas vinculando ao novo PTrab ID.
      
      const originalPTrabIds = selectedPTrabs.map(p => p.id);
      
      for (const tableName of tablesToConsolidate) {
        const { data: records, error: recordsError } = await supabase
          .from(tableName as 'classe_i_registros')
          .select('*')
          .in('p_trab_id', originalPTrabIds);

        if (recordsError) {
          console.error(`Erro ao buscar registros de ${tableName} para consolidação:`, recordsError);
          continue;
        }

        if (records && records.length > 0) {
          const newRecords = records.map(record => {
            const { id: oldId, created_at: oldCreated, updated_at: oldUpdated, ...restOfRecord } = record;
            return { 
              ...restOfRecord, 
              p_trab_id: newPTrabId,
              // Mantém a OM original no registro
            };
          });
          
          const { error: insertRecordsError } = await supabase
            .from(tableName as 'classe_i_registros')
            .insert(newRecords as any);
            
          if (insertRecordsError) {
            console.error(`Erro ao inserir registros consolidados de ${tableName}:`, insertRecordsError);
          }
        }
      }
      
      // 3. Clonar Referência LPC (apenas a primeira encontrada)
      const { data: refLPC, error: lpcError } = await supabase
        .from('p_trab_ref_lpc')
        .select('*')
        .in('p_trab_id', originalPTrabIds)
        .limit(1)
        .maybeSingle();
        
      if (lpcError) console.error("Erro ao buscar LPC para consolidação:", lpcError);
      
      if (refLPC) {
        const { id: oldId, created_at: oldCreated, updated_at: oldUpdated, ...restOfLPC } = refLPC;
        const newLPC = { ...restOfLPC, p_trab_id: newPTrabId };
        await supabase.from('p_trab_ref_lpc').insert([newLPC]);
      }
      
      toast.success(`Consolidação concluída! Novo P Trab: ${finalMinutaNumber}`);
      setSelectedPTrabs([]); // Limpa a seleção
      loadPTrabs();
      navigate(`/ptrab/form?ptrabId=${newPTrabId}`);
      
    } catch (error) {
      console.error("Erro na consolidação:", error);
      toast.error(sanitizeError(error));
    } finally {
      setConsolidationLoading(false);
    }
  };
  
  // --- UI Helpers ---
  const getStatusBadge = (status: string, origem: string) => {
    const isMinuta = status === 'aberto' && origem !== 'original';
    const isShared = origem === 'compartilhado';
    
    if (isShared) {
      return <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-indigo-300">Compartilhado</Badge>;
    }
    
    switch (status) {
      case 'aberto':
        return <Badge variant="outline" className={cn("border-yellow-500 text-yellow-700", isMinuta && "bg-yellow-50")}>Minuta</Badge>;
      case 'em_andamento':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-300">Em Andamento</Badge>;
      case 'aprovado':
        return <Badge className="bg-green-600 hover:bg-green-700 text-white">Aprovado</Badge>;
      case 'arquivado':
        return <Badge variant="secondary" className="bg-gray-200 text-gray-600">Arquivado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const getOwnerBadge = (ptrab: SimplePTrab) => {
    if (ptrab.user_id === user?.id) {
      return <Badge variant="default" className="bg-primary/10 text-primary border-primary/20">Proprietário</Badge>;
    }
    return <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-indigo-300">Colaborador</Badge>;
  };
  
  const handleOMChange = (omData: OMData | undefined) => {
    setSelectedOmId(omData?.id);
    setFormData(prev => ({
      ...prev,
      nome_om: omData?.nome_om || "",
      codug_om: omData?.codug_om || "",
      rm_vinculacao: omData?.rm_vinculacao || "",
      codug_rm_vinculacao: omData?.codug_rm_vinculacao || "",
      comando_militar_area: omData?.rm_vinculacao || "", // Usando RM como CMA (simplificação)
    }));
  };
  
  const handleToggleSelectPTrab = (ptrab: SimplePTrab) => {
    if (selectedPTrabs.some(p => p.id === ptrab.id)) {
      setSelectedPTrabs(prev => prev.filter(p => p.id !== ptrab.id));
    } else {
      setSelectedPTrabs(prev => [...prev, ptrab]);
    }
  };
  
  const handleClearSelection = () => {
    setSelectedPTrabs([]);
  };

  // --- RENDERIZAÇÃO ---
  if (loadingSession || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando Planos de Trabalho...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header e Ações */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold font-display text-foreground">Gerenciamento de Planos de Trabalho</h1>
          <div className="flex items-center gap-3">
            <Button 
              variant="secondary" 
              onClick={() => setShowLinkDialog(true)}
              className="gap-2"
            >
              <LinkPTrabDialog className="h-4 w-4" />
              Vincular P Trab
            </Button>
            <Button 
              onClick={() => { resetForm(); setDialogOpen(true); }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Novo P Trab
            </Button>
            <Button 
              onClick={handleConsolidate}
              disabled={selectedPTrabs.length < 2}
              variant="outline"
              className="gap-2"
            >
              <ClipboardList className="h-4 w-4" />
              Consolidar ({selectedPTrabs.length})
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={loadPTrabs}
              disabled={loading}
            >
              <RefreshCw className={cn("h-5 w-5", loading && "animate-spin")} />
            </Button>
            
            {/* Menu de Configurações */}
            <Select onValueChange={(value) => navigate(value)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Configurações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="/config/profile">Perfil do Usuário</SelectItem>
                <SelectItem value="/config/diretrizes">Diretriz de Custeio</SelectItem>
                <SelectItem value="/config/om">Relação de OM</SelectItem>
                <SelectItem value="/config/ptrab-export-import">Exportar/Importar P Trabs</SelectItem>
                <SelectItem value="/config/visualizacao">Visualização</SelectItem>
                <SelectItem value="/feedback" onClick={() => setShowFeedbackDialog(true)}>Reportar Falha/Sugestão</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Alerta de Seleção para Consolidação */}
        {selectedPTrabs.length > 0 && (
          <Alert variant="default" className="bg-blue-50 border-blue-200">
            <Check className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-700 flex items-center justify-between">
              <span>{selectedPTrabs.length} P Trabs selecionados para consolidação.</span>
              <Button variant="link" size="sm" onClick={handleClearSelection} className="text-blue-700 hover:text-blue-800">
                Limpar Seleção
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Tabela de P Trabs */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[5%]">Sel.</TableHead>
                    <TableHead className="w-[15%]">Número</TableHead>
                    <TableHead className="w-[25%]">Operação</TableHead>
                    <TableHead className="w-[15%]">OM</TableHead>
                    <TableHead className="w-[10%]">Status</TableHead>
                    <TableHead className="w-[10%]">Propriedade</TableHead>
                    <TableHead className="w-[20%] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pTrabs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum Plano de Trabalho encontrado. Clique em "Novo P Trab" para começar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pTrabs.map((ptrab) => {
                      const isOwner = ptrab.user_id === user?.id;
                      const isShared = ptrab.origem === 'compartilhado';
                      const isEditable = ptrab.status !== 'completo' && ptrab.status !== 'arquivado';
                      const isSelected = selectedPTrabs.some(p => p.id === ptrab.id);
                      
                      return (
                        <TableRow key={ptrab.id} className={cn(isSelected && "bg-blue-50/50 hover:bg-blue-100")}>
                          <TableCell>
                            <Checkbox 
                              checked={isSelected}
                              onCheckedChange={() => handleToggleSelectPTrab(ptrab)}
                              disabled={!isOwner || ptrab.status === 'arquivado'}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {ptrab.numero_ptrab}
                            <p className="text-xs text-muted-foreground mt-1">
                              Atz: {formatDateDDMMMAA(ptrab.updated_at)}
                            </p>
                          </TableCell>
                          <TableCell>{ptrab.nome_operacao}</TableCell>
                          <TableCell>{ptrab.nome_om}</TableCell>
                          <TableCell>{getStatusBadge(ptrab.status, ptrab.origem)}</TableCell>
                          <TableCell>{getOwnerBadge(ptrab)}</TableCell>
                          <TableCell className="text-right space-x-2 whitespace-nowrap">
                            
                            {/* Botão Preencher/Visualizar */}
                            <Button 
                              variant={isEditable ? "default" : "secondary"} 
                              size="sm" 
                              onClick={() => navigate(`/ptrab/form?ptrabId=${ptrab.id}`)}
                              className="gap-1"
                            >
                              {isEditable ? <Pencil className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                              {isEditable ? "Preencher" : "Visualizar"}
                            </Button>
                            
                            {/* Botão Relatório */}
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => navigate(`/ptrab/print?ptrabId=${ptrab.id}`)}
                              className="gap-1"
                            >
                              <FileText className="h-4 w-4" />
                              Relatório
                            </Button>
                            
                            {/* Ações Adicionais (Dropdown ou Botões) */}
                            {isOwner && ptrab.status !== 'arquivado' && (
                              <>
                                {/* Aprovar (Minuta ou Em Andamento) */}
                                {(ptrab.status === 'aberto' || ptrab.status === 'em_andamento') && !ptrab.numero_ptrab.startsWith('Minuta') && (
                                  <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    onClick={() => handleApprove(ptrab)}
                                    className="bg-green-100 text-green-700 hover:bg-green-200"
                                  >
                                    <Check className="h-4 w-4" />
                                    Aprovar
                                  </Button>
                                )}
                                
                                {/* Compartilhar */}
                                <Button 
                                  variant="secondary" 
                                  size="sm" 
                                  onClick={() => handleShare(ptrab)}
                                  className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                                >
                                  <Share2 className="h-4 w-4" />
                                  Compartilhar
                                </Button>
                                
                                {/* Gerenciar Compartilhamento */}
                                <Button 
                                  variant="secondary" 
                                  size="sm" 
                                  onClick={() => handleManageSharing(ptrab)}
                                  className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                                >
                                  <Users className="h-4 w-4" />
                                  Gerenciar
                                </Button>
                                
                                {/* Clonar */}
                                <Button 
                                  variant="secondary" 
                                  size="sm" 
                                  onClick={() => handleClone(ptrab)}
                                  className="bg-gray-100 text-gray-700 hover:bg-gray-200"
                                >
                                  <Copy className="h-4 w-4" />
                                  Clonar
                                </Button>
                                
                                {/* Arquivar */}
                                <Button 
                                  variant="secondary" 
                                  size="sm" 
                                  onClick={() => handleToggleArchive(ptrab)}
                                  className="bg-gray-100 text-gray-700 hover:bg-gray-200"
                                >
                                  <X className="h-4 w-4" />
                                  Arquivar
                                </Button>
                                
                                {/* Excluir */}
                                <Button 
                                  variant="destructive" 
                                  size="sm" 
                                  onClick={() => handleDelete(ptrab)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            
                            {/* Ações para Colaborador */}
                            {!isOwner && isShared && (
                              <Button 
                                variant="destructive" 
                                size="sm" 
                                onClick={() => handleUnlink(ptrab)}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Desvincular
                              </Button>
                            )}
                            
                            {/* Ações para Arquivado */}
                            {ptrab.status === 'arquivado' && isOwner && (
                              <Button 
                                variant="secondary" 
                                size="sm" 
                                onClick={() => handleToggleArchive(ptrab)}
                                className="bg-green-100 text-green-700 hover:bg-green-200"
                              >
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Reativar
                              </Button>
                            )}
                            
                            {/* Botão de Edição de Metadados (Sempre disponível para o proprietário, exceto arquivado) */}
                            {isOwner && ptrab.status !== 'arquivado' && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleEdit(ptrab)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Drawer de Chat com IA */}
      <AIChatDrawer />

      {/* Diálogo de Novo/Editar P Trab */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Plano de Trabalho" : "Novo Plano de Trabalho"}</DialogTitle>
            <DialogDescription>
              Preencha os dados básicos do Plano de Trabalho.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="numero_ptrab">Número do P Trab *</Label>
                <Input
                  id="numero_ptrab"
                  value={formData.numero_ptrab}
                  onChange={(e) => setFormData({ ...formData, numero_ptrab: e.target.value })}
                  placeholder={formData.numero_ptrab}
                  required
                  onKeyDown={handleEnterToNextField}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  {formData.numero_ptrab.startsWith('Minuta') ? 'Sugestão de Minuta' : 'Número oficial (N/YYYY/OM_SIGLA)'}
                </p>
              </div>
              
              <div className="space-y-2 col-span-2">
                <Label htmlFor="nome_operacao">Nome da Operação *</Label>
                <Input
                  id="nome_operacao"
                  value={formData.nome_operacao}
                  onChange={(e) => setFormData({ ...formData, nome_operacao: e.target.value })}
                  placeholder="Ex: Operação Marajoara"
                  required
                  onKeyDown={handleEnterToNextField}
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="periodo_inicio">Período Início *</Label>
                <Input
                  id="periodo_inicio"
                  type="date"
                  value={formData.periodo_inicio}
                  onChange={(e) => setFormData({ ...formData, periodo_inicio: e.target.value })}
                  required
                  onKeyDown={handleEnterToNextField}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodo_fim">Período Fim *</Label>
                <Input
                  id="periodo_fim"
                  type="date"
                  value={formData.periodo_fim}
                  onChange={(e) => setFormData({ ...formData, periodo_fim: e.target.value })}
                  required
                  onKeyDown={handleEnterToNextField}
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2 col-span-2">
                <Label htmlFor="om_selector">Organização Militar *</Label>
                <OmSelector
                  selectedOmId={selectedOmId}
                  currentOmName={formData.nome_om}
                  initialOmUg={formData.codug_om}
                  onChange={handleOMChange}
                  placeholder="Selecione a OM detentora do P Trab"
                  disabled={loading}
                />
                {formData.nome_om && (
                  <p className="text-xs text-muted-foreground">
                    UG: {formData.codug_om} | RM: {formData.rm_vinculacao}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="efetivo_empregado">Efetivo Empregado *</Label>
                <Input
                  id="efetivo_empregado"
                  type="number"
                  inputMode="numeric"
                  value={formData.efetivo_empregado}
                  onChange={(e) => setFormData({ ...formData, efetivo_empregado: e.target.value })}
                  placeholder="Ex: 150"
                  required
                  onKeyDown={handleEnterToNextField}
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="nome_cmt_om">Nome Cmt OM</Label>
                <Input
                  id="nome_cmt_om"
                  value={formData.nome_cmt_om || ""}
                  onChange={(e) => setFormData({ ...formData, nome_cmt_om: e.target.value })}
                  placeholder="Ex: Cel Fulano"
                  onKeyDown={handleEnterToNextField}
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2 col-span-2">
                <Label htmlFor="acoes">Ações/Objetivo</Label>
                <Textarea
                  id="acoes"
                  value={formData.acoes || ""}
                  onChange={(e) => setFormData({ ...formData, acoes: e.target.value })}
                  placeholder="Descreva as ações principais..."
                  onKeyDown={handleEnterToNextField}
                  disabled={loading}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || !formData.nome_om}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingId ? "Atualizar P Trab" : "Criar P Trab"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmação de Exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o P Trab <span className="font-bold">{ptrabToDelete?.numero_ptrab}</span>? Esta ação é irreversível e excluirá todos os registros de classes vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              disabled={loading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Diálogo de Aprovação */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="h-5 w-5" />
              Confirmar Aprovação
            </AlertDialogTitle>
            <AlertDialogDescription>
              O P Trab <span className="font-bold">{ptrabToApprove?.numero_ptrab}</span> será aprovado e receberá um número oficial no formato N/YYYY/OM_SIGLA.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmApprove}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Aprovar P Trab
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Diálogo de Clonagem */}
      {ptrabToClone && (
        <CloneVariationDialog
          open={showCloneDialog}
          onOpenChange={setShowCloneDialog}
          ptrab={ptrabToClone}
          existingNumbers={existingPTrabNumbers}
          onConfirm={handleConfirmClone}
        />
      )}
      
      {/* Diálogo de Link de Compartilhamento */}
      {ptrabToShare && (
        <ShareLinkDialog
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
          ptrabName={`${ptrabToShare.numero_ptrab} - ${ptrabToShare.nome_operacao}`}
          shareLink={shareLink}
        />
      )}
      
      {/* Diálogo de Gerenciamento de Compartilhamento */}
      {ptrabToManage && (
        <ManageSharingDialog
          open={showManageSharingDialog}
          onOpenChange={setShowManageSharingDialog}
          ptrabId={ptrabToManage.id}
          ptrabName={`${ptrabToManage.numero_ptrab} - ${ptrabToManage.nome_operacao}`}
          onApprove={handleApproveRequest}
          onReject={handleRejectRequest}
          onCancelSharing={handleCancelSharing}
          loading={loading}
        />
      )}
      
      {/* Diálogo de Desvinculação (Colaborador) */}
      {ptrabToUnlink && (
        <UnlinkPTrabDialog
          open={showUnlinkDialog}
          onOpenChange={setShowUnlinkDialog}
          ptrabName={`${ptrabToUnlink.numero_ptrab} - ${ptrabToUnlink.nome_operacao}`}
          onConfirm={handleConfirmUnlink}
          loading={loading}
        />
      )}
      
      {/* Diálogo de Vincular P Trab (Colaborador) */}
      <LinkPTrabDialog
        open={showLinkDialog}
        onOpenChange={setShowLinkDialog}
        linkInput={linkInput}
        onLinkInputChange={setLinkInput}
        onRequestLink={handleRequestLink}
        loading={loading}
      />
      
      {/* Diálogo de Feedback */}
      <FeedbackDialog
        open={showFeedbackDialog}
        onOpenChange={setShowFeedbackDialog}
      />
      
      {/* Diálogo de Consolidação */}
      {selectedPTrabs.length >= 2 && (
        <ConsolidationNumberDialog
          open={showConsolidationDialog}
          onOpenChange={setShowConsolidationDialog}
          suggestedNumber={formData.numero_ptrab}
          existingNumbers={existingPTrabNumbers}
          selectedPTrabs={selectedPTrabs}
          onConfirm={handleConfirmConsolidation}
          loading={consolidationLoading}
        />
      )}
    </div>
  );
};

export default PTrabManager;