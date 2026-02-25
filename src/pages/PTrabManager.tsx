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
import InstructionHub from "@/components/InstructionHub";
import GhostModeBanner from "@/components/GhostModeBanner";
import { runMission01 } from "@/tours/missionTours";
import { GHOST_DATA, isGhostMode, exitGhostMode } from "@/lib/ghostStore";
import { shouldShowVictory, markVictoryAsShown } from "@/lib/missionUtils";
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

const COMANDOS_MILITARES_AREA = [
  "Comando Militar da Amazônia", "Comando Militar do Norte", "Comando Militar do Nordeste",
  "Comando Militar do Planalto", "Comando Militar do Oeste", "Comando Militar do Leste",
  "Comando Militar do Sudeste", "Comando Militar do Sul",
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

  const [completedMissions, setCompletedMissions] = useState<number[]>([]);
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
          const { data: requestsData } = await supabase.from('ptrab_share_requests').select('*').in('ptrab_id', ownedPTrabIds).eq('status', 'pending');
          pendingRequests = requestsData || []; 
      }
      const ptrabsWithPendingRequests = new Set(pendingRequests.map(r => r.ptrab_id));
      return typedPTrabsData.map((ptrab) => {
        const totals = batchTotals[ptrab.id] || { totalLogistica: 0, totalOperacional: 0, totalMaterialPermanente: 0, quantidadeRacaoOp: 0, quantidadeHorasVoo: 0 };
        return { ...ptrab, ...totals, isOwner: ptrab.user_id === user.id, isShared: ptrab.user_id !== user.id && (ptrab.shared_with || []).includes(user.id), hasPendingRequests: ptrab.user_id === user.id && ptrabsWithPendingRequests.has(ptrab.id) } as PTrab;
      });
    },
    enabled: !!user?.id,
  });

  const missions = useMemo(() => [
    {
      id: 1,
      title: "Gerencie o seu P Trab",
      description: "Aprenda a controlar o ciclo de vida completo dos seus Planos de Trabalho na tela principal.",
      onStart: () => {
        if (user?.id) {
          localStorage.setItem('is_ghost_mode', 'true');
          localStorage.setItem('active_mission_id', '1');
          runMission01(user.id, () => {
            const completed = [...new Set([...completedMissions, 1])];
            setCompletedMissions(completed);
            localStorage.setItem(`completed_missions_${user.id}`, JSON.stringify(completed));
            setTimeout(() => window.dispatchEvent(new CustomEvent('instruction-hub:open')), 500);
          });
        }
      }
    },
    {
      id: 2,
      title: "Inteligência PNCP",
      description: "Aprenda a definir valores de referência utilizando a API do Portal Nacional de Contratações Públicas.",
      onStart: () => {
        localStorage.setItem('is_ghost_mode', 'true');
        localStorage.setItem('active_mission_id', '2');
        navigate("/config/custos-operacionais?startTour=true");
      }
    }
  ], [user?.id, completedMissions, navigate]);

  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`completed_missions_${user.id}`);
      if (saved) setCompletedMissions(JSON.parse(saved));
      
      if (shouldShowVictory(user.id)) {
        setShowVictory(true);
        markVictoryAsShown(user.id);
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      }
    }
    
    if (searchParams.get('showHub') === 'true') {
      setTimeout(() => window.dispatchEvent(new CustomEvent('instruction-hub:open')), 300);
    }
  }, [user?.id, searchParams]);

  const handleLogout = async () => {
    if (isGhostMode()) exitGhostMode();
    await supabase.auth.signOut();
    navigate("/");
  };

  const existingPTrabNumbers = useMemo(() => pTrabs.map(p => p.numero_ptrab), [pTrabs]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setSelectedOmId(undefined);
    setOriginalPTrabIdToClone(null);
    setFormData({
      numero_ptrab: generateUniqueMinutaNumber(existingPTrabNumbers), comando_militar_area: "", nome_om: "", nome_om_extenso: "",
      codug_om: "", rm_vinculacao: "", codug_rm_vinculacao: "", nome_operacao: "", periodo_inicio: "", periodo_fim: "",
      efetivo_empregado: "", acoes: "", nome_cmt_om: "", local_om: "", status: "aberto", origem: 'original', comentario: "", rotulo_versao: null,
    });
  }, [existingPTrabNumbers]);

  const [formData, setFormData] = useState({
    numero_ptrab: "Minuta", comando_militar_area: "", nome_om: "", nome_om_extenso: "", codug_om: "", codug_rm_vinculacao: "",
    rm_vinculacao: "", nome_operacao: "", periodo_inicio: "", periodo_fim: "", efetivo_empregado: "", acoes: "", nome_cmt_om: "",
    local_om: "", status: "aberto", origem: 'original' as any, comentario: "", rotulo_versao: null as string | null,
  });

  const [selectedOmId, setSelectedOmId] = useState<string | undefined>(undefined);
  const { handleEnterToNextField } = useFormNavigation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      const ptrabData = { ...formData, user_id: user.id };
      if (editingId) {
        await supabase.from("p_trab").update(ptrabData).eq("id", editingId);
        toast.success("P Trab atualizado!");
      } else {
        await supabase.from("p_trab").insert([ptrabData as any]);
        toast.success("Novo P Trab criado!");
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
    setFormData({ ...ptrab } as any);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string, isOwner: boolean) => {
    if (!isOwner) return toast.error("Apenas o dono pode excluir.");
    if (!confirm("Tem certeza?")) return;
    try {
      await supabase.from("p_trab").delete().eq("id", id);
      toast.success("Excluído!");
      loadPTrabs();
    } catch (error) { toast.error("Erro ao excluir"); }
  };

  if (isLoadingOnboarding) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PageMetadata title="Gerenciamento de Planos de Trabalho" description="Visualize, crie, edite e gerencie todos os seus Planos de Trabalho (P Trabs)." canonicalPath="/ptrab" />
      
      <GhostModeBanner />
      
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Planos de Trabalho</h1>
              <p className="text-muted-foreground">Gerencie seu P Trab</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 px-4 h-10 rounded-md bg-muted/50 border border-border">
                <User className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{userName || 'Perfil Incompleto'}</span>
              </div>
              
              <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="btn-novo-ptrab">
                <Plus className="mr-2 h-4 w-4" /> Novo P Trab
              </Button>
              
              <DropdownMenu open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="btn-configuracoes"><Settings className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Configurações</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/config/profile")}>Perfil do Usuário</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/config/diretrizes")}>Diretriz de Custeio Logístico</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/config/custos-operacionais")}>Custos Operacionais</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/config/om")}>Relação de OM (CODUG)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button onClick={handleLogout} variant="outline" className="btn-sair"><LogOut className="mr-2 h-4 w-4" /> Sair</Button>
              <HelpDialog />
            </div>
          </div>

          <InstructionHub missions={missions} completedMissions={completedMissions} />

          <Card className="tabela-ptrabs">
            <CardHeader className="flex flex-row items-center justify-between">
              <h2 className="text-xl font-bold">Planos de Trabalho Cadastrados</h2>
              <Button variant="outline" size="sm" onClick={() => loadPTrabs()} className="h-8">
                <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? <PTrabTableSkeleton /> : pTrabs.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold">Nenhum P Trab</h3>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">Número</TableHead>
                      <TableHead>Operação</TableHead>
                      <TableHead className="text-center">Período</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pTrabs.map((ptrab) => (
                      <TableRow key={ptrab.id}>
                        <TableCell className="text-center font-medium">{ptrab.numero_ptrab}</TableCell>
                        <TableCell>{ptrab.nome_operacao}</TableCell>
                        <TableCell className="text-center text-xs">
                          {new Date(ptrab.periodo_inicio).toLocaleDateString('pt-BR')} - {new Date(ptrab.periodo_fim).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={statusConfig[ptrab.status as keyof typeof statusConfig]?.variant || 'default'}>
                            {statusConfig[ptrab.status as keyof typeof statusConfig]?.label || ptrab.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency((ptrab.totalLogistica || 0) + (ptrab.totalOperacional || 0) + (ptrab.totalMaterialPermanente || 0))}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrab.id}`)} className="btn-preencher-ptrab">
                              <FileText className="h-4 w-4 mr-2" /> Preencher
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(ptrab)}><Pencil className="mr-2 h-4 w-4" /> Editar Cabeçalho</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(ptrab.id, ptrab.isOwner)} className="text-red-600"><Trash2 className="mr-2 h-4 w-4" /> Excluir</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar P Trab" : "Novo P Trab"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="numero_ptrab">Número do P Trab *</Label>
                <Input id="numero_ptrab" value={formData.numero_ptrab} onChange={(e) => setFormData({...formData, numero_ptrab: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nome_operacao">Nome da Operação *</Label>
                <Input id="nome_operacao" value={formData.nome_operacao} onChange={(e) => setFormData({...formData, nome_operacao: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nome_om">Nome da OM (sigla) *</Label>
                <OmSelector selectedOmId={selectedOmId} initialOmName={formData.nome_om} onChange={(om) => { if(om) { setSelectedOmId(om.id); setFormData({...formData, nome_om: om.nome_om, nome_om_extenso: om.nome_om, codug_om: om.codug_om, rm_vinculacao: om.rm_vinculacao, codug_rm_vinculacao: om.codug_rm_vinculacao, local_om: om.cidade || ""}); } }} />
              </div>
              <div className="space-y-2">
                <Label>Comando Militar de Área *</Label>
                <Select value={formData.comando_militar_area} onValueChange={(v) => setFormData({...formData, comando_militar_area: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{COMANDOS_MILITARES_AREA.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Início *</Label>
                <Input type="date" value={formData.periodo_inicio} onChange={(e) => setFormData({...formData, periodo_inicio: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Término *</Label>
                <Input type="date" value={formData.periodo_fim} onChange={(e) => setFormData({...formData, periodo_fim: e.target.value})} required />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Efetivo Empregado *</Label>
                <Input value={formData.efetivo_empregado} onChange={(e) => setFormData({...formData, efetivo_empregado: e.target.value})} placeholder="Ex: 150 militares" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ações *</Label>
              <Textarea value={formData.acoes} onChange={(e) => setFormData({...formData, acoes: e.target.value})} rows={3} required />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isActionLoading}>{isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingId ? "Atualizar" : "Criar")}</Button>
              <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <WelcomeModal open={showWelcomeModal} onOpenChange={setShowWelcomeModal} status={onboardingStatus || null} />
      <AIChatDrawer />
    </div>
  );
};

export default PTrabManager;