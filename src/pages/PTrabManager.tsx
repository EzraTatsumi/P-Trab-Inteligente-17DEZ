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
import { Tables, TablesInsert, TablesUpdate, TableName } from "@/integrations/supabase/types";
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
  "Comando Militar da Amazônia",
  "Comando Militar do Norte",
  "Comando Militar do Nordeste",
  "Comando Militar do Planalto",
  "Comando Militar do Oeste",
  "Comando Militar do Leste",
  "Comando Militar do Sudeste",
  "Comando Militar do Sul",
];

// =================================================================
// REFACTOR: Usar novos variantes de Badge
// =================================================================
const statusConfig = {
  'aberto': { 
    variant: 'ptrab-aberto' as const, 
    label: 'Aberto',
  },
  'em_andamento': { 
    variant: 'ptrab-em-andamento' as const, 
    label: 'Em Andamento',
  },
  'aprovado': { 
    variant: 'ptrab-aprovado' as const, 
    label: 'Aprovado',
  },
  'arquivado': { 
    variant: 'ptrab-arquivado' as const, 
    label: 'Arquivado',
  }
};
// =================================================================
// FIM REFACTOR
// =================================================================

const PTrabManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pTrabs, setPTrabs] = useState<PTrab[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [existingPTrabNumbers, setExistingPTrabNumbers] = useState<string[]>([]);
  
  const { user } = useSession();
  const [userName, setUserName] = useState<string>("");
  
  // Estado para controlar a abertura do DropdownMenu de configurações
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);

  // Estados para o AlertDialog de status "arquivado"
  const [showArchiveStatusDialog, setShowArchiveStatusDialog] = useState(false);
  const [ptrabToArchiveId, setPtrabToArchiveId] = useState<string | null>(null);
  const [ptrabToArchiveName, setPtrabToArchiveName] = useState<string | null>(null);
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
  
  const [originalPTrabIdToClone, setOriginalPTrabIdToClone] = useState(null as string | null);

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
  const hasBeenPrompted = useRef(new Set<string>()); // FIX: Correctly declared with 'const'

  // =================================================================
  // ESTADOS DE COMPARTILHAMENTO (NOVOS)
  // =================================================================
  const [showShareLinkDialog, setShowShareLinkDialog] = useState(false);
  const [ptrabToShare, setPtrabToShare] = useState<PTrab | null>(null);
  const [shareLink, setShareLink] = useState<string>("");
  
  const [showLinkPTrabDialog, setShowLinkPTrabDialog] = useState(false);
  const [linkPTrabInput, setLinkPTrabInput] = useState("");
  
  const [showManageSharingDialog, setShowManageSharingDialog] = useState(false);
  const [ptrabToManageSharing, setPtrabToManageSharing] = useState<PTrab | null>(null);
  
  const [showUnlinkPTrabDialog, setShowUnlinkPTrabDialog] = useState(false);
  const [ptrabToUnlink, setPtrabToUnlink] = useState<PTrab | null>(null);
  
  // =================================================================
  // FIM ESTADOS DE COMPARTILHAMENTO
  // =================================================================

  const currentYear = new Date().getFullYear();
  const yearSuffix = `/${currentYear}`;

  // =================================================================
  // FUNÇÕES AUXILIARES
  // =================================================================
  
  const fetchUserName = useCallback(async (userId: string, userMetadata: any) => {
    // Buscar o perfil para obter o last_name e o raw_user_meta_data (que contém posto_graduacao)
    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('last_name, raw_user_meta_data') 
        .eq('id', userId)
        .single();

    if (profileError) {
        console.error("Error fetching user profile:", profileError);
    }
    
    // Usar dados do perfil se disponíveis, senão usar o metadata do auth.user
    const nomeGuerra = profileData?.last_name || '';
    
    // Acessar posto_graduacao e nome_om do raw_user_meta_data do perfil (que é JSONB)
    const profileMetadata = profileData?.raw_user_meta_data as { posto_graduacao?: string, nome_om?: string } | undefined;
    const postoGraduacao = profileMetadata?.posto_graduacao?.trim() || userMetadata?.posto_graduacao?.trim() || '';
    const nomeOM = profileMetadata?.nome_om?.trim() || '';
    
    let nameParts: string[] = [];
    
    if (postoGraduacao) {
        nameParts.push(postoGraduacao);
    }
    
    if (nomeGuerra) {
        nameParts.push(nomeGuerra);
    }
    
    let finalName = nameParts.join(' ');
    
    if (nomeOM) {
        finalName += ` (${nomeOM})`;
    }
    
    if (!finalName.trim()) {
        return 'Perfil Incompleto';
    }

    return finalName; 
  }, []);

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  // =================================================================
  // REFACTOR: Usar novos variantes de Badge
  // =================================================================
  const getOriginBadge = (origem: PTrabDB['origem']) => {
    switch (origem) {
        case 'importado':
            return { label: 'Importado', variant: 'ptrab-importado' as const };
        case 'consolidado':
            return { label: 'Consolidado', variant: 'ptrab-consolidado' as const };
        case 'original':
        default:
            return { label: 'Original', variant: 'ptrab-original' as const }; 
    }
  };
  // =================================================================
  // FIM REFACTOR
  // =================================================================
  
  const cleanOperationName = (name: string, origem: PTrabDB['origem']) => {
    if (origem === 'consolidado' && name.startsWith('CONSOLIDADO - ')) {
        return name.replace('CONSOLIDADO - ', '');
    }
    return name;
  };

  const handleSelectPTrab = (ptrab: PTrab) => {
      navigate(`/ptrab/form?ptrabId=${ptrab.id}`);
  };

  const handleNavigateToPrintOrExport = (ptrabId: string) => {
      navigate(`/ptrab/print?ptrabId=${ptrabId}`);
  };

  const consolidationTooltipText = "Selecione múltiplos P Trabs para consolidar seus custos em um novo P Trab.";

  const isConsolidationDisabled = useMemo(() => {
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
      setShowCreditPrompt(false);
      navigate(`/ptrab/form?ptrabId=${ptrabToFill?.id}&openCredit=true`);
  };

  const handlePromptCancel = () => {
      setShowCreditPrompt(false);
  };
  
  // Função de reset do formulário (usando useCallback para evitar recriação desnecessária)
  const resetForm = useCallback(() => {
    setEditingId(null);
    setSelectedOmId(undefined);
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
    });
  }, [existingPTrabNumbers]);

  const [formData, setFormData] = useState({
    numero_ptrab: "Minuta",
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
    comentario: "",
    rotulo_versao: null as string | null,
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

  const loadPTrabs = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      // A query agora busca PTrabs onde o usuário é o dono OU está na lista shared_with
      const { data: pTrabsData, error: pTrabsError } = await supabase
        .from("p_trab")
        .select("*, comentario, origem, rotulo_versao, user_id, shared_with, share_token") // Incluir share_token
        .or(`user_id.eq.${user.id},shared_with.cs.{${user.id}}`)
        .order("created_at", { ascending: false });

      if (pTrabsError) throw pTrabsError;

      if (!Array.isArray(pTrabsData)) {
        console.error("Invalid data received from p_trab table");
        setPTrabs([]);
        return;
      }

      const typedPTrabsData = pTrabsData as unknown as PTrabDB[];

      const numbers = (typedPTrabsData || []).map(p => p.numero_ptrab);
      setExistingPTrabNumbers(numbers);
      
      // Buscar solicitações pendentes para os PTrabs do usuário (apenas se for o dono)
      const ownedPTrabIds = typedPTrabsData.filter(p => p.user_id === user.id).map(p => p.id);
      let pendingRequests: Tables<'ptrab_share_requests'>[] = [];
      
      if (ownedPTrabIds.length > 0) {
          const { data: requestsData, error: requestsError } = await supabase
              .from('ptrab_share_requests')
              .select('id, ptrab_id, requester_id, share_token, status, created_at, updated_at') // Selecionar todas as colunas
              .in('ptrab_id', ownedPTrabIds)
              .eq('status', 'pending');
              
          if (requestsError) console.error("Erro ao carregar solicitações pendentes:", requestsError);
          // FIX 1: requestsData agora é do tipo correto (Tables<'ptrab_share_requests'>[])
          else pendingRequests = requestsData || []; 
      }
      
      const ptrabsWithPendingRequests = new Set(pendingRequests.map(r => r.ptrab_id));

      const pTrabsWithTotals: PTrab[] = await Promise.all(
        (typedPTrabsData || []).map(async (ptrab) => {
          let totalOperacionalCalculado = 0;
          let totalLogisticaCalculado = 0;
          let totalMaterialPermanenteCalculado = 0;
          let quantidadeRacaoOpCalculada = 0;
          let quantidadeHorasVooCalculada = 0;

          // 1. Fetch Classe I totals (33.90.30)
          const { data: classeIData, error: classeIError } = await supabase
            .from('classe_i_registros')
            .select('total_qs, total_qr, quantidade_r2, quantidade_r3')
            .eq('p_trab_id', ptrab.id);

          let totalClasseI = 0;
          if (classeIError) console.error("Erro ao carregar Classe I para PTrab", ptrab.numero_ptrab, classeIError);
          else {
            totalClasseI = (classeIData || []).reduce((sum, record) => sum + record.total_qs + record.total_qr, 0);
            quantidadeRacaoOpCalculada = (classeIData || []).reduce((sum, record) => sum + (record.quantidade_r2 || 0) + (record.quantidade_r3 || 0), 0);
          }
          
          // 2. Fetch Classes II, V, VI, VII, VIII, IX totals (33.90.30 + 33.90.39)
          const { data: classeIIData, error: classeIIError } = await supabase
            .from('classe_ii_registros')
            .select('valor_total') // FIX 2: Selecting valor_total
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
          
          // 4. Fetch Diaria totals (33.90.15 and 33.90.30)
          const { data: diariaData, error: diariaError } = await supabase
            .from('diaria_registros') // FIX 3: Table name is now recognized
            .select('valor_nd_15, valor_nd_30')
            .eq('p_trab_id', ptrab.id);

          let totalDiariaND15 = 0;
          let totalDiariaND30 = 0;
          
          if (diariaError) console.error("Erro ao carregar Diárias para PTrab", ptrab.numero_ptrab, diariaError);
          else {
              // FIX 4 & 5: Properties are now correctly typed
              totalDiariaND15 = (diariaData || []).reduce((sum, record) => sum + (record.valor_nd_15 || 0), 0); 
              totalDiariaND30 = (diariaData || []).reduce((sum, record) => sum + (record.valor_nd_30 || 0), 0);
          }
          
          // 5. Fetch Verba Operacional totals (33.90.30 and 33.90.39)
          const { data: verbaOperacionalData, error: verbaOperacionalError } = await supabase
            .from('verba_operacional_registros')
            .select('valor_nd_30, valor_nd_39')
            .eq('p_trab_id', ptrab.id);
            
          let totalVerbaOperacional = 0;
          if (verbaOperacionalError) console.error("Erro ao carregar Verba Operacional para PTrab", ptrab.numero_ptrab, verbaOperacionalError);
          else {
              totalVerbaOperacional = (verbaOperacionalData || []).reduce((sum, record) => sum + (record.valor_nd_30 || 0) + (record.valor_nd_39 || 0), 0);
          }
          
          // 6. Fetch Passagem totals (33.90.33) - NOVO
          const { data: passagemData, error: passagemError } = await supabase
            .from('passagem_registros')
            .select('valor_nd_33')
            .eq('p_trab_id', ptrab.id);
            
          let totalPassagemND33 = 0;
          if (passagemError) console.error("Erro ao carregar Passagens para PTrab", ptrab.numero_ptrab, passagemError);
          else {
              totalPassagemND33 = (passagemData || []).reduce((sum, record) => sum + (record.valor_nd_33 || 0), 0);
          }


          // SOMA TOTAL DA ABA LOGÍSTICA
          // Logística = Classe I + Classes Diversas + Classe III
          totalLogisticaCalculado = totalClasseI + totalClassesDiversas + totalClasseIII;
          
          // SOMA TOTAL DA ABA OPERACIONAL
          // Operacional = Diárias (ND 15) + Verba Operacional + Passagens (ND 33)
          totalOperacionalCalculado = totalDiariaND15 + totalVerbaOperacional + totalPassagemND33;
          
          const isOwner = ptrab.user_id === user.id;
          const isShared = !isOwner && (ptrab.shared_with || []).includes(user.id);
          
          return {
            ...ptrab,
            totalLogistica: totalLogisticaCalculado,
            totalOperacional: totalOperacionalCalculado,
            totalMaterialPermanente: totalMaterialPermanenteCalculado,
            quantidadeRacaoOp: quantidadeRacaoOpCalculada,
            quantidadeHorasVoo: quantidadeHorasVooCalculada,
            isOwner: isOwner,
            isShared: isShared,
            hasPendingRequests: isOwner && ptrabsWithPendingRequests.has(ptrab.id),
          } as PTrab;
        })
      );

      setPTrabs(pTrabsWithTotals);

      // Lógica para perguntar sobre arquivamento (mantida)
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      for (const ptrab of pTrabsWithTotals) {
        if (
          ptrab.status === 'aprovado' && 
          ptrab.isOwner &&
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
  }, [setLoading, setPTrabs, setExistingPTrabNumbers, user?.id]);

  useEffect(() => {
    checkAuth();
    loadPTrabs();
    
    if (user?.id) {
        fetchUserName(user.id, user.user_metadata).then(name => {
            setUserName(name || ""); 
        });
    }
  }, [loadPTrabs, user, fetchUserName]);

  // Efeito para atualizar o número sugerido no diálogo de clonagem (mantido)
  useEffect(() => {
    if (ptrabToClone) {
      let newSuggestedNumber = "";
      
      newSuggestedNumber = generateUniqueMinutaNumber(existingPTrabNumbers); 
      
      setSuggestedCloneNumber(newSuggestedNumber);
      setCustomCloneNumber(newSuggestedNumber);
    }
  }, [ptrabToClone, existingPTrabNumbers]);

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

  const handleArchive = async (ptrabId: string, ptrabName: string) => {
    const isOwner = pTrabs.find(p => p.id === ptrabId)?.isOwner;
    if (!isOwner) {
        toast.error("Apenas o dono do P Trab pode excluí-lo.");
        return;
    }
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

  const handleConfirmReactivateStatus = async () => {
    if (!ptrabToReactivateId) return;

    setLoading(true);

    try {
      const { data: ptrab, error: fetchError } = await supabase
        .from("p_trab")
        .select("numero_ptrab")
        .eq("id", ptrabToReactivateId)
        .single();

      if (fetchError || !ptrab) throw new Error("P Trab não encontrado.");

      const isMinuta = ptrab.numero_ptrab.startsWith("Minuta");
      const newStatus = isMinuta ? 'aberto' : 'aprovado';

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
      setLoading(false);
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
      
      const requiredFields: (keyof typeof formData)[] = [
        'numero_ptrab', 'nome_operacao', 'comando_militar_area', 
        'nome_om_extenso', 'nome_om', 'efetivo_empregado', 
        'periodo_inicio', 'periodo_fim', 'acoes',
        'local_om',
        'nome_cmt_om',
      ];
      
      for (const field of requiredFields) {
        if (!formData[field] || String(formData[field]).trim() === "") {
          
          let fieldName = field.replace(/_/g, ' ');
          if (fieldName === 'nome om') fieldName = 'Nome da OM (sigla)';
          if (fieldName === 'nome om extenso') fieldName = 'Nome da OM (extenso)';
          if (fieldName === 'acoes') fieldName = 'Ações realizadas ou a serem realizadas';
          if (fieldName === 'local om') fieldName = 'Local da OM';
          if (fieldName === 'nome cmt om') fieldName = 'Nome do Comandante da OM';
          if (fieldName === 'comando militar area') fieldName = 'Comando Militar de Área';
          
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

      if (currentNumber && !currentNumber.startsWith("Minuta")) {
        const isDuplicate = isPTrabNumberDuplicate(currentNumber, existingPTrabNumbers) && 
                           currentNumber !== pTrabs.find(p => p.id === editingId)?.numero_ptrab;

        if (isDuplicate) {
          toast.error("Já existe um P Trab com este número. Por favor, proponha outro.");
          setLoading(false);
          return;
        }
      }
      
      const finalNumeroPTrab = currentNumber || generateUniqueMinutaNumber(existingPTrabNumbers);

      const ptrabData = {
        ...formData,
        user_id: user.id,
        origem: editingId ? formData.origem : 'original',
        numero_ptrab: finalNumeroPTrab, 
        status: editingId ? formData.status : 'aberto',
      };

      if (editingId) {
        const { error } = await supabase.from("p_trab").update(ptrabData).eq("id", editingId);
        if (error) throw error;
        toast.success("P Trab atualizado!");
      } else {
        const { id, ...insertData } = ptrabData as Partial<PTrab> & { id?: string };
        
        const { data: newPTrab, error: insertError } = await supabase
          .from("p_trab")
          .insert([insertData as TablesInsert<'p_trab'>])
          .select()
          .single();
          
        if (insertError || !newPTrab) throw insertError;
        
        const newPTrabId = newPTrab.id;
        
        if (originalPTrabIdToClone) {
            await cloneRelatedRecords(originalPTrabIdToClone, newPTrabId);
            
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
        
        try {
            await updateUserCredits(user.id, 0, 0);
        } catch (creditError) {
            console.error("Erro ao zerar créditos após criação do P Trab:", creditError);
            toast.warning("Aviso: Ocorreu um erro ao zerar os créditos disponíveis. Por favor, verifique manualmente.");
        }
        
        setDialogOpen(false);
        resetForm();
        loadPTrabs();
        return;
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
    // Se a OM estiver preenchida, usamos o ID dela para o seletor. Se não, usamos 'temp' para forçar a exibição do nome.
    setSelectedOmId(ptrab.codug_om ? 'temp' : undefined); 
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
    });
    setDialogOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string, isOwner: boolean) => {
    if (!isOwner) {
        toast.error("Apenas o dono do P Trab pode excluí-lo.");
        return;
    }
    if (!confirm("Tem certeza?")) return;
    try {
      await supabase.from("p_trab").delete().eq("id", id);
      toast.success("P Trab excluído!");
      loadPTrabs();
    } catch (error: any) {
      toast.error("Erro ao excluir");
    }
  };

  const handleOpenApproveDialog = (ptrab: PTrab) => {
    const omSigla = ptrab.nome_om;
    const suggestedNumber = generateApprovalPTrabNumber(existingPTrabNumbers, omSigla);
    
    setPtrabToApprove(ptrab);
    setSuggestedApproveNumber(suggestedNumber);
    setShowApproveDialog(true);
  };

  const handleApproveAndNumber = async () => {
    if (!ptrabToApprove) return;

    const newNumber = suggestedApproveNumber.trim();
    if (!newNumber) {
      toast.error("O número do P Trab não pode ser vazio.");
      return;
    }
    
    const isDuplicate = isPTrabNumberDuplicate(newNumber, existingPTrabNumbers);
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
          status: 'aprovado',
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

  const handleOpenCloneOptions = (ptrab: PTrab) => {
    setPtrabToClone(ptrab);
    setCloneType('new');
    setShowCloneOptionsDialog(true);
  };

  const handleConfirmCloneOptions = async () => {
    if (!ptrabToClone) return;

    if (cloneType === 'new') {
      setShowCloneOptionsDialog(false);
      
      // CORREÇÃO: Excluir explicitamente todos os campos calculados e de sistema
      const { 
        id, created_at, updated_at, user_id, share_token, shared_with,
        totalLogistica, totalOperacional, totalMaterialPermanente, 
        quantidadeRacaoOp, quantidadeHorasVoo, isOwner, isShared, hasPendingRequests,
        ...restOfPTrab 
      } = ptrabToClone;
      
      setFormData({
        ...restOfPTrab,
        numero_ptrab: suggestedCloneNumber,
        status: "aberto",
        origem: ptrabToClone.origem,
        comentario: "",
        rotulo_versao: ptrabToClone.rotulo_versao,
        
        // Reset OM fields because the user needs to select a new OM in the form
        nome_om: "",
        nome_om_extenso: "",
        codug_om: "",
        rm_vinculacao: "",
        codug_rm_vinculacao: "",
      });
      
      setSelectedOmId(undefined); 
      setOriginalPTrabIdToClone(ptrabToClone.id);
      
      setDialogOpen(true);
      
    } else {
      setShowCloneOptionsDialog(false);
      setShowCloneVariationDialog(true);
    }
  };
  
  const handleConfirmCloneVariation = async (versionName: string) => {
    if (!ptrabToClone || !suggestedCloneNumber.trim()) {
      toast.error("Erro: Dados de clonagem incompletos.");
      return;
    }
    
    setShowCloneVariationDialog(false);
    setLoading(true);

    try {
        // CORREÇÃO: Excluir explicitamente todos os campos calculados e de sistema
        const { 
            id, created_at, updated_at, user_id, share_token, shared_with,
            totalLogistica, totalOperacional, totalMaterialPermanente, 
            quantidadeRacaoOp, quantidadeHorasVoo, isOwner, isShared, hasPendingRequests,
            ...restOfPTrab 
        } = ptrabToClone;
        
        const newPTrabData: TablesInsert<'p_trab'> & { origem: PTrabDB['origem'] } = {
            ...restOfPTrab,
            numero_ptrab: suggestedCloneNumber,
            status: "aberto",
            origem: ptrabToClone.origem,
            comentario: null,
            rotulo_versao: versionName,
            user_id: (await supabase.auth.getUser()).data.user?.id!,
        };

        const { data: newPTrab, error: insertError } = await supabase
            .from("p_trab")
            .insert([newPTrabData as TablesInsert<'p_trab'>])
            .select()
            .single();
            
        if (insertError || !newPTrab) throw insertError;
        
        const newPTrabId = newPTrab.id;
        
        await cloneRelatedRecords(ptrabToClone.id, newPTrabId);
        
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

  const cloneRelatedRecords = async (originalPTrabId: string, newPTrabId: string) => {
    
    // Refatoração da função cloneClassRecords para aceitar o tipo T genérico
    const cloneClassRecords = async <T extends PTrabLinkedTableName>(
        tableName: T, 
        jsonbField: keyof Tables<T> | null, 
        numericFields: string[]
    ) => {
        // A solução é usar 'as any' no construtor da consulta para contornar a rigidez do TypeScript
        // com nomes de tabela dinâmicos, mantendo a tipagem forte no retorno.
        const { data: originalRecords, error: fetchError } = await (supabase.from(tableName) as any)
            .select('*')
            .eq("p_trab_id", originalPTrabId);

        if (fetchError) {
            console.error(`Erro ao carregar registros da ${tableName}:`, fetchError);
            return 0;
        }

        // CORREÇÃO: Garantir que originalRecords é um array de objetos com as propriedades esperadas
        const typedRecords = originalRecords as Tables<T>[];

        const newRecords = (typedRecords || []).map(record => {
            // CORREÇÃO: Desestruturação segura para remover campos de sistema
            // Usamos 'as any' aqui para resolver o erro de desestruturação em tipos complexos/uniões
            const { id, created_at, updated_at, ...restOfRecord } = record as any; 
            
            const newRecord: Record<string, any> = {
                ...restOfRecord,
                p_trab_id: newPTrabId,
            };
            
            // Clonar campos JSONB se existirem
            if (jsonbField && newRecord[jsonbField as string]) {
                newRecord[jsonbField as string] = JSON.parse(JSON.stringify(newRecord[jsonbField as string]));
            }
            
            numericFields.forEach(field => {
                if (newRecord[field] === null || newRecord[field] === undefined) {
                    newRecord[field] = 0;
                }
            });
            
            return newRecord;
        });

        if (newRecords.length > 0) {
            // CORREÇÃO: Usar 'as any' no insert para permitir o nome dinâmico
            const { error: insertError } = await (supabase.from(tableName) as any)
                .insert(newRecords as TablesInsert<T>[]);
            
            if (insertError) {
                console.error(`ERRO DE INSERÇÃO ${tableName}:`, insertError);
                toast.error(`Erro ao clonar registros da ${tableName}: ${sanitizeError(insertError)}`);
            }
        }
        return newRecords.length;
    };

    const classeINumericFields = [
        'complemento_qr', 'complemento_qs', 'dias_operacao', 'efetivo', 'etapa_qr', 'etapa_qs', 
        'nr_ref_int', 'total_geral', 'total_qr', 'total_qs', 'valor_qr', 'valor_qs', 
        'quantidade_r2', 'quantidade_r3'
    ];
    
    // CLASSE I (Tratamento especial devido à estrutura de campos)
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
    
    const genericNumericFields = ['dias_operacao', 'valor_total', 'valor_nd_30', 'valor_nd_39', 'efetivo'];

    // CORREÇÕES APLICADAS AQUI (Linhas 1188, 1234-1239, 1268)
    await cloneClassRecords('classe_ii_registros', 'itens_equipamentos', genericNumericFields);

    const classeIIINumericFields = [
        'dias_operacao', 'preco_litro', 'quantidade', 'total_litros', 'valor_total', 
        'consumo_lubrificante_litro', 'preco_lubrificante', 'valor_nd_30', 'valor_nd_39'
    ];
    
    // CLASSE III (Tratamento especial devido à estrutura de campos)
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
            // CORREÇÃO: Clonar JSONB
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
    
    await cloneClassRecords('classe_v_registros', 'itens_equipamentos', genericNumericFields);
    await cloneClassRecords('classe_vi_registros', 'itens_equipamentos', genericNumericFields);
    await cloneClassRecords('classe_vii_registros', 'itens_equipamentos', genericNumericFields);
    await cloneClassRecords('classe_viii_saude_registros', 'itens_saude', genericNumericFields);
    await cloneClassRecords('classe_viii_remonta_registros', 'itens_remonta', [...genericNumericFields, 'quantidade_animais']);
    await cloneClassRecords('classe_ix_registros', 'itens_motomecanizacao', genericNumericFields);

    // CLONAGEM DE REFERÊNCIA LPC
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
    
    // CLONAGEM DE DIÁRIAS
    await cloneClassRecords('diaria_registros', 'quantidades_por_posto', ['dias_operacao', 'quantidade', 'nr_viagens', 'valor_nd_15', 'valor_nd_30', 'valor_total']);
    
    // CLONAGEM DE VERBA OPERACIONAL
    await cloneClassRecords('verba_operacional_registros', null, ['dias_operacao', 'quantidade_equipes', 'valor_total_solicitado', 'valor_nd_30', 'valor_nd_39']);
    
    // CLONAGEM DE PASSAGENS
    await cloneClassRecords('passagem_registros', null, ['dias_operacao', 'efetivo', 'quantidade_passagens', 'valor_nd_33', 'valor_total', 'valor_unitario']);
  };

  const needsNumbering = (ptrab: PTrab) => {
    return ptrab.numero_ptrab.startsWith("Minuta") && (ptrab.status === 'aberto' || ptrab.status === 'em_andamento');
  };
  
  const isFinalStatus = (ptrab: PTrab) => {
    return ptrab.status === 'aprovado' || ptrab.status === 'arquivado';
  };
  
  const handleOpenConsolidationNumberDialog = (selectedPTrabs: string[]) => {
    if (selectedPTrabs.length < 2) {
        toast.error("Selecione pelo menos dois P Trabs para consolidar.");
        return;
    }
    setSelectedPTrabsToConsolidate(selectedPTrabs);
    const newMinutaNumber = generateUniqueMinutaNumber(existingPTrabNumbers);
    setSuggestedConsolidationNumber(newMinutaNumber);
    setShowConsolidationDialog(false);
    setShowConsolidationNumberDialog(true);
  };

  const handleConfirmConsolidation = async (finalMinutaNumber: string) => {
    if (selectedPTrabsToConsolidate.length < 2 || !user?.id) return;

    setLoading(true);
    setShowConsolidationNumberDialog(false);

    try {
        const { data: selectedPTrabsData, error: fetchError } = await supabase
            .from('p_trab')
            .select('*')
            .in('id', selectedPTrabsToConsolidate);

        if (fetchError || !selectedPTrabsData || selectedPTrabsData.length === 0) {
            throw new Error("Falha ao carregar dados dos P Trabs selecionados.");
        }
        
        const basePTrab = selectedPTrabsData[0];
        
        // CORREÇÃO: Desestruturação segura para remover campos de sistema
        const { 
            id, created_at, updated_at, share_token, shared_with, user_id,
            ...restOfBasePTrab 
        } = basePTrab;
        
        const newPTrabData: TablesInsert<'p_trab'> = {
            ...restOfBasePTrab,
            user_id: user.id,
            numero_ptrab: finalMinutaNumber,
            nome_operacao: basePTrab.nome_operacao, 
            status: 'aberto',
            origem: 'consolidado',
            comentario: `Consolidação dos P Trabs: ${selectedPTrabsData.map(p => p.numero_ptrab).join(', ')}`,
            rotulo_versao: null,
        };

        const { data: newPTrab, error: insertError } = await supabase
            .from("p_trab")
            .insert([newPTrabData])
            .select('id')
            .single();
            
        if (insertError || !newPTrab) throw insertError;
        
        const newPTrabId = newPTrab.id;
        
        const tablesToConsolidate: PTrabLinkedTableName[] = [
            'classe_i_registros', 'classe_ii_registros', 'classe_iii_registros', 
            'classe_v_registros', 'classe_vi_registros', 'classe_vii_registros', 
            'classe_viii_saude_registros', 'classe_viii_remonta_registros', 'classe_ix_registros',
            'diaria_registros', 
            'verba_operacional_registros', 
            'passagem_registros', 
        ];
        
        for (const tableName of tablesToConsolidate) {
            // CORREÇÃO: Usar 'as any' para permitir o nome dinâmico
            const { data: records, error: recordsError } = await (supabase.from(tableName) as any)
                .select('*')
                .in('p_trab_id', selectedPTrabsToConsolidate);
                
            if (recordsError) {
                console.error(`Erro ao buscar registros de ${tableName} para consolidação:`, recordsError);
                toast.warning(`Aviso: Falha ao consolidar registros de ${tableName}.`);
                continue;
            }
            
            // CORREÇÃO: Tipagem segura para o array de registros
            const typedRecords = records as Tables<typeof tableName>[];
            
            if (typedRecords && typedRecords.length > 0) {
                const newRecords = typedRecords.map(record => {
                    // CORREÇÃO: Desestruturação segura para remover campos de sistema
                    const { id, created_at, updated_at, ...restOfRecord } = record as any;
                    
                    // CORREÇÃO: Tipagem do objeto de inserção
                    const newRecord: TablesInsert<typeof tableName> = {
                        ...restOfRecord,
                        p_trab_id: newPTrabId,
                        // CORREÇÃO: Clonar JSONB de forma segura, verificando a existência da propriedade
                        ...(record.hasOwnProperty('itens_equipamentos') && { itens_equipamentos: JSON.parse(JSON.stringify((record as any).itens_equipamentos)) }),
                        ...(record.hasOwnProperty('itens_saude') && { itens_saude: JSON.parse(JSON.stringify((record as any).itens_saude)) }),
                        ...(record.hasOwnProperty('itens_remonta') && { itens_remonta: JSON.parse(JSON.stringify((record as any).itens_remonta)) }),
                        ...(record.hasOwnProperty('itens_motomecanizacao') && { itens_motomecanizacao: JSON.parse(JSON.stringify((record as any).itens_motomecanizacao)) }),
                        ...(record.hasOwnProperty('quantidades_por_posto') && { quantidades_por_posto: JSON.parse(JSON.stringify((record as any).quantidades_por_posto)) }),
                    } as TablesInsert<typeof tableName>;
                    
                    return newRecord;
                });
                
                // CORREÇÃO: Usar 'as any' no insert para permitir o nome dinâmico
                const { error: insertRecordsError } = await (supabase.from(tableName) as any)
                    .insert(newRecords);
                    
                if (insertRecordsError) {
                    console.error(`Erro ao inserir registros consolidados de ${tableName}:`, insertRecordsError);
                    toast.warning(`Aviso: Falha ao inserir registros consolidados de ${tableName}.`);
                }
            }
        }
        
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
  
  const simplePTrabsToConsolidate = useMemo(() => {
    return pTrabs
        .filter(p => selectedPTrabsToConsolidate.includes(p.id))
        .map(p => ({ id: p.id, numero_ptrab: p.numero_ptrab, nome_operacao: p.nome_operacao }));
  }, [pTrabs, selectedPTrabsToConsolidate]);

  // =================================================================
  // LÓGICA DE COMPARTILHAMENTO (NOVAS FUNÇÕES)
  // =================================================================
  
  const handleOpenShareDialog = (ptrab: PTrab) => {
    if (!ptrab.share_token) {
        toast.error("Token de compartilhamento não encontrado.");
        return;
    }
    const baseUrl = window.location.origin;
    // MUDANÇA: Usar a rota /share-ptrab para processar o link
    const link = `${baseUrl}/share-ptrab?ptrabId=${ptrab.id}&token=${ptrab.share_token}`;
    
    setPtrabToShare(ptrab);
    setShareLink(link);
    setShowShareLinkDialog(true);
  };
  
  const handleOpenLinkPTrabDialog = () => {
    setLinkPTrabInput("");
    setShowLinkPTrabDialog(true);
  };
  
  const handleRequestLink = async () => {
    if (!linkPTrabInput || !user?.id) {
        toast.error("Link inválido ou usuário não autenticado.");
        return;
    }
    
    setLoading(true);
    
    try {
        const url = new URL(linkPTrabInput);
        const ptrabId = url.searchParams.get('ptrabId'); // CORRIGIDO: Usar 'ptrabId'
        const shareToken = url.searchParams.get('token');
        
        if (!ptrabId || !shareToken) {
            throw new Error("Link de compartilhamento incompleto.");
        }
        
        // 1. Chama a função RPC para registrar a solicitação
        const { data, error } = await supabase.rpc('request_ptrab_share', {
            p_ptrab_id: ptrabId,
            p_share_token: shareToken,
            p_user_id: user.id,
        });
        
        if (error) throw error;
        
        if (data === false) {
            throw new Error("P Trab não encontrado ou token inválido.");
        }
        
        // 2. Simplificação: Apenas confirma que a solicitação foi enviada.
        // Removido: Busca de dados do P Trab e do perfil do proprietário.
        
        toast.success(
            "Solicitação Enviada!", 
            {
                description: `Sua solicitação de acesso foi enviada ao proprietário do P Trab. Você será notificado quando for aprovada.`,
                duration: 8000,
            }
        );
        
        setShowLinkPTrabDialog(false);
        
    } catch (error: any) {
        toast.error("Erro ao solicitar vinculação.", { description: sanitizeError(error) });
    } finally {
        setLoading(false);
    }
  };
  
  const handleOpenManageSharingDialog = async (ptrab: PTrab) => {
    if (!ptrab.isOwner) return;
    
    setPtrabToManageSharing(ptrab);
    // Abre o diálogo imediatamente
    setShowManageSharingDialog(true); 
    // A busca de requests e shared users será feita dentro do ManageSharingDialog
    // para que o estado de loading seja local a ele.
  };
  
  const handleApproveRequest = async (requestId: string) => {
    setLoading(true);
    try {
        const { data, error } = await supabase.rpc('approve_ptrab_share', {
            p_request_id: requestId,
        });
        
        if (error) throw error;
        if (data === false) throw new Error("Falha na aprovação. Verifique se você é o dono.");
        
        toast.success("Compartilhamento aprovado com sucesso!");
        
        loadPTrabs();
        // Não precisa reabrir o diálogo aqui, o ManageSharingDialog deve ter sua própria lógica de atualização interna.
        
    } catch (error: any) {
        toast.error("Erro ao aprovar solicitação.");
        console.error(error);
    } finally {
        setLoading(false);
    }
  };
  
  const handleRejectRequest = async (requestId: string) => {
    setLoading(true);
    try {
        const { data, error } = await supabase.rpc('reject_ptrab_share', {
            p_request_id: requestId,
        });
        
        if (error) throw error;
        if (data === false) throw new Error("Falha na rejeição. Verifique se você é o dono.");
        
        toast.info("Solicitação rejeitada.");
        
        loadPTrabs();
        // Não precisa reabrir o diálogo aqui, o ManageSharingDialog deve ter sua própria lógica de atualização interna.
        
    } catch (error: any) {
        toast.error("Erro ao rejeitar solicitação.");
        console.error(error);
    } finally {
        setLoading(false);
    }
  };
  
  const handleCancelSharing = async (ptrabId: string, userIdToRemove: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja remover o acesso de ${userName} a este P Trab?`)) return;
    
    setLoading(true);
    try {
        // CORREÇÃO: Usar a função RPC para remover o usuário, que tem SECURITY DEFINER
        const { data: success, error } = await supabase.rpc('remove_user_from_shared_with', {
            p_ptrab_id: ptrabId,
            p_user_to_remove_id: userIdToRemove,
        });
            
        if (error) throw error;
        if (success === false) throw new Error("Falha na remoção de acesso. Verifique se você é o dono.");
        
        toast.success(`Acesso de ${userName} removido com sucesso.`);
        
        loadPTrabs();
        // Não precisa reabrir o diálogo aqui, o ManageSharingDialog deve ter sua própria lógica de atualização interna.
        
    } catch (error: any) {
        toast.error("Erro ao cancelar compartilhamento.");
        console.error(error);
    } finally {
        setLoading(false);
    }
  };
  
  const handleOpenUnlinkDialog = (ptrab: PTrab) => {
    setPtrabToUnlink(ptrab);
    setShowUnlinkPTrabDialog(true);
  };
  
  const handleConfirmUnlink = async () => {
    if (!ptrabToUnlink || !user?.id) return;
    
    setLoading(true);
    try {
        // CORREÇÃO: Usar a função RPC para remover o próprio usuário, que tem SECURITY DEFINER
        const { data: success, error } = await supabase.rpc('remove_user_from_shared_with', {
            p_ptrab_id: ptrabToUnlink.id,
            p_user_to_remove_id: user.id, // O usuário está se removendo
        });
            
        if (error) throw error;
        if (success === false) throw new Error("Falha na desvinculação. O P Trab não foi encontrado ou você não tinha acesso.");
        
        toast.success(`P Trab ${ptrabToUnlink.numero_ptrab} desvinculado com sucesso.`);
        setShowUnlinkPTrabDialog(false);
        loadPTrabs();
        
    } catch (error: any) {
        toast.error("Erro ao desvincular P Trab.", { description: sanitizeError(error) });
        console.error(error);
    } finally {
        setLoading(false);
    }
  };
  
  // =================================================================
  // FIM LÓGICA DE COMPARTILHAMENTO
  // =================================================================

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
            
            <div className="flex items-center gap-2 px-4 h-10 rounded-md bg-muted/50 border border-border">
              <User className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                {userName || (user ? 'Perfil Incompleto' : 'Carregando...')}
              </span>
            </div>
            
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
                    
                    <div className="space-y-2">
                      <Label htmlFor="comando_militar_area">Comando Militar de Área *</Label>
                      <Select
                        value={formData.comando_militar_area}
                        onValueChange={(value) => setFormData({ ...formData, comando_militar_area: value })}
                        disabled={loading}
                      >
                        <SelectTrigger id="comando_militar_area">
                          <SelectValue placeholder="Selecione o Comando Militar de Área" />
                        </SelectTrigger>
                        <SelectContent>
                          {COMANDOS_MILITARES_AREA.map((cma) => (
                            <SelectItem key={cma} value={cma}>
                              {cma}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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

                    <div className="space-y-2">
                      <Label htmlFor="nome_om">Nome da OM (sigla) *</Label>
                      <OmSelector
                        selectedOmId={selectedOmId}
                        initialOmName={formData.nome_om} // PASSANDO O NOME INICIAL AQUI
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
                              local_om: omData.cidade || "", // NOVO: Preenche a cidade
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
                              local_om: "", // Limpa a cidade
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

                    <div className="space-y-2">
                      <Label htmlFor="periodo_inicio">Início da Operação *</Label>
                      <Input
                        id="periodo_inicio"
                        type="date"
                        value={formData.periodo_inicio}
                        onChange={(e) => setFormData({ ...formData, periodo_inicio: e.target.value })}
                        required
                        onKeyDown={handleEnterToNextField}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="periodo_fim">Término da Operação *</Label>
                      <Input
                        id="periodo_fim"
                        type="date"
                        value={formData.periodo_fim}
                        onChange={(e) => setFormData({ ...formData, periodo_fim: e.target.value })}
                        required
                        onKeyDown={handleEnterToNextField}
                      />
                    </div>
                    
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
                    <div className="space-y-2">
                      <Label htmlFor="nome_cmt_om">Nome do Comandante da OM - Posto *</Label>
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
                      required
                      onKeyDown={handleEnterToNextField}
                    />
                  </div>
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
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button 
                      onClick={() => {
                        if (!isConsolidationDisabled) {
                          setShowConsolidationDialog(true);
                        } else {
                          toast.info(getConsolidationDisabledMessage());
                        }
                      }} 
                      variant="secondary"
                      disabled={isConsolidationDisabled}
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
                
                {/* NOVO ITEM: Vincular P Trab (Ação do Destinatário) */}
                <DropdownMenuItem onClick={handleOpenLinkPTrabDialog}>
                  <Link className="mr-2 h-4 w-4" />
                  Vincular P Trab
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={() => navigate("/config/profile")}>
                  Perfil do Usuário
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={() => navigate("/config/diretrizes")}>
                  Diretriz de Custeio Logístico
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={() => navigate("/config/custos-operacionais")}>
                  Custos Operacionais
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={() => navigate("/config/visualizacao")}>
                  Opção de Visualização
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/config/om")}>
                  Relação de OM (CODUG)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/config/ptrab-export-import")}>
                  <ArrowDownUp className="mr-2 h-4 w-4" />
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
                    const originBadge = getOriginBadge(ptrab.origem);
                    const isMinuta = ptrab.numero_ptrab.startsWith("Minuta");
                    const isEditable = (ptrab.isOwner || ptrab.isShared) && ptrab.status !== 'aprovado' && ptrab.status !== 'arquivado'; 
                    const isApprovedOrArchived = isFinalStatus(ptrab);
                    
                    const totalGeral = (ptrab.totalLogistica || 0) + (ptrab.totalOperacional || 0) + (ptrab.totalMaterialPermanente || 0);
                    
                    const displayOperationName = cleanOperationName(ptrab.nome_operacao, ptrab.origem);
                    
                    const isSharedWithCurrentUser = ptrab.isShared;
                    const isOwnedByCurrentUser = ptrab.isOwner;
                    
                    // Lógica de desativação para não-proprietários
                    const isActionDisabledForNonOwner = !isOwnedByCurrentUser;
                    
                    // NOVO: Condição para desabilitar o compartilhamento
                    const isSharingDisabled = ptrab.status === 'aprovado' || ptrab.status === 'arquivado';

                    // CORREÇÃO: O badge de gerenciamento deve aparecer se for o dono E houver compartilhamento ativo OU solicitações pendentes.
                    const showManageSharingBadge = isOwnedByCurrentUser && ((ptrab.shared_with?.length || 0) > 0 || ptrab.hasPendingRequests);

                    return (
                    <TableRow key={ptrab.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col items-center">
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
                            variant={originBadge.variant} // USANDO NOVO VARIANT
                            className="mt-1 text-xs font-semibold"
                          >
                            {originBadge.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start">
                          <span>{displayOperationName}</span>
                          {ptrab.rotulo_versao && (
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
                          <Badge 
                            variant={statusConfig[ptrab.status as keyof typeof statusConfig]?.variant || 'default'} // USANDO NOVO VARIANT
                            className="w-[140px] h-7 text-xs flex items-center justify-center"
                          >
                            {statusConfig[ptrab.status as keyof typeof statusConfig]?.label || ptrab.status}
                          </Badge>
                          
                          {/* NOVO BADGE DE COMPARTILHAMENTO (DONO) - CORRIGIDO */}
                          {showManageSharingBadge && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge 
                                    variant="ptrab-shared" // USANDO NOVO VARIANT
                                    className="mt-1 text-xs cursor-pointer w-[140px] h-7 flex items-center justify-center"
                                    onClick={() => handleOpenManageSharingDialog(ptrab)}
                                  >
                                    <Users className="h-3 w-3 mr-1" />
                                    Compartilhando
                                    {ptrab.hasPendingRequests && (
                                        <span className="ml-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                                    )}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {ptrab.hasPendingRequests ? "Gerenciar (Solicitações Pendentes!)" : "Gerenciar Compartilhamento"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          
                          {/* NOVO BADGE DE COMPARTILHAMENTO (COMPARTILHADO) */}
                          {isSharedWithCurrentUser && (
                            <Badge 
                              variant="ptrab-collaborator" // USANDO NOVO VARIANT
                              className="mt-1 text-xs w-[140px] h-7 flex items-center justify-center"
                            >
                              <Share2 className="h-3 w-3 mr-1" />
                              Compartilhado
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
                          
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Log:</span>
                            <span className="text-orange-600 font-medium">
                              {formatCurrency(ptrab.totalLogistica || 0)}
                            </span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Op:</span>
                            <span className="text-blue-600 font-medium">
                              {formatCurrency(ptrab.totalOperacional || 0)}
                            </span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Mat Perm:</span>
                            <span className="text-green-600 font-medium">
                              {formatCurrency(ptrab.totalMaterialPermanente || 0)}
                            </span>
                          </div>
                          
                          <>
                            <div className="w-full h-px bg-muted-foreground/30 my-1" />
                            <div className="flex justify-between font-bold text-sm text-foreground">
                              <span>Total:</span>
                              <span>{formatCurrency(totalGeral)}</span>
                            </div>
                          </>
                          
                          <div className="w-full h-px bg-muted-foreground/30 my-1" />
                          
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Rç Op:</span>
                            <span className="font-medium">
                              {`${ptrab.quantidadeRacaoOp || 0} Unid.`}
                            </span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">HV:</span>
                            <span className="font-medium">
                              {`${ptrab.quantidadeHorasVoo || 0} h`}
                            </span>
                          </div>
                          
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
                          {(needsNumbering(ptrab) || isApprovedOrArchived) && (
                            <Button
                              onClick={() => handleOpenApproveDialog(ptrab)}
                              size="sm"
                              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                              disabled={loading || isApprovedOrArchived || isActionDisabledForNonOwner}
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
                              
                              {/* NOVO: Ação de Compartilhar (Apenas para o DONO, visível mas desabilitado se finalizado) */}
                              {isOwnedByCurrentUser && (
                                <DropdownMenuItem 
                                  onClick={() => !isSharingDisabled && handleOpenShareDialog(ptrab)}
                                  disabled={isSharingDisabled}
                                  className={isSharingDisabled ? "opacity-50 cursor-not-allowed" : ""}
                                >
                                  <Share2 className="mr-2 h-4 w-4" />
                                  Compartilhar
                                </DropdownMenuItem>
                              )}
                              
                              {/* NOVO: Ação de Desvincular (Apenas para o COMPARTILHADO) */}
                              {isSharedWithCurrentUser && (
                                <DropdownMenuItem 
                                  onClick={() => handleOpenUnlinkDialog(ptrab)}
                                  className="text-red-600"
                                >
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Desvincular
                                </DropdownMenuItem>
                              )}
                              
                              {/* Ação 3: Clonar P Trab (Desabilitado se arquivado) */}
                              <DropdownMenuItem 
                                onClick={() => ptrab.status !== 'arquivado' && handleOpenCloneOptions(ptrab)}
                                disabled={ptrab.status === 'arquivado'}
                                className={ptrab.status === 'arquivado' ? "opacity-50 cursor-not-allowed" : ""}
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Clonar P Trab
                              </DropdownMenuItem>
                              
                              {/* NOVO: Arquivar (Disponível se NÃO estiver arquivado) */}
                              {ptrab.status !== 'arquivado' && (
                                <DropdownMenuItem 
                                  onClick={() => isOwnedByCurrentUser && handleArchive(ptrab.id, `${ptrab.numero_ptrab} - ${ptrab.nome_operacao}`)}
                                  disabled={isActionDisabledForNonOwner}
                                  className={isActionDisabledForNonOwner ? "opacity-50 cursor-not-allowed" : ""}
                                >
                                  <Archive className="mr-2 h-4 w-4" />
                                  Arquivar
                                </DropdownMenuItem>
                              )}
                              
                              {/* Ação 5: Reativar (Disponível APENAS se estiver arquivado) */}
                              {ptrab.status === 'arquivado' && (
                                  <DropdownMenuItem 
                                      onClick={() => {
                                          if (isOwnedByCurrentUser) {
                                              setPtrabToReactivateId(ptrab.id);
                                              setPtrabToReactivateName(`${ptrab.numero_ptrab} - ${ptrab.nome_operacao}`);
                                              setShowReactivateStatusDialog(true);
                                          }
                                      }}
                                      disabled={isActionDisabledForNonOwner}
                                      className={isActionDisabledForNonOwner ? "opacity-50 cursor-not-allowed" : ""}
                                  >
                                      <RefreshCw className="mr-2 h-4 w-4" />
                                      Reativar
                                  </DropdownMenuItem>
                              )}
                              
                              <DropdownMenuSeparator />
                              
                              {/* Ação 6: Excluir (Sempre disponível, mas desabilitado para usuários compartilhados) */}
                              <DropdownMenuItem 
                                onClick={() => handleDelete(ptrab.id, isOwnedByCurrentUser)}
                                className={cn("text-red-600", !isOwnedByCurrentUser && "opacity-50 cursor-not-allowed")}
                                disabled={!isOwnedByCurrentUser}
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
            <AlertDialogAction onClick={handleConfirmArchiveStatus}>Sim, arquivar</AlertDialogAction>
            <AlertDialogCancel onClick={handleCancelArchiveStatus}>Agora não</AlertDialogCancel>
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
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de Opções de Clonagem (mantido) */}
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

      {/* Diálogo de Variação do Trabalho (mantido) */}
      {ptrabToClone && (
        <CloneVariationDialog
          open={showCloneVariationDialog}
          onOpenChange={setShowCloneVariationDialog}
          originalNumber={ptrabToClone.numero_ptrab}
          suggestedCloneNumber={suggestedCloneNumber}
          onConfirm={handleConfirmCloneVariation}
        />
      )}

      {/* Dialog de Comentário (mantido) */}
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

      {/* Diálogo de Aprovação e Numeração (mantido) */}
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

      {/* Diálogo de Consolidação (Seleção) (mantido) */}
      <PTrabConsolidationDialog
        open={showConsolidationDialog}
        onOpenChange={setShowConsolidationDialog}
        pTrabsList={pTrabs.filter(p => p.status !== 'arquivado').map(p => ({ id: p.id, numero_ptrab: p.numero_ptrab, nome_operacao: p.nome_operacao }))}
        existingPTrabNumbers={existingPTrabNumbers}
        onConfirm={handleOpenConsolidationNumberDialog}
        loading={loading}
      />
      
      {/* Diálogo de Numeração de Consolidação (CORRIGIDO) */}
      <ConsolidationNumberDialog
        open={showConsolidationNumberDialog}
        onOpenChange={setShowConsolidationNumberDialog}
        suggestedNumber={suggestedConsolidationNumber}
        existingNumbers={existingPTrabNumbers}
        selectedPTrabs={simplePTrabsToConsolidate}
        onConfirm={handleConfirmConsolidation}
        loading={loading}
      />
      
      {/* Diálogo de Prompt de Crédito (mantido) */}
      <CreditPromptDialog
        open={showCreditPrompt}
        onConfirm={handlePromptConfirm}
        onCancel={handlePromptCancel}
      />
      
      {/* ================================================================= */}
      {/* NOVOS DIÁLOGOS DE COMPARTILHAMENTO */}
      {/* ================================================================= */}
      
      {/* 1. Share Link Dialog (Originador) */}
      {ptrabToShare && (
        <ShareLinkDialog
          open={showShareLinkDialog}
          onOpenChange={setShowShareLinkDialog}
          ptrabName={`${ptrabToShare.numero_ptrab} - ${ptrabToShare.nome_operacao}`}
          shareLink={shareLink}
        />
      )}
      
      {/* 2. Link PTrab Dialog (Destinatário) */}
      <LinkPTrabDialog
        open={showLinkPTrabDialog}
        onOpenChange={setShowLinkPTrabDialog}
        linkInput={linkPTrabInput}
        onLinkInputChange={setLinkPTrabInput}
        onRequestLink={handleRequestLink}
        loading={loading}
      />
      
      {/* 3. Manage Sharing Dialog (Originador) */}
      {ptrabToManageSharing && (
        <ManageSharingDialog
          open={showManageSharingDialog}
          onOpenChange={setShowManageSharingDialog}
          ptrabId={ptrabToManageSharing.id}
          ptrabName={`${ptrabToManageSharing.numero_ptrab} - ${ptrabToManageSharing.nome_operacao}`}
          // Não passamos sharedWith e requests diretamente, o componente filho irá buscar
          onApprove={handleApproveRequest}
          onReject={handleRejectRequest}
          onCancelSharing={handleCancelSharing}
          // O loading aqui é o loading global do Manager, mas o ManageSharingDialog terá seu próprio loading interno
          loading={loading} 
        />
      )}
      
      {/* 4. Unlink PTrab Dialog (Destinatário) */}
      {ptrabToUnlink && (
        <UnlinkPTrabDialog
          open={showUnlinkPTrabDialog}
          onOpenChange={setShowUnlinkPTrabDialog}
          ptrabName={`${ptrabToUnlink.numero_ptrab} - ${ptrabToUnlink.nome_operacao}`}
          onConfirm={handleConfirmUnlink}
          loading={loading}
        />
      )}
      
      <AIChatDrawer />
    </div>
  );
};

export default PTrabManager;