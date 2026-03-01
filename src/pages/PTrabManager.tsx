"use client";

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
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Edit, Trash2, LogOut, FileText, Printer, Settings, PenSquare, MoreVertical, Pencil, Copy, FileSpreadsheet, Download, MessageSquare, ArrowRight, HelpCircle, CheckCircle, GitBranch, Archive, RefreshCw, User, Loader2, Share2, Link, Users, XCircle, ArrowDownUp, ClipboardList, GraduationCap, Trophy } from "lucide-react";
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
import { isPTrabNumberDuplicate, generateApprovalPTrabNumber, generateUniqueMinutaNumber } from "@/lib/ptrabNumberUtils";
import PTrabConsolidationDialog from "@/components/PTrabConsolidationDialog";
import { ConsolidationNumberDialog } from "@/components/ConsolidationNumberDialog";
import { Tables, TablesInsert, TablesUpdate, Json } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { HelpDialog } from "@/components/HelpDialog";
import { CloneVariationDialog } from "@/components/CloneVariationDialog";
import { updateUserCredits } from "@/lib/creditUtils";
import { cn } from "@/lib/utils";
import { CreditPromptDialog } from "@/components/CreditPromptDialog";
import { useSession } from "@/components/SessionContextProvider";
import AIChatDrawer from "@/components/AIChatDrawer";
import ShareLinkDialog from "@/components/ShareLinkDialog";
import LinkPTrabDialog from "@/components/LinkPTrabDialog";
import ManageSharingDialog from "@/components/ManageSharingDialog";
import UnlinkPTrabDialog from "@/components/UnlinkPTrabDialog";
import PageMetadata from "@/components/PageMetadata";
import { fetchBatchPTrabTotals, PTrabLinkedTableName } from "@/lib/ptrabUtils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PTrabTableSkeleton } from "@/components/PTrabTableSkeleton";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { WelcomeModal } from "@/components/WelcomeModal";
import { RequirementsAlert } from "@/components/RequirementsAlert";
import { InstructionHub } from "@/components/InstructionHub";
import { runMission01 } from "@/tours/missionTours";
import { GHOST_DATA, isGhostMode, getActiveMission } from "@/lib/ghostStore";
import { shouldShowVictory, markVictoryAsShown, exitGhostMode, fetchCompletedMissions } from "@/lib/missionUtils";
import confetti from "canvas-confetti";

export type PTrabDB = Tables<'p_trab'> & {
  origem: 'original' | 'importado' | 'consolidado';
  rotulo_versao: string | null;
};

export interface PTrab extends PTrabDB {
  totalLogistica?: number;
  totalOperacional?: number;
  totalMaterialPermanente?: number;
  quantidadeRacaoOp?: number;
  quantidadeHorasVoo?: number;
  isOwner: boolean;
  isShared: boolean;
  hasPendingRequests: boolean;
}

/**
 * Interface simples para exibição e seleção de P Trabs em diálogos de consolidação/clonagem.
 */
export interface SimplePTrab {
  id: string;
  numero_ptrab: string;
  nome_operacao: string;
}

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

const PTrabManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useSession();
  const queryClient = useQueryClient();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  
  const [isActionLoading, setIsActionLoading] = useState(false);

  const [showArchiveStatusDialog, setShowArchiveStatusDialog] = useState(false);
  const [ptrabToArchiveId, setPtrabToArchiveId] = useState<string | null>(null);
  const [ptrabToArchiveName, setPtrabToArchiveName] = useState<string | null>(null);

  const [showReactivateStatusDialog, setShowReactivateStatusDialog] = useState(false);
  const [ptrabToReactivateId, setPtrabToReactivateId] = useState<string | null>(null);
  const [ptrabToReactivateName, setPtrabToReactivateName] = useState<string | null>(null);

  const [showCloneOptionsDialog, setShowCloneOptionsDialog] = useState(false);
  const [showCloneVariationDialog, setShowCloneVariationDialog] = useState(false);
  const [ptrabToClone, setPtrabToClone] = useState<PTrab | null>(null);
  const [cloneType, setCloneType] = useState<'new' | 'variation'>('new');
  const [suggestedCloneNumber, setSuggestedCloneNumber] = useState<string>("");
  
  const [originalPTrabIdToClone, setOriginalPTrabIdToClone] = useState(null as string | null);

  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [ptrabToApprove, setPtrabToApprove] = useState<PTrab | null>(null);
  const [suggestedApproveNumber, setSuggestedApproveNumber] = useState<string>("");

  const [showComentarioDialog, setShowComentarioDialog] = useState(false);
  const [ptrabComentario, setPtrabComentario] = useState<PTrab | null>(null);
  const [comentarioText, setComentarioText] = useState("");

  const [showConsolidationDialog, setShowConsolidationDialog] = useState(false);
  const [selectedPTrabsToConsolidate, setSelectedPTrabsToConsolidate] = useState<string[]>([]);
  const [showConsolidationNumberDialog, setShowConsolidationNumberDialog] = useState(false);
  const [suggestedConsolidationNumber, setSuggestedConsolidationNumber] = useState<string>("");
  
  const [showCreditPrompt, setShowCreditPrompt] = useState(false);
  const [ptrabToFill, setPtrabToFill] = useState<PTrab | null>(null);

  const [showShareLinkDialog, setShowShareLinkDialog] = useState(false);
  const [ptrabToShare, setPtrabToShare] = useState<PTrab | null>(null);
  const [shareLink, setShareLink] = useState<string>("");
  
  const [showLinkPTrabDialog, setShowLinkPTrabDialog] = useState(false);
  const [linkPTrabInput, setLinkPTrabInput] = useState("");
  
  const [showManageSharingDialog, setShowManageSharingDialog] = useState(false);
  const [ptrabToManageSharing, setPtrabToManageSharing] = useState<PTrab | null>(null);
  
  const [showUnlinkPTrabDialog, setShowUnlinkPTrabDialog] = useState(false);
  const [ptrabToUnlink, setPtrabToUnlink] = useState<PTrab | null>(null);

  const [showInstructionHub, setShowInstructionHub] = useState(false);
  const [showVictory, setShowVictory] = useState(false);

  // Detecta o modo fantasma de forma reativa para a query
  const ghostActive = isGhostMode();

  const { data: onboardingStatus, isLoading: isLoadingOnboarding } = useOnboardingStatus();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showRequirementsAlert, setShowRequirementsAlert] = useState(false);
  const hasShownWelcome = useRef(false);

  const dispararConfetes = () => {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#4CAF50', '#FFEB3B', '#2196F3', '#FF9800', '#E91E63'],
      zIndex: 999999
    });

    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 120,
        origin: { y: 0.6 },
        zIndex: 999999
      });
    }, 300);
  };

  useEffect(() => {
    if (user?.id) {
      // Sincroniza o LocalStorage com o Banco de Dados
      fetchCompletedMissions(user.id).then((missionIds) => {
        console.log("Sincronia de Missões concluída:", missionIds.length);
        // Se o banco retornar vazio, força o refresh para limpar o estado visual
        if (missionIds.length === 0) {
          queryClient.invalidateQueries({ queryKey: ['user-status', user.id] });
        }
      });
    }
  }, [user?.id, queryClient]);

  useEffect(() => {
    if (!user?.id) return;

    const handleVictory = (e: any) => {
      if (e.detail?.userId === user.id) {
        if (shouldShowVictory(user.id)) {
          setShowVictory(true);
          markVictoryAsShown(user.id);
          dispararConfetes();
        }
      }
    };

    const handleOpenHub = () => {
        setShowInstructionHub(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('tour:todas-concluidas', handleVictory);
    window.addEventListener('instruction-hub:open', handleOpenHub);
    
    return () => {
        window.removeEventListener('tour:todas-concluidas', handleVictory);
        window.removeEventListener('instruction-hub:open', handleOpenHub);
    };
  }, [user?.id]);

  useEffect(() => {
    // 1. BARREIRA DE SUPRESSÃO: 
    // Se o modo fantasma estiver ativo (missão) ou se o Centro de Instrução estiver aberto, o modal é estritamente proibido.
    if (isGhostMode() || showInstructionHub) {
      setShowWelcomeModal(false);
      return;
    }

    // 2. LÓGICA DE LEMBRETE (Apenas no Manager):
    if (!isLoadingOnboarding && onboardingStatus) {
      const hasPendingTasks = !onboardingStatus.isReady || !onboardingStatus.hasMissions;
      
      // Só mostra se houver pendências e se ainda não foi mostrado nesta visita à página
      if (hasPendingTasks && !hasShownWelcome.current) {
        // Pequeno delay para a tela respirar antes de exibir o lembrete
        const timer = setTimeout(() => {
          setShowWelcomeModal(true);
          hasShownWelcome.current = true; 
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoadingOnboarding, onboardingStatus, showInstructionHub]); // showInstructionHub é dependência crítica.

  const { data: pTrabs = [], isLoading: loading, refetch: loadPTrabs } = useQuery({
    // Adicionamos ghostActive na chave para que o React Query invalide o cache real e use o simulado
    queryKey: ['pTrabs', user?.id, ghostActive],
    queryFn: async () => {
      if (!user?.id) return [];
      
      if (ghostActive) {
        return [{
          ...GHOST_DATA.p_trab_exemplo,
          isOwner: true,
          isShared: false,
          hasPendingRequests: false,
          totalLogistica: GHOST_DATA.totais_exemplo.totalLogistica,
          totalOperacional: GHOST_DATA.totais_exemplo.totalOperacional,
          totalMaterialPermanente: GHOST_DATA.totais_exemplo.totalMaterialPermanente,
          quantidadeRacaoOp: GHOST_DATA.totais_exemplo.quantidadeRacaoOp,
          quantidadeHorasVoo: GHOST_DATA.totais_exemplo.quantidadeHorasVoo,
        }] as PTrab[];
      }

      const { data: pTrabsData, error: pTrabsError } = await supabase
        .from("p_trab")
        .select("*, comentario, origem, rotulo_versao, user_id, shared_with, share_token")
        .or(`user_id.eq.${user.id},shared_with.cs.{${user.id}}`)
        .order("created_at", { ascending: false });

      if (pTrabsError) throw pTrabsError;

      const typedPTrabsData = pTrabsData as unknown as PTrabDB[];
      const ptrabIds = typedPTrabsData.map(p => p.id);
      
      const batchTotals = await fetchBatchPTrabTotals(ptrabIds);
      
      const ownedPTrabIds = typedPTrabsData.filter(p => p.user_id === user.id).map(p => p.id);
      let pendingRequests: Tables<'ptrab_share_requests'>[] = [];
      
      if (ownedPTrabIds.length > 0) {
          const { data: requestsData } = await supabase
              .from('ptrab_share_requests')
              .select('id, ptrab_id, requester_id, share_token, status, created_at, updated_at')
              .in('ptrab_id', ownedPTrabIds)
              .eq('status', 'pending');
              
          pendingRequests = requestsData || []; 
      }
      
      const ptrabsWithPendingRequests = new Set(pendingRequests.map(r => r.ptrab_id));

      return typedPTrabsData.map((ptrab) => {
        const totals = batchTotals[ptrab.id] || {
          totalLogistica: 0,
          totalOperacional: 0,
          totalMaterialPermanente: 0,
          quantidadeRacaoOp: 0,
          quantidadeHorasVoo: 0
        };

        return {
          ...ptrab,
          ...totals,
          isOwner: ptrab.user_id === user.id,
          isShared: ptrab.user_id !== user.id && (ptrab.shared_with || []).includes(user.id),
          hasPendingRequests: ptrab.user_id === user.id && ptrabsWithPendingRequests.has(ptrab.id),
        } as PTrab;
      });
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    (window as any).openSettings = () => setSettingsOpen(true);
    (window as any).closeSettings = () => setSettingsOpen(false);
    (window as any).openActions = () => {
      if (pTrabs && pTrabs.length > 0) {
        setOpenActionsId(pTrabs[0].id);
      }
    };
    (window as any).closeActions = () => setOpenActionsId(null);
    
    return () => {
      delete (window as any).openSettings;
      delete (window as any).closeSettings;
      delete (window as any).openActions;
      delete (window as any).closeActions;
    };
  }, [pTrabs]);

  useEffect(() => {
    const startTour = searchParams.get('startTour') === 'true';
    const showHub = searchParams.get('showHub') === 'true';
    const missionId = localStorage.getItem('active_mission_id');
    const ghost = isGhostMode();

    if (showHub) {
      setShowInstructionHub(true);
    }

    if (startTour && ghost && missionId === '1' && user?.id) {
      runMission01(user.id, () => {
        const completed = JSON.parse(localStorage.getItem(`completed_missions_${user.id}`) || '[]');
        if (!completed.includes(1)) {
          localStorage.setItem(`completed_missions_${user.id}`, JSON.stringify([...completed, 1]));
        }
        setShowInstructionHub(true);
      });
    }
  }, [searchParams, user?.id]);
  
  const currentYear = new Date().getFullYear();
  const yearSuffix = `/${currentYear}`;

  const existingPTrabNumbers = useMemo(() => pTrabs.map(p => p.numero_ptrab), [pTrabs]);

  const fetchUserName = useCallback(async (userId: string, userMetadata: any) => {
    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('last_name, raw_user_meta_data') 
        .eq('id', userId)
        .single();

    if (profileError) {
        console.error("Error fetching user profile:", profileError);
    }
    
    const nomeGuerra = profileData?.last_name || '';
    const profileMetadata = profileData?.raw_user_meta_data as { posto_graduacao?: string, nome_om?: string } | undefined;
    const postoGraduacao = profileMetadata?.posto_graduacao?.trim() || userMetadata?.posto_graduacao?.trim() || '';
    const nomeOM = profileMetadata?.nome_om?.trim() || '';
    
    let nameParts: string[] = [];
    if (postoGraduacao) nameParts.push(postoGraduacao);
    if (nomeGuerra) nameParts.push(nomeGuerra);
    
    let finalName = nameParts.join(' ');
    if (nomeOM) finalName += ` (${nomeOM})`;
    if (!finalName.trim()) return 'Perfil Incompleto';

    return finalName; 
  }, []);

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

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
    codug_rm_vinculacao: "",
    rm_vinculacao: "",
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

  useEffect(() => {
    checkAuth();
    
    if (user?.id) {
        fetchUserName(user.id, user.user_metadata).then(name => {
            setUserName(name || ""); 
        });
    }
  }, [user, fetchUserName]);

  useEffect(() => {
    if (ptrabToClone) {
      let newSuggestedNumber = generateUniqueMinutaNumber(existingPTrabNumbers); 
      setSuggestedCloneNumber(newSuggestedNumber);
    }
  }, [ptrabToClone, existingPTrabNumbers]);

  const handleConfirmArchiveStatus = async () => {
    if (!ptrabToArchiveId) return;
    setIsActionLoading(true);
    try {
      const { error } = await supabase.from("p_trab").update({ status: "arquivado" }).eq("id", ptrabToArchiveId);
      if (error) throw error;
      toast.success(`P Trab ${ptrabToArchiveName} arquivado com sucesso!`);
      setShowArchiveStatusDialog(false);
      setPtrabToArchiveId(null);
      setPtrabToArchiveName(null);
      loadPTrabs();
    } catch (error) {
      console.error("Erro ao arquivar P Trab:", error);
      toast.error("Erro ao arquivar P Trab.");
    } finally {
      setIsActionLoading(false);
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

    setIsActionLoading(true);
    try {
        const { error } = await supabase.from("p_trab").update({ status: "arquivado" }).eq("id", ptrabId);
        if (error) throw error;
        toast.success(`P Trab ${ptrabName} arquivado com sucesso!`);
        loadPTrabs();
    } catch (error) {
        console.error("Erro ao arquivar P Trab:", error);
        toast.error("Erro ao arquivar P Trab.");
    } finally {
        setIsActionLoading(false);
    }
  };

  const handleConfirmReactivateStatus = async () => {
    if (!ptrabToReactivateId) return;
    setIsActionLoading(true);
    try {
      const { data: ptrab, error: fetchError } = await supabase.from("p_trab").select("numero_ptrab").eq("id", ptrabToReactivateId).single();
      if (fetchError || !ptrab) throw new Error("P Trab não encontrado.");
      const isMinuta = ptrab.numero_ptrab.startsWith("Minuta");
      const newStatus = isMinuta ? 'aberto' : 'aprovado';
      const { error: updateError = null } = await supabase.from("p_trab").update({ status: newStatus }).eq("id", ptrabToReactivateId);
      if (updateError) throw updateError;
      toast.success(`P Trab ${ptrabToReactivateName} reativado para "${newStatus.toUpperCase()}"!`);
      setShowReactivateStatusDialog(false);
      setPtrabToReactivateId(null);
      setPtrabToReactivateName(null);
      loadPTrabs();
    } catch (error: any) {
      console.error("Erro ao reativar P Trab:", error);
      toast.error(error.message || "Erro ao reativar P Trab.");
    } finally {
      setIsActionLoading(false);
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
    setIsActionLoading(true);
    try {
      const { error } = await supabase.from('p_trab').update({ comentario: comentarioText || null }).eq('id', ptrabComentario.id);
      if (error) throw error;
      toast.success("Comentário salvo com sucesso!");
      setShowComentarioDialog(false);
      setPtrabComentario(null);
      setComentarioText("");
      loadPTrabs();
    } catch (error) {
      console.error("Erro ao salvar comentário:", error);
      toast.error("Erro ao salvar comentário. Tente novamente.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      toast.info("Encerrando sessão...");
      if (isGhostMode()) {
        localStorage.removeItem(`is_ghost_mode_${user?.id}`);
        localStorage.removeItem(`active_mission_id_${user?.id}`);
      }
      await supabase.auth.signOut();
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('auth-token')) {
          localStorage.removeItem(key);
        }
      });
      window.location.href = "/";
    } catch (error: any) {
      console.error("Erro ao sair:", error);
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('auth-token')) {
          localStorage.removeItem(key);
        }
      });
      window.location.href = "/";
    }
  };

  const handleNumeroPTrabChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, numero_ptrab: e.target.value }));
  };

  const handleOpenNewPTrabDialog = () => {
    if (onboardingStatus?.isReady || isGhostMode()) {
      resetForm();
      setDialogOpen(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setShowRequirementsAlert(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      const currentNumber = formData.numero_ptrab.trim();
      const requiredFields: (keyof typeof formData)[] = ['numero_ptrab', 'nome_operacao', 'comando_militar_area', 'nome_om_extenso', 'nome_om', 'efetivo_empregado', 'periodo_inicio', 'periodo_fim', 'acoes', 'local_om', 'nome_cmt_om'];
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
          setIsActionLoading(false);
          return;
        }
      }
      if (!formData.codug_om || !formData.rm_vinculacao || !formData.codug_rm_vinculacao) {
        toast.error("A OM deve ser selecionada na lista para preencher os CODUGs e RM.");
        setIsActionLoading(false);
        return;
      }
      if (new Date(formData.periodo_inicio) > new Date(formData.periodo_fim)) {
        toast.error("A Data Fim deve ser posterior ou igual à Data Início.");
        setIsActionLoading(false);
        return;
      }
      if (currentNumber && !currentNumber.startsWith("Minuta")) {
        const isDuplicate = isPTrabNumberDuplicate(currentNumber, existingPTrabNumbers) && currentNumber !== pTrabs.find(p => p.id === editingId)?.numero_ptrab;
        if (isDuplicate) {
          toast.error("Já existe um P Trab com este número. Por favor, proponha outro.");
          setIsActionLoading(false);
          return;
        }
      }
      const finalNumeroPTrab = currentNumber || generateUniqueMinutaNumber(existingPTrabNumbers);
      const ptrabData = { ...formData, user_id: user.id, origem: editingId ? formData.origem : 'original', numero_ptrab: finalNumeroPTrab, status: editingId ? formData.status : 'aberto' };
      if (editingId) {
        const { error } = await supabase.from("p_trab").update(ptrabData).eq("id", editingId);
        if (error) throw error;
        toast.success("P Trab actualizado!");
      } else {
        const { id, ...insertData } = ptrabData as Partial<PTrab> & { id?: string };
        const { data: newPTrab, error: insertError = null } = await supabase.from("p_trab").insert([insertData as TablesInsert<'p_trab'>]).select().single();
        if (insertError || !newPTrab) throw insertError;
        const newPTrabId = newPTrab.id;
        if (originalPTrabIdToClone) {
            await cloneRelatedRecords(originalPTrabIdToClone, newPTrabId);
            const { data: originalPTrabData } = await supabase.from("p_trab").select("rotulo_versao").eq("id", originalPTrabIdToClone).single();
            if (originalPTrabData?.rotulo_versao) {
                await supabase.from("p_trab").update({ rotulo_versao: originalPTrabData.rotulo_versao }).eq("id", newPTrabId);
            }
            toast.success("P Trab criado e registros clonados!");
        }
        try {
            await updateUserCredits(user.id, 0, 0);
        } catch (creditError) {
            console.error("Erro ao zerar créditos após criação do P Trab:", creditError);
        }
        setDialogOpen(false);
        resetForm();
        loadPTrabs();
        setIsActionLoading(false);
        return;
      }
      setDialogOpen(false);
      resetForm();
      loadPTrabs();
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleEdit = (ptrab: PTrab) => {
    setEditingId(ptrab.id);
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
    
    queryClient.setQueryData(['pTrabs', user?.id, ghostActive], (old: PTrab[] | undefined) => 
      old ? old.filter(p => p.id !== id) : []
    );
    
    setIsActionLoading(true);
    try {
      const { error } = await supabase.from("p_trab").delete().eq("id", id);
      if (error) throw error;
      toast.success("P Trab excluído!");
    } catch (error: any) {
      toast.error("Erro ao excluir");
      loadPTrabs();
    } finally {
      setIsActionLoading(false);
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
    setIsActionLoading(true);
    try {
      const { error } = await supabase.from("p_trab").update({ numero_ptrab: newNumber, status: 'aprovado' }).eq("id", ptrabToApprove.id);
      if (error) throw error;
      toast.success(`P Trab ${newNumber} aprovado e numerado com sucesso!`);
      setShowApproveDialog(false);
      setPtrabToApprove(null);
      setSuggestedApproveNumber("");
      loadPTrabs();
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setIsActionLoading(false);
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
      const { id, created_at, updated_at, user_id, share_token, shared_with, totalLogistica, totalOperacional, totalMaterialPermanente, quantidadeRacaoOp, quantidadeHorasVoo, isOwner, isShared, hasPendingRequests, ...restOfPTrab } = ptrabToClone;
      setFormData({ ...restOfPTrab, numero_ptrab: suggestedCloneNumber, status: "aberto", origem: ptrabToClone.origem, comentario: "", rotulo_versao: ptrabToClone.rotulo_versao, nome_om: "", nome_om_extenso: "", codug_om: "", rm_vinculacao: "", codug_rm_vinculacao: "" });
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
    setIsActionLoading(true);
    try {
        const { id, created_at, updated_at, user_id, share_token, shared_with, totalLogistica, totalOperacional, totalMaterialPermanente, quantidadeRacaoOp, quantidadeHorasVoo, isOwner, isShared, hasPendingRequests, ...restOfPTrab } = ptrabToClone;
        const newPTrabData: TablesInsert<'p_trab'> & { origem: PTrabDB['origem'] } = { ...restOfPTrab, numero_ptrab: suggestedCloneNumber, status: "aberto", origem: ptrabToClone.origem, comentario: null, rotulo_versao: versionName, user_id: (await supabase.auth.getUser()).data.user?.id! };
        const { data: newPTrab, error: insertError = null } = await supabase.from("p_trab").insert([newPTrabData as TablesInsert<'p_trab'>]).select().single();
        if (insertError || !newPTrab) throw insertError;
        const newPTrabId = newPTrab.id;
        await cloneRelatedRecords(ptrabToClone.id, newPTrabId);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await updateUserCredits(user.id, 0, 0);
        toast.success(`Variação "${versionName}" criada como Minuta ${suggestedCloneNumber} e registros clonados!`);
        loadPTrabs();
    } catch (error: any) {
        console.error("Erro ao clonar variação:", error);
        toast.error(sanitizeError(error));
    } finally {
        setIsActionLoading(false);
    }
  };

  const cloneRelatedRecords = async (originalPTrabId: string, newPTrabId: string) => {
    const cloneClassRecords = async <T extends string>(
        tableName: T, 
        jsonbFields: string[] | null, 
        numericFields: string[]
    ) => {
        const { data: originalRecords, error: fetchError } = await (supabase.from(tableName as any) as any).select('*').eq("p_trab_id", originalPTrabId);
        if (fetchError) {
            console.error(`Erro ao carregar registros da ${tableName}:`, fetchError);
            return 0;
        }
        const typedRecords = originalRecords as any[];
        const newRecords = (typedRecords || []).map(record => {
            const { id, created_at, updated_at, ...restOfRecord } = record; 
            const newRecord: Record<string, any> = { ...restOfRecord, p_trab_id: newPTrabId };
            
            if (jsonbFields) {
                jsonbFields.forEach(field => {
                    if (newRecord[field]) {
                        newRecord[field] = JSON.parse(JSON.stringify(newRecord[field]));
                    }
                });
            }
            
            numericFields.forEach(field => { 
                if (newRecord[field] === null || newRecord[field] === undefined) newRecord[field] = 0; 
            });
            return newRecord;
        });
        if (newRecords.length > 0) {
            const { error: insertError } = await (supabase.from(tableName as any) as any).insert(newRecords);
            if (insertError) {
                console.error(`ERRO DE INSERÇÃO ${tableName}:`, insertError);
                toast.error(`Erro ao clonar registros da ${tableName}: ${sanitizeError(insertError)}`);
            }
        }
        return newRecords.length;
    };

    const genericNumericFields = ['dias_operacao', 'valor_total', 'valor_nd_30', 'valor_nd_39', 'efetivo'];
    const classeINumericFields = ['complemento_qr', 'complemento_qs', 'dias_operacao', 'efetivo', 'etapa_qr', 'etapa_qs', 'nr_ref_int', 'total_geral', 'total_qr', 'total_qs', 'valor_qr', 'valor_qs', 'quantidade_r2', 'quantidade_r3'];
    const classeIIINumericFields = ['dias_operacao', 'preco_litro', 'quantidade', 'total_litros', 'valor_total', 'consumo_lubrificante_litro', 'preco_lubrificante', 'valor_nd_30', 'valor_nd_39'];

    await Promise.all([
      cloneClassRecords('classe_i_registros', null, classeINumericFields),
      cloneClassRecords('classe_ii_registros', ['itens_equipamentos'], genericNumericFields),
      cloneClassRecords('classe_iii_registros', ['itens_equipamentos'], classeIIINumericFields),
      cloneClassRecords('classe_v_registros', ['itens_equipamentos'], genericNumericFields),
      cloneClassRecords('classe_vi_registros', ['itens_equipamentos'], genericNumericFields),
      cloneClassRecords('classe_vii_registros', ['itens_equipamentos'], genericNumericFields),
      cloneClassRecords('classe_viii_saude_registros', ['itens_saude'], genericNumericFields),
      cloneClassRecords('classe_viii_remonta_registros', ['itens_remonta'], [...genericNumericFields, 'quantidade_animais']),
      cloneClassRecords('classe_ix_registros', ['itens_motomecanizacao'], genericNumericFields),
      cloneClassRecords('diaria_registros', ['quantidades_por_posto'], ['dias_operacao', 'quantidade', 'nr_viagens', 'valor_nd_15', 'valor_nd_30', 'valor_total']),
      cloneClassRecords('verba_operacional_registros', null, ['dias_operacao', 'quantidade_equipes', 'valor_total_solicitado', 'valor_nd_30', 'valor_nd_39']),
      cloneClassRecords('passagem_registros', null, ['dias_operacao', 'efetivo', 'quantidade_passagens', 'valor_nd_33', 'valor_total', 'valor_unitario']),
      cloneClassRecords('concessionaria_registros', null, ['dias_operacao', 'efetivo', 'consumo_pessoa_dia', 'valor_unitario', 'valor_total', 'valor_nd_39']),
      cloneClassRecords('horas_voo_registros', null, ['dias_operacao', 'quantidade_hv', 'valor_nd_30', 'valor_nd_39', 'valor_total']),
      cloneClassRecords('material_consumo_registros', ['itens_aquisicao'], ['dias_operacao', 'efetivo', 'valor_total', 'valor_nd_30', 'valor_nd_39']),
      cloneClassRecords('complemento_alimentacao_registros', ['itens_aquisicao'], ['dias_operacao', 'efetivo', 'valor_total', 'valor_nd_30', 'valor_nd_39']),
      cloneClassRecords('material_permanente_registros', ['detalhes_planejamento'], ['dias_operacao', 'efetivo', 'valor_total', 'valor_nd_52']),
      cloneClassRecords('servicos_terceiros_registros', ['detalhes_planejamento'], ['dias_operacao', 'efetivo', 'valor_total', 'valor_nd_30', 'valor_nd_39']),
      cloneClassRecords('dor_registros', ['itens_dor', 'grupos_dor'], []),
      (async () => {
        const { data: originalRefLPC } = await supabase.from("p_trab_ref_lpc").select("*").eq("p_trab_id", originalPTrabId).maybeSingle();
        if (originalRefLPC) {
          const { id, created_at, updated_at, ...restOfRefLPC } = originalRefLPC;
          const newRefLPCData = { ...restOfRefLPC, p_trab_id: newPTrabId, preco_diesel: restOfRefLPC.preco_diesel ?? 0, preco_gasolina: restOfRefLPC.preco_gasolina ?? 0 };
          await supabase.from("p_trab_ref_lpc").insert([newRefLPCData as TablesInsert<'p_trab_ref_lpc'>]);
        }
      })()
    ]);
  };

  const needsNumbering = (ptrab: PTrab) => ptrab.numero_ptrab.startsWith("Minuta") && (ptrab.status === 'aberto' || ptrab.status === 'em_andamento');
  const isFinalStatus = (ptrab: PTrab) => ptrab.status === 'aprovado' || ptrab.status === 'arquivado';
  
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
    setShowConsolidationNumberDialog(false);
    setIsActionLoading(true);
    try {
        const { data: selectedPTrabsData, error: fetchError } = await supabase.from('p_trab').select('*').in('id', selectedPTrabsToConsolidate);
        if (fetchError || !selectedPTrabsData || selectedPTrabsData.length === 0) throw new Error("Falha ao carregar dados dos P Trabs selecionados.");
        const basePTrab = selectedPTrabsData[0];
        const { id, created_at, updated_at, share_token, shared_with, user_id, ...restOfBasePTrab } = basePTrab;
        const newPTrabData: TablesInsert<'p_trab'> = { ...restOfBasePTrab, user_id: user.id, numero_ptrab: finalMinutaNumber, nome_operacao: basePTrab.nome_operacao, status: 'aberto', origem: 'consolidated', comentario: `Consolidação dos P Trabs: ${selectedPTrabsData.map(p => p.numero_ptrab).join(', ')}`, rotulo_versao: null };
        const { data: newPTrab, error: insertError = null } = await supabase.from("p_trab").insert([newPTrabData]).select('id').single();
        if (insertError || !newPTrab) throw insertError;
        const newPTrabId = newPTrab.id;
        const tablesToConsolidate: PTrabLinkedTableName[] = ['classe_i_registros', 'classe_ii_registros', 'classe_iii_registros', 'classe_v_registros', 'classe_vi_registros', 'classe_vii_registros', 'classe_viii_saude_registros', 'classe_viii_remonta_registros', 'classe_ix_registros', 'diaria_registros', 'verba_operacional_registros', 'passagem_registros', 'concessionaria_registros', 'horas_voo_registros', 'material_consumo_registros', 'complemento_alimentacao_registros', 'material_permanente_registros', 'servicos_terceiros_registros', 'dor_registros'];
        
        await Promise.all(tablesToConsolidate.map(async (tableName) => {
            const { data: records, error: recordsError } = await (supabase.from(tableName as any) as any).select('*').in('p_trab_id', selectedPTrabsToConsolidate);
            if (recordsError || !records || records.length === 0) return;
            
            const newRecords = records.map((record: any) => {
                const { id, created_at, updated_at, ...restOfRecord } = record;
                const newRecord: any = { 
                    ...restOfRecord, 
                    p_trab_id: newPTrabId, 
                    ...((record as any).hasOwnProperty('itens_equipamentos') && { itens_equipamentos: JSON.parse(JSON.stringify(record.itens_equipamentos)) }), 
                    ...((record as any).hasOwnProperty('itens_saude') && { itens_saude: JSON.parse(JSON.stringify(record.itens_saude)) }), 
                    ...((record as any).hasOwnProperty('itens_remonta') && { itens_remonta: JSON.parse(JSON.stringify(record.itens_remonta)) }), 
                    ...((record as any).hasOwnProperty('itens_motomecanizacao') && { itens_motomecanizacao: JSON.parse(JSON.stringify(record.itens_motomecanizacao)) }), 
                    ...((record as any).hasOwnProperty('quantidades_por_posto') && { quantidades_por_posto: JSON.parse(JSON.stringify(record.quantidades_por_posto)) }), 
                    ...((record as any).hasOwnProperty('itens_aquisicao') && { itens_aquisicao: JSON.parse(JSON.stringify(record.itens_aquisicao)) }),
                    ...((record as any).hasOwnProperty('detalhes_planejamento') && { detalhes_planejamento: JSON.parse(JSON.stringify(record.detalhes_planejamento)) }),
                    ...((record as any).hasOwnProperty('itens_dor') && { itens_dor: JSON.parse(JSON.stringify(record.itens_dor)) }),
                    ...((record as any).hasOwnProperty('groups_dor') && { grupos_dor: JSON.parse(JSON.stringify(record.grupos_dor)) })
                };
                return newRecord;
            });
            await (supabase.from(tableName as any) as any).insert(newRecords);
        }));

        await updateUserCredits(user.id, 0, 0);
        toast.success(`Consolidação concluída! Novo P Trab ${finalMinutaNumber} criado.`);
        loadPTrabs();
    } catch (error: any) {
        console.error("Erro na consolidação:", error);
        toast.error(sanitizeError(error));
    } finally {
        setSelectedPTrabsToConsolidate([]);
        setIsActionLoading(false);
    }
  };
  
  const simplePTrabsToConsolidate = useMemo(() => pTrabs.filter(p => selectedPTrabsToConsolidate.includes(p.id)).map(p => ({ id: p.id, numero_ptrab: p.numero_ptrab, nome_operacao: p.numero_ptrab })), [pTrabs, selectedPTrabsToConsolidate]);

  const handleOpenShareDialog = (ptrab: PTrab) => {
    if (!ptrab.share_token) {
        toast.error("Token de compartilhamento não encontrado.");
        return;
    }
    const baseUrl = window.location.origin;
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
    setIsActionLoading(true);
    try {
        const url = new URL(linkPTrabInput);
        const ptrabId = url.searchParams.get('ptrabId');
        const shareToken = url.searchParams.get('token');
        if (!ptrabId || !shareToken) throw new Error("Link de compartilhamento incompleto.");
        const { data, error } = await supabase.rpc('request_ptrab_share', { p_ptrab_id: ptrabId, p_share_token: shareToken, p_user_id: user.id });
        if (error) throw error;
        if (data === false) throw new Error("P Trab não encontrado ou token inválido.");
        toast.success("Solicitação Enviada!", { description: `Sua solicitação de acesso foi enviada ao proprietário do P Trab. Você será notificado quando for aprovada.`, duration: 8000 });
        setShowLinkPTrabDialog(false);
    } catch (error: any) {
        toast.error("Erro ao solicitar vinculação.", { description: sanitizeError(error) });
    } finally {
        setIsActionLoading(false);
    }
  };
  
  const handleOpenManageSharingDialog = async (ptrab: PTrab) => {
    if (!ptrab.isOwner) return;
    setPtrabToManageSharing(ptrab);
    setShowManageSharingDialog(true); 
  };
  
  const handleApproveRequest = async (requestId: string) => {
    setIsActionLoading(true);
    try {
        const { data, error = null } = await supabase.rpc('approve_ptrab_share', { p_request_id: requestId });
        if (error) throw error;
        if (data === false) throw new Error("Falha na aprovação. Verifique se você é o dono.");
        toast.success("Compartilhamento aprovado com sucesso!");
        loadPTrabs();
    } catch (error: any) {
        toast.error("Erro ao aprovar solicitação.");
    } finally {
        setIsActionLoading(false);
    }
  };
  
  const handleRejectRequest = async (requestId: string) => {
    setIsActionLoading(true);
    try {
        const { data, error = null } = await supabase.rpc('reject_ptrab_share', { p_request_id: requestId });
        if (error) throw error;
        if (data === false) throw new Error("Falha na rejeição. Verifique se você é o dono.");
        toast.info("Solicitação rejeitada.");
        loadPTrabs();
    } catch (error: any) {
        toast.error("Erro ao rejeitar solicitação.");
    } finally {
        setIsActionLoading(false);
    }
  };
  
  const handleCancelSharing = async (ptrabId: string, userIdToRemove: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja remover o acesso de ${userName} a este P Trab?`)) return;
    setIsActionLoading(true);
    try {
        const { data: success, error = null } = await supabase.rpc('remove_user_from_shared_with', { p_ptrab_id: ptrabId, p_user_to_remove_id: userIdToRemove });
        if (error) throw error;
        if (success === false) throw new Error("Falha na remoção de acesso. Verifique se você é o dono.");
        toast.success(`Acesso de ${userName} removido com sucesso.`);
        loadPTrabs();
    } catch (error: any) {
        toast.error("Erro ao cancelar compartilhamento.");
    } finally {
        setIsActionLoading(false);
    }
  };
  
  const handleOpenUnlinkDialog = (ptrab: PTrab) => {
    setPtrabToUnlink(ptrab);
    setShowUnlinkPTrabDialog(true);
  };
  
  const handleConfirmUnlink = async () => {
    if (!ptrabToUnlink || !user?.id) return;
    setIsActionLoading(true);
    try {
        const { data: success, error = null } = await supabase.rpc('remove_user_from_shared_with', { p_ptrab_id: ptrabToUnlink.id, p_user_to_remove_id: user.id });
        if (error) throw error;
        if (success === false) throw new Error("Falha na desvinculação. O P Trab não foi encontrado ou você não tinha acesso.");
        toast.success(`P Trab ${ptrabToUnlink.numero_ptrab} desvinculado com sucesso.`);
        setShowUnlinkPTrabDialog(false);
        loadPTrabs();
    } catch (error: any) {
        toast.error("Erro ao desvincular P Trab.", { description: sanitizeError(error) });
    } finally {
        setIsActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <PageMetadata 
        title="Gerenciamento de Planos de Trabalho" 
        description="Visualize, crie, edite e gerencie todos os seus Planos de Trabalho (P Trabs) e seus custos associados."
        canonicalPath="/ptrab"
      />
      
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
              <Button onClick={handleOpenNewPTrabDialog} className="btn-novo-ptrab">
                <Plus className="mr-2 h-4 w-4" />
                Novo P Trab
              </Button>
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
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nome_om">Nome da OM (sigla) *</Label>
                      <OmSelector
                        selectedOmId={selectedOmId}
                        initialOmName={formData.nome_om}
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
                              local_om: omData.cidade || "",
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
                              local_om: "",
                            });
                          }
                        }}
                        placeholder="Selecione uma OM..."
                      />
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
                      <Input id="periodo_inicio" type="date" value={formData.periodo_inicio} onChange={(e) => setFormData({ ...formData, periodo_inicio: e.target.value })} required onKeyDown={handleEnterToNextField} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="periodo_fim">Término da Operação *</Label>
                      <Input id="periodo_fim" type="date" value={formData.periodo_fim} onChange={(e) => setFormData({ ...formData, periodo_fim: e.target.value })} required onKeyDown={handleEnterToNextField} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="local_om">Local da OM *</Label>
                      <Input id="local_om" value={formData.local_om} onChange={(e) => setFormData({ ...formData, local_om: e.target.value })} placeholder="Ex: Marabá/PA" maxLength={200} required onKeyDown={handleEnterToNextField} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nome_cmt_om">Nome do Comandante da OM - Posto *</Label>
                      <Input id="nome_cmt_om" value={formData.nome_cmt_om} onChange={(e) => setFormData({ ...formData, nome_cmt_om: e.target.value })} maxLength={200} required onKeyDown={handleEnterToNextField} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="acoes">Ações realizadas ou a serem realizadas *</Label>
                    <Textarea id="acoes" value={formData.acoes} onChange={(e) => setFormData({ ...formData, acoes: e.target.value })} rows={4} maxLength={2000} required onKeyDown={handleEnterToNextField} />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isActionLoading}>{isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingId ? "Atualizar" : "Criar")}</Button>
                    <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button onClick={() => !isConsolidationDisabled && setShowConsolidationDialog(true)} variant="secondary" disabled={isConsolidationDisabled} className="btn-consolidar">
                      <ArrowRight className="mr-2 h-4 w-4" />
                      Consolidar P Trab
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {isConsolidationDisabled ? <p className="text-xs text-orange-400 max-w-xs">{getConsolidationDisabledMessage()}</p> : <p>Selecione múltiplos P Trabs para consolidar seus custos em um novo P Trab.</p>}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="btn-ajuda">
              <HelpDialog />
            </div>

            <DropdownMenu open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="btn-configuracoes"><Settings className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 menu-configuracoes z-tour-portal">
                <DropdownMenuLabel>Configurações</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleOpenLinkPTrabDialog}><Link className="mr-2 h-4 w-4" />Vincular P Trab</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/config/profile")}>Perfil do Usuário</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/config/diretrizes")}>Diretriz de Custeio Logístico</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/config/custos-operacionais")}>Custos Operacionais</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/config/visualizacao")}>Opção de Visualização</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/config/om")}>Relação de OM (CODUG)</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/config/ptrab-export-import")}><ArrowDownUp className="mr-2 h-4 w-4" />Exportar/Importar P Trab</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button onClick={handleLogout} variant="outline" className="btn-sair"><LogOut className="mr-2 h-4 w-4" />Sair</Button>
          </div>
        </div>

        {showInstructionHub && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-6 w-6 text-primary" />
                <CardTitle>Centro de Instrução</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowInstructionHub(false)}>Ocultar</Button>
            </CardHeader>
            <CardContent>
              <InstructionHub />
            </CardContent>
          </Card>
        )}

        <Card className="tabela-ptrabs">
          <CardHeader>
            <h2 className="text-xl font-bold">Planos de Trabalho Cadastrados</h2>
          </CardHeader>
          <CardContent>
            {loading ? (
              <PTrabTableSkeleton />
            ) : pTrabs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold">Nenhum Plano de Trabalho Registrado</h3>
                <p className="text-muted-foreground mt-2">Clique em "Novo P Trab" para começar a configurar seu primeiro Plano de Trabalho.</p>
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
                    const isActionDisabledForNonOwner = !isOwnedByCurrentUser;
                    const isSharingDisabled = ptrab.status === 'aprovado' || ptrab.status === 'arquivado';
                    const showManageSharingBadge = isOwnedByCurrentUser && ((ptrab.shared_with?.length || 0) > 0 || ptrab.hasPendingRequests);

                    return (
                    <TableRow key={ptrab.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col items-center">
                          {ptrab.status === 'arquivado' && isMinuta ? <span className="text-gray-500 font-bold">MINUTA</span> : ptrab.status === 'aprovado' || ptrab.status === 'arquivado' ? <span>{ptrab.numero_ptrab}</span> : <span className="text-red-500 font-bold">{isMinuta ? "MINUTA" : "PENDENTE"}</span>}
                          <Badge variant={originBadge.variant} className="mt-1 text-xs font-semibold">{originBadge.label}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start">
                          <span>{displayOperationName}</span>
                          {ptrab.rotulo_versao && <Badge variant="secondary" className="mt-1 text-xs bg-secondary text-secondary-foreground"><GitBranch className="h-3 w-3 mr-1" />{ptrab.rotulo_versao}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center">
                          <span className="block">{new Date(ptrab.periodo_inicio).toLocaleDateString('pt-BR')}</span>
                          <span className="block font-bold text-sm">-</span>
                          <span className="block">{new Date(ptrab.periodo_fim).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{calculateDays(ptrab.periodo_inicio, ptrab.periodo_fim)} dias</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-center">
                          <Badge variant={statusConfig[ptrab.status as keyof typeof statusConfig]?.variant || 'default'} className="w-[140px] h-7 text-xs flex items-center justify-center">{statusConfig[ptrab.status as keyof typeof statusConfig]?.label || ptrab.status}</Badge>
                          {showManageSharingBadge && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span onClick={() => handleOpenManageSharingDialog(ptrab)} className="cursor-pointer">
                                    <Badge variant="ptrab-shared" className="mt-1 text-xs w-[140px] h-7 flex items-center justify-center"><Users className="h-3 w-3 mr-1" />Compartilhando{ptrab.hasPendingRequests && <span className="ml-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />}</Badge>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{ptrab.hasPendingRequests ? "Gerenciar (Solicitações Pendentes!)" : "Gerenciar Compartilhamento"}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {isSharedWithCurrentUser && <Badge variant="ptrab-collaborator" className="mt-1 text-xs w-[140px] h-7 flex items-center justify-center"><Share2 className="h-3 w-3 mr-1" />Compartilhado</Badge>}
                          <div className="text-xs text-muted-foreground mt-1 flex flex-col items-center"><span className="block">Última alteração:</span><span className="block">{formatDateTime(ptrab.updated_at)}</span></div>
                        </div>
                      </TableCell>
                      <TableCell className="text-left w-[200px]">
                        <div className="flex flex-col text-xs space-y-1">
                          <div className="flex justify-between"><span className="text-muted-foreground">Log:</span><span className="text-orange-600 font-medium">{formatCurrency(ptrab.totalLogistica || 0)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Op:</span><span className="text-blue-600 font-medium">{formatCurrency(ptrab.totalOperacional || 0)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Mat Perm:</span><span className="text-green-600 font-medium">{formatCurrency(ptrab.totalMaterialPermanente || 0)}</span></div>
                          <div className="w-full h-px bg-muted-foreground/30 my-1" />
                          <div className="flex justify-between font-bold text-sm text-foreground"><span>Total:</span><span>{formatCurrency(totalGeral)}</span></div>
                          <div className="w-full h-px bg-muted-foreground/30 my-1" />
                          <div className="flex justify-between"><span className="text-muted-foreground">Rç Op:</span><span className="font-medium">{`${ptrab.quantidadeRacaoOp || 0} Unid.`}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">HV:</span><span className="font-medium">{`${ptrab.quantidadeHorasVoo || 0} h`}</span></div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 btn-comentarios" onClick={() => handleOpenComentario(ptrab)}><MessageSquare className={`h-5 w-5 transition-all ${ptrab.comentario && ptrab.status !== 'arquivado' ? "text-green-600 fill-green-600" : "text-gray-300"}`} /></Button>
                            </TooltipTrigger>
                            <TooltipContent><p>{ptrab.comentario && ptrab.status !== 'arquivado' ? "Editar comentário" : "Adicionar comentário"}</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 items-start">
                          {(needsNumbering(ptrab) || isApprovedOrArchived) && <Button onClick={() => handleOpenApproveDialog(ptrab)} size="sm" className="flex items-center gap-2 bg-green-600 hover:bg-green-700 btn-aprovar" disabled={isApprovedOrArchived || isActionDisabledForNonOwner}><CheckCircle className="h-4 w-4" />Aprovar</Button>}
                          
                          <div className="flex flex-col gap-1">
                            <Button 
                              onClick={() => handleSelectPTrab(ptrab)} 
                              size="sm" 
                              className="flex items-center gap-2 w-full justify-start btn-preencher-ptrab" 
                              disabled={!isEditable}
                            >
                              <FileText className="h-4 w-4" />
                              Preencher P Trab
                            </Button>
                            <Button 
                              onClick={() => navigate(`/ptrab/dor?ptrabId=${ptrab.id}`)} 
                              size="sm" 
                              variant="outline"
                              className="flex items-center gap-2 w-full justify-start btn-preencher-dor" 
                              disabled={!isEditable}
                            >
                              <ClipboardList className="h-4 w-4" />
                              Preencher DOR
                            </Button>
                          </div>

                          <DropdownMenu open={openActionsId === ptrab.id} onOpenChange={(open) => setOpenActionsId(open ? ptrab.id : null)}>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="btn-acoes-ptrab"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="menu-acoes z-tour-portal">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleNavigateToPrintOrExport(ptrab.id)}><Printer className="mr-2 h-4 w-4" />Visualizar Impressão</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => isEditable && handleEdit(ptrab)} disabled={!isEditable} className={!isEditable ? "opacity-50 cursor-not-allowed" : ""}><Pencil className="mr-2 h-4 w-4" />Editar P Trab</DropdownMenuItem>
                              {isOwnedByCurrentUser && <DropdownMenuItem onClick={() => !isSharingDisabled && handleOpenShareDialog(ptrab)} disabled={isSharingDisabled} className={isSharingDisabled ? "opacity-50 cursor-not-allowed" : ""}><Share2 className="mr-2 h-4 w-4" />Compartilhar</DropdownMenuItem>}
                              {isSharedWithCurrentUser && <DropdownMenuItem onClick={() => handleOpenUnlinkDialog(ptrab)} className="text-red-600"><XCircle className="mr-2 h-4 w-4" />Desvincular</DropdownMenuItem>}
                              <DropdownMenuItem onClick={() => ptrab.status !== 'arquivado' && handleOpenCloneOptions(ptrab)} disabled={ptrab.status === 'arquivado'} className={ptrab.status === 'arquivado' ? "opacity-50 cursor-not-allowed" : ""}><Copy className="mr-2 h-4 w-4" />Clonar P Trab</DropdownMenuItem>
                              {ptrab.status !== 'arquivado' && <DropdownMenuItem onClick={() => isOwnedByCurrentUser && handleArchive(ptrab.id, `${ptrab.numero_ptrab} - ${ptrab.nome_operacao}`)} disabled={isActionDisabledForNonOwner} className={isActionDisabledForNonOwner ? "opacity-50 cursor-not-allowed" : ""}><Archive className="mr-2 h-4 w-4" />Arquivar</DropdownMenuItem>}
                              {ptrab.status === 'arquivado' && <DropdownMenuItem onClick={() => isOwnedByCurrentUser && setShowReactivateStatusDialog(true)} disabled={isActionDisabledForNonOwner} className={isActionDisabledForNonOwner ? "opacity-50 cursor-not-allowed" : ""}><RefreshCw className="mr-2 h-4 w-4" />Reativar</DropdownMenuItem>}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDelete(ptrab.id, isOwnedByCurrentUser)} className={cn("text-red-600", !isOwnedByCurrentUser && "opacity-50 cursor-not-allowed")} disabled={!isOwnedByCurrentUser}><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>
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

      <WelcomeModal 
        open={showWelcomeModal} 
        onOpenChange={setShowWelcomeModal} 
        status={onboardingStatus || null} 
      />

      <RequirementsAlert 
        open={showRequirementsAlert} 
        onOpenChange={setShowRequirementsAlert} 
        status={onboardingStatus || null} 
      />

      <AlertDialog open={showArchiveStatusDialog} onOpenChange={setShowArchiveStatusDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar P Trab?</AlertDialogTitle>
            <AlertDialogDescription>O P Trab "{ptrabToArchiveName}" está com status "Aprovado" há mais de 10 dias. Deseja arquivá-lo?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleConfirmArchiveStatus} disabled={isActionLoading}>{isActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sim, arquivar"}</AlertDialogAction>
            <AlertDialogCancel onClick={handleCancelArchiveStatus}>Agora não</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showReactivateStatusDialog} onOpenChange={setShowReactivateStatusDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reativar P Trab?</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja reativar o P Trab "{ptrabToReactivateName}"? Ele retornará ao status de "Aprovado" (se já numerado) ou "Aberto" (se for Minuta), permitindo novas edições.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleConfirmReactivateStatus} disabled={isActionLoading}>{isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirmar Reativação"}</AlertDialogAction>
            <AlertDialogCancel onClick={handleCancelReactivateStatus}>Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showCloneOptionsDialog} onOpenChange={setShowCloneOptionsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clonar Plano de Trabalho</DialogTitle>
            <p className="text-sm text-muted-foreground">Clonando: <span className="font-medium">{ptrabToClone?.numero_ptrab} - {ptrabToClone?.nome_operacao}</span></p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <RadioGroup value={cloneType} onValueChange={(value: 'new' | 'variation') => setCloneType(value)} className="grid grid-cols-2 gap-4">
              <Label htmlFor="clone-new" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary">
                <RadioGroupItem id="clone-new" value="new" className="sr-only" />
                <span className="mb-3 text-lg font-semibold">Novo P Trab</span>
                <p className="text-sm text-muted-foreground text-center">Cria um P Trab totalmente novo, iniciando como Minuta para posterior numeração.</p>
              </Label>
              <Label htmlFor="clone-variation" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary">
                <RadioGroupItem id="clone-variation" value="variation" className="sr-only" />
                <span className="mb-3 text-lg font-semibold">Variação do Trabalho</span>
                <p className="text-sm text-muted-foreground text-center">Cria uma variação do P Trab atual, gerando um novo número de Minuta.</p>
              </Label>
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleConfirmCloneOptions}>Continuar</Button>
            <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ptrabToClone && <CloneVariationDialog open={showCloneVariationDialog} onOpenChange={setShowCloneVariationDialog} originalNumber={ptrabToClone.numero_ptrab} suggestedCloneNumber={suggestedCloneNumber} onConfirm={handleConfirmCloneVariation} />}

      <Dialog open={showComentarioDialog} onOpenChange={setShowComentarioDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Comentário do P Trab</DialogTitle>
            {ptrabComentario && <p className="text-sm text-muted-foreground">{ptrabComentario.numero_ptrab} - {ptrabComentario.nome_operacao}</p>}
          </DialogHeader>
          <div className="py-4"><Textarea placeholder="Digite seu comentário sobre este P Trab..." value={comentarioText} onChange={(e) => setComentarioText(e.target.value)} className="min-h-[150px]" /></div>
          <DialogFooter>
            <Button onClick={handleSaveComentario} disabled={isActionLoading}>{isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Salvar"}</Button>
            <Button variant="outline" onClick={() => setShowComentarioDialog(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-600" />Aprovar e Numerar P Trab</DialogTitle>
            <DialogDescription>Atribua o número oficial ao P Trab "{ptrabToApprove?.nome_operacao}".</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="approve-number">Número Oficial do P Trab *</Label>
              <Input id="approve-number" value={suggestedApproveNumber} onChange={(e) => setSuggestedApproveNumber(e.target.value)} placeholder={`Ex: 1${yearSuffix}/${ptrabToApprove?.nome_om}`} maxLength={50} onKeyDown={handleEnterToNextField} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleApproveAndNumber} disabled={!suggestedApproveNumber.trim() || isActionLoading}>{isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirmar Aprovação"}</Button>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PTrabConsolidationDialog open={showConsolidationDialog} onOpenChange={setShowConsolidationDialog} pTrabsList={pTrabs.filter(p => p.status !== 'arquivado').map(p => ({ id: p.id, numero_ptrab: p.numero_ptrab, nome_operacao: p.numero_ptrab }))} existingPTrabNumbers={existingPTrabNumbers} onConfirm={handleOpenConsolidationNumberDialog} loading={isActionLoading} />
      <ConsolidationNumberDialog open={showConsolidationNumberDialog} onOpenChange={setShowConsolidationNumberDialog} suggestedNumber={suggestedConsolidationNumber} existingNumbers={existingPTrabNumbers} selectedPTrabs={simplePTrabsToConsolidate} onConfirm={handleConfirmConsolidation} loading={isActionLoading} />
      <CreditPromptDialog open={showCreditPrompt} onConfirm={() => { setShowCreditPrompt(false); navigate(`/ptrab/form?ptrabId=${ptrabToFill?.id}&openCredit=true`); }} onCancel={() => setShowCreditPrompt(false)} />
      
      {ptrabToShare && <ShareLinkDialog open={showShareLinkDialog} onOpenChange={setShowShareLinkDialog} ptrabName={`${ptrabToShare.numero_ptrab} - ${ptrabToShare.nome_operacao}`} shareLink={shareLink} />}
      <LinkPTrabDialog open={showLinkPTrabDialog} onOpenChange={setShowLinkPTrabDialog} linkInput={linkPTrabInput} onLinkInputChange={setLinkPTrabInput} onRequestLink={handleRequestLink} loading={isActionLoading} />
      {ptrabToManageSharing && <ManageSharingDialog open={showManageSharingDialog} onOpenChange={setShowManageSharingDialog} ptrabId={ptrabToManageSharing.id} ptrabName={`${ptrabToManageSharing.numero_ptrab} - ${ptrabToManageSharing.nome_operacao}`} onApprove={handleApproveRequest} onReject={handleRejectRequest} onCancelSharing={handleCancelSharing} loading={isActionLoading} />}
      {ptrabToUnlink && <UnlinkPTrabDialog open={showUnlinkPTrabDialog} onOpenChange={setShowUnlinkPTrabDialog} ptrabName={`${ptrabToUnlink.numero_ptrab} - ${ptrabToUnlink.nome_operacao}`} onConfirm={handleConfirmUnlink} loading={isActionLoading} />}
      
      <Dialog open={showVictory} onOpenChange={setShowVictory}>
        <DialogContent className="text-center sm:max-w-[450px] z-[999999]">
          <div className="flex justify-center mb-4">
            <div className="h-20 w-20 bg-yellow-100 rounded-full flex items-center justify-center">
              <Trophy className="h-10 w-10 text-yellow-600" />
            </div>
          </div>
          <DialogTitle className="text-2xl font-bold text-center">
            Aprendizagem Concluída!
          </DialogTitle>
          <div className="space-y-4 mt-2">
            <p className="text-muted-foreground">
              Excelente trabalho! Concluiu todas as missões de treinamento. O P Trab Inteligente está agora totalmente liberado para as configurações iniciais.
            </p>
            <p className="text-sm text-primary font-medium bg-primary/5 p-3 rounded-md border border-primary/10">
              Caso queira acessar o Centro de Instrução novamente no futuro, basta clicar no botão de <strong>Ajuda e Documentação</strong> (ícone de interrogação no topo da tela).
            </p>
          </div>
          <Button 
            className="mt-6 w-full text-lg h-12 bg-green-600 hover:bg-green-700" 
            onClick={() => {
                setShowVictory(false);
                setShowInstructionHub(false);
                if (isGhostMode()) {
                    exitGhostMode(user?.id);
                }
            }}
          >
            Iniciar Configurações Iniciais
          </Button>
        </DialogContent>
      </Dialog>

      <AIChatDrawer />
    </div>
  );
};

export default PTrabManager;