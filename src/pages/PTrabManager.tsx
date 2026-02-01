import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Edit, Trash2, LogOut, FileText, Printer, Settings, PenSquare, MoreVertical, Pencil, Copy, FileSpreadsheet, Download, MessageSquare, ArrowRight, HelpCircle, CheckCircle, GitBranch, Archive, RefreshCw, User, Loader2, Share2, Link, Users, XCircle, ArrowDownUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCurrency } from "@/lib/formatUtils";
import { generateUniquePTrabNumber, generateVariationPTrabNumber, isPTrabNumberDuplicate, generateApprovalPTrabNumber, generateUniqueMinutaNumber } from "@/lib/ptrabNumberUtils";
import PTrabConsolidationDialog from "@/components/PTrabConsolidationDialog";
import { ConsolidationNumberDialog } from "@/components/ConsolidationNumberDialog";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { HelpDialog } from "@/components/HelpDialog";
import { CloneVariationDialog } from "@/components/CloneVariationDialog";
import { updateUserCredits, fetchUserCredits } from "@/lib/creditUtils";
import { cn } from "@/lib/utils";
import { CreditPromptDialog } from "@/components/CreditPromptDialog";
import { useSession } from "@/components/SessionContextProvider";
import AIChatDrawer from "@/components/AIChatDrawer";
import ShareLinkDialog from "@/components/ShareLinkDialog";
import LinkPTrabDialog from "@/components/LinkPTrabDialog";
import ManageSharingDialog from "@/components/ManageSharingDialog";
import UnlinkPTrabDialog from "@/components/UnlinkPTrabDialog";

// Define a base type for PTrab data fetched from DB, including the missing 'origem' field
type PTrabDB = Tables<'p_trab'> & {
  origem: 'original' | 'importado' | 'consolidado';
  rotulo_versao: string | null;
};

export interface SimplePTrab {
  id: string;
  numero_ptrab: string;
  nome_operacao: string;
}

interface PTrab extends PTrabDB {
  totalLogistica?: number;
  totalOperacional?: number;
  totalMaterialPermanente?: number;
  quantidadeRacaoOp?: number;
  quantidadeHorasVoo?: number;
  // NOVO: Propriedades de compartilhamento
  isOwner: boolean;
  isShared: boolean;
  hasPendingRequests: boolean;
}

// NOVO TIPO: Para gerenciar solicitações
interface ShareRequest extends Tables<'ptrab_share_requests'> {
  requester_profile: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    raw_user_meta_data: { posto_graduacao?: string, nome_om?: string } | null;
  } | null;
}

// Tipo de união para as tabelas que podem ser clonadas/consolidadas
type PTrabLinkedTableName =
    'classe_i_registros' | 'classe_ii_registros' | 'classe_iii_registros' | 
    'classe_v_registros' | 'classe_vi_registros' | 'classe_vii_registros' | 
    'classe_viii_saude_registros' | 'classe_viii_remonta_registros' | 
    'classe_ix_registros' | 'p_trab_ref_lpc' | 'passagem_registros' | 
    'diaria_registros' | 'verba_operacional_registros';


// Lista de Comandos Militares de Área (CMA)
const COMANDOS_MILITARES_AREA = [
  "CMNE", "CMSE", "CMS", "CMO", "CML", "CMP", "CMA", "CMN"
];

