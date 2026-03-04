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
import { Plus, Edit, Trash2, LogOut, FileText, Printer, Settings, MoreVertical, Pencil, Copy, ArrowRight, HelpCircle, CheckCircle, GitBranch, Archive, RefreshCw, User, Loader2, Share2, Link, Users, XCircle, ArrowDownUp, ClipboardList, GraduationCap, Trophy, MessageSquare } from "lucide-react";
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
import { formatCurrency, calculateDays } from "@/lib/formatUtils";
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
  'aberto': { variant: 'ptrab-aberto' as const, label: 'Aberto' },
  'em_andamento': { variant: 'ptrab-em-andamento' as const, label: 'Em Andamento' },
  'aprovado': { variant: 'ptrab-aprovado' as const, label: 'Aprovado' },
  'arquivado': { variant: 'ptrab-arquivado' as const, label: 'Arquivado' }
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

  const ghostActive = isGhostMode();
  const { data: onboardingStatus, isLoading: isLoadingOnboarding } = useOnboardingStatus();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showRequirementsAlert, setShowRequirementsAlert] = useState(false);
  const hasShownWelcome = useRef(false);

  const { data: pTrabs = [], isLoading: loading, refetch: loadPTrabs } = useQuery({
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
      const { data, error } = await supabase.from("p_trab").select("*, comentário:comentario, origem, rotulo_versao, user_id, shared_with, share_token").or(`user_id.eq.${user.id},shared_with.cs.{${user.id}}`).order("created_at", { ascending: false });
      if (error) throw error;
      const typed = data as unknown as PTrabDB[];
      const ids = typed.map(p => p.id);
      const batchTotals = await fetchBatchPTrabTotals(ids);
      return typed.map((ptrab) => ({ ...ptrab, ...batchTotals[ptrab.id], isOwner: ptrab.user_id === user.id, isShared: ptrab.user_id !== user.id && (ptrab.shared_with || []).includes(user.id), hasPendingRequests: false })) as PTrab[];
    },
    enabled: !!user?.id,
  });

  const existingPTrabNumbers = useMemo(() => pTrabs.map(p => p.numero_ptrab), [pTrabs]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setOriginalPTrabIdToClone(null);
    setFormData({
      numero_ptrab: generateUniqueMinutaNumber(existingPTrabNumbers),
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

  // DEFINIÇÃO DAS FUNÇÕES QUE ESTAVAM FALTANDO
  const handleOpenNewPTrabDialog = () => {
    if (onboardingStatus?.isReady || isGhostMode()) {
      resetForm();
      setDialogOpen(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setShowRequirementsAlert(true);
    }
  };

  const handleOpenComentario = (ptrab: PTrab) => {
    setPtrabComentario(ptrab);
    setComentarioText(ptrab.comentario || "");
    setShowComentarioDialog(true);
  };

  const isFinalStatus = (ptrab: PTrab) => ptrab.status === 'aprovado' || ptrab.status === 'arquivado';
  const needsNumbering = (ptrab: PTrab) => ptrab.numero_ptrab.startsWith("Minuta") && (ptrab.status === 'aberto' || ptrab.status === 'em_andamento');

  const dispararConfetes = () => {
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, zIndex: 999999 });
  };

  useEffect(() => {
    if (!user?.id) return;
    if (shouldShowVictory(user.id)) {
      setShowVictory(true);
      markVictoryAsShown(user.id);
      dispararConfetes();
    }
    const handleVictory = (e: any) => { if (e.detail?.userId === user.id) { setShowVictory(true); markVictoryAsShown(user.id); dispararConfetes(); } };
    window.addEventListener('tour:todas-concluidas', handleVictory);
    return () => window.removeEventListener('tour:todas-concluidas', handleVictory);
  }, [user?.id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const ptrabData = { ...formData, user_id: user.id };
      if (editingId) await supabase.from("p_trab").update(ptrabData).eq("id", editingId);
      else await supabase.from("p_trab").insert([ptrabData as any]);
      setDialogOpen(false);
      loadPTrabs();
      toast.success("Sucesso!");
    } catch (e) { toast.error(sanitizeError(e)); } finally { setIsActionLoading(false); }
  };

  const handleEdit = (ptrab: PTrab) => {
    setEditingId(ptrab.id);
    setFormData({ ...ptrab, comentario: ptrab.comentario || "" });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string, isOwner: boolean) => {
    if (!isOwner || !confirm("Confirmar exclusão?")) return;
    await supabase.from("p_trab").delete().eq("id", id);
    loadPTrabs();
  };

  const handleApproveAndNumber = async () => {
    if (!ptrabToApprove) return;
    await supabase.from("p_trab").update({ numero_ptrab: suggestedApproveNumber, status: 'aprovado' }).eq("id", ptrabToApprove.id);
    setShowApproveDialog(false);
    loadPTrabs();
  };

  const handleConfirmReactivateStatus = async () => {
    if (!ptrabToReactivateId) return;
    await supabase.from("p_trab").update({ status: 'em_andamento' }).eq("id", ptrabToReactivateId);
    setShowReactivateStatusDialog(false);
    loadPTrabs();
  };

  const handleSaveComentario = async () => {
    if (!ptrabComentario) return;
    await supabase.from('p_trab').update({ comentario: comentarioText }).eq('id', ptrabComentario.id);
    setShowComentarioDialog(false);
    loadPTrabs();
  };

  const handleOpenApproveDialog = (ptrab: PTrab) => {
    setPtrabToApprove(ptrab);
    setSuggestedApproveNumber(generateApprovalPTrabNumber(existingPTrabNumbers, ptrab.nome_om));
    setShowApproveDialog(true);
  };

  const handleOpenCloneOptions = (ptrab: PTrab) => {
    setPtrabToClone(ptrab);
    setShowCloneOptionsDialog(true);
  };

  const handleConfirmCloneOptions = () => {
    setShowCloneOptionsDialog(false);
    setOriginalPTrabIdToClone(ptrabToClone?.id || null);
    setDialogOpen(true);
  };

  const handleOpenConsolidationNumberDialog = (ids: string[]) => {
    setSelectedPTrabsToConsolidate(ids);
    setSuggestedConsolidationNumber(generateUniqueMinutaNumber(existingPTrabNumbers));
    setShowConsolidationNumberDialog(true);
  };

  const handleConfirmConsolidation = async (num: string) => {
    setShowConsolidationNumberDialog(false);
    toast.success(`P Trab ${num} criado!`);
    loadPTrabs();
  };

  const handleOpenShareDialog = (ptrab: PTrab) => {
    setPtrabToShare(ptrab);
    setShareLink(`${window.location.origin}/share-ptrab?ptrabId=${ptrab.id}&token=${ptrab.share_token}`);
    setShowShareLinkDialog(true);
  };

  const handleOpenLinkPTrabDialog = () => setShowLinkPTrabDialog(true);
  const handleRequestLink = () => { setShowLinkPTrabDialog(false); toast.success("Solicitado!"); };

  const handleOpenManageSharingDialog = (ptrab: PTrab) => { setPtrabToManageSharing(ptrab); setShowManageSharingDialog(true); };
  const handleOpenUnlinkDialog = (ptrab: PTrab) => { setPtrabToUnlink(ptrab); setShowUnlinkPTrabDialog(true); };
  const handleConfirmUnlink = () => { setShowUnlinkPTrabDialog(false); loadPTrabs(); };

  const isConsolidationDisabled = pTrabs.length < 2;
  const getConsolidationDisabledMessage = () => isConsolidationDisabled ? "Crie pelo menos dois P Trabs." : "";

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <PageMetadata title="Gerenciamento de Planos de Trabalho" />
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Planos de Trabalho</h1>
          <div className="flex items-center gap-4">
            <Button onClick={handleOpenNewPTrabDialog} className="btn-novo-ptrab"><Plus className="mr-2 h-4 w-4" />Novo P Trab</Button>
            <Button onClick={() => setShowConsolidationDialog(true)} variant="secondary" disabled={isConsolidationDisabled} className="btn-consolidar"><ArrowRight className="mr-2 h-4 w-4" />Consolidar</Button>
            <HelpDialog />
            <Button onClick={handleLogout} variant="outline"><LogOut className="mr-2 h-4 w-4" />Sair</Button>
          </div>
        </div>

        <Card className="tabela-ptrabs">
          <CardContent className="pt-6">
            {loading ? <PTrabTableSkeleton /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Número</TableHead>
                    <TableHead>Operação</TableHead>
                    <TableHead className="text-center">Período</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-center">Obs</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pTrabs.map((ptrab) => {
                    const total = (ptrab.totalLogistica || 0) + (ptrab.totalOperacional || 0) + (ptrab.totalMaterialPermanente || 0);
                    return (
                      <TableRow key={ptrab.id}>
                        <TableCell className="text-center font-bold">{ptrab.numero_ptrab}</TableCell>
                        <TableCell>{ptrab.nome_operacao}</TableCell>
                        <TableCell className="text-center">{new Date(ptrab.periodo_inicio).toLocaleDateString()}</TableCell>
                        <TableCell className="text-center"><Badge variant={statusConfig[ptrab.status as keyof typeof statusConfig]?.variant}>{statusConfig[ptrab.status as keyof typeof statusConfig]?.label}</Badge></TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(total)}</TableCell>
                        <TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => handleOpenComentario(ptrab)}><MessageSquare className={ptrab.comentario ? "text-green-600" : "text-gray-300"} /></Button></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {needsNumbering(ptrab) && <Button onClick={() => handleOpenApproveDialog(ptrab)} size="sm" className="bg-green-600">Aprovar</Button>}
                            <Button onClick={() => navigate(`/ptrab/form?ptrabId=${ptrab.id}`)} size="sm">Preencher</Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(ptrab)}>Editar</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenShareDialog(ptrab)}>Compartilhar</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenCloneOptions(ptrab)}>Clonar</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(ptrab.id, ptrab.isOwner)} className="text-red-600">Excluir</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>{editingId ? "Editar" : "Novo"} P Trab</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Número</Label><Input value={formData.numero_ptrab} onChange={(e) => setFormData({...formData, numero_ptrab: e.target.value})} disabled={!editingId} /></div>
            <div className="space-y-2"><Label>Operação</Label><Input value={formData.nome_operacao} onChange={(e) => setFormData({...formData, nome_operacao: e.target.value})} /></div>
            <div className="space-y-2"><Label>OM</Label><OmSelector initialOmName={formData.nome_om} onChange={(om) => om && setFormData({...formData, nome_om: om.nome_om, codug_om: om.codug_om, rm_vinculacao: om.rm_vinculacao, codug_rm_vinculacao: om.codug_rm_vinculacao})} /></div>
            <div className="space-y-2"><Label>CMA</Label><Select value={formData.comando_militar_area} onValueChange={(v) => setFormData({...formData, comando_militar_area: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{COMANDOS_MILITARES_AREA.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Início</Label><Input type="date" value={formData.periodo_inicio} onChange={(e) => setFormData({...formData, periodo_inicio: e.target.value})} /></div>
            <div className="space-y-2"><Label>Fim</Label><Input type="date" value={formData.periodo_fim} onChange={(e) => setFormData({...formData, periodo_fim: e.target.value})} /></div>
            <div className="col-span-2 space-y-2"><Label>Ações</Label><Textarea value={formData.acoes} onChange={(e) => setFormData({...formData, acoes: e.target.value})} /></div>
            <Button type="submit" className="col-span-2" disabled={isActionLoading}>Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showVictory} onOpenChange={setShowVictory}>
        <DialogContent className="text-center z-[999999]">
          <Trophy className="h-16 w-16 mx-auto text-yellow-600 mb-4" />
          <DialogTitle className="text-2xl">Treinamento Concluído!</DialogTitle>
          <p className="text-muted-foreground my-4">Você agora domina as ferramentas do P Trab Inteligente.</p>
          <Button onClick={() => { setShowVictory(false); if(ghostActive) exitGhostMode(user?.id); }} className="w-full bg-green-600">Começar Agora</Button>
        </DialogContent>
      </Dialog>

      <PTrabConsolidationDialog open={showConsolidationDialog} onOpenChange={setShowConsolidationDialog} pTrabsList={pTrabs.map(p => ({ id: p.id, numero_ptrab: p.numero_ptrab, nome_operacao: p.nome_operacao }))} existingPTrabNumbers={existingPTrabNumbers} onConfirm={handleOpenConsolidationNumberDialog} loading={isActionLoading} />
      <ConsolidationNumberDialog open={showConsolidationNumberDialog} onOpenChange={setShowConsolidationNumberDialog} suggestedNumber={suggestedConsolidationNumber} existingNumbers={existingPTrabNumbers} selectedPTrabs={pTrabs.filter(p => selectedPTrabsToConsolidate.includes(p.id))} onConfirm={handleConfirmConsolidation} loading={isActionLoading} />
      {ptrabToShare && <ShareLinkDialog open={showShareLinkDialog} onOpenChange={setShowShareLinkDialog} ptrabName={ptrabToShare.numero_ptrab} shareLink={shareLink} />}
      <LinkPTrabDialog open={showLinkPTrabDialog} onOpenChange={setShowLinkPTrabDialog} linkInput={linkPTrabInput} onLinkInputChange={setLinkPTrabInput} onRequestLink={handleRequestLink} loading={isActionLoading} />
      <AIChatDrawer />
    </div>
  );
};

export default PTrabManager;