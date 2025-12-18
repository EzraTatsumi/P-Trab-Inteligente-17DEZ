import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { Plus, Edit, Trash2, LogOut, FileText, Printer, Settings, PenSquare, MoreVertical, Pencil, Copy, FileSpreadsheet, Download, MessageSquare, ArrowRight, HelpCircle, CheckCircle, GitBranch, Archive, RefreshCw, User, Loader2, Link, Users, Bell } from "lucide-react";
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
import { ShareDialog } from "@/components/ShareDialog";
import { ShareRequestDialog } from "@/components/ShareRequestDialog";
import { ShareRequestsDialog } from "@/components/ShareRequestsDialog"; // NOVO IMPORT

// Define a base type for PTrab data fetched from DB, including the missing 'origem' field
type PTrabDB = Tables<'p_trab'> & {
  origem: 'original' | 'importado' | 'consolidado';
  rotulo_versao: string | null;
  shared_with: string[] | null; // Incluir shared_with
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
  isShared: boolean; // Indica se o PTrab está compartilhado com o usuário logado
  pendingRequestsCount: number; // NOVO: Contagem de solicitações pendentes
}

const PTrabManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pTrabs, setPTrabs] = useState<PTrab[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [existingPTrabNumbers, setExistingPTrabNumbers] = useState<string[]>([]);
  
  // ADDED: User state
  const { user } = useSession();
  const [userName, setUserName] = useState<string>("");
  
  // Estado para controlar a abertura do DropdownMenu de configurações
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);

  // Estados para o AlertDialog de status "arquivado"
  const [showArchiveStatusDialog, setShowArchiveStatusDialog] = useState(false);
  const [ptrabToArchiveId, setPtrabToArchiveId] = useState<string | null>(null);
  const [ptrabToArchiveName, setPtrabToArchiveName] = useState<string | null>(null);
  // Ref para controlar quais PTrabs já foram oferecidos para arquivamento na sessão atual
  const promptedForArchive = useRef(new Set<string>());

  // Novos estados para o diálogo de reativação
  const [showReactivateStatusDialog, setShowReactivateStatusDialog] = useState(false);
  const [ptrabToReactivateId, setPtrabToReactivateId] = useState<string | null>(null);
  const [ptrabToReactivateName, setPtrabToReactivateName] = useState<string | null>(null);

  // Novos estados para o diálogo de clonagem
  const [showCloneOptionsDialog, setShowCloneOptionsDialog] = useState(false);
  const [showCloneVariationDialog, setShowCloneVariationDialog] = useState(false);
  const [ptrabToClone, setPtrabToClone] = useState<PTrab | null>(null);
  const [cloneType, setCloneType, ] = useState<'new' | 'variation'>('new');
  const [suggestedCloneNumber, setSuggestedCloneNumber] = useState<string>("");
  const [customCloneNumber, setCustomCloneNumber] = useState<string>("");
  
  // NOVO: ID do PTrab original a ser clonado (usado no handleSubmit)
  const [originalPTrabIdToClone, setOriginalPTrabIdToClone] = useState<string | null>(null);

  // ESTADOS PARA APROVAÇÃO E NUMERAÇÃO
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [ptrabToApprove, setPtrabToApprove] = useState<PTrab | null>(null);
  const [suggestedApproveNumber, setSuggestedApproveNumber] = useState<string>("");

  // Estados para o diálogo de comentário
  const [showComentarioDialog, setShowComentarioDialog] = useState(false);
  const [ptrabComentario, setPtrabComentario] = useState<PTrab | null>(null);
  const [comentarioText, setComentarioText] = useState("");

  // NOVO ESTADO: Diálogo de Consolidação
  const [showConsolidationDialog, setShowConsolidationDialog] = useState(false);
  const [selectedPTrabsToConsolidate, setSelectedPTrabsToConsolidate] = useState<string[]>([]);
  const [showConsolidationNumberDialog, setShowConsolidationNumberDialog] = useState(false);
  const [suggestedConsolidationNumber, setSuggestedConsolidationNumber] = useState<string>("");
  
  // NOVO ESTADO: Controle do Prompt de Crédito
  const [showCreditPrompt, setShowCreditPrompt] = useState(false);
  const [ptrabToFill, setPtrabToFill] = useState<PTrab | null>(null);
  const hasBeenPrompted = useRef(new Set<string>()); // Armazena IDs dos PTrabs já perguntados
  
  // NOVO ESTADO: Compartilhamento
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [ptrabToShare, setPtrabToShare] = useState<Tables<'p_trab'> | null>(null);
  
  // NOVO ESTADO: Solicitação de Compartilhamento (Passo 2)
  const [showShareRequestDialog, setShowShareRequestDialog] = useState(false);
  const [shareLinkInput, setShareLinkInput] = useState("");
  
  // NOVO ESTADO: Gerenciamento de Solicitações (Passo 3)
  const [showShareRequestsDialog, setShowShareRequestsDialog] = useState(false);
  const [ptrabToManageRequests, setPtrabToManageRequests] = useState<string | null>(null);
  const [totalPendingRequests, setTotalPendingRequests] = useState(0);

  const currentYear = new Date().getFullYear();
  const yearSuffix = `/${currentYear}`;

  // =================================================================
  // FUNÇÕES AUXILIARES (Exportadas para uso nos relatórios)
  // =================================================================
  
  // MUDANÇA: A função agora recebe os metadados do usuário (userMetadata)
  const fetchUserName = useCallback(async (userId: string, userMetadata: any) => {
    // 1. Buscar last_name (Nome de Guerra) na tabela profiles
    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('last_name') 
        .eq('id', userId)
        .single();

    if (profileError) {
        console.error("Error fetching user profile:", profileError);
        // Continua mesmo com erro, pois podemos ter dados nos metadados
    }
    
    const nomeGuerra = profileData?.last_name || '';
    
    // 2. Buscar posto_graduacao nos metadados do usuário
    const postoGraduacao = userMetadata?.posto_graduacao || '';
    
    if (postoGraduacao && nomeGuerra) {
        return `${postoGraduacao} ${nomeGuerra}`;
    }
    
    if (nomeGuerra) {
        return nomeGuerra;
    }
    
    if (postoGraduacao) {
        return postoGraduacao;
    }

    // Retorna null se não houver nome de guerra ou posto/graduação
    return null; 
  }, []);

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getOriginBadge = (origem: PTrabDB['origem']) => {
    switch (origem) {
        case 'importado':
            return { label: 'Importado', className: 'bg-purple-500 text-white hover:bg-purple-600' };
        case 'consolidado':
            return { label: 'Consolidado', className: 'bg-teal-500 text-white hover:bg-teal-600' };
        case 'original':
        default:
            // Corrigido para Azul Escuro (blue-600) com letra branca
            return { label: 'Original', className: 'bg-blue-600 text-white hover:bg-blue-700' }; 
    }
  };
  
  // NOVO: Função para limpar o prefixo "CONSOLIDADO - "
  const cleanOperationName = (name: string, origem: PTrabDB['origem']) => {
    if (origem === 'consolidado' && name.startsWith('CONSOLIDADO - ')) {
        return name.replace('CONSOLIDADO - ', '');
    }
    return name;
  };
  
  // NOVO: Função para obter o badge de status de compartilhamento
  const getShareStatusBadge = (ptrab: PTrab, currentUserId: string | undefined) => {
    if (!currentUserId) return null;
    
    const isOwner = ptrab.user_id === currentUserId;
    const isSharedWithMe = ptrab.shared_with?.includes(currentUserId);
    
    if (isOwner && (ptrab.shared_with?.length || 0) > 0) {
        return { label: 'Compartilhando', className: 'bg-indigo-600 text-white hover:bg-indigo-700' };
    }
    
    if (!isOwner && isSharedWithMe) {
        return { label: 'Compartilhado', className: 'bg-pink-600 text-white hover:bg-pink-700' };
    }
    
    return null;
  };

  const handleSelectPTrab = (ptrab: PTrab) => {
      navigate(`/ptrab/form?ptrabId=${ptrab.id}`);
  };

  const handleNavigateToPrintOrExport = (ptrabId: string) => {
      navigate(`/ptrab/print?ptrabId=${ptrabId}`);
  };

  // Lógica de Consolidação
  const consolidationTooltipText = "Selecione múltiplos P Trabs para consolidar seus custos em um novo P Trab.";

  const isConsolidationDisabled = useMemo(() => {
      // Consolidação requer pelo menos 2 PTrabs que não estejam arquivados
      const availablePTrabs = pTrabs.filter(p => p.status !== 'arquivado');
      return availablePTrabs.length < 2;
  }, [pTrabs]);

  const getConsolidationDisabledMessage = () => {
      const availablePTrabs = pTrabs.filter(p => p.status !== 'arquivado');
      if (availablePTrabs.length === 0) {
          return "Crie pelo menos dois P Trabs para iniciar a consolidação.";
      }
      return "É necessário ter pelo menos dois P Trabs ativos para consolidar.";
  };
  
  const handlePromptConfirm = () => {
      // Placeholder for credit prompt confirm
      setShowCreditPrompt(false);
      navigate(`/ptrab/form?ptrabId=${ptrabToFill?.id}&openCredit=true`);
  };

  const handlePromptCancel = () => {
      // Placeholder for credit prompt cancel
      setShowCreditPrompt(false);
  };
  
  // =================================================================
  // FIM FUNÇÕES AUXILIARES
  // =================================================================

  // Função de reset do formulário (usando useCallback para evitar recriação desnecessária)
  const resetForm = useCallback(() => {
    setEditingId(null);
    setSelectedOmId(undefined);
    setOriginalPTrabIdToClone(null); // Resetar o ID de clonagem
    
    // Gera um número de minuta único ao iniciar um novo P Trab
    const uniqueMinutaNumber = generateUniqueMinutaNumber(existingPTrabNumbers);
    
    setFormData({
      // Inicializa o número do PTrab como a Minuta única
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
      comentario: "", // Adicionado
      rotulo_versao: null, // Adicionado
    });
  }, [existingPTrabNumbers]);

  const [formData, setFormData] = useState({
    numero_ptrab: "Minuta", // Inicializa como 'Minuta'
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
    origem: 'original' as 'original' | 'importado' | 'consolidado',
    comentario: "", // Adicionado
    rotulo_versao: null as string | null, // Adicionado
  });

  const [selectedOmId, setSelectedOmId] = useState<string | undefined>(undefined);

  const { handleEnterToNextField } = useFormNavigation();

  const checkAuth = async () => {
    const { data: { session } = {} } = await supabase.auth.getSession();
    if (!session) {
      navigate("/login");
    }
  };

  const calculateDays = (inicio: string, fim: string) => {
    const start = new Date(inicio);
    const end = new Date(fim);
    const diff = end.getTime() - start.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24)) + 1;
  };
  
  // NOVO: Função para buscar solicitações pendentes para todos os PTrabs do usuário
  const fetchPendingRequests = useCallback(async (ptrabIds: string[]) => {
    if (!ptrabIds.length) return 0;
    
    // Busca todas as solicitações pendentes para os PTrabs que o usuário é dono
    const { count, error } = await supabase
        .from('ptrab_share_requests')
        .select('id', { count: 'exact', head: true })
        .in('ptrab_id', ptrabIds)
        .eq('status', 'pending');
        
    if (error) {
        console.error("Error fetching pending requests count:", error);
        return 0;
    }
    
    return count || 0;
  }, []);

  const loadPTrabs = useCallback(async () => {
    const currentUserId = user?.id;
    if (!currentUserId) return;
    
    try {
      // MUDANÇA AQUI: A RLS agora garante que apenas os PTrabs do usuário OU compartilhados com ele sejam retornados.
      const { data: pTrabsData, error: pTrabsError } = await supabase
        .from("p_trab")
        .select("*, comentario, origem, rotulo_versao, shared_with") // Incluir shared_with
        .order("created_at", { ascending: false });

      if (pTrabsError) throw pTrabsError;

      if (!Array.isArray(pTrabsData)) {
        console.error("Invalid data received from p_trab table");
        setPTrabs([]);
        return;
      }

      // Cast pTrabsData to the expected structure PTrabDB[]
      const typedPTrabsData = pTrabsData as unknown as PTrabDB[];

      const numbers = (typedPTrabsData || []).map(p => p.numero_ptrab);
      setExistingPTrabNumbers(numbers);
      
      // IDs dos PTrabs que o usuário é proprietário
      const ownedPTrabIds = typedPTrabsData.filter(p => p.user_id === currentUserId).map(p => p.id);
      
      // Busca a contagem total de solicitações pendentes para todos os PTrabs do usuário
      const totalPending = await fetchPendingRequests(ownedPTrabIds);
      setTotalPendingRequests(totalPending);

      const pTrabsWithTotals: PTrab[] = await Promise.all(
        (typedPTrabsData || []).map(async (ptrab) => {
          let totalOperacionalCalculado = 0;
          let totalLogisticaCalculado = 0;
          let totalMaterialPermanenteCalculado = 0; // NOVO
          let quantidadeRacaoOpCalculada = 0; // NOVO
          let quantidadeHorasVooCalculada = 0; // NOVO (Inicialmente 0)

          // 1. Fetch Classe I totals (33.90.30)
          const { data: classeIData, error: classeIError } = await supabase
            .from('classe_i_registros')
            .select('total_qs, total_qr, quantidade_r2, quantidade_r3') // Incluindo quantidades de ração
            .eq('p_trab_id', ptrab.id);

          let totalClasseI = 0;
          if (classeIError) console.error("Erro ao carregar Classe I para PTrab", ptrab.numero_ptrab, classeIError);
          else {
            totalClasseI = (classeIData || []).reduce((sum, record) => sum + record.total_qs + record.total_qr, 0);
            // Soma das quantidades de Ração Op (R2 + R3)
            quantidadeRacaoOpCalculada = (classeIData || []).reduce((sum, record) => sum + (record.quantidade_r2 || 0) + (record.quantidade_r3 || 0), 0);
          }
          
          // 2. Fetch Classes II, V, VI, VII, VIII, IX totals (33.90.30 + 33.90.39)
          const { data: classeIIData, error: classeIIError } = await supabase
            .from('classe_ii_registros')
            .select('valor_total')
            .eq('p_trab_id', ptrab.id);
            
          const { data: classeVData, error: classeVError } = await supabase
            .from('classe_v_registros')
            .select('valor_total')
            .eq('p_trab_id', ptrab.id);
            
          const { data: classeVIData, error: classeVIError } = await supabase
            .from('classe_vi_registros')
            .select('valor_total')
            .eq('p_trab_id', ptrab.id);
            
          const { data: classeVIIData, error: classeVIIError } = await supabase
            .from('classe_vii_registros')
            .select('valor_total')
            .eq('p_trab_id', ptrab.id);
            
          const { data: classeVIIISaudeData, error: classeVIIISaudeError } = await supabase
            .from('classe_viii_saude_registros')
            .select('valor_total')
            .eq('p_trab_id', ptrab.id);
            
          const { data: classeVIIIRemontaData, error: classeVIIIRemontaError } = await supabase
            .from('classe_viii_remonta_registros')
            .select('valor_total')
            .eq('p_trab_id', ptrab.id);
            
          const { data: classeIXData, error: classeIXError } = await supabase
            .from('classe_ix_registros')
            .select('valor_total')
            .eq('p_trab_id', ptrab.id);

          let totalClassesDiversas = 0;
          if (classeIIError) console.error("Erro ao carregar Classe II para PTrab", ptrab.numero_ptrab, classeIIError);
          else totalClassesDiversas += (classeIIData || []).reduce((sum, record) => sum + record.valor_total, 0);
          if (classeVError) console.error("Erro ao carregar Classe V para PTrab", ptrab.numero_ptrab, classeVError);
          else totalClassesDiversas += (classeVData || []).reduce((sum, record) => sum + record.valor_total, 0);
          if (classeVIError) console.error("Erro ao carregar Classe VI para PTrab", ptrab.numero_ptrab, classeVIError);
          else totalClassesDiversas += (classeVIData || []).reduce((sum, record) => sum + record.valor_total, 0);
          if (classeVIIError) console.error("Erro ao carregar Classe VII para PTrab", ptrab.numero_ptrab, classeVIIError);
          else totalClassesDiversas += (classeVIIData || []).reduce((sum, record) => sum + record.valor_total, 0);
          if (classeVIIISaudeError) console.error("Erro ao carregar Classe VIII Saúde para PTrab", ptrab.numero_ptrab, classeVIIISaudeError);
          else totalClassesDiversas += (classeVIIISaudeData || []).reduce((sum, record) => sum + record.valor_total, 0);
          if (classeVIIIRemontaError) console.error("Erro ao carregar Classe VIII Remonta para PTrab", ptrab.numero_ptrab, classeVIIIRemontaError);
          else totalClassesDiversas += (classeVIIIRemontaData || []).reduce((sum, record) => sum + record.valor_total, 0);
          if (classeIXError) console.error("Erro ao carregar Classe IX para PTrab", ptrab.numero_ptrab, classeIXError);
          else totalClassesDiversas += (classeIXData || []).reduce((sum, record) => sum + record.valor_total, 0);


          // 3. Fetch Classe III totals (Combustível e Lubrificante)
          const { data: classeIIIData, error: classeIIIError } = await supabase
            .from('classe_iii_registros')
            .select('valor_total')
            .eq('p_trab_id', ptrab.id);

          let totalClasseIII = 0;
          if (classeIIIError) console.error("Erro ao carregar Classe III para PTrab", ptrab.numero_ptrab, classeIIIError);
          else {
            totalClasseIII = (classeIIIData || []).reduce((sum, record) => sum + record.valor_total, 0);
          }

          // SOMA TOTAL DA ABA LOGÍSTICA
          totalLogisticaCalculado = totalClasseI + totalClassesDiversas + totalClasseIII;

          return {
            ...ptrab,
            totalLogistica: totalLogisticaCalculado,
            totalOperacional: totalOperacionalCalculado,
            totalMaterialPermanente: totalMaterialPermanenteCalculado, // Inicializado como 0
            quantidadeRacaoOp: quantidadeRacaoOpCalculada, // Valor real da Classe I
            quantidadeHorasVoo: quantidadeHorasVooCalculada, // Inicializado como 0
            isShared: ptrab.shared_with?.includes(currentUserId) || false, // NOVO: Define se está compartilhado comigo
            pendingRequestsCount: 0, // Será atualizado abaixo se necessário
          } as PTrab;
        })
      );
      
      // Se o usuário for proprietário, busca a contagem de solicitações pendentes por PTrab
      if (ownedPTrabIds.length > 0) {
          const { data: requestsData } = await supabase
              .from('ptrab_share_requests')
              .select('ptrab_id', { count: 'exact' })
              .in('ptrab_id', ownedPTrabIds)
              .eq('status', 'pending');
              
          const requestCounts: Record<string, number> = {};
          (requestsData || []).forEach((req: any) => {
              requestCounts[req.ptrab_id] = (requestCounts[req.ptrab_id] || 0) + 1;
          });
          
          // Atualiza a contagem no objeto PTrab
          pTrabsWithTotals.forEach(ptrab => {
              if (ptrab.user_id === currentUserId) {
                  ptrab.pendingRequestsCount = requestCounts[ptrab.id] || 0;
              }
          });
      }

      setPTrabs(pTrabsWithTotals);

      // Lógica para perguntar sobre arquivamento
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      for (const ptrab of pTrabsWithTotals) {
        if (
          ptrab.status === 'aprovado' && // MUDANÇA: De 'completo' para 'aprovado'
          new Date(ptrab.updated_at) < tenDaysAgo &&
          !promptedForArchive.current.has(ptrab.id)
        ) {
          setPtrabToArchiveId(ptrab.id);
          setPtrabToArchiveName(`${ptrab.numero_ptrab} - ${ptrab.nome_operacao}`);
          setShowArchiveStatusDialog(true);
          promptedForArchive.current.add(ptrab.id);
          break;
        }
      }

    } catch (error: any) {
      toast.error("Erro ao carregar P Trabs e seus totais");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user, toast, setPTrabs, setExistingPTrabNumbers, fetchPendingRequests]);

  useEffect(() => {
    checkAuth();
    if (user?.id) {
        loadPTrabs();
        
        // ADDED: Fetch user name on load
        // MUDANÇA: Passando user.user_metadata para a função
        fetchUserName(user.id, user.user_metadata).then(name => {
            // Se o nome for encontrado, usa ele. Caso contrário, define como string vazia.
            setUserName(name || ""); 
        });
    }
  }, [loadPTrabs, user, fetchUserName]);

  // Efeito para atualizar o número sugerido no diálogo de clonagem
  useEffect(() => {
    if (ptrabToClone) {
      let newSuggestedNumber = "";
      
      // Tanto 'new' quanto 'variation' agora geram um número de Minuta único
      newSuggestedNumber = generateUniqueMinutaNumber(existingPTrabNumbers); 
      
      setSuggestedCloneNumber(newSuggestedNumber);
      setCustomCloneNumber(newSuggestedNumber); // Inicializa o campo editável com a sugestão
    }
  }, [ptrabToClone, existingPTrabNumbers]); // Removido cloneType da dependência, pois a lógica é a mesma

  const handleConfirmArchiveStatus = async () => {
    if (!ptrabToArchiveId) return;

    try {
      const { error } = await supabase
        .from("p_trab")
        .update({ status: "arquivado" })
        .eq("id", ptrabToArchiveId);

      if (error) throw error;

      toast.success(`P Trab ${ptrabToArchiveName} arquivado com sucesso!`);
      setShowArchiveStatusDialog(false);
      setPtrabToArchiveId(null);
      setPtrabToArchiveName(null);
      loadPTrabs();
    } catch (error) {
      console.error("Erro ao arquivar P Trab:", error);
      toast.error("Erro ao arquivar P Trab.");
    }
  };

  const handleCancelArchiveStatus = () => {
    setShowArchiveStatusDialog(false);
    setPtrabToArchiveId(null);
    setPtrabToArchiveName(null);
  };

  // MUDANÇA: Nova função para arquivar manualmente
  const handleArchive = async (ptrabId: string, ptrabName: string) => {
    if (!confirm(`Tem certeza que deseja ARQUIVAR o P Trab "${ptrabName}"? Esta ação irá finalizar o trabalho e restringir edições.`)) return;

    setLoading(true);
    try {
        const { error } = await supabase
            .from("p_trab")
            .update({ status: "arquivado" })
            .eq("id", ptrabId);

        if (error) throw error;

        toast.success(`P Trab ${ptrabName} arquivado com sucesso!`);
        loadPTrabs();
    } catch (error) {
        console.error("Erro ao arquivar P Trab:", error);
        toast.error("Erro ao arquivar P Trab.");
    } finally {
        setLoading(false);
    }
  };

  // MUDANÇA: Nova configuração de status
  const statusConfig = {
    'aberto': { 
      variant: 'default' as const, 
      label: 'Aberto',
      className: 'bg-yellow-500 text-white hover:bg-yellow-600'
    },
    'em_andamento': { 
      variant: 'secondary' as const, 
      label: 'Em Andamento',
      className: 'bg-blue-600 text-white hover:bg-blue-700'
    },
    'aprovado': { // NOVO STATUS
      variant: 'default' as const, 
      label: 'Aprovado',
      className: 'bg-green-600 text-white hover:bg-green-700'
    },
    'arquivado': { 
      variant: 'outline' as const, 
      label: 'Arquivado',
      className: 'bg-gray-500 text-white hover:bg-gray-600'
    }
  };

  const handleConfirmReactivateStatus = async () => {
    if (!ptrabToReactivateId) return;

    setLoading(true); // Start loading

    try {
      // 1. Fetch PTrab data to check its number
      const { data: ptrab, error: fetchError } = await supabase
        .from("p_trab")
        .select("numero_ptrab")
        .eq("id", ptrabToReactivateId)
        .single();

      if (fetchError || !ptrab) throw new Error("P Trab não encontrado.");

      // Check if the number starts with "Minuta"
      const isMinuta = ptrab.numero_ptrab.startsWith("Minuta");
      
      // Determine the new status: 'aberto' if Minuta, 'aprovado' if officially numbered
      const newStatus = isMinuta ? 'aberto' : 'aprovado';

      // 2. Update status
      const { error: updateError } = await supabase
        .from("p_trab")
        .update({ status: newStatus })
        .eq("id", ptrabToReactivateId);

      if (updateError) throw updateError;

      toast.success(`P Trab ${ptrabToReactivateName} reativado para "${newStatus.toUpperCase()}"!`);
      setShowReactivateStatusDialog(false);
      setPtrabToReactivateId(null);
      setPtrabToReactivateName(null);
      loadPTrabs();
    } catch (error: any) {
      console.error("Erro ao reativar P Trab:", error);
      toast.error(error.message || "Erro ao reativar P Trab.");
      setLoading(false); // Ensure loading is stopped on error
    }
  };

  const handleCancelReactivateStatus = () => {
    setShowReactivateStatusDialog(false);
    setPtrabToReactivateId(null);
    setPtrabToReactivateName(null);
    loadPTrabs(); 
  };

  const handleOpenComentario = (ptrab: PTrab) => {
    setPtrabComentario(ptrab);
    setComentarioText(ptrab.comentario || "");
    setShowComentarioDialog(true);
  };

  const handleSaveComentario = async () => {
    if (!ptrabComentario) return;

    try {
      const { error } = await supabase
        .from('p_trab')
        // Garante que o comentário seja null se estiver vazio
        .update({ comentario: comentarioText || null }) 
        .eq('id', ptrabComentario.id);

      if (error) throw error;

      toast.success("Comentário salvo com sucesso!");
      setShowComentarioDialog(false);
      setPtrabComentario(null);
      setComentarioText("");
      loadPTrabs();
    } catch (error) {
      console.error("Erro ao salvar comentário:", error);
      toast.error("Erro ao salvar comentário. Tente novamente.");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  // Removida a lógica de formatação automática do número do P Trab
  const handleNumeroPTrabChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, numero_ptrab: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const currentNumber = formData.numero_ptrab.trim();
      
      // --- VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS ---
      const requiredFields: (keyof typeof formData)[] = [
        'numero_ptrab', 'nome_operacao', 'comando_militar_area', 
        'nome_om_extenso', 'nome_om', 'efetivo_empregado', 
        'periodo_inicio', 'periodo_fim', 'acoes',
        'local_om', // TORNADO OBRIGATÓRIO
        'nome_cmt_om', // TORNADO OBRIGATÓRIO
      ];
      
      for (const field of requiredFields) {
        if (!formData[field] || String(formData[field]).trim() === "") {
          
          let fieldName = field.replace(/_/g, ' ');
          if (fieldName === 'nome om') fieldName = 'Nome da OM (sigla)';
          if (fieldName === 'nome om extenso') fieldName = 'Nome da OM (extenso)';
          if (fieldName === 'acoes') fieldName = 'Ações realizadas ou a serem realizadas';
          if (fieldName === 'local om') fieldName = 'Local da OM';
          if (fieldName === 'nome cmt om') fieldName = 'Nome do Comandante da OM';
          
          toast.error(`O campo '${fieldName}' é obrigatório.`);
          setLoading(false);
          return;
        }
      }
      
      if (!formData.codug_om || !formData.rm_vinculacao || !formData.codug_rm_vinculacao) {
        toast.error("A OM deve ser selecionada na lista para preencher os CODUGs e RM.");
        setLoading(false);
        return;
      }
      
      if (new Date(formData.periodo_fim) < new Date(formData.periodo_inicio)) {
        toast.error("A Data Fim deve ser posterior ou igual à Data Início.");
        setLoading(false);
        return;
      }
      // --- FIM VALIDAÇÃO ---

      // Validação: Se o número não for "Minuta", ele deve ser único (exceto se for o próprio registro em edição)
      if (currentNumber && !currentNumber.startsWith("Minuta")) {
        const isDuplicate = isPTrabNumberDuplicate(currentNumber, existingPTrabNumbers) && 
                           currentNumber !== pTrabs.find(p => p.id === editingId)?.numero_ptrab;

        if (isDuplicate) {
          toast.error("Já existe um P Trab com este número. Por favor, proponha outro.");
          setLoading(false);
          return;
        }
      }
      
      // Se estiver criando, o numero_ptrab deve ser o valor único gerado pelo resetForm ou o valor customizado.
      const finalNumeroPTrab = currentNumber || generateUniqueMinutaNumber(existingPTrabNumbers);

      const ptrabData = {
        ...formData,
        user_id: user.id,
        origem: editingId ? formData.origem : 'original',
        // Garante que o numero_ptrab seja salvo como o valor final
        numero_ptrab: finalNumeroPTrab, 
        // MUDANÇA: Status inicial é sempre 'aberto'
        status: editingId ? formData.status : 'aberto',
      };

      if (editingId) {
        // Edição: O ID já está no escopo do editingId, não precisamos nos preocupar com ele aqui.
        const { error } = await supabase.from("p_trab").update(ptrabData).eq("id", editingId);
        if (error) throw error;
        toast.success("P Trab atualizado!");
      } else {
        // Criação: Removemos o ID do objeto para garantir que o DB gere um novo UUID.
        const { id, ...insertData } = ptrabData as Partial<PTrab> & { id?: string };
        
        const { data: newPTrab, error: insertError } = await supabase
          .from("p_trab")
          .insert([insertData as TablesInsert<'p_trab'>])
          .select()
          .single();
          
        if (insertError || !newPTrab) throw insertError;
        
        const newPTrabId = newPTrab.id;
        
        // --- NOVO FLUXO DE CLONAGEM DE REGISTROS APÓS CRIAÇÃO DO CABEÇALHO ---
        if (originalPTrabIdToClone) {
            // 1. Clonar registros (Classes I, II, III, LPC)
            await cloneRelatedRecords(originalPTrabIdToClone, newPTrabId);
            
            // 2. Copiar rotulo_versao do original para o novo PTrab (se existir)
            const { data: originalPTrabData } = await supabase
                .from("p_trab")
                .select("rotulo_versao")
                .eq("id", originalPTrabIdToClone)
                .single();
                
            if (originalPTrabData?.rotulo_versao) {
                await supabase
                    .from("p_trab")
                    .update({ rotulo_versao: originalPTrabData.rotulo_versao })
                    .eq("id", newPTrabId);
            }
            
            toast.success("P Trab criado e registros clonados!");
        }
        
        // ZERAR CRÉDITOS DISPONÍVEIS APÓS A CRIAÇÃO DE UM NOVO P TRAB
        try {
            await updateUserCredits(user.id, 0, 0);
        } catch (creditError) {
            console.error("Erro ao zerar créditos após criação do P Trab:", creditError);
            toast.warning("Aviso: Ocorreu um erro ao zerar os créditos disponíveis. Por favor, verifique manualmente.");
        }
        
        // Não redireciona, apenas fecha o diálogo e recarrega a lista.
        setDialogOpen(false);
        resetForm();
        loadPTrabs();
        return; // Sai da função para evitar o resetForm e loadPTrabs duplicados abaixo
      }

      setDialogOpen(false);
      resetForm();
      loadPTrabs();
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (ptrab: PTrab) => {
    setEditingId(ptrab.id);
    setSelectedOmId(ptrab.codug_om ? 'temp' : undefined); // Placeholder para forçar a seleção da OM
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
      comentario: ptrab.comentario || "", // Comentário continua sendo editável
      rotulo_versao: ptrab.rotulo_versao || null, // Adicionado
    });
    setDialogOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza?")) return;
    try {
      // MUDANÇA: A RLS agora impede que usuários compartilhados excluam o PTrab.
      await supabase.from("p_trab").delete().eq("id", id);
      toast.success("P Trab excluído!");
      loadPTrabs();
    } catch (error: any) {
      toast.error("Erro ao excluir. Apenas o proprietário pode excluir o P Trab.");
    }
  };

  // Função para abrir o diálogo de aprovação
  const handleOpenApproveDialog = (ptrab: PTrab) => {
    // 1. A sigla da OM é usada como está (ptrab.nome_om)
    const omSigla = ptrab.nome_om;
    
    // 2. Gerar o número no novo padrão N/YYYY/OM_SIGLA
    const suggestedNumber = generateApprovalPTrabNumber(existingPTrabNumbers, omSigla); // CORRIGIDO: Usando existingPTrabNumbers
    
    setPtrabToApprove(ptrab);
    setSuggestedApproveNumber(suggestedNumber);
    setShowApproveDialog(true);
  };

  // Função para confirmar a aprovação e numeração
  const handleApproveAndNumber = async () => {
    if (!ptrabToApprove) return;

    const newNumber = suggestedApproveNumber.trim();
    if (!newNumber) {
      toast.error("O número do P Trab não pode ser vazio.");
      return;
    }
    
    // Verifica se o número sugerido (ou customizado) já existe
    const isDuplicate = isPTrabNumberDuplicate(newNumber, existingPTrabNumbers); // CORRIGIDO: Usando existingPTrabNumbers
    if (isDuplicate) {
      toast.error("O número sugerido já existe. Tente novamente ou use outro número.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("p_trab")
        .update({ 
          numero_ptrab: newNumber,
          status: 'aprovado', // MUDANÇA: Define o status como 'aprovado' após a numeração
        })
        .eq("id", ptrabToApprove.id);

      if (error) throw error;

      toast.success(`P Trab ${newNumber} aprovado e numerado com sucesso!`);
      setShowApproveDialog(false);
      setPtrabToApprove(null);
      setSuggestedApproveNumber("");
      loadPTrabs();
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  // Função para abrir o diálogo de opções de clonagem
  const handleOpenCloneOptions = (ptrab: PTrab) => {
    setPtrabToClone(ptrab);
    setCloneType('new');
    // O useEffect acima cuidará de definir suggestedCloneNumber e customCloneNumber
    setShowCloneOptionsDialog(true);
  };

  // Função para confirmar a clonagem a partir do diálogo de opções
  const handleConfirmCloneOptions = async () => {
    if (!ptrabToClone) return;

    if (cloneType === 'new') {
      // Fluxo 1: Novo P Trab (Abre o diálogo de edição do cabeçalho)
      setShowCloneOptionsDialog(false);
      
      // 1. Prepara o formulário com os dados do original e o novo número de minuta
      // MUDANÇA AQUI: Excluir todos os campos calculados do frontend
      const { 
        id, created_at, updated_at, totalLogistica, totalOperacional, 
        totalMaterialPermanente, quantidadeRacaoOp, quantidadeHorasVoo, // <-- CAMPOS CALCULADOS EXCLUÍDOS
        rotulo_versao, nome_om, nome_om_extenso, codug_om, rm_vinculacao, codug_rm_vinculacao,
        share_token, shared_with, // Adicionado shared_with para que o novo PTrab não herde o compartilhamento
        ...restOfPTrab 
      } = ptrabToClone;
      
      setFormData({
        ...restOfPTrab,
        numero_ptrab: suggestedCloneNumber, // Usa o número de minuta gerado
        status: "aberto",
        origem: ptrabToClone.origem,
        comentario: "", // Limpa o comentário para um novo P Trab
        rotulo_versao: ptrabToClone.rotulo_versao, // COPIA o rótulo da versão
        
        // NOVO: Limpa campos da OM para forçar a re-seleção/confirmação
        nome_om: "",
        nome_om_extenso: "",
        codug_om: "",
        rm_vinculacao: "",
        codug_rm_vinculacao: "",
      });
      
      // Limpa o estado de seleção da OM para forçar a seleção no OmSelector
      setSelectedOmId(undefined); 
      setOriginalPTrabIdToClone(ptrabToClone.id); // Salva o ID para clonar os registros no submit
      
      // 2. Abre o diálogo de edição
      setDialogOpen(true);
      
    } else {
      // Fluxo 2: Variação do Trabalho (abre o diálogo de nome da versão para CAPTURAR O RÓTULO)
      setShowCloneOptionsDialog(false);
      setShowCloneVariationDialog(true);
    }
  };
  
  // Função para confirmar a clonagem de variação (chamada pelo CloneVariationDialog)
  const handleConfirmCloneVariation = async (versionName: string) => {
    if (!ptrabToClone || !suggestedCloneNumber.trim()) {
      toast.error("Erro: Dados de clonagem incompletos.");
      return;
    }
    
    // 1. Captura o rótulo e fecha o diálogo de variação
    setShowCloneVariationDialog(false);
    setLoading(true);

    try {
        // MUDANÇA AQUI: Excluir todos os campos calculados do frontend
        const { 
            id, created_at, updated_at, totalLogistica, totalOperacional, 
            totalMaterialPermanente, quantidadeRacaoOp, quantidadeHorasVoo, // <-- CAMPOS CALCULADOS EXCLUÍDOS
            rotulo_versao, share_token, shared_with, // Adicionado shared_with
            ...restOfPTrab 
        }
        = ptrabToClone;
        
        const newPTrabData: TablesInsert<'p_trab'> & { origem: PTrabDB['origem'] } = {
            ...restOfPTrab,
            numero_ptrab: suggestedCloneNumber, // Usa o número de minuta gerado
            status: "aberto",
            origem: ptrabToClone.origem,
            comentario: null, // Comentário é limpo
            rotulo_versao: versionName, // NEW: Salva o rótulo da versão fornecido pelo usuário
            user_id: (await supabase.auth.getUser()).data.user?.id!,
        };

        const { data: newPTrab, error: insertError } = await supabase
            .from("p_trab")
            .insert([newPTrabData as TablesInsert<'p_trab'>]) // Cast to TablesInsert<'p_trab'>
            .select()
            .single();
            
        if (insertError || !newPTrab) throw insertError;
        
        const newPTrabId = newPTrab.id;
        
        // 3. Clona os registros relacionados (Classes I, II, III, LPC)
        await cloneRelatedRecords(ptrabToClone.id, newPTrabId);
        
        // 4. ZERAR CRÉDITOS DISPONÍVEIS
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await updateUserCredits(user.id, 0, 0);
        }
        
        toast.success(`Variação "${versionName}" criada como Minuta ${suggestedCloneNumber} e registros clonados!`);
        loadPTrabs();
        
    } catch (error: any) {
        console.error("Erro ao clonar variação:", error);
        toast.error(sanitizeError(error));
    } finally {
        setLoading(false);
    }
  };

  // Função para clonar os registros relacionados (Chamada APENAS no handleSubmit para novos PTrabs clonados)
  const cloneRelatedRecords = async (originalPTrabId: string, newPTrabId: string) => {
    
    // Helper function for cloning generic class records
    const cloneClassRecords = async (tableName: keyof Tables, jsonbField: string, numericFields: string[]) => {
        const { data: originalRecords, error: fetchError } = await supabase
            .from(tableName)
            .select(`*, ${jsonbField}`)
            .eq("p_trab_id", originalPTrabId);

        if (fetchError) {
            console.error(`Erro ao carregar registros da ${tableName}:`, fetchError);
            return 0;
        }

        const newRecords = (originalRecords || []).map(record => {
            const { id, created_at, updated_at, ...restOfRecord } = record;
            
            const newRecord: Record<string, any> = {
                ...restOfRecord,
                p_trab_id: newPTrabId,
                [jsonbField]: record[jsonbField] ? JSON.parse(JSON.stringify(record[jsonbField])) : null,
            };
            
            // Ensure numeric fields are present and default to 0 if null/undefined
            numericFields.forEach(field => {
                if (newRecord[field] === null || newRecord[field] === undefined) {
                    newRecord[field] = 0;
                }
            });
            
            return newRecord;
        });

        if (newRecords.length > 0) {
            const { error: insertError } = await supabase
                .from(tableName)
                .insert(newRecords as TablesInsert<typeof tableName>[]);
            if (insertError) {
                console.error(`ERRO DE INSERÇÃO ${tableName}:`, insertError);
                toast.error(`Erro ao clonar registros da ${tableName}: ${sanitizeError(insertError)}`);
            }
        }
        return newRecords.length;
    };

    // 1. Clone Classe I records (Ração Quente/Operacional)
    const classeINumericFields = [
        'complemento_qr', 'complemento_qs', 'dias_operacao', 'efetivo', 'etapa_qr', 'etapa_qs', 
        'nr_ref_int', 'total_geral', 'total_qr', 'total_qs', 'valor_qr', 'valor_qs', 
        'quantidade_r2', 'quantidade_r3'
    ];
    
    const { data: originalClasseIRecords, error: fetchClasseIError } = await supabase
      .from("classe_i_registros")
      .select("*")
      .eq("p_trab_id", originalPTrabId);

    if (fetchClasseIError) {
      console.error("Erro ao carregar registros da Classe I:", fetchClasseIError);
    } else {
      const newClasseIRecords = (originalClasseIRecords || []).map(record => {
        const { id, created_at, updated_at, ...restOfRecord } = record;
        
        const newRecord: Record<string, any> = {
            ...restOfRecord,
            p_trab_id: newPTrabId,
        };
        
        classeINumericFields.forEach(field => {
            if (newRecord[field] === null || newRecord[field] === undefined) {
                newRecord[field] = 0;
            }
        });
        
        return newRecord;
      });

      if (newClasseIRecords.length > 0) {
        const { error: insertClasseIError } = await supabase
          .from("classe_i_registros")
          .insert(newClasseIRecords as TablesInsert<'classe_i_registros'>[]);
        if (insertClasseIError) {
          console.error("ERRO DE INSERÇÃO CLASSE I:", insertClasseIError);
          toast.error(`Erro ao clonar registros da Classe I: ${sanitizeError(insertClasseIError)}`);
        }
      }
    }
    
    const genericNumericFields = ['dias_operacao', 'valor_total', 'valor_nd_30', 'valor_nd_39'];

    // 2. Clone Classe II records
    await cloneClassRecords('classe_ii_registros', 'itens_equipamentos', genericNumericFields);

    // 3. Clone Classe III records (needs specific handling due to many nullable fields)
    const classeIIINumericFields = [
        'dias_operacao', 'preco_litro', 'quantidade', 'total_litros', 'valor_total', 
        'consumo_lubrificante_litro', 'preco_lubrificante', 'valor_nd_30', 'valor_nd_39'
    ];
    
    const { data: originalClasseIIIRecords, error: fetchClasseIIIError } = await supabase
      .from("classe_iii_registros")
      .select("*")
      .eq("p_trab_id", originalPTrabId);

    if (fetchClasseIIIError) {
      console.error("Erro ao carregar registros da Classe III:", fetchClasseIIIError);
    } else {
      const newClasseIIIRecords = (originalClasseIIIRecords || []).map(record => {
        const { id, created_at, updated_at, ...restOfRecord } = record;
        
        const newRecord: Record<string, any> = {
            ...restOfRecord,
            p_trab_id: newPTrabId,
            itens_equipamentos: record.itens_equipamentos ? JSON.parse(JSON.stringify(record.itens_equipamentos)) : null,
        };
        
        classeIIINumericFields.forEach(field => {
            if (newRecord[field] === null || newRecord[field] === undefined) {
                newRecord[field] = 0;
            }
        });
        
        return newRecord;
      });

      if (newClasseIIIRecords.length > 0) {
        const { error: insertClasseIIIError } = await supabase
          .from("classe_iii_registros")
          .insert(newClasseIIIRecords as TablesInsert<'classe_iii_registros'>[]);
        if (insertClasseIIIError) {
          console.error("ERRO DE INSERÇÃO CLASSE III:", insertClasseIIIError);
          toast.error(`Erro ao clonar registros da Classe III: ${sanitizeError(insertClasseIIIError)}`);
        }
      }
    }
    
    // 4. Clone Classe V records
    await cloneClassRecords('classe_v_registros', 'itens_equipamentos', genericNumericFields);

    // 5. Clone Classe VI records
    await cloneClassRecords('classe_vi_registros', 'itens_equipamentos', genericNumericFields);

    // 6. Clone Classe VII records
    await cloneClassRecords('classe_vii_registros', 'itens_equipamentos', genericNumericFields);

    // 7. Clone Classe VIII Saúde records
    await cloneClassRecords('classe_viii_saude_registros', 'itens_saude', genericNumericFields);

    // 8. Clone Classe VIII Remonta records
    await cloneClassRecords('classe_viii_remonta_registros', 'itens_remonta', [...genericNumericFields, 'quantidade_animais']);

    // 9. Clone Classe IX records
    await cloneClassRecords('classe_ix_registros', 'itens_motomecanizacao', genericNumericFields);

    // 10. Clone p_trab_ref_lpc record (if exists)
    const { data: originalRefLPC, error: fetchRefLPCError } = await supabase
      .from("p_trab_ref_lpc")
      .select("*")
      .eq("p_trab_id", originalPTrabId)
      .maybeSingle();

    if (fetchRefLPCError) {
      console.error("Erro ao carregar referência LPC:", fetchRefLPCError);
    } else if (originalRefLPC) {
      const { id, created_at, updated_at, ...restOfRefLPC } = originalRefLPC;
      const newRefLPCData = {
        ...restOfRefLPC,
        p_trab_id: newPTrabId,
        preco_diesel: restOfRefLPC.preco_diesel ?? 0,
        preco_gasolina: restOfRefLPC.preco_gasolina ?? 0,
      };
      const { error: insertRefLPCError } = await supabase
        .from("p_trab_ref_lpc")
        .insert([newRefLPCData as TablesInsert<'p_trab_ref_lpc'>]);
      if (insertRefLPCError) {
        console.error("ERRO DE INSERÇÃO REF LPC:", insertRefLPCError);
        toast.error(`Erro ao clonar referência LPC: ${sanitizeError(insertRefLPCError)}`);
      }
    }
  };

  // Função para verificar se o PTrab precisa ser numerado
  const needsNumbering = (ptrab: PTrab) => {
    // Verifica se o numero_ptrab é "Minuta" ou se o status é 'aberto' ou 'em_andamento'
    return ptrab.status === 'aberto' || ptrab.status === 'em_andamento';
  };
  
  // Função para verificar se o PTrab está em um estado final
  const isFinalStatus = (ptrab: PTrab) => {
    return ptrab.status === 'aprovado' || ptrab.status === 'arquivado';
  };
  
  // =================================================================
  // LÓGICA DE CONSOLIDAÇÃO (NOVA IMPLEMENTAÇÃO)
  // =================================================================
  
  const handleOpenConsolidationNumberDialog = (selectedPTrabs: string[]) => {
    if (selectedPTrabs.length < 2) {
        toast.error("Selecione pelo menos dois P Trabs para consolidar.");
        return;
    }
    setSelectedPTrabsToConsolidate(selectedPTrabs);
    const newMinutaNumber = generateUniqueMinutaNumber(existingPTrabNumbers);
    setSuggestedConsolidationNumber(newMinutaNumber);
    setShowConsolidationDialog(false); // Fecha o diálogo de seleção
    setShowConsolidationNumberDialog(true); // Abre o diálogo de numeração
  };

  const handleConfirmConsolidation = async (finalMinutaNumber: string) => {
    if (selectedPTrabsToConsolidate.length < 2 || !user?.id) return;

    setLoading(true);
    setShowConsolidationNumberDialog(false);

    try {
        // 1. Obter os dados completos dos PTrabs selecionados
        const { data: selectedPTrabsData, error: fetchError } = await supabase
            .from('p_trab')
            .select('*')
            .in('id', selectedPTrabsToConsolidate);

        if (fetchError || !selectedPTrabsData || selectedPTrabsData.length === 0) {
            throw new Error("Falha ao carregar dados dos P Trabs selecionados.");
        }
        
        // Usar o primeiro PTrab como base para o cabeçalho
        const basePTrab = selectedPTrabsData[0];
        
        // NOVO: Destruturar e omitir campos que devem ser gerados pelo DB
        const { 
            id, created_at, updated_at, share_token, shared_with,
            ...restOfBasePTrab 
        } = basePTrab;
        
        // 2. Criar o novo PTrab consolidado (Minuta)
        const newPTrabData: TablesInsert<'p_trab'> = {
            ...restOfBasePTrab, // Usar o restante dos campos
            user_id: user.id,
            numero_ptrab: finalMinutaNumber,
            // MUDANÇA AQUI: Remove o prefixo "CONSOLIDADO - "
            nome_operacao: basePTrab.nome_operacao, 
            status: 'aberto',
            origem: 'consolidado',
            comentario: `Consolidação dos P Trabs: ${selectedPTrabsData.map(p => p.numero_ptrab).join(', ')}`,
            rotulo_versao: null,
            // id, created_at, updated_at, share_token são omitidos, permitindo que o DB gere os valores
        };

        const { data: newPTrab, error: insertError } = await supabase
            .from("p_trab")
            .insert([newPTrabData])
            .select('id')
            .single();
            
        if (insertError || !newPTrab) throw insertError;
        
        const newPTrabId = newPTrab.id;
        
        // 3. Clonar e Consolidar Registros de TODAS as Classes
        const tablesToConsolidate: (keyof Tables)[] = [
            'classe_i_registros', 'classe_ii_registros', 'classe_iii_registros', 
            'classe_v_registros', 'classe_vi_registros', 'classe_vii_registros', 
            'classe_viii_saude_registros', 'classe_viii_remonta_registros', 'classe_ix_registros'
        ];
        
        for (const tableName of tablesToConsolidate) {
            // Buscar todos os registros da tabela para todos os PTrabs selecionados
            const { data: records, error: recordsError } = await supabase
                .from(tableName)
                .select('*')
                .in('p_trab_id', selectedPTrabsToConsolidate);
                
            if (recordsError) {
                console.error(`Erro ao buscar registros de ${tableName} para consolidação:`, recordsError);
                toast.warning(`Aviso: Falha ao consolidar registros de ${tableName}.`);
                continue;
            }
            
            if (records && records.length > 0) {
                const newRecords = records.map(record => {
                    const { id, created_at, updated_at, ...restOfRecord } = record;
                    
                    // Ajusta o p_trab_id para o novo PTrab consolidado
                    const newRecord: TablesInsert<typeof tableName> = {
                        ...restOfRecord,
                        p_trab_id: newPTrabId,
                        // Garante que campos JSONB sejam copiados corretamente (se existirem)
                        ...(record.itens_equipamentos ? { itens_equipamentos: JSON.parse(JSON.stringify(record.itens_equipamentos)) } : {}),
                        ...(record.itens_saude ? { itens_saude: JSON.parse(JSON.stringify(record.itens_saude)) } : {}),
                        ...(record.itens_remonta ? { itens_remonta: JSON.parse(JSON.stringify(record.itens_remonta)) } : {}),
                        ...(record.itens_motomecanizacao ? { itens_motomecanizacao: JSON.parse(JSON.stringify(record.itens_motomecanizacao)) } : {}),
                    } as TablesInsert<typeof tableName>;
                    
                    return newRecord;
                });
                
                const { error: insertRecordsError } = await supabase
                    .from(tableName)
                    .insert(newRecords);
                    
                if (insertRecordsError) {
                    console.error(`Erro ao inserir registros consolidados de ${tableName}:`, insertRecordsError);
                    toast.warning(`Aviso: Falha ao inserir registros consolidados de ${tableName}.`);
                }
            }
        }
        
        // 4. Limpar créditos (opcional, mas recomendado para novo PTrab)
        await updateUserCredits(user.id, 0, 0);

        toast.success(`Consolidação concluída! Novo P Trab ${finalMinutaNumber} criado.`);
        loadPTrabs();
        
    } catch (error: any) {
        console.error("Erro na consolidação:", error);
        toast.error(sanitizeError(error));
    } finally {
        setLoading(false);
        setSelectedPTrabsToConsolidate([]);
    }
  };
  
  // PTrabs disponíveis para o ConsolidationNumberDialog
  const simplePTrabsToConsolidate = useMemo(() => {
    return pTrabs
        .filter(p => selectedPTrabsToConsolidate.includes(p.id))
        .map(p => ({ id: p.id, numero_ptrab: p.numero_ptrab, nome_operacao: p.nome_operacao }));
  }, [pTrabs, selectedPTrabsToConsolidate]);
  
  // =================================================================
  // LÓGICA DE COMPARTILHAMENTO (Passo 1)
  // =================================================================
  
  const handleOpenShareDialog = (ptrab: PTrab) => {
    setPtrabToShare(ptrab);
    setShowShareDialog(true);
  };
  
  // =================================================================
  // LÓGICA DE SOLICITAÇÃO DE COMPARTILHAMENTO (Passo 2)
  // =================================================================
  
  const handleOpenShareRequestDialog = () => {
    setShareLinkInput("");
    setShowShareRequestDialog(true);
  };
  
  const handleProcessShareLink = async (link: string) => {
    if (!user?.id) {
        toast.error("Você precisa estar logado para solicitar acesso.");
        return;
    }
    
    setLoading(true);
    
    try {
        // 1. Extrair ptrabId e token do link
        const url = new URL(link);
        const ptrabId = url.searchParams.get('ptrabId');
        const token = url.searchParams.get('token');
        
        if (!ptrabId || !token) {
            throw new Error("Link inválido. Certifique-se de que o link contém o ID do P Trab e o token.");
        }
        
        // 2. Redireciona para a página /share para processar o link
        // Isso garante que a lógica de contextualização e chamada RPC seja centralizada no SharePage
        navigate(`/share?ptrabId=${ptrabId}&token=${token}`);
        
    } catch (e: any) {
        toast.error(e.message || "Erro ao processar o link de compartilhamento.");
    } finally {
        setLoading(false);
        setShowShareRequestDialog(false);
    }
  };
  
  // =================================================================
  // LÓGICA DE GERENCIAMENTO DE SOLICITAÇÕES (Passo 3)
  // =================================================================
  
  const handleOpenShareRequestsDialog = (ptrabId: string) => {
    setPtrabToManageRequests(ptrabId);
    setShowShareRequestsDialog(true);
  };
  
  // =================================================================
  // LÓGICA DE DESVINCULAÇÃO (Passo 6)
  // =================================================================
  
  const handleUnshare = async (ptrabId: string, ptrabName: string) => {
    if (!user?.id) return;
    if (!confirm(`Tem certeza que deseja DESVINCULAR-SE do P Trab "${ptrabName}"? Você perderá o acesso colaborativo.`)) return;

    setLoading(true);
    try {
        // Remove o ID do usuário logado do array shared_with
        const { error } = await supabase
            .from('p_trab')
            .update({ 
                shared_with: pTrabs.find(p => p.id === ptrabId)?.shared_with?.filter(id => id !== user.id) || []
            })
            .eq('id', ptrabId);

        if (error) throw error;

        toast.success(`Você foi desvinculado do P Trab ${ptrabName}.`);
        loadPTrabs();
    } catch (error) {
        console.error("Erro ao desvincular P Trab:", error);
        toast.error("Erro ao desvincular P Trab. Tente novamente.");
    } finally {
        setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando P Trabs...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">Planos de Trabalho</h1>
              <p className="text-muted-foreground">Gerencie seu P Trab</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            
            {/* NOVO: Exibição explícita do usuário logado (Ajustado para Posto/Grad e Nome de Guerra) */}
            <div className="flex items-center gap-2 px-4 h-10 rounded-md bg-muted/50 border border-border">
              <User className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                {/* Se userName estiver preenchido (Posto/Grad NomeGuerra), usa ele. 
                    Caso contrário, se o usuário estiver carregado, mostra 'Perfil Incompleto'. */}
                {userName || (user ? 'Perfil Incompleto' : 'Carregando...')}
              </span>
            </div>
            
            {/* BOTÃO NOVO P TRAB */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetForm(); setDialogOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo P Trab
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Editar P Trab" : "Novo P Trab"}</DialogTitle>
                  {originalPTrabIdToClone && (
                    <DialogDescription className="text-green-600 font-medium">
                      Clonando dados de classes do P Trab original. Edite o cabeçalho e clique em Criar.
                    </DialogDescription>
                  )}
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* L1L: Número do P Trab (Agora Minuta/Obrigatório) */}
                    <div className="space-y-2">
                      <Label htmlFor="numero_ptrab">Número do P Trab *</Label>
                      <Input
                        id="numero_ptrab"
                        value={formData.numero_ptrab}
                        onChange={handleNumeroPTrabChange}
                        placeholder="Minuta"
                        maxLength={50}
                        required
                        onKeyDown={handleEnterToNextField}
                        // NEW: Disable if it's a Minuta number (Minuta-N)
                        disabled={formData.numero_ptrab.startsWith("Minuta") && !editingId}
                        className={formData.numero_ptrab.startsWith("Minuta") && !editingId ? "bg-muted/50 cursor-not-allowed" : ""}
                      />
                      <p className="text-xs text-muted-foreground">
                        {formData.numero_ptrab.startsWith("Minuta") 
                          ? "A numeração oficial (padrão: número/ano/OM) será atribuída após a aprovação."
                          : "O número oficial já foi atribuído."
                        }
                      </p>
                    </div>
                    {/* L1R: Nome da Operação */}
                    <div className="space-y-2">
                      <Label htmlFor="nome_operacao">Nome da Operação *</Label>
                      <Input
                        id="nome_operacao"
                        value={formData.nome_operacao}
                        onChange={(e) => setFormData({ ...formData, nome_operacao: e.target.value })}
                        required
                        onKeyDown={handleEnterToNextField}
                      />
                    </div>
                    
                    {/* L2L: Comando Militar de Área */}
                    <div className="space-y-2">
                      <Label htmlFor="comando_militar_area">Comando Militar de Área *</Label>
                      <Input
                        id="comando_militar_area"
                        value={formData.comando_militar_area}
                        onChange={(e) => setFormData({ ...formData, comando_militar_area: e.target.value })}
                        placeholder="Ex: Comando Militar da Amazônia"
                        maxLength={100}
                        required
                        onKeyDown={handleEnterToNextField}
                      />
                    </div>
                    {/* L2R: Nome da OM (por extenso) */}
                    <div className="space-y-2">
                      <Label htmlFor="nome_om_extenso">Nome da OM (por extenso) *</Label>
                      <Input
                        id="nome_om_extenso"
                        value={formData.nome_om_extenso}
                        onChange={(e) => setFormData({ ...formData, nome_om_extenso: e.target.value })}
                        placeholder="Ex: Comando da 23ª Brigada de Infantaria de Selva"
                        maxLength={300}
                        required
                        onKeyDown={handleEnterToNextField}
                      />
                      <p className="text-xs text-muted-foreground">
                        Este nome será usado no cabeçalho do P Trab impresso
                      </p>
                    </div>

                    {/* L3L: Nome da OM (sigla) */}
                    <div className="space-y-2">
                      <Label htmlFor="nome_om">Nome da OM (sigla) *</Label>
                      <OmSelector
                        selectedOmId={selectedOmId}
                        onChange={(omData: OMData | undefined) => {
                          if (omData) {
                            setSelectedOmId(omData.id);
                            setFormData({
                              ...formData,
                              nome_om: omData.nome_om,
                              nome_om_extenso: formData.nome_om_extenso,
                              codug_om: omData.codug_om,
                              rm_vinculacao: omData.rm_vinculacao,
                              codug_rm_vinculacao: omData.codug_rm_vinculacao,
                            });
                          } else {
                            setSelectedOmId(undefined);
                            setFormData({
                              ...formData,
                              nome_om: "",
                              nome_om_extenso: formData.nome_om_extenso,
                              codug_om: "",
                              rm_vinculacao: "",
                              codug_rm_vinculacao: "",
                            });
                          }
                        }}
                        placeholder="Selecione uma OM..."
                        disabled={loading}
                      />
                      {formData.codug_om && (
                        <p className="text-xs text-muted-foreground">
                          CODUG: {formData.codug_om} | RM: {formData.rm_vinculacao}
                        </p>
                      )}
                    </div>
                    {/* L3R: Efetivo Empregado */}
                    <div className="space-y-2">
                      <Label htmlFor="efetivo_empregado">Efetivo Empregado *</Label>
                      <Input
                        id="efetivo_empregado"
                        value={formData.efetivo_empregado}
                        onChange={(e) => setFormData({ ...formData, efetivo_empregado: e.target.value })}
                        placeholder="Ex: 110 militares e 250 OSP"
                        required
                        onKeyDown={handleEnterToNextField}
                      />
                    </div>

                    {/* L4L: Período Início */}
                    <div className="space-y-2">
                      <Label htmlFor="periodo_inicio">Período Início *</Label>
                      <Input
                        id="periodo_inicio"
                        type="date"
                        value={formData.periodo_inicio}
                        onChange={(e) => setFormData({ ...formData, periodo_inicio: e.target.value })}
                        required
                        onKeyDown={handleEnterToNextField}
                      />
                    </div>
                    {/* L4R: Período Fim */}
                    <div className="space-y-2">
                      <Label htmlFor="periodo_fim">Período Fim *</Label>
                      <Input
                        id="periodo_fim"
                        type="date"
                        value={formData.periodo_fim}
                        onChange={(e) => setFormData({ ...formData, periodo_fim: e.target.value })}
                        required
                        onKeyDown={handleEnterToNextField}
                      />
                    </div>
                    
                    {/* L5L: Local da OM */}
                    <div className="space-y-2">
                      <Label htmlFor="local_om">Local da OM *</Label>
                      <Input
                        id="local_om"
                        value={formData.local_om}
                        onChange={(e) => setFormData({ ...formData, local_om: e.target.value })}
                        placeholder="Ex: Marabá/PA"
                        maxLength={200}
                        required
                        onKeyDown={handleEnterToNextField}
                      />
                    </div>
                    {/* L5R: Nome do Comandante da OM */}
                    <div className="space-y-2">
                      <Label htmlFor="nome_cmt_om">Nome do Comandante da OM *</Label>
                      <Input
                        id="nome_cmt_om"
                        value={formData.nome_cmt_om}
                        onChange={(e) => setFormData({ ...formData, nome_cmt_om: e.target.value })}
                        maxLength={200}
                        required
                        onKeyDown={handleEnterToNextField}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="acoes">Ações realizadas ou a serem realizadas *</Label>
                    <Textarea
                      id="acoes"
                      value={formData.acoes}
                      onChange={(e) => setFormData({ ...formData, acoes: e.target.value })}
                      rows={4}
                      maxLength={2000}
                      required // Adicionado required aqui
                      onKeyDown={handleEnterToNextField}
                    />
                  </div>
                  {/* REMOVIDO: Campo de Comentário */}
                  <DialogFooter>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Aguarde..." : (editingId ? "Atualizar" : "Criar")}
                    </Button>
                    <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            
            {/* BOTÃO DE CONSOLIDAÇÃO ENVOLVIDO POR TOOLTIP */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* O span é necessário para que o Tooltip funcione em elementos desabilitados */}
                  <span className="inline-block">
                    <Button 
                      onClick={() => {
                        if (!isConsolidationDisabled) {
                          setShowConsolidationDialog(true);
                        } else {
                          // Dispara o toast ao clicar no botão desativado
                          toast.info(getConsolidationDisabledMessage());
                        }
                      }} 
                      variant="secondary"
                      disabled={isConsolidationDisabled}
                      // Adiciona style para garantir que o clique seja capturado pelo Button e não pelo span
                      style={isConsolidationDisabled ? { pointerEvents: 'auto' } : {}} 
                    >
                      <ArrowRight className="mr-2 h-4 w-4" />
                      Consolidar P Trab
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {isConsolidationDisabled ? (
                    <p className="text-xs text-orange-400 max-w-xs">
                      {getConsolidationDisabledMessage()}
                    </p>
                  ) : (
                    <p>{consolidationTooltipText}</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* NOVO BOTÃO DE VINCULAR P TRAB (Passo 2) */}
            <Button 
                onClick={handleOpenShareRequestDialog} 
                variant="outline"
                className="flex items-center gap-2"
            >
                <Link className="h-4 w-4" />
                Vincular P Trab
            </Button>
            
            {/* NOVO BOTÃO DE GERENCIAR SOLICITAÇÕES (Passo 3) */}
            {totalPendingRequests > 0 && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button 
                                onClick={() => {
                                    // Abre o diálogo de gerenciamento para o primeiro PTrab com solicitação pendente
                                    const ptrabWithRequest = pTrabs.find(p => p.pendingRequestsCount > 0);
                                    if (ptrabWithRequest) {
                                        handleOpenShareRequestsDialog(ptrabWithRequest.id);
                                    }
                                }} 
                                variant="destructive"
                                size="icon"
                                className="relative"
                            >
                                <Bell className="h-5 w-5" />
                                <Badge 
                                    variant="default" 
                                    className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-red-700 text-white"
                                >
                                    {totalPendingRequests}
                                </Badge>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{totalPendingRequests} solicitações de acesso pendentes.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}

            {/* NOVO BOTÃO DE AJUDA */}
            <HelpDialog />

            <DropdownMenu open={settingsDropdownOpen} onOpenChange={setSettingsDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-56"
                onPointerLeave={() => setSettingsDropdownOpen(false)}
              >
                <DropdownMenuLabel>Configurações</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {/* NOVO ITEM: Perfil do Usuário */}
                <DropdownMenuItem onClick={() => navigate("/config/profile")}>
                  Perfil do Usuário
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={() => navigate("/config/diretrizes")}>
                  Diretriz de Custeio
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/config/visualizacao")}>
                  Opção de Visualização
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/config/om")}>
                  Relação de OM (CODUG)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/config/ptrab-export-import")}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar/Importar P Trab
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button onClick={handleLogout} variant="outline">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Planos de Trabalho Cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2 mx-auto" />
                <h3 className="text-lg font-semibold text-foreground">Carregando P Trabs...</h3>
                <p className="text-sm text-muted-foreground mt-1">Calculando totais de classes.</p>
              </div>
            ) : pTrabs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold">Nenhum Plano de Trabalho Registrado</h3>
                <p className="text-muted-foreground mt-2">
                  Clique em "Novo P Trab" para começar a configurar seu primeiro Plano de Trabalho.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center border-b border-border">Número</TableHead>
                    <TableHead className="text-center border-b border-border">Operação</TableHead>
                    <TableHead className="text-center border-b border-border">Período</TableHead>
                    <TableHead className="text-center border-b border-border">Status</TableHead>
                    <TableHead className="text-center border-b border-border">Valor P Trab</TableHead>
                    <TableHead className="text-center border-b border-border w-[50px]"></TableHead>
                    <TableHead className="text-center border-b border-border">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pTrabs.map((ptrab) => {
                    const isOwner = ptrab.user_id === user?.id;
                    const originBadge = getOriginBadge(ptrab.origem);
                    const shareStatusBadge = getShareStatusBadge(ptrab, user?.id); // NOVO
                    const isMinuta = ptrab.numero_ptrab.startsWith("Minuta");
                    const isNumbered = !needsNumbering(ptrab);
                    // MUDANÇA: Editável se não for aprovado/arquivado E se for o dono OU compartilhado
                    const isEditable = (ptrab.status !== 'aprovado' && ptrab.status !== 'arquivado') && (isOwner || ptrab.isShared); 
                    const isApprovedOrArchived = isFinalStatus(ptrab); // NOVO: Verifica se está em status final
                    
                    const totalGeral = (ptrab.totalLogistica || 0) + (ptrab.totalOperacional || 0) + (ptrab.totalMaterialPermanente || 0);
                    
                    // MUDANÇA AQUI: Limpa o nome da operação se for consolidado
                    const displayOperationName = cleanOperationName(ptrab.nome_operacao, ptrab.origem);
                    
                    return (
                    <TableRow key={ptrab.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col items-center">
                          {/* Lógica de exibição do número: Se for Minuta arquivada, mostra apenas MINUTA */}
                          {ptrab.status === 'arquivado' && isMinuta ? (
                            <span className="text-gray-500 font-bold">MINUTA</span>
                          ) : ptrab.status === 'aprovado' || ptrab.status === 'arquivado' ? (
                            <span>{ptrab.numero_ptrab}</span>
                          ) : (
                            <span className="text-red-500 font-bold">
                              {isMinuta ? "MINUTA" : "PENDENTE"}
                            </span>
                          )}
                          <Badge 
                            variant="outline" 
                            className={`mt-1 text-xs font-semibold ${originBadge.className}`}
                          >
                            {originBadge.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start">
                          <span>{displayOperationName}</span>
                          {/* NOVO RÓTULO DE VERSÃO - AGORA VISÍVEL */}
                          {ptrab.rotulo_versao && ( // Check rotulo_versao
                            <Badge variant="secondary" className="mt-1 text-xs bg-secondary text-secondary-foreground">
                              <GitBranch className="h-3 w-3 mr-1" />
                              {ptrab.rotulo_versao}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center">
                          <span className="block">
                            {new Date(ptrab.periodo_inicio).toLocaleDateString('pt-BR')}
                          </span>
                          <span className="block font-bold text-sm">-</span>
                          <span className="block">
                            {new Date(ptrab.periodo_fim).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {calculateDays(ptrab.periodo_inicio, ptrab.periodo_fim)} dias
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-center">
                          {/* MUDANÇA: Substituído Select por Badge estático */}
                          <Badge 
                            className={cn(
                              "w-[140px] h-7 text-xs flex items-center justify-center",
                              statusConfig[ptrab.status as keyof typeof statusConfig]?.className || 'bg-background'
                            )}
                          >
                            {statusConfig[ptrab.status as keyof typeof statusConfig]?.label || ptrab.status}
                          </Badge>
                          {/* NOVO: Badge de Compartilhamento (Passo 4) */}
                          {shareStatusBadge && (
                            <Badge 
                                variant="outline" 
                                className={cn(
                                    "mt-1 text-xs font-semibold w-[140px] h-7 flex items-center justify-center cursor-pointer",
                                    shareStatusBadge.className
                                )}
                                onClick={() => {
                                    // Ação ao clicar no badge de compartilhamento (Passo 5)
                                    if (isOwner) {
                                        handleOpenShareRequestsDialog(ptrab.id);
                                    }
                                }}
                            >
                                <Users className="h-3 w-3 mr-1" />
                                {shareStatusBadge.label}
                                {/* NOVO: Indicador de solicitações pendentes */}
                                {isOwner && ptrab.pendingRequestsCount > 0 && (
                                    <span className="ml-2 bg-red-500 text-white rounded-full px-2 text-[10px]">
                                        {ptrab.pendingRequestsCount}
                                    </span>
                                )}
                            </Badge>
                          )}
                          <div className="text-xs text-muted-foreground mt-1 flex flex-col items-center">
                            <span className="block">Última alteração:</span>
                            <span className="block">{formatDateTime(ptrab.updated_at)}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-left w-[200px]">
                        <div className="flex flex-col text-xs space-y-1">
                          
                          {/* 1. Aba Logística (Valor) */}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Log:</span>
                            <span className="text-orange-600 font-medium">
                              {formatCurrency(ptrab.totalLogistica || 0)}
                            </span>
                          </div>
                          
                          {/* 2. Aba Operacional (Valor) */}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Op:</span>
                            <span className="text-blue-600 font-medium">
                              {formatCurrency(ptrab.totalOperacional || 0)}
                            </span>
                          </div>
                          
                          {/* 3. Aba Material Permanente (Valor) */}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Mat Perm:</span>
                            <span className="text-green-600 font-medium">
                              {formatCurrency(ptrab.totalMaterialPermanente || 0)}
                            </span>
                          </div>
                          
                          {/* Separador e Total Geral */}
                          {/* Removida a condição (totalGeral > 0) para garantir que o total 0,00 seja exibido */}
                          <>
                            <div className="w-full h-px bg-muted-foreground/30 my-1" />
                            <div className="flex justify-between font-bold text-sm text-foreground">
                              <span>Total:</span>
                              <span>{formatCurrency(totalGeral)}</span>
                            </div>
                          </>
                          
                          {/* Separador para Quantidades */}
                          <div className="w-full h-px bg-muted-foreground/30 my-1" />
                          
                          {/* 5. Quantidade de Ração Op */}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Rç Op:</span>
                            <span className="font-medium">
                              {/* Exibe 0 Unid. se for 0 ou undefined */}
                              {`${ptrab.quantidadeRacaoOp || 0} Unid.`}
                            </span>
                          </div>
                          
                          {/* 6. Quantidade de Horas de Voo */}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">HV:</span>
                            <span className="font-medium">
                              {/* Exibe 0 h se for 0 ou undefined */}
                              {`${ptrab.quantidadeHorasVoo || 0} h`}
                            </span>
                          </div>
                          
                          {/* Caso não haja nenhum valor - REMOVIDO */}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleOpenComentario(ptrab)}
                              >
                                <MessageSquare 
                                  className={`h-5 w-5 transition-all ${
                                    ptrab.comentario && ptrab.status !== 'arquivado'
                                      ? "text-green-600 fill-green-600" 
                                      : "text-gray-300"
                                  }`}
                                />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{ptrab.comentario && ptrab.status !== 'arquivado' ? "Editar comentário" : "Adicionar comentário"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          
                          {/* Botão Aprovar: Aparece SEMPRE se precisar de numeração OU se estiver em status final */}
                          {(needsNumbering(ptrab) || isApprovedOrArchived) && isOwner && ( // Apenas o dono pode aprovar
                            <Button
                              onClick={() => handleOpenApproveDialog(ptrab)}
                              size="sm"
                              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                              disabled={loading || isApprovedOrArchived} // Desabilita se estiver em status final
                            >
                              <CheckCircle className="h-4 w-4" />
                              Aprovar
                            </Button>
                          )}

                          {/* Botão Preencher: Aparece SEMPRE, mas desabilitado se não for editável */}
                          <Button
                            onClick={() => handleSelectPTrab(ptrab)}
                            size="sm"
                            className="flex items-center gap-2"
                            disabled={!isEditable}
                          >
                            <FileText className="h-4 w-4" />
                            Preencher
                          </Button>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              
                              {/* NOVO: Botão Compartilhar (Passo 1) / Desvincular (Passo 6) */}
                              {isOwner ? (
                                <DropdownMenuItem 
                                    onClick={() => handleOpenShareDialog(ptrab)}
                                    disabled={ptrab.status === 'arquivado'}
                                >
                                    <Link className="mr-2 h-4 w-4" />
                                    Compartilhar
                                </DropdownMenuItem>
                              ) : ptrab.isShared ? (
                                <DropdownMenuItem 
                                    onClick={() => handleUnshare(ptrab.id, `${ptrab.numero_ptrab} - ${ptrab.nome_operacao}`)}
                                    className="text-destructive"
                                >
                                    <Users className="mr-2 h-4 w-4" />
                                    Desvincular
                                </DropdownMenuItem>
                              ) : null}
                              
                              {isOwner && <DropdownMenuSeparator />}
                              
                              <DropdownMenuItem 
                                onClick={() => handleNavigateToPrintOrExport(ptrab.id)}
                              >
                                <Printer className="mr-2 h-4 w-4" />
                                Visualizar Impressão
                              </DropdownMenuItem>
                              
                              {/* Ação 2: Editar P Trab (Sempre visível, desabilitado se aprovado ou arquivado) */}
                              <DropdownMenuItem 
                                onClick={() => isEditable && handleEdit(ptrab)}
                                disabled={!isEditable}
                                className={!isEditable ? "opacity-50 cursor-not-allowed" : ""}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar P Trab
                              </DropdownMenuItem>
                              
                              {/* Ação 3: Clonar P Trab (Desabilitado se arquivado) */}
                              <DropdownMenuItem 
                                onClick={() => ptrab.status !== 'arquivado' && handleOpenCloneOptions(ptrab)}
                                disabled={ptrab.status === 'arquivado'}
                                className={ptrab.status === 'arquivado' ? "opacity-50 cursor-not-allowed" : ""}
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Clonar P Trab
                              </DropdownMenuItem>
                              
                              {/* NOVO: Arquivar (Disponível se NÃO estiver arquivado E for o dono) */}
                              {ptrab.status !== 'arquivado' && isOwner && (
                                <DropdownMenuItem 
                                  onClick={() => handleArchive(ptrab.id, `${ptrab.numero_ptrab} - ${ptrab.nome_operacao}`)}
                                >
                                  <Archive className="mr-2 h-4 w-4" />
                                  Arquivar
                                </DropdownMenuItem>
                              )}
                              
                              {/* Ação 5: Reativar (Disponível APENAS se estiver arquivado E for o dono) */}
                              {ptrab.status === 'arquivado' && isOwner && (
                                  <DropdownMenuItem 
                                      onClick={() => {
                                          setPtrabToReactivateId(ptrab.id);
                                          setPtrabToReactivateName(`${ptrab.numero_ptrab} - ${ptrab.nome_operacao}`);
                                          setShowReactivateStatusDialog(true);
                                      }}
                                  >
                                      <RefreshCw className="mr-2 h-4 w-4" />
                                      Reativar
                                  </DropdownMenuItem>
                              )}
                              
                              <DropdownMenuSeparator />
                              
                              {/* Ação 6: Excluir (Sempre disponível, mas RLS impede se não for o dono) */}
                              <DropdownMenuItem 
                                onClick={() => handleDelete(ptrab.id)}
                                className={isOwner ? "text-red-600" : "opacity-50 cursor-not-allowed"}
                                disabled={!isOwner} // Desabilita o botão de exclusão para usuários compartilhados (Passo 6)
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );})}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showArchiveStatusDialog} onOpenChange={setShowArchiveStatusDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar P Trab?</AlertDialogTitle>
            <AlertDialogDescription>
              O P Trab "{ptrabToArchiveName}" está com status "Aprovado" há mais de 10 dias. Deseja arquivá-lo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelArchiveStatus}>Agora não</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmArchiveStatus}>Sim, arquivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showReactivateStatusDialog} onOpenChange={setShowReactivateStatusDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reativar P Trab?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja reativar o P Trab "{ptrabToReactivateName}"? Ele retornará ao status de "Aprovado" (se já numerado) ou "Aberto" (se for Minuta), permitindo novas edições.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleConfirmReactivateStatus} disabled={loading}>
              {loading ? "Aguarde..." : "Confirmar Reativação"}
            </AlertDialogAction>
            <AlertDialogCancel onClick={handleCancelReactivateStatus} disabled={loading}>
              Cancelar
            </AlertDialogCancel>
          </DialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de Opções de Clonagem */}
      <Dialog open={showCloneOptionsDialog} onOpenChange={setShowCloneOptionsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clonar Plano de Trabalho</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Clonando: <span className="font-medium">{ptrabToClone?.numero_ptrab} - {ptrabToClone?.nome_operacao}</span>
            </p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <RadioGroup 
              value={cloneType} 
              onValueChange={(value: 'new' | 'variation') => setCloneType(value)}
              className="grid grid-cols-2 gap-4"
            >
              <Label
                htmlFor="clone-new"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
              >
                <RadioGroupItem id="clone-new" value="new" className="sr-only" />
                <span className="mb-3 text-lg font-semibold">Novo P Trab</span>
                <p className="text-sm text-muted-foreground text-center">
                  Cria um P Trab totalmente novo, iniciando como Minuta para posterior numeração.
                </p>
              </Label>
              <Label
                htmlFor="clone-variation"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
              >
                <RadioGroupItem id="clone-variation" value="variation" className="sr-only" />
                <span className="mb-3 text-lg font-semibold">Variação do Trabalho</span>
                <p className="text-sm text-muted-foreground text-center">
                  Cria uma variação do P Trab atual, gerando um novo número de Minuta.
                </p>
              </Label>
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleConfirmCloneOptions}>Continuar</Button>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Variação do Trabalho (NOVO) */}
      {ptrabToClone && (
        <CloneVariationDialog
          open={showCloneVariationDialog}
          onOpenChange={setShowCloneVariationDialog}
          originalNumber={ptrabToClone.numero_ptrab}
          suggestedCloneNumber={suggestedCloneNumber}
          onConfirm={handleConfirmCloneVariation}
        />
      )}

      {/* Dialog de Comentário */}
      <Dialog open={showComentarioDialog} onOpenChange={setShowComentarioDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Comentário do P Trab</DialogTitle>
            {ptrabComentario && (
              <p className="text-sm text-muted-foreground">
                {ptrabComentario.numero_ptrab} - {ptrabComentario.nome_operacao}
              </p>
            )}
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Digite seu comentário sobre este P Trab..."
              value={comentarioText}
              onChange={(e) => setComentarioText(e.target.value)}
              className="min-h-[150px]"
            />
          </div>
          <DialogFooter>
            <Button onClick={handleSaveComentario}>
              Salvar
            </Button>
            <Button variant="outline" onClick={() => setShowComentarioDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Aprovação e Numeração */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Aprovar e Numerar P Trab
            </DialogTitle>
            <DialogDescription>
              Atribua o número oficial ao P Trab "{ptrabToApprove?.nome_operacao}".
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="approve-number">Número Oficial do P Trab *</Label>
              <Input
                id="approve-number"
                value={suggestedApproveNumber}
                onChange={(e) => setSuggestedApproveNumber(e.target.value)}
                placeholder={`Ex: 1${yearSuffix}/${ptrabToApprove?.nome_om}`}
                maxLength={50}
                onKeyDown={handleEnterToNextField}
              />
              <p className="text-xs text-muted-foreground">
                Padrão sugerido: Número/Ano/Sigla da OM.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleApproveAndNumber} disabled={loading || !suggestedApproveNumber.trim()}>
              {loading ? "Aguarde..." : "Confirmar Aprovação"}
            </Button>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Consolidação (Seleção) */}
      <PTrabConsolidationDialog
        open={showConsolidationDialog}
        onOpenChange={setShowConsolidationDialog}
        pTrabsList={pTrabs.filter(p => p.status !== 'arquivado').map(p => ({ id: p.id, numero_ptrab: p.numero_ptrab, nome_operacao: p.nome_operacao }))}
        existingPTrabNumbers={existingPTrabNumbers}
        onConfirm={handleOpenConsolidationNumberDialog} // MUDANÇA: Abre o diálogo de numeração
        loading={loading}
      />
      
      {/* Diálogo de Numeração de Consolidação (NOVO) */}
      <ConsolidationNumberDialog
        open={showConsolidationNumberDialog}
        onOpenChange={setShowConsolidationNumberDialog}
        suggestedNumber={suggestedConsolidationNumber}
        existingNumbers={existingPTrabNumbers}
        selectedPTrabs={simplePTrabsToConsolidate}
        onConfirm={handleConfirmConsolidation}
        loading={loading}
      />
      
      {/* NOVO: Diálogo de Compartilhamento (Passo 1) */}
      {ptrabToShare && (
        <ShareDialog
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
          ptrab={ptrabToShare}
        />
      )}
      
      {/* NOVO: Diálogo de Solicitação de Compartilhamento (Passo 2) */}
      <ShareRequestDialog
        open={showShareRequestDialog}
        onOpenChange={setShowShareRequestDialog}
        onConfirm={handleProcessShareLink}
        loading={loading}
      />
      
      {/* NOVO: Diálogo de Gerenciamento de Solicitações (Passo 3) */}
      {ptrabToManageRequests && (
        <ShareRequestsDialog
          open={showShareRequestsDialog}
          onOpenChange={setShowShareRequestsDialog}
          ptrabId={ptrabToManageRequests}
          onUpdate={loadPTrabs} // Recarrega a lista de PTrabs após aprovação/rejeição
        />
      )}
      
      {/* NOVO: Diálogo de Prompt de Crédito */}
      <CreditPromptDialog
        open={showCreditPrompt}
        onConfirm={handlePromptConfirm}
        onCancel={handlePromptCancel}
      />
      
      {/* NOVO: Drawer de Chat com IA */}
      <AIChatDrawer />
    </div>
  );
};

export default PTrabManager;