const PTrabManager = () => {
  const navigate = useNavigate();
  const { user, isLoading: loadingSession } = useSession();
  const queryClient = useQueryClient();
  
  const [ptrabs, setPtrabs] = useState<PTrab[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConsolidationDialogOpen, setIsConsolidationDialogOpen] = useState(false);
  const [isConsolidationNumberDialogOpen, setIsConsolidationNumberDialogOpen] = useState(false);
  const [isCloneVariationDialogOpen, setIsCloneVariationDialogOpen] = useState(false);
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [isShareLinkDialogOpen, setIsShareLinkDialogOpen] = useState(false);
  const [isLinkPTrabDialogOpen, setIsLinkPTrabDialogOpen] = useState(false);
  const [isManageSharingDialogOpen, setIsManageSharingDialogOpen] = useState(false);
  const [isUnlinkPTrabDialogOpen, setIsUnlinkPTrabDialogOpen] = useState(false);
  
  const [currentPTrab, setCurrentPTrab] = useState<Partial<PTrabDB> | null>(null);
  const [ptrabToDelete, setPTrabToDelete] = useState<PTrab | null>(null);
  const [ptrabToClone, setPTrabToClone] = useState<PTrab | null>(null);
  const [ptrabToShare, setPTrabToShare] = useState<PTrab | null>(null);
  const [ptrabToManageSharing, setPTrabToManageSharing] = useState<PTrab | null>(null);
  const [ptrabToUnlink, setPTrabToUnlink] = useState<PTrab | null>(null);
  
  const [selectedPTrabs, setSelectedPTrabs] = useState<PTrab[]>([]);
  const [consolidationType, setConsolidationType] = useState<'consolidado' | 'importado'>('consolidado');
  const [consolidationNumber, setConsolidationNumber] = useState('');
  const [consolidationVersion, setConsolidationVersion] = useState('');
  
  const [sortConfig, setSortConfig] = useState<{ key: keyof PTrab, direction: 'ascending' | 'descending' }>({ key: 'updated_at', direction: 'descending' });
  
  // Estados para o novo PTrab
  const [newPTrabData, setNewPTrabData] = useState<Partial<PTrabDB>>({
    comando_militar_area: COMANDOS_MILITARES_AREA[0],
    nome_om: '',
    nome_operacao: '',
    periodo_inicio: new Date().toISOString().split('T')[0],
    periodo_fim: new Date().toISOString().split('T')[0],
    efetivo_empregado: '0',
    status: 'aberto',
    origem: 'original',
    rotulo_versao: 'V1.0',
  });
  
  // Estados para o chat AI
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [chatPTrabId, setChatPTrabId] = useState<string | null>(null);
  
  // Estados para o prompt de crédito
  const [showCreditPrompt, setShowCreditPrompt] = useState(false);
  const [hasPromptedForCredit, setHasPromptedForCredit] = useState(false);
  
  // Fetch User Credits (TanStack Query)
  const { data: credits, isLoading: isLoadingCredits } = useQuery({
    queryKey: ['userCredits', user?.id],
    queryFn: () => fetchUserCredits(user!.id),
    enabled: !!user?.id,
    initialData: { credit_gnd3: 0, credit_gnd4: 0 },
  });

  const { handleEnterToNextField } = useFormNavigation();

  const fetchPTrabs = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Fetch PTrabs owned by the user OR shared with the user
      const { data: ownedData, error: ownedError } = await supabase
        .from('p_trab')
        .select(`
          *,
          classe_i_registros(id),
          classe_ii_registros(id),
          classe_iii_registros(id),
          classe_v_registros(id),
          classe_vi_registros(id),
          classe_vii_registros(id),
          classe_viii_saude_registros(id),
          classe_viii_remonta_registros(id),
          classe_ix_registros(id),
          passagem_registros(id),
          diaria_registros(id),
          verba_operacional_registros(id)
        `)
        .or(`user_id.eq.${user.id},shared_with.cs.{${user.id}}`)
        .order(sortConfig.key, { ascending: sortConfig.direction === 'ascending' });

      if (ownedError) throw ownedError;
      
      // 2. Fetch pending share requests where the current user is the owner
      const { data: requestsData, error: requestsError } = await supabase
        .from('ptrab_share_requests')
        .select(`
          ptrab_id,
          status,
          p_trab(user_id)
        `)
        .eq('status', 'pending');
        
      if (requestsError) throw requestsError;
      
      const pendingRequestsMap = new Map<string, boolean>();
      requestsData.forEach(req => {
          if (req.p_trab?.user_id === user.id) {
              pendingRequestsMap.set(req.ptrab_id, true);
          }
      });

      const processedPTrabs: PTrab[] = ownedData.map(p => {
        const isOwner = p.user_id === user.id;
        const isShared = p.shared_with?.includes(user.id) ?? false;
        
        return {
          ...p,
          isOwner,
          isShared,
          hasPendingRequests: pendingRequestsMap.has(p.id),
          // Adicionando campos de total (apenas para verificar se há registros)
          totalLogistica: 0, // Placeholder, o cálculo real é feito em PTrabCostSummary
          totalOperacional: 0, // Placeholder
          totalMaterialPermanente: 0, // Placeholder
          quantidadeRacaoOp: 0, // Placeholder
          quantidadeHorasVoo: 0, // Placeholder
        };
      });

      setPtrabs(processedPTrabs);
    } catch (error) {
      console.error("Erro ao carregar P Trabs:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  }, [user, sortConfig]);

  useEffect(() => {
    if (user) {
      fetchPTrabs();
    }
  }, [user, fetchPTrabs]);
  
  // Efeito para exibir o prompt de crédito
  useEffect(() => {
    if (!loadingSession && !loading && !isLoadingCredits && credits && !hasPromptedForCredit) {
      const hasZeroCredits = credits.credit_gnd3 === 0 && credits.credit_gnd4 === 0;
      
      // Verifica se existe pelo menos um PTrab 'aberto' ou 'em_andamento'
      const hasActivePTrab = ptrabs.some(p => p.status === 'aberto' || p.status === 'em_andamento');

      if (hasActivePTrab && hasZeroCredits) {
        setShowCreditPrompt(true);
        setHasPromptedForCredit(true);
      }
    }
  }, [loadingSession, loading, isLoadingCredits, credits, hasPromptedForCredit, ptrabs]);

  const handleCreatePTrab = async () => {
    if (!user) {
      toast.error("Usuário não autenticado.");
      return;
    }

    try {
      setLoading(true);
      
      // 1. Gerar número único
      const numero_ptrab = await generateUniqueMinutaNumber(newPTrabData.nome_om!);

      const dataToInsert: TablesInsert<'p_trab'> = {
        user_id: user.id,
        numero_ptrab: numero_ptrab,
        comando_militar_area: newPTrabData.comando_militar_area!,
        nome_om: newPTrabData.nome_om!,
        nome_om_extenso: newPTrabData.nome_om_extenso || null,
        codug_om: newPTrabData.codug_om || null,
        rm_vinculacao: newPTrabData.rm_vinculacao || null,
        codug_rm_vinculacao: newPTrabData.codug_rm_vinculacao || null,
        nome_operacao: newPTrabData.nome_operacao!,
        periodo_inicio: newPTrabData.periodo_inicio!,
        periodo_fim: newPTrabData.periodo_fim!,
        efetivo_empregado: newPTrabData.efetivo_empregado!,
        acoes: newPTrabData.acoes || null,
        status: 'aberto',
        nome_cmt_om: newPTrabData.nome_cmt_om || null,
        local_om: newPTrabData.local_om || null,
        comentario: newPTrabData.comentario || null,
        origem: 'original',
        rotulo_versao: newPTrabData.rotulo_versao || 'V1.0',
      };

      const { data, error } = await supabase
        .from('p_trab')
        .insert([dataToInsert])
        .select()
        .single();

      if (error) throw error;

      toast.success(`P Trab ${numero_ptrab} criado com sucesso!`);
      setIsDialogOpen(false);
      await fetchPTrabs();
      navigate(`/ptrab/form?ptrabId=${data.id}`);

    } catch (error: any) {
      if (error.code === '23505') {
        toast.error("Já existe um P Trab com este número. Tente novamente.");
      } else {
        toast.error(sanitizeError(error));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePTrab = async () => {
    if (!currentPTrab?.id || !user) return;

    try {
      setLoading(true);
      
      const dataToUpdate: TablesUpdate<'p_trab'> = {
        comando_militar_area: currentPTrab.comando_militar_area!,
        nome_om: currentPTrab.nome_om!,
        nome_om_extenso: currentPTrab.nome_om_extenso || null,
        codug_om: currentPTrab.codug_om || null,
        rm_vinculacao: currentPTrab.rm_vinculacao || null,
        codug_rm_vinculacao: currentPTrab.codug_rm_vinculacao || null,
        nome_operacao: currentPTrab.nome_operacao!,
        periodo_inicio: currentPTrab.periodo_inicio!,
        periodo_fim: currentPTrab.periodo_fim!,
        efetivo_empregado: currentPTrab.efetivo_empregado!,
        acoes: currentPTrab.acoes || null,
        nome_cmt_om: currentPTrab.nome_cmt_om || null,
        local_om: currentPTrab.local_om || null,
        comentario: currentPTrab.comentario || null,
        rotulo_versao: currentPTrab.rotulo_versao || 'V1.0',
      };

      const { error } = await supabase
        .from('p_trab')
        .update(dataToUpdate)
        .eq('id', currentPTrab.id);

      if (error) throw error;

      toast.success(`P Trab ${currentPTrab.numero_ptrab} atualizado!`);
      setIsDialogOpen(false);
      await fetchPTrabs();

    } catch (error) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePTrab = async () => {
    if (!ptrabToDelete) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('p_trab')
        .delete()
        .eq('id', ptrabToDelete.id);

      if (error) throw error;

      toast.success(`P Trab ${ptrabToDelete.numero_ptrab} excluído com sucesso.`);
      setPTrabToDelete(null);
      await fetchPTrabs();
    } catch (error) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const handleClonePTrab = async (newNumeroPTrab: string, newRotuloVersao: string) => {
    if (!ptrabToClone || !user) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase.rpc('clone_ptrab_with_records', {
        old_ptrab_id: ptrabToClone.id,
        new_user_id: user.id,
        new_numero_ptrab: newNumeroPTrab,
        new_rotulo_versao: newRotuloVersao,
      });

      if (error) throw error;

      toast.success(`P Trab clonado com sucesso! Novo número: ${newNumeroPTrab}`);
      setIsCloneVariationDialogOpen(false);
      await fetchPTrabs();
      navigate(`/ptrab/form?ptrabId=${data}`);

    } catch (error) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const handleArchivePTrab = async (ptrab: PTrab) => {
    if (!ptrab.isOwner) {
      toast.error("Apenas o proprietário pode arquivar o P Trab.");
      return;
    }
    
    const newStatus = ptrab.status === 'arquivado' ? 'aberto' : 'arquivado';
    const action = newStatus === 'arquivado' ? 'Arquivar' : 'Desarquivar';
    
    if (!confirm(`Tem certeza que deseja ${action} o P Trab ${ptrab.numero_ptrab}?`)) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('p_trab')
        .update({ status: newStatus })
        .eq('id', ptrab.id);

      if (error) throw error;

      toast.success(`P Trab ${ptrab.numero_ptrab} ${newStatus === 'arquivado' ? 'arquivado' : 'desarquivado'} com sucesso.`);
      await fetchPTrabs();
    } catch (error) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const handleApprovePTrab = async (ptrab: PTrab) => {
    if (!ptrab.isOwner) {
      toast.error("Apenas o proprietário pode aprovar o P Trab.");
      return;
    }
    
    if (ptrab.status === 'completo') {
      toast.warning("Este P Trab já está completo.");
      return;
    }
    
    if (!confirm(`Tem certeza que deseja APROVAR o P Trab ${ptrab.numero_ptrab} e marcá-lo como 'completo'? Esta ação o tornará não editável.`)) return;

    try {
      setLoading(true);
      
      // 1. Gerar o número final de aprovação
      const newNumeroPTrab = generateApprovalPTrabNumber(ptrab.numero_ptrab);
      
      // 2. Atualizar o PTrab
      const { error } = await supabase
        .from('p_trab')
        .update({ 
          status: 'completo',
          numero_ptrab: newNumeroPTrab,
          rotulo_versao: 'APROVADO',
        })
        .eq('id', ptrab.id);

      if (error) throw error;

      toast.success(`P Trab ${newNumeroPTrab} aprovado e marcado como completo!`);
      await fetchPTrabs();
    } catch (error) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditDialog = (ptrab: PTrab) => {
    if (!ptrab.isOwner) {
      toast.error("Você não é o proprietário deste P Trab e não pode editá-lo.");
      return;
    }
    setCurrentPTrab(ptrab);
    setIsDialogOpen(true);
  };
  
  const handleOpenNewDialog = () => {
    setCurrentPTrab(null);
    setNewPTrabData({
      comando_militar_area: COMANDOS_MILITARES_AREA[0],
      nome_om: '',
      nome_operacao: '',
      periodo_inicio: new Date().toISOString().split('T')[0],
      periodo_fim: new Date().toISOString().split('T')[0],
      efetivo_empregado: '0',
      status: 'aberto',
      origem: 'original',
      rotulo_versao: 'V1.0',
    });
    setIsDialogOpen(true);
  };
  
  const handleOpenConsolidationDialog = (type: 'consolidado' | 'importado') => {
    if (selectedPTrabs.length < 2) {
      toast.error("Selecione pelo menos dois P Trabs para consolidar.");
      return;
    }
    setConsolidationType(type);
    setIsConsolidationDialogOpen(true);
  };
  
  const handleConfirmConsolidation = (number: string, version: string) => {
    setConsolidationNumber(number);
    setConsolidationVersion(version);
    setIsConsolidationDialogOpen(false);
    setIsConsolidationNumberDialogOpen(true);
  };
  
  const handleFinalizeConsolidation = async () => {
    if (!user || selectedPTrabs.length === 0 || !consolidationNumber) return;
    
    try {
      setLoading(true);
      
      // 1. Criar o novo PTrab consolidado
      const firstPTrab = selectedPTrabs[0];
      const dataToInsert: TablesInsert<'p_trab'> = {
        user_id: user.id,
        numero_ptrab: consolidationNumber,
        comando_militar_area: firstPTrab.comando_militar_area,
        nome_om: firstPTrab.nome_om,
        nome_operacao: firstPTrab.nome_operacao,
        periodo_inicio: firstPTrab.periodo_inicio,
        periodo_fim: firstPTrab.periodo_fim,
        efetivo_empregado: firstPTrab.efetivo_empregado,
        acoes: `Consolidação dos P Trabs: ${selectedPTrabs.map(p => p.numero_ptrab).join(', ')}`,
        status: 'aberto',
        origem: consolidationType,
        rotulo_versao: consolidationVersion,
      };

      const { data: newPTrabData, error: insertError } = await supabase
        .from('p_trab')
        .insert([dataToInsert])
        .select('id')
        .single();

      if (insertError) throw insertError;
      
      const newPTrabId = newPTrabData.id;
      
      // 2. Mover os registros das classes para o novo PTrab
      const tablesToMove: PTrabLinkedTableName[] = [
        'classe_i_registros', 'classe_ii_registros', 'classe_iii_registros', 
        'classe_v_registros', 'classe_vi_registros', 'classe_vii_registros', 
        'classe_viii_saude_registros', 'classe_viii_remonta_registros', 
        'classe_ix_registros', 'p_trab_ref_lpc', 'passagem_registros', 
        'diaria_registros', 'verba_operacional_registros'
      ];
      
      const ptrabIdsToConsolidate = selectedPTrabs.map(p => p.id);
      
      for (const table of tablesToMove) {
        const { error: updateError } = await supabase
          .from(table)
          .update({ p_trab_id: newPTrabId })
          .in('p_trab_id', ptrabIdsToConsolidate);
          
        if (updateError) throw updateError;
      }
      
      // 3. Excluir os PTrabs originais (se forem do tipo 'consolidado')
      if (consolidationType === 'consolidado') {
        const { error: deleteError } = await supabase
          .from('p_trab')
          .delete()
          .in('id', ptrabIdsToConsolidate);
          
        if (deleteError) throw deleteError;
      }
      
      toast.success(`Consolidação ${consolidationNumber} finalizada com sucesso!`);
      setIsConsolidationNumberDialogOpen(false);
      setSelectedPTrabs([]);
      await fetchPTrabs();
      navigate(`/ptrab/form?ptrabId=${newPTrabId}`);
      
    } catch (error) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const handleSort = (key: keyof PTrab) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (key: keyof PTrab) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? <ArrowDownUp className="h-3 w-3 ml-1 rotate-180" /> : <ArrowDownUp className="h-3 w-3 ml-1" />;
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aberto':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-400">Minuta</Badge>;
      case 'em_andamento':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-400">Em Andamento</Badge>;
      case 'completo':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-400">Completo</Badge>;
      case 'arquivado':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-gray-400">Arquivado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };
  
  const handleToggleSelect = (ptrab: PTrab) => {
    if (ptrab.status === 'completo' || ptrab.status === 'arquivado') {
      toast.warning("Não é possível consolidar P Trabs completos ou arquivados.");
      return;
    }
    
    setSelectedPTrabs(prev => {
      if (prev.some(p => p.id === ptrab.id)) {
        return prev.filter(p => p.id !== ptrab.id);
      } else {
        // Regra de validação: todos os PTrabs selecionados devem ter a mesma OM e Operação
        if (prev.length > 0) {
          const first = prev[0];
          if (first.nome_om !== ptrab.nome_om || first.nome_operacao !== ptrab.nome_operacao) {
            toast.error("Apenas P Trabs da mesma OM e Operação podem ser consolidados.");
            return prev;
          }
        }
        return [...prev, ptrab];
      }
    });
  };
  
  const handleOpenShareDialog = (ptrab: PTrab) => {
    setPTrabToShare(ptrab);
    setIsShareLinkDialogOpen(true);
  };
  
  const handleOpenManageSharingDialog = (ptrab: PTrab) => {
    setPTrabToManageSharing(ptrab);
    setIsManageSharingDialogOpen(true);
  };
  
  const handleOpenUnlinkDialog = (ptrab: PTrab) => {
    setPTrabToUnlink(ptrab);
    setIsUnlinkPTrabDialogOpen(true);
  };
  
  const handleOpenLinkDialog = () => {
    setIsLinkPTrabDialogOpen(true);
  };
  
  const handleOpenAIChat = (ptrabId: string) => {
    setChatPTrabId(ptrabId);
    setIsAIChatOpen(true);
  };

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
      <div className="container max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FileText className="h-7 w-7 text-primary" />
            Gerenciamento de Planos de Trabalho
          </h1>
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              onClick={() => navigate('/diretrizes/operacional')}
            >
              <Settings className="mr-2 h-4 w-4" />
              Diretrizes Operacionais
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/diretrizes/logistica')}
            >
              <Settings className="mr-2 h-4 w-4" />
              Diretrizes Logísticas
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsHelpDialogOpen(true)}
            >
              <HelpCircle className="mr-2 h-4 w-4" />
              Ajuda
            </Button>
            <Button 
              variant="default" 
              onClick={handleOpenNewDialog}
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo P Trab
            </Button>
          </div>
        </div>
        
        {/* Ações de Consolidação e Compartilhamento */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-muted-foreground">
                {selectedPTrabs.length} P Trabs selecionados
              </span>
              
              <Button
                variant="secondary"
                onClick={() => handleOpenConsolidationDialog('consolidado')}
                disabled={selectedPTrabs.length < 2}
                className="gap-2"
              >
                <GitBranch className="h-4 w-4" />
                Consolidar (Excluir Originais)
              </Button>
              
              <Button
                variant="secondary"
                onClick={() => handleOpenConsolidationDialog('importado')}
                disabled={selectedPTrabs.length < 2}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                Importar (Manter Originais)
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setSelectedPTrabs([])}
                disabled={selectedPTrabs.length === 0}
                className="gap-2"
              >
                <XCircle className="h-4 w-4" />
                Limpar Seleção
              </Button>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={handleOpenLinkDialog}
                className="gap-2"
              >
                <Link className="h-4 w-4" />
                Vincular P Trab
              </Button>
              <Button
                variant="outline"
                onClick={fetchPTrabs}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar Lista
              </Button>
            </div>
          </div>
        </Card>

        {/* Tabela de P Trabs */}
        <Card className="shadow-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedPTrabs([])}>
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Limpar Seleção</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('numero_ptrab')}
                >
                  Número P Trab {getSortIcon('numero_ptrab')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('nome_operacao')}
                >
                  Operação {getSortIcon('nome_operacao')}
                </TableHead>
                <TableHead>OM</TableHead>
                <TableHead>Status</TableHead>
                <TableHead 
                  className="cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('updated_at')}
                >
                  Última Atualização {getSortIcon('updated_at')}
                </TableHead>
                <TableHead className="text-right w-[150px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ptrabs.map((ptrab) => {
                const isSelected = selectedPTrabs.some(p => p.id === ptrab.id);
                const isEditable = ptrab.status !== 'completo' && ptrab.status !== 'arquivado';
                
                return (
                  <TableRow 
                    key={ptrab.id} 
                    className={cn(
                      "hover:bg-muted/50 transition-colors",
                      isSelected && "bg-blue-50/50 border-l-4 border-blue-500",
                      ptrab.status === 'arquivado' && "opacity-60"
                    )}
                  >
                    <TableCell>
                      <Input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(ptrab)}
                        disabled={!isEditable}
                        className="h-4 w-4"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {ptrab.numero_ptrab}
                        {ptrab.rotulo_versao && ptrab.rotulo_versao !== 'APROVADO' && (
                          <Badge variant="secondary" className="text-xs font-normal">{ptrab.rotulo_versao}</Badge>
                        )}
                        {ptrab.origem === 'importado' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-xs font-normal bg-purple-100 text-purple-800 border-purple-400">Importado</Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>P Trab criado por importação de registros de outros P Trabs.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {ptrab.origem === 'consolidado' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-xs font-normal bg-indigo-100 text-indigo-800 border-indigo-400">Consolidado</Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>P Trab criado por consolidação de registros de outros P Trabs (originais excluídos).</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {ptrab.isShared && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Users className="h-4 w-4 text-green-600" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Compartilhado com você.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {ptrab.hasPendingRequests && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <MessageSquare className="h-4 w-4 text-red-600 animate-pulse" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Solicitação de acesso pendente.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{ptrab.nome_operacao}</TableCell>
                    <TableCell>{ptrab.nome_om}</TableCell>
                    <TableCell>{getStatusBadge(ptrab.status)}</TableCell>
                    <TableCell>{new Date(ptrab.updated_at!).toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menu</span>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          
                          <DropdownMenuItem onClick={() => navigate(`/ptrab/form?ptrabId=${ptrab.id}`)}>
                            <ArrowRight className="mr-2 h-4 w-4" />
                            Abrir / Editar Detalhes
                          </DropdownMenuItem>
                          
                          {ptrab.isOwner && isEditable && (
                            <DropdownMenuItem onClick={() => handleOpenEditDialog(ptrab)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar Dados Principais
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuSeparator />
                          
                          {ptrab.isOwner && (
                            <DropdownMenuItem onClick={() => { setPTrabToClone(ptrab); setIsCloneVariationDialogOpen(true); }}>
                              <Copy className="mr-2 h-4 w-4" />
                              Clonar / Criar Variação
                            </DropdownMenuItem>
                          )}
                          
                          {ptrab.isOwner && isEditable && (
                            <DropdownMenuItem onClick={() => handleApprovePTrab(ptrab)}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Aprovar (Marcar como Completo)
                            </DropdownMenuItem>
                          )}
                          
                          {ptrab.isOwner && (
                            <DropdownMenuItem onClick={() => handleArchivePTrab(ptrab)}>
                              <Archive className="mr-2 h-4 w-4" />
                              {ptrab.status === 'arquivado' ? 'Desarquivar' : 'Arquivar'}
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuSeparator />
                          
                          <DropdownMenuItem onClick={() => handleOpenAIChat(ptrab.id)}>
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Chat AI
                          </DropdownMenuItem>
                          
                          {ptrab.isOwner && (
                            <DropdownMenuItem onClick={() => handleOpenShareDialog(ptrab)}>
                              <Share2 className="mr-2 h-4 w-4" />
                              Compartilhar Link
                            </DropdownMenuItem>
                          )}
                          
                          {ptrab.isOwner && (
                            <DropdownMenuItem onClick={() => handleOpenManageSharingDialog(ptrab)}>
                              <Users className="mr-2 h-4 w-4" />
                              Gerenciar Compartilhamento
                            </DropdownMenuItem>
                          )}
                          
                          {ptrab.isShared && (
                            <DropdownMenuItem onClick={() => handleOpenUnlinkDialog(ptrab)}>
                              <XCircle className="mr-2 h-4 w-4" />
                              Desvincular
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuSeparator />
                          
                          {ptrab.isOwner && (
                            <DropdownMenuItem 
                              className="text-red-600 focus:text-red-600"
                              onClick={() => setPTrabToDelete(ptrab)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir P Trab
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Diálogo de Criação/Edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{currentPTrab ? "Editar P Trab" : "Novo Plano de Trabalho"}</DialogTitle>
            <DialogDescription>
              {currentPTrab ? "Atualize os dados principais do P Trab." : "Preencha os dados básicos para criar um novo P Trab."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            
            {/* Comando Militar de Área */}
            <div className="space-y-2">
              <Label htmlFor="comando_militar_area">Comando Militar de Área</Label>
              <Select
                value={currentPTrab?.comando_militar_area || newPTrabData.comando_militar_area}
                onValueChange={(value) => {
                  if (currentPTrab) {
                    setCurrentPTrab(prev => ({ ...prev, comando_militar_area: value }));
                  } else {
                    setNewPTrabData(prev => ({ ...prev, comando_militar_area: value }));
                  }
                }}
              >
                <SelectTrigger id="comando_militar_area">
                  <SelectValue placeholder="Selecione o CMA" />
                </SelectTrigger>
                <SelectContent>
                  {COMANDOS_MILITARES_AREA.map(cma => (
                    <SelectItem key={cma} value={cma}>{cma}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* OM e UG */}
            <OmSelector
              label="Organização Militar (OM)"
              initialOmName={currentPTrab?.nome_om || newPTrabData.nome_om || ''}
              initialCodug={currentPTrab?.codug_om || newPTrabData.codug_om || ''}
              onOmChange={(omData: OMData) => {
                const updateFn = (prev: Partial<PTrabDB>) => ({
                  ...prev,
                  nome_om: omData.nome_om,
                  nome_om_extenso: omData.nome_om_extenso,
                  codug_om: omData.codug_om,
                  rm_vinculacao: omData.rm_vinculacao,
                  codug_rm_vinculacao: omData.codug_rm_vinculacao,
                });
                if (currentPTrab) {
                  setCurrentPTrab(updateFn);
                } else {
                  setNewPTrabData(updateFn);
                }
              }}
            />
            
            {/* Nome da Operação */}
            <div className="space-y-2">
              <Label htmlFor="nome_operacao">Nome da Operação</Label>
              <Input
                id="nome_operacao"
                value={currentPTrab?.nome_operacao || newPTrabData.nome_operacao || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (currentPTrab) {
                    setCurrentPTrab(prev => ({ ...prev, nome_operacao: value }));
                  } else {
                    setNewPTrabData(prev => ({ ...prev, nome_operacao: value }));
                  }
                }}
                onKeyDown={handleEnterToNextField}
                placeholder="Ex: Operação Ágata"
              />
            </div>
            
            {/* Período */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="periodo_inicio">Início</Label>
                <Input
                  id="periodo_inicio"
                  type="date"
                  value={currentPTrab?.periodo_inicio || newPTrabData.periodo_inicio || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (currentPTrab) {
                      setCurrentPTrab(prev => ({ ...prev, periodo_inicio: value }));
                    } else {
                      setNewPTrabData(prev => ({ ...prev, periodo_inicio: value }));
                    }
                  }}
                  onKeyDown={handleEnterToNextField}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodo_fim">Fim</Label>
                <Input
                  id="periodo_fim"
                  type="date"
                  value={currentPTrab?.periodo_fim || newPTrabData.periodo_fim || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (currentPTrab) {
                      setCurrentPTrab(prev => ({ ...prev, periodo_fim: value }));
                    } else {
                      setNewPTrabData(prev => ({ ...prev, periodo_fim: value }));
                    }
                  }}
                  onKeyDown={handleEnterToNextField}
                />
              </div>
            </div>
            
            {/* Efetivo e Versão */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="efetivo_empregado">Efetivo Empregado</Label>
                <Input
                  id="efetivo_empregado"
                  type="number"
                  value={currentPTrab?.efetivo_empregado || newPTrabData.efetivo_empregado || '0'}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (currentPTrab) {
                      setCurrentPTrab(prev => ({ ...prev, efetivo_empregado: value }));
                    } else {
                      setNewPTrabData(prev => ({ ...prev, efetivo_empregado: value }));
                    }
                  }}
                  onKeyDown={handleEnterToNextField}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rotulo_versao">Rótulo da Versão</Label>
                <Input
                  id="rotulo_versao"
                  value={currentPTrab?.rotulo_versao || newPTrabData.rotulo_versao || 'V1.0'}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (currentPTrab) {
                      setCurrentPTrab(prev => ({ ...prev, rotulo_versao: value }));
                    } else {
                      setNewPTrabData(prev => ({ ...prev, rotulo_versao: value }));
                    }
                  }}
                  onKeyDown={handleEnterToNextField}
                  placeholder="V1.0"
                />
              </div>
            </div>
            
            {/* Ações */}
            <div className="space-y-2">
              <Label htmlFor="acoes">Ações (Resumo)</Label>
              <Textarea
                id="acoes"
                value={currentPTrab?.acoes || newPTrabData.acoes || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (currentPTrab) {
                    setCurrentPTrab(prev => ({ ...prev, acoes: value }));
                  } else {
                    setNewPTrabData(prev => ({ ...prev, acoes: value }));
                  }
                }}
                onKeyDown={handleEnterToNextField}
                placeholder="Descreva as principais ações da operação."
              />
            </div>
            
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button 
              type="submit" 
              onClick={currentPTrab ? handleUpdatePTrab : handleCreatePTrab}
              disabled={loading || !((currentPTrab || newPTrabData).nome_om && (currentPTrab || newPTrabData).nome_operacao)}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (currentPTrab ? "Salvar Alterações" : "Criar P Trab")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmação de Exclusão */}
      <AlertDialog open={!!ptrabToDelete} onOpenChange={() => setPTrabToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o P Trab 
              <span className="font-bold mx-1">{ptrabToDelete?.numero_ptrab}</span> 
              e todos os seus registros de custos associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePTrab} className="bg-red-600 hover:bg-red-700">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Excluir Permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Diálogo de Clonagem/Variação */}
      <CloneVariationDialog
        open={isCloneVariationDialogOpen}
        onOpenChange={setIsCloneVariationDialogOpen}
        ptrab={ptrabToClone}
        onClone={handleClonePTrab}
        loading={loading}
      />
      
      {/* Diálogo de Consolidação (Passo 1: Dados) */}
      <PTrabConsolidationDialog
        open={isConsolidationDialogOpen}
        onOpenChange={setIsConsolidationDialogOpen}
        selectedPTrabs={selectedPTrabs}
        onConfirm={handleConfirmConsolidation}
        consolidationType={consolidationType}
      />
      
      {/* Diálogo de Consolidação (Passo 2: Confirmação Final) */}
      <ConsolidationNumberDialog
        open={isConsolidationNumberDialogOpen}
        onOpenChange={setIsConsolidationNumberDialogOpen}
        consolidationNumber={consolidationNumber}
        consolidationVersion={consolidationVersion}
        onFinalize={handleFinalizeConsolidation}
        loading={loading}
      />
      
      {/* Diálogo de Ajuda */}
      <HelpDialog
        open={isHelpDialogOpen}
        onOpenChange={setIsHelpDialogOpen}
      />
      
      {/* Diálogo de Compartilhamento */}
      <ShareLinkDialog
        open={isShareLinkDialogOpen}
        onOpenChange={setIsShareLinkDialogOpen}
        ptrab={ptrabToShare}
      />
      
      {/* Diálogo de Gerenciamento de Compartilhamento */}
      <ManageSharingDialog
        open={isManageSharingDialogOpen}
        onOpenChange={setIsManageSharingDialogOpen}
        ptrab={ptrabToManageSharing}
        onUnlink={handleOpenUnlinkDialog}
        onUpdate={fetchPTrabs}
      />
      
      {/* Diálogo de Desvinculação */}
      <UnlinkPTrabDialog
        open={isUnlinkPTrabDialogOpen}
        onOpenChange={setIsUnlinkPTrabDialogOpen}
        ptrab={ptrabToUnlink}
        onUnlinkSuccess={fetchPTrabs}
      />
      
      {/* Diálogo de Vinculação */}
      <LinkPTrabDialog
        open={isLinkPTrabDialogOpen}
        onOpenChange={setIsLinkPTrabDialogOpen}
        onLinkSuccess={fetchPTrabs}
      />
      
      {/* Drawer de Chat AI */}
      <AIChatDrawer
        open={isAIChatOpen}
        onOpenChange={setIsAIChatOpen}
        ptrabId={chatPTrabId}
      />
      
      {/* Diálogo de Prompt de Crédito */}
      <CreditPromptDialog
        open={showCreditPrompt}
        onOpenChange={setShowCreditPrompt}
        onConfirm={() => {
          setShowCreditPrompt(false);
          navigate('/ptrab/form', { state: { openCredit: true } });
        }}
      />
    </div>
  );
};

export default PTrabManager;