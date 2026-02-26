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
import { WelcomeModal } from "@/components/WelcomeModal";
import { RequirementsAlert } from "@/components/RequirementsAlert";
import { InstructionHub } from "@/components/InstructionHub";
import { runMission01 } from "@/tours/missionTours";
import { GHOST_DATA, isGhostMode, getActiveMission } from "@/lib/ghostStore";
import { shouldShowVictory, markVictoryAsShown, exitGhostMode } from "@/lib/missionUtils";
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

export interface SimplePTrab {
  id: string;
  numero_ptrab: string;
  nome_operacao: string;
}

const statusConfig = {
  'aberto': { variant: 'ptrab-aberto' as const, label: 'Aberto' },
  'em_andamento': { variant: 'ptrab-em-andamento' as const, label: 'Em Andamento' },
  'aprovado': { variant: 'ptrab-aprovado' as const, label: 'Aprovado' },
  'arquivado': { variant: 'ptrab-arquivado' as const, label: 'Arquivado' }
};

const COMANDOS_MILITARES_AREA = [
  "Comando Militar da Amazônia", "Comando Militar do Norte", "Comando Militar do Nordeste",
  "Comando Militar do Planalto", "Comando Militar do Oeste", "Comando Militar do Leste",
  "Comando Militar do Sudeste", "Comando Militar do Sul"
];

const PTrabManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useSession();
  const queryClient = useQueryClient();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  
  // Diálogos de Status e Ações
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
  const [suggestedCloneNumber, setSuggestedCloneNumber] = useState("");
  const [originalPTrabIdToClone, setOriginalPTrabIdToClone] = useState<string | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [ptrabToApprove, setPtrabToApprove] = useState<PTrab | null>(null);
  const [suggestedApproveNumber, setSuggestedApproveNumber] = useState("");
  const [showComentarioDialog, setShowComentarioDialog] = useState(false);
  const [ptrabComentario, setPtrabComentario] = useState<PTrab | null>(null);
  const [comentarioText, setComentarioText] = useState("");
  const [showConsolidationDialog, setShowConsolidationDialog] = useState(false);
  const [selectedPTrabsToConsolidate, setSelectedPTrabsToConsolidate] = useState<string[]>([]);
  const [showConsolidationNumberDialog, setShowConsolidationNumberDialog] = useState(false);
  const [suggestedConsolidationNumber, setSuggestedConsolidationNumber] = useState("");
  const [showCreditPrompt, setShowCreditPrompt] = useState(false);
  const [ptrabToFill, setPtrabToFill] = useState<PTrab | null>(null);
  const [showShareLinkDialog, setShowShareLinkDialog] = useState(false);
  const [ptrabToShare, setPtrabToShare] = useState<PTrab | null>(null);
  const [shareLink, setShareLink] = useState("");
  const [showLinkPTrabDialog, setShowLinkPTrabDialog] = useState(false);
  const [linkPTrabInput, setLinkPTrabInput] = useState("");
  const [showManageSharingDialog, setShowManageSharingDialog] = useState(false);
  const [ptrabToManageSharing, setPtrabToManageSharing] = useState<PTrab | null>(null);
  const [showUnlinkPTrabDialog, setShowUnlinkPTrabDialog] = useState(false);
  const [ptrabToUnlink, setPtrabToUnlink] = useState<PTrab | null>(null);
  const [showInstructionHub, setShowInstructionHub] = useState(false);
  const [showVictory, setShowVictory] = useState(false);

  const ghostActive = isGhostMode();

  // Query de status do usuário com polling de 1s para feedback em tempo real
  const { data: onboardingStatus, isLoading: isLoadingOnboarding } = useQuery({
    queryKey: ['user-status', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      if (ghostActive) return { isReady: true, hasOm: true, hasOp: true, hasLog: true, hasMissions: true };

      const [oms, op, log, missions] = await Promise.all([
        supabase.from('organizacoes_militares').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('diretrizes_operacionais').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('diretrizes_custeio').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('user_missions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);

      const hasOm = (oms.count ?? 0) > 0;
      const hasOp = (op.count ?? 0) > 0;
      const hasLog = (log.count ?? 0) > 0;
      const hasMissions = (missions.count ?? 0) === 6;

      return {
        hasOm, hasOp, hasLog, hasMissions,
        isReady: hasOm && hasOp && hasLog && hasMissions
      };
    },
    enabled: !!user?.id,
    refetchInterval: (query) => (query.state.data?.isReady ? false : 1000),
    staleTime: 0,
    gcTime: 0,
  });

  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showRequirementsAlert, setShowRequirementsAlert] = useState(false);
  const hasShownWelcome = useRef(false);

  const dispararConfetes = () => {
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#4CAF50', '#FFEB3B', '#2196F3', '#FF9800', '#E91E63'], zIndex: 999999 });
    setTimeout(() => confetti({ particleCount: 100, spread: 120, origin: { y: 0.6 }, zIndex: 999999 }), 300);
  };

  useEffect(() => {
    if (!user?.id) return;
    if (shouldShowVictory(user.id)) {
      setShowVictory(true);
      markVictoryAsShown(user.id);
      dispararConfetes();
    }
    const handleVictory = (e: any) => {
      if (e.detail?.userId === user.id) {
        setShowVictory(true);
        markVictoryAsShown(user.id);
        dispararConfetes();
      }
    };
    const handleOpenHub = () => { setShowInstructionHub(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    window.addEventListener('tour:todas-concluidas', handleVictory);
    window.addEventListener('instruction-hub:open', handleOpenHub);
    return () => {
        window.removeEventListener('tour:todas-concluidas', handleVictory);
        window.removeEventListener('instruction-hub:open', handleOpenHub);
    };
  }, [user?.id]);

  useEffect(() => {
    if (ghostActive) { setShowWelcomeModal(false); setShowRequirementsAlert(false); return; }
    if (!isLoadingOnboarding && onboardingStatus && !onboardingStatus.isReady && !hasShownWelcome.current) {
      setShowWelcomeModal(true);
      hasShownWelcome.current = true;
    }
  }, [isLoadingOnboarding, onboardingStatus, ghostActive]);

  const { data: pTrabs = [], isLoading: loading, refetch: loadPTrabs } = useQuery({
    queryKey: ['pTrabs', user?.id, ghostActive],
    queryFn: async () => {
      if (!user?.id) return [];
      if (ghostActive) {
        return [{
          ...GHOST_DATA.p_trab_exemplo,
          isOwner: true, isShared: false, hasPendingRequests: false,
          totalLogistica: GHOST_DATA.totais_exemplo.totalLogistica,
          totalOperacional: GHOST_DATA.totais_exemplo.totalOperacional,
          totalMaterialPermanente: GHOST_DATA.totais_exemplo.totalMaterialPermanente,
          quantidadeRacaoOp: GHOST_DATA.totais_exemplo.quantidadeRacaoOp,
          quantidadeHorasVoo: GHOST_DATA.totais_exemplo.quantidadeHorasVoo,
        }] as PTrab[];
      }

      const { data: pTrabsData, error: pTrabsError } = await supabase
        .from("p_trab").select("*, comentario, origem, rotulo_versao, user_id, shared_with, share_token")
        .or(`user_id.eq.${user.id},shared_with.cs.{${user.id}}`).order("created_at", { ascending: false });

      if (pTrabsError) throw pTrabsError;
      const ptrabIds = (pTrabsData as unknown as PTrabDB[]).map(p => p.id);
      const batchTotals = await fetchBatchPTrabTotals(ptrabIds);
      const ownedPTrabIds = (pTrabsData as unknown as PTrabDB[]).filter(p => p.user_id === user.id).map(p => p.id);
      let pendingRequests: Tables<'ptrab_share_requests'>[] = [];
      if (ownedPTrabIds.length > 0) {
          const { data: reqData } = await supabase.from('ptrab_share_requests').select('*').in('ptrab_id', ownedPTrabIds).eq('status', 'pending');
          pendingRequests = reqData || [];
      }
      const ptrabsWithPendingRequests = new Set(pendingRequests.map(r => r.ptrab_id));

      return (pTrabsData as unknown as PTrabDB[]).map((ptrab) => {
        const totals = batchTotals[ptrab.id] || { totalLogistica: 0, totalOperacional: 0, totalMaterialPermanente: 0, quantidadeRacaoOp: 0, quantidadeHorasVoo: 0 };
        return {
          ...ptrab, ...totals,
          isOwner: ptrab.user_id === user.id,
          isShared: ptrab.user_id !== user.id && (ptrab.shared_with || []).includes(user.id),
          hasPendingRequests: ptrab.user_id === user.id && ptrabsWithPendingRequests.has(ptrab.id),
        } as PTrab;
      });
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  // Funções Auxiliares
  const fetchUserName = useCallback(async (userId: string, userMetadata: any) => {
    const { data: profileData } = await supabase.from('profiles').select('last_name, raw_user_meta_data').eq('id', userId).single();
    const nomeGuerra = profileData?.last_name || '';
    const profileMetadata = profileData?.raw_user_meta_data as any;
    const postoGraduacao = profileMetadata?.posto_graduacao?.trim() || userMetadata?.posto_graduacao?.trim() || '';
    const nomeOM = profileMetadata?.nome_om?.trim() || '';
    let nameParts = [];
    if (postoGraduacao) nameParts.push(postoGraduacao);
    if (nomeGuerra) nameParts.push(nomeGuerra);
    let finalName = nameParts.join(' ');
    if (nomeOM) finalName += ` (${nomeOM})`;
    return finalName.trim() || 'Perfil Incompleto';
  }, []);

  useEffect(() => {
    if (user?.id) fetchUserName(user.id, user.user_metadata).then(name => setUserName(name));
  }, [user, fetchUserName]);

  const handleLogout = async () => {
    try {
      toast.info("Encerrando sessão...");
      await supabase.auth.signOut();
      localStorage.clear();
      window.location.href = "/";
    } catch (error) { window.location.href = "/"; }
  };

  const handleOpenNewPTrabDialog = () => {
    if (onboardingStatus?.isReady || ghostActive) {
      setDialogOpen(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setShowRequirementsAlert(true);
    }
  };

  // Renderização principal simplificada para brevidade
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <PageMetadata title="Gerenciamento de Planos de Trabalho" description="Visualize, crie, edite e gerencie todos os seus Planos de Trabalho (P Trabs)." canonicalPath="/ptrab" />
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
              <span className="text-sm font-medium text-foreground">{userName || 'Carregando...'}</span>
            </div>
            <Button onClick={handleOpenNewPTrabDialog} className="btn-novo-ptrab"><Plus className="mr-2 h-4 w-4" />Novo P Trab</Button>
            <div className="btn-ajuda"><HelpDialog /></div>
            <DropdownMenu open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="btn-configuracoes"><Settings className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 menu-configuracoes">
                <DropdownMenuLabel>Configurações</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/config/profile")}>Perfil do Usuário</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/config/diretrizes")}>Diretriz de Custeio Logístico</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/config/custos-operacionais")}>Custos Operacionais</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/config/om")}>Relação de OM (CODUG)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={handleLogout} variant="outline" className="btn-sair"><LogOut className="mr-2 h-4 w-4" />Sair</Button>
          </div>
        </div>

        {showInstructionHub && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2"><GraduationCap className="h-6 w-6 text-primary" /><CardTitle>Centro de Instrução</CardTitle></div>
              <Button variant="ghost" size="sm" onClick={() => setShowInstructionHub(false)}>Ocultar</Button>
            </CardHeader>
            <CardContent><InstructionHub /></CardContent>
          </Card>
        )}

        <Card className="tabela-ptrabs">
          <CardHeader><h2 className="text-xl font-bold">Planos de Trabalho Cadastrados</h2></CardHeader>
          <CardContent>
            {loading ? <PTrabTableSkeleton /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Número</TableHead>
                    <TableHead>Operação</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Valor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pTrabs.map((ptrab) => (
                    <TableRow key={ptrab.id}>
                      <TableCell className="text-center font-medium">{ptrab.numero_ptrab}</TableCell>
                      <TableCell>{ptrab.nome_operacao}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={statusConfig[ptrab.status as keyof typeof statusConfig]?.variant || 'default'}>
                          {statusConfig[ptrab.status as keyof typeof statusConfig]?.label || ptrab.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        {formatCurrency((ptrab.totalLogistica || 0) + (ptrab.totalOperacional || 0) + (ptrab.totalMaterialPermanente || 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button onClick={() => navigate(`/ptrab/form?ptrabId=${ptrab.id}`)} size="sm" variant="outline">Ver Detalhes</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <WelcomeModal open={showWelcomeModal} onOpenChange={setShowWelcomeModal} status={onboardingStatus || null} />
      <RequirementsAlert open={showRequirementsAlert} onOpenChange={setShowRequirementsAlert} status={onboardingStatus || null} />
      
      <Dialog open={showVictory} onOpenChange={setShowVictory}>
        <DialogContent className="text-center sm:max-w-[450px]">
          <Trophy className="h-10 w-10 text-yellow-600 mx-auto mb-4" />
          <DialogTitle className="text-2xl font-bold">Aprendizagem Concluída!</DialogTitle>
          <p className="text-muted-foreground mt-2">Excelente trabalho! Concluiu todas as missões de treinamento.</p>
          <Button className="mt-6 w-full bg-green-600" onClick={() => { setShowVictory(false); if (ghostActive) exitGhostMode(user?.id); }}>Iniciar Configurações</Button>
        </DialogContent>
      </Dialog>
      <AIChatDrawer />
    </div>
  );
};

export default PTrabManager;