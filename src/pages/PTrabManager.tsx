import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
import { Plus, LogOut, FileText, Printer, Settings, MessageSquare, ArrowRight, HelpCircle, CheckCircle, GitBranch, Archive, RefreshCw, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { formatCurrency } from "@/lib/formatUtils";
import PTrabConsolidationDialog from "@/components/PTrabConsolidationDialog";
import { Badge } from "@/components/ui/badge";
import { HelpDialog } from "@/components/HelpDialog";
import { CloneVariationDialog } from "@/components/CloneVariationDialog";
import { CreditPromptDialog } from "@/components/CreditPromptDialog";
import { usePTrabManager, PTrab } from "@/hooks/usePTrabManager"; // Importar o hook
import { PTrabFormDialog } from "@/components/PTrabFormDialog"; // Importar o novo diálogo de formulário
import { PTrabActionsMenu } from "@/components/PTrabActionsMenu"; // Importar o novo menu de ações
import { PTrabApproveDialog } from "@/components/PTrabApproveDialog"; // Importar o novo diálogo de aprovação
import { RadioGroup } from "@/components/ui/radio-group"; // Importar RadioGroup

const PTrabManager = () => {
  const navigate = useNavigate();
  const { handleEnterToNextField } = useFormNavigation();
  
  // Usar o hook para gerenciar todo o estado e lógica
  const {
    pTrabs, loading, existingPTrabNumbers, formData, setFormData, editingId, setEditingId,
    resetForm, loadPTrabs, handleDelete, handleArchive, handleReactivate, handleConfirmReactivate,
    ptrabToReactivateId, ptrabToReactivateName, handleOpenApproveDialog, ptrabToApprove,
    suggestedApproveNumber, setSuggestedApproveNumber, handleApproveAndNumber, handleOpenComentario,
    ptrabComentario, comentarioText, setComentarioText, handleSaveComentario, ptrabToArchiveId,
    ptrabToArchiveName, handleOpenCloneOptions, ptrabToClone, originalPTrabIdToClone,
    setOriginalPTrabIdToClone, handleConfirmCloneVariation, cloneRelatedRecords, needsNumbering,
    isFinalStatus, isEditable, getMinutaNumber,
  } = usePTrabManager();

  // Estados locais para controle de diálogos
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);
  const [showArchiveStatusDialog, setShowArchiveStatusDialog] = useState(false);
  const [showReactivateStatusDialog, setShowReactivateStatusDialog] = useState(false);
  const [showComentarioDialog, setShowComentarioDialog] = useState(false);
  const [showConsolidationDialog, setShowConsolidationDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showCloneOptionsDialog, setShowCloneOptionsDialog] = useState(false);
  const [showCloneVariationDialog, setShowCloneVariationDialog] = useState(false);
  const [cloneType, setCloneType] = useState<'new' | 'variation'>('new');
  const [suggestedCloneNumber, setSuggestedCloneNumber] = useState<string>("");
  const [ptrabToFill, setPtrabToFill] = useState<PTrab | null>(null);
  const [showCreditPrompt, setShowCreditPrompt] = useState(false);
  const hasBeenPrompted = React.useRef(new Set<string>());
  
  // Estado local para a OM selecionada no formulário (necessário para o OmSelector)
  const [selectedOmId, setSelectedOmId] = useState<string | undefined>(undefined);

  // Efeito para sincronizar o estado do hook com os diálogos locais
  useEffect(() => {
    if (ptrabToArchiveId) setShowArchiveStatusDialog(true);
    if (ptrabToReactivateId) setShowReactivateStatusDialog(true);
    if (ptrabToApprove) setShowApproveDialog(true);
    if (ptrabComentario) setShowComentarioDialog(true);
    if (ptrabToClone) setShowCloneOptionsDialog(true);
  }, [ptrabToArchiveId, ptrabToReactivateId, ptrabToApprove, ptrabComentario, ptrabToClone]);

  // Efeito para carregar a OM selecionada no formulário de edição
  useEffect(() => {
    if (editingId && formData.codug_om) {
      // Busca o ID da OM para preencher o OmSelector
      supabase.from('organizacoes_militares')
        .select('id')
        .eq('codug_om', formData.codug_om)
        .maybeSingle()
        .then(({ data }) => {
          setSelectedOmId(data?.id);
        })
        .catch(err => console.error("Erro ao buscar ID da OM:", err));
    } else if (!editingId) {
      setSelectedOmId(undefined);
    }
  }, [editingId, formData.codug_om]);

  // Lógica de submissão do formulário (mantida aqui para orquestração)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const currentNumber = formData.numero_ptrab.trim();
      
      // --- VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS (Simplificada para o Manager) ---
      const requiredFields: (keyof typeof formData)[] = [
        'numero_ptrab', 'nome_operacao', 'comando_militar_area', 
        'nome_om_extenso', 'nome_om', 'efetivo_empregado', 
        'periodo_inicio', 'periodo_fim', 'acoes',
        'local_om', 'nome_cmt_om',
      ];
      
      for (const field of requiredFields) {
        if (!formData[field] || String(formData[field]).trim() === "") {
          toast.error(`O campo '${field.replace(/_/g, ' ')}' é obrigatório.`);
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

      if (currentNumber && !currentNumber.startsWith("Minuta")) {
        const isDuplicate = existingPTrabNumbers.some(num => 
          num === currentNumber && num !== pTrabs.find(p => p.id === editingId)?.numero_ptrab
        );

        if (isDuplicate) {
          toast.error("Já existe um P Trab com este número. Por favor, proponha outro.");
          setLoading(false);
          return;
        }
      }
      
      const finalNumeroPTrab = currentNumber || getMinutaNumber();

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
            toast.success("P Trab criado e registros clonados!");
        }
        
        try {
            await updateUserCredits(user.id, 0, 0);
        } catch (creditError) {
            console.error("Erro ao zerar créditos após criação do P Trab:", creditError);
            toast.warning("Aviso: Ocorreu um erro ao zerar os créditos disponíveis. Por favor, verifique manualmente.");
        }
      }

      setDialogOpen(false);
      resetForm();
      loadPTrabs();
    } catch (error: any) {
      toast.error(error.message || "Erro desconhecido ao salvar P Trab.");
    } finally {
      setLoading(false);
    }
  };

  // Lógica de Clonagem (Orquestração dos Diálogos)
  const handleConfirmCloneOptions = () => {
    if (!ptrabToClone) return;

    if (cloneType === 'new') {
      // Fluxo 1: Novo P Trab (Abre o diálogo de edição do cabeçalho)
      setDialogOpen(true);
      setEditingId(null);
      
      const { 
        id, created_at, updated_at, totalLogistica, totalOperacional, 
        rotulo_versao, nome_om, nome_om_extenso, codug_om, rm_vinculacao, codug_rm_vinculacao,
        ...restOfPTrab 
      } = ptrabToClone;
      
      setFormData({
        ...restOfPTrab,
        numero_ptrab: suggestedCloneNumber,
        status: "aberto",
        origem: ptrabToClone.origem,
        comentario: "",
        rotulo_versao: ptrabToClone.rotulo_versao,
        
        // Limpa campos da OM para forçar a re-seleção/confirmação
        nome_om: "",
        nome_om_extenso: "",
        codug_om: "",
        rm_vinculacao: "",
        codug_rm_vinculacao: "",
      });
      
      setSelectedOmId(undefined); 
      setOriginalPTrabIdToClone(ptrabToClone.id);
      setShowCloneOptionsDialog(false);
      
    } else {
      // Fluxo 2: Variação do Trabalho (abre o diálogo de nome da versão para CAPTURAR O RÓTULO)
      const ptrab = pTrabs.find(p => p.id === ptrabToClone.id);
      if (!ptrab) return;
      
      // Gera o número de minuta único para a variação
      const newSuggestedNumber = generateUniqueMinutaNumber(existingPTrabNumbers);
      setSuggestedCloneNumber(newSuggestedNumber);
      
      setShowCloneOptionsDialog(false);
      setShowCloneVariationDialog(true);
    }
  };
  
  const handleFinalCloneVariation = async (versionName: string) => {
    await handleConfirmCloneVariation(versionName, suggestedCloneNumber);
    setShowCloneVariationDialog(false);
  };

  // Lógica de Prompt de Crédito
  const handleSelectPTrab = async (ptrab: PTrab) => {
    if (ptrab.status === 'aprovado' || ptrab.status === 'arquivado') {
      navigate(`/ptrab/form?ptrabId=${ptrab.id}`);
      return;
    }
    
    if (ptrab.status === 'aberto' && !hasBeenPrompted.current.has(ptrab.id)) {
      setPtrabToFill(ptrab);
      setShowCreditPrompt(true);
    } else {
      navigate(`/ptrab/form?ptrabId=${ptrab.id}`);
    }
  };
  
  const handlePromptConfirm = () => {
    if (!ptrabToFill) return;
    hasBeenPrompted.current.add(ptrabToFill.id);
    setShowCreditPrompt(false);
    navigate(`/ptrab/form?ptrabId=${ptrabToFill.id}&openCredit=true`);
  };
  
  const handlePromptCancel = async () => {
    if (!ptrabToFill) return;
    hasBeenPrompted.current.add(ptrabToFill.id);
    setShowCreditPrompt(false);
    
    try {
        await supabase
            .from("p_trab")
            .update({ status: 'em_andamento' })
            .eq("id", ptrabToFill.id);
        loadPTrabs();
    } catch (error) {
        console.error("Erro ao atualizar status para 'em_andamento':", error);
    }
    
    navigate(`/ptrab/form?ptrabId=${ptrabToFill.id}`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateDays = (inicio: string, fim: string) => {
    const start = new Date(inicio);
    const end = new Date(fim);
    const diff = end.getTime() - start.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24)) + 1;
  };

  const getOriginBadge = (origem: PTrab['origem']) => {
    switch (origem) {
      case 'importado':
        return { label: 'IMPORTADO', className: 'bg-purple-100 text-purple-800 border-purple-300' };
      case 'consolidado':
        return { label: 'CONSOLIDADO', className: 'bg-orange-100 text-orange-800 border-orange-300' };
      case 'original':
      default:
        return { label: 'ORIGINAL', className: 'bg-blue-100 text-blue-800 border-blue-300' };
    }
  };
  
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
    'aprovado': { 
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
  
  const isConsolidationDisabled = pTrabs.length < 2;
  const consolidationTooltipText = "Consolidar dados de múltiplos P Trabs em um único destino.";
  const getConsolidationDisabledMessage = () => "É necessário ter pelo menos 2 Planos de Trabalho cadastrados para realizar a consolidação.";

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
            
            {/* BOTÃO NOVO P TRAB */}
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setDialogOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                <Plus className="mr-2 h-4 w-4" />
                Novo P Trab
              </Button>
            </DialogTrigger>
            
            {/* BOTÃO DE CONSOLIDAÇÃO ENVOLVIDO POR TOOLTIP */}
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
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      Carregando P Trabs...
                    </TableCell>
                  </TableRow>
                ) : pTrabs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Nenhum Plano de Trabalho encontrado. Crie um novo para começar.
                    </TableCell>
                  </TableRow>
                ) : (
                  pTrabs.map((ptrab) => {
                    const originBadge = getOriginBadge(ptrab.origem);
                    const isMinuta = ptrab.numero_ptrab.startsWith("Minuta");
                    const isEditable = ptrab.status !== 'aprovado' && ptrab.status !== 'arquivado';
                    const isApprovedOrArchived = isFinalStatus(ptrab);
                    
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
                            variant="outline" 
                            className={`mt-1 text-xs font-semibold ${originBadge.className}`}
                          >
                            {originBadge.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start">
                          <span>{ptrab.nome_operacao}</span>
                          {ptrab.rotulo_versao && (
                            <Badge variant="secondary" className="mt-1 text-xs bg-secondary text-secondary-foreground">
                              <GitBranch className="h-3 w-3 mr-1" />
                              {ptrab.rotulo_versao}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div>
                          {new Date(ptrab.periodo_inicio).toLocaleDateString('pt-BR')} - {new Date(ptrab.periodo_fim).toLocaleDateString('pt-BR')}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {calculateDays(ptrab.periodo_inicio, ptrab.periodo_fim)} dias
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-center">
                          <Badge 
                            className={cn(
                              "w-[140px] h-7 text-xs flex items-center justify-center",
                              statusConfig[ptrab.status as keyof typeof statusConfig]?.className || 'bg-background'
                            )}
                          >
                            {statusConfig[ptrab.status as keyof typeof statusConfig]?.label || ptrab.status}
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-1">
                            Última alteração: {formatDateTime(ptrab.updated_at)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center text-xs">
                          {ptrab.totalLogistica !== undefined && (
                            <span className="text-orange-600 font-medium">
                              {formatCurrency(ptrab.totalLogistica)}
                            </span>
                          )}
                          {ptrab.totalOperacional !== undefined && (
                            <span className="text-blue-600 font-medium">
                              {formatCurrency(ptrab.totalOperacional)}
                            </span>
                          )}
                          {((ptrab.totalLogistica || 0) > 0 || (ptrab.totalOperacional || 0) > 0) && (
                            <>
                              <div className="w-full h-px bg-muted-foreground/30 my-1" />
                              <span className="font-bold text-sm text-foreground">
                                {formatCurrency((ptrab.totalLogistica || 0) + (ptrab.totalOperacional || 0))}
                              </span>
                            </>
                          )}
                          {((ptrab.totalLogistica || 0) === 0 && (ptrab.totalOperacional || 0) === 0) && (
                            <span className="text-muted-foreground">N/A</span>
                          )}
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
                          
                          {(needsNumbering(ptrab) || isApprovedOrArchived) && (
                            <Button
                              onClick={() => handleOpenApproveDialog(ptrab)}
                              size="sm"
                              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                              disabled={loading || isApprovedOrArchived}
                            >
                              <CheckCircle className="h-4 w-4" />
                              Aprovar
                            </Button>
                          )}

                          <Button
                            onClick={() => handleSelectPTrab(ptrab)}
                            size="sm"
                            className="flex items-center gap-2"
                            disabled={!isEditable}
                          >
                            <FileText className="h-4 w-4" />
                            Preencher
                          </Button>
                          
                          <PTrabActionsMenu
                            ptrab={ptrab}
                            isEditable={isEditable}
                            isFinalStatus={isApprovedOrArchived}
                            onEdit={handleEdit}
                            onClone={handleOpenCloneOptions}
                            onArchive={(id, name) => handleArchive(id, name)}
                            onReactivate={handleReactivate}
                            onDelete={handleDelete}
                            onNavigateToPrint={id => navigate(`/ptrab/print?ptrabId=${id}`)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Diálogo de Formulário (Criação/Edição) */}
      <PTrabFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        formData={formData}
        setFormData={setFormData}
        handleSubmit={handleSubmit}
        loading={loading}
        editingId={editingId}
        originalPTrabIdToClone={originalPTrabIdToClone}
        selectedOmId={selectedOmId}
        setSelectedOmId={setSelectedOmId}
      />

      {/* Diálogo de Arquivamento Automático */}
      <AlertDialog open={showArchiveStatusDialog} onOpenChange={setShowArchiveStatusDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar P Trab?</AlertDialogTitle>
            <AlertDialogDescription>
              O P Trab "{ptrabToArchiveName}" está com status "Aprovado" há mais de 10 dias. Deseja arquivá-lo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowArchiveStatusDialog(false)}>Agora não</AlertDialogCancel>
            <AlertDialogAction onClick={() => { handleArchive(ptrabToArchiveId!, ptrabToArchiveName!); setShowArchiveStatusDialog(false); }}>Sim, arquivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de Reativação */}
      <AlertDialog open={showReactivateStatusDialog} onOpenChange={setShowReactivateStatusDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reativar P Trab?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja reativar o P Trab "{ptrabToReactivateName}"? Ele retornará ao status de "Aprovado" (se já numerado) ou "Aberto" (se for Minuta), permitindo novas edições.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => { handleConfirmReactivate(); setShowReactivateStatusDialog(false); }} disabled={loading}>
              {loading ? "Aguarde..." : "Confirmar Reativação"}
            </AlertDialogAction>
            <AlertDialogCancel onClick={() => setShowReactivateStatusDialog(false)} disabled={loading}>
              Cancelar
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <Button onClick={() => { handleSaveComentario(); setShowComentarioDialog(false); }}>
              Salvar
            </Button>
            <Button variant="outline" onClick={() => setShowComentarioDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Aprovação e Numeração */}
      <PTrabApproveDialog
        open={showApproveDialog}
        onOpenChange={setShowApproveDialog}
        ptrabToApprove={ptrabToApprove}
        suggestedApproveNumber={suggestedApproveNumber}
        setSuggestedApproveNumber={setSuggestedApproveNumber}
        onApprove={handleApproveAndNumber}
        loading={loading}
      />

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
                <Input type="radio" id="clone-new" value="new" className="sr-only" />
                <span className="mb-3 text-lg font-semibold">Novo P Trab</span>
                <p className="text-sm text-muted-foreground text-center">
                  Cria um P Trab totalmente novo, iniciando como Minuta para posterior numeração.
                </p>
              </Label>
              <Label
                htmlFor="clone-variation"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
              >
                <Input type="radio" id="clone-variation" value="variation" className="sr-only" />
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

      {/* Diálogo de Variação do Trabalho */}
      {ptrabToClone && (
        <CloneVariationDialog
          open={showCloneVariationDialog}
          onOpenChange={setShowCloneVariationDialog}
          originalNumber={ptrabToClone.numero_ptrab}
          suggestedCloneNumber={suggestedCloneNumber}
          onConfirm={handleFinalCloneVariation}
        />
      )}

      {/* Diálogo de Consolidação */}
      <PTrabConsolidationDialog
        open={showConsolidationDialog}
        onOpenChange={setShowConsolidationDialog}
        pTrabsList={pTrabs.map(p => ({ id: p.id, numero_ptrab: p.numero_ptrab, nome_operacao: p.nome_operacao }))}
        existingPTrabNumbers={existingPTrabNumbers}
        onConfirm={async (sourceIds, targetId, newNumber, templateId) => {
          // Lógica de consolidação (a ser implementada no futuro)
          toast.info("A consolidação será implementada em breve.");
          setShowConsolidationDialog(false);
        }}
        loading={loading}
      />
      
      {/* Diálogo de Prompt de Crédito */}
      <CreditPromptDialog
        open={showCreditPrompt}
        onConfirm={handlePromptConfirm}
        onCancel={handlePromptCancel}
      />
    </div>
  );
};

export default PTrabManager;