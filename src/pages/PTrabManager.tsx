import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { useSession } from "@/components/SessionContextProvider";
import { toast } from "sonner";
import { ArrowLeft, Plus, FileText, Pencil, Trash2, Copy, GitBranch, Check, AlertCircle, Loader2, RefreshCw, Settings, TrendingUp, MessageSquare, UploadCloud, Download, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { formatCurrency } from "@/lib/formatUtils";
import { generateUniqueMinutaNumber, isPTrabNumberDuplicate, generateApprovalPTrabNumber } from "@/lib/ptrabNumberUtils";
import { sanitizeError } from "@/lib/errorUtils";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import PTrabConsolidationDialog from "@/components/PTrabConsolidationDialog";
import { CloneVariationDialog } from "@/components/CloneVariationDialog";
import { CreditInputDialog } from "@/components/CreditInputDialog";
import { fetchUserCredits, updateUserCredits } from "@/lib/creditUtils";
import { CreditPromptDialog } from "@/components/CreditPromptDialog";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label"; // Adicionado Label

// Define a base type for PTrab data fetched from DB, including the missing 'origem' field
type PTrabDB = Tables<'p_trab'> & {
  origem: 'original' | 'importado' | 'variacao' | 'consolidado';
};

interface PTrab extends PTrabDB {
  // Adicione campos calculados ou de UI aqui se necessário
}

const PTrabManager = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: loadingSession } = useSession();

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [ptrabToClone, setPTrabToClone] = useState<PTrab | null>(null);
  const [cloneType, setCloneType] = useState<'new' | 'variation' | null>(null);
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);
  const [suggestedCloneNumber, setSuggestedCloneNumber] = useState('');
  const [customCloneNumber, setCustomCloneNumber] = useState('');
  const [cloneVersionName, setCloneVersionName] = useState('');
  const [ptrabToDelete, setPTrabToDelete] = useState<PTrab | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [ptrabToComment, setPTrabToComment] = useState<PTrab | null>(null);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [currentComment, setCurrentComment] = useState('');
  const [ptrabToApprove, setPTrabToApprove] = useState<PTrab | null>(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [omToApprove, setOmToApprove] = useState<OMData | undefined>(undefined);
  const [isConsolidationDialogOpen, setIsConsolidationDialogOpen] = useState(false);
  const [consolidationLoading, setConsolidationLoading] = useState(false);
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const [showCreditPromptDialog, setShowCreditPromptDialog] = useState(false);
  const [hasCheckedCredits, setHasCheckedCredits] = useState(false);
  
  // NOVO ESTADO para o diálogo de variação
  const [showCloneVariationDialog, setShowCloneVariationDialog] = useState(false);

  // Estado para OMs do usuário (necessário para o diálogo de aprovação)
  const { data: userOms, isLoading: isLoadingOms } = useQuery({
    queryKey: ['userOms', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('organizacoes_militares')
        .select('*')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .order('nome_om');
      if (error) throw error;
      return (data || []) as OMData[];
    },
    enabled: !!user?.id,
  });

  // Fetch PTrabs
  const { data: pTrabs, isLoading: isLoadingPTrabs } = useQuery({
    queryKey: ['pTrabs', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('p_trab')
        .select('*')
        .eq('user_id', user.id)
        .order('numero_ptrab', { ascending: false });
      if (error) throw error;
      return (data || []) as PTrab[];
    },
    enabled: !!user?.id,
  });

  // Fetch Existing PTrab Numbers
  const existingPTrabNumbers = useMemo(() => {
    return (pTrabs || []).map(p => p.numero_ptrab);
  }, [pTrabs]);

  // Fetch User Credits
  const { data: credits, isLoading: isLoadingCredits } = useQuery({
    queryKey: ['userCredits', user?.id],
    queryFn: () => fetchUserCredits(user!.id),
    enabled: !!user?.id,
    initialData: { credit_gnd3: 0, credit_gnd4: 0 },
  });

  // Efeito para atualizar o número sugerido no diálogo de clonagem
  useEffect(() => {
    if (ptrabToClone) {
      // Tanto para 'new' quanto para 'variation', o novo P Trab deve começar como uma Minuta única
      const newSuggestedNumber = generateUniqueMinutaNumber(existingPTrabNumbers); 
      
      setSuggestedCloneNumber(newSuggestedNumber);
      setCustomCloneNumber(newSuggestedNumber); // Inicializa o campo editável com a sugestão
    }
  }, [ptrabToClone, existingPTrabNumbers]);


  const checkAuth = async () => {
    if (!user && !loadingSession) {
      navigate('/login');
      toast.error("Sessão expirada. Faça login novamente.");
    }
  };

  useEffect(() => {
    checkAuth();
  }, [user, loadingSession, navigate]);

  // Filtros
  const filteredPTrabs = useMemo(() => {
    let filtered = pTrabs || [];

    if (filterStatus !== 'all') {
      filtered = filtered.filter(p => p.status === filterStatus);
    }

    if (searchTerm) {
      const lowerCaseSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.numero_ptrab.toLowerCase().includes(lowerCaseSearch) ||
        p.nome_operacao.toLowerCase().includes(lowerCaseSearch) ||
        p.nome_om.toLowerCase().includes(lowerCaseSearch)
      );
    }

    return filtered;
  }, [pTrabs, filterStatus, searchTerm]);

  // Variável de carregamento consolidada
  const isDataLoading = isLoadingPTrabs || loadingSession || isLoadingOms;

  // --- Funções de Clonagem ---

  // Função para clonar os registros relacionados
  const cloneRelatedRecords = async (originalPTrabId: string, newPTrabId: string) => {
    const dependentTables = [
      'classe_i_registros',
      'classe_ii_registros',
      'classe_iii_registros',
      'p_trab_ref_lpc',
    ];

    for (const table of dependentTables) {
      const { data: oldRecords, error: fetchError } = await supabase
        .from(table as 'classe_i_registros')
        .select('*')
        .eq('p_trab_id', originalPTrabId);

      if (fetchError) {
        console.error(`Erro ao buscar registros de ${table}:`, fetchError);
        continue;
      }

      if (oldRecords && oldRecords.length > 0) {
        const recordsToInsert = oldRecords.map(record => {
          const newRecord = { ...record };
          delete (newRecord as any).id;
          delete (newRecord as any).created_at;
          delete (newRecord as any).updated_at;
          (newRecord as any).p_trab_id = newPTrabId;
          
          // Limpar campos customizados na clonagem (opcional, mas seguro)
          if (table === 'classe_i_registros') {
            (newRecord as any).memoria_calculo_qs_customizada = null;
            (newRecord as any).memoria_calculo_qr_customizada = null;
          }
          if (table === 'classe_ii_registros' || table === 'classe_iii_registros') {
            (newRecord as any).detalhamento_customizado = null;
          }
          
          return newRecord;
        });

        const { error: insertError } = await supabase.from(table as 'classe_i_registros').insert(recordsToInsert);
        if (insertError) console.error(`Erro ao inserir registros de ${table}:`, insertError);
      }
    }
  };

  // Função unificada para executar a clonagem (usada por 'new' e 'variation')
  const executeCloningProcess = async (originalPTrab: PTrab, newNumeroPTrab: string, versionName: string | null = null, isVariation: boolean = false): Promise<string | null> => {
    if (!user?.id) return null;
    setLoadingPTrabs(true);

    try {
      // 1. Criar o novo P Trab
      const { id: originalId, created_at, updated_at, ...restOfPTrab } = originalPTrab; 
      
      const newPTrabData: TablesInsert<'p_trab'> & { origem: PTrabDB['origem'] } = {
        ...restOfPTrab,
        user_id: user.id,
        numero_ptrab: newNumeroPTrab,
        status: 'minuta', // Sempre começa como minuta
        origem: isVariation ? 'variacao' : 'original',
        comentario: versionName || originalPTrab.comentario,
      };

      const { data: newPTrab, error: insertPTrabError } = await supabase
        .from('p_trab')
        .insert([newPTrabData as TablesInsert<'p_trab'>])
        .select()
        .single();

      if (insertPTrabError || !newPTrab) throw new Error(`Erro ao criar novo P Trab: ${insertPTrabError?.message}`);
      const newPTrabId = newPTrab.id;

      // 2. Clonar registros dependentes
      await cloneRelatedRecords(originalPTrab.id, newPTrabId);

      // 3. Zerar créditos disponíveis após a criação de um novo P Trab
      await updateUserCredits(user.id, 0, 0);

      toast.success(`P Trab ${newPTrab.numero_ptrab} criado com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['pTrabs', user.id] });
      
      return newPTrabId;
    } catch (error: any) {
      console.error("ERRO GERAL AO CLONAR P TRAB:", error);
      toast.error(sanitizeError(error));
      return null;
    } finally {
      setLoadingPTrabs(false);
    }
  };

  const handleCreateNewPTrab = async () => {
    if (!user?.id) return;
    setLoadingPTrabs(true);
    
    try {
      const newMinutaNumber = generateUniqueMinutaNumber(existingPTrabNumbers);
      
      const newPTrabData: TablesInsert<'p_trab'> = {
        user_id: user.id,
        numero_ptrab: newMinutaNumber,
        comando_militar_area: "CMDO MILITAR DE ÁREA",
        nome_om: "OM SIGLA",
        nome_operacao: "NOVA OPERAÇÃO",
        periodo_inicio: new Date().toISOString().split('T')[0],
        periodo_fim: new Date().toISOString().split('T')[0],
        efetivo_empregado: "0",
        acoes: "Ações a serem definidas",
        status: 'minuta',
        origem: 'original',
      };

      const { data: newPTrab, error: insertPTrabError } = await supabase
        .from('p_trab')
        .insert([newPTrabData])
        .select()
        .single();

      if (insertPTrabError || !newPTrab) throw new Error(`Erro ao criar novo P Trab: ${insertPTrabError?.message}`);
      
      // Zerar créditos disponíveis após a criação de um novo P Trab
      await updateUserCredits(user.id, 0, 0);

      toast.success(`Novo P Trab Minuta criado: ${newPTrab.numero_ptrab}`);
      queryClient.invalidateQueries({ queryKey: ['pTrabs', user.id] });
      navigate(`/ptrab/form?ptrabId=${newPTrab.id}`);
      
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoadingPTrabs(false);
    }
  };

  // Fluxo 1: Clonagem Simples (Novo P Trab)
  const handleClone = (ptrab: PTrab) => {
    setPTrabToClone(ptrab);
    setCloneType('new');
    setIsCloneDialogOpen(true);
  };

  const handleConfirmCloneNew = async () => {
    if (!ptrabToClone || !customCloneNumber.trim()) return;
    
    const newPTrabId = await executeCloningProcess(ptrabToClone, customCloneNumber, null, false);
    
    if (newPTrabId) {
      setIsCloneDialogOpen(false);
      navigate(`/ptrab/form?ptrabId=${newPTrabId}`);
    }
  };

  // Fluxo 2: Clonagem Variação (Abre o diálogo de nome da versão)
  const handleVariationClick = (ptrab: PTrab) => {
    setPTrabToClone(ptrab);
    setCloneType('variation');
    setShowCloneVariationDialog(true);
  };

  // Fluxo 2.1: Confirmação da Variação (Chamado pelo CloneVariationDialog)
  const handleConfirmCloneVariation = async (versionName: string) => {
    if (!ptrabToClone || !suggestedCloneNumber.trim()) return;
    
    // O suggestedCloneNumber já é o Minuta-N
    const newPTrabId = await executeCloningProcess(ptrabToClone, suggestedCloneNumber, versionName, true);
    
    if (newPTrabId) {
      setShowCloneVariationDialog(false);
      navigate(`/ptrab/form?ptrabId=${newPTrabId}`);
    }
  };

  // --- Handlers de Ação (Continuação) ---

  const handleDeleteClick = (ptrab: PTrab) => {
    setPTrabToDelete(ptrab);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!ptrabToDelete || !user?.id) return;

    try {
      const { error } = await supabase
        .from('p_trab')
        .delete()
        .eq('id', ptrabToDelete.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success(`P Trab ${ptrabToDelete.numero_ptrab} excluído com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['pTrabs', user.id] });
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setIsDeleteDialogOpen(false);
      setPTrabToDelete(null);
    }
  };

  const handleStatusChange = async (ptrab: PTrab, newStatus: string) => {
    if (newStatus === 'minuta' && ptrab.origem !== 'original' && ptrab.origem !== 'variacao') {
      toast.error("Apenas P Trabs originais ou variações podem ser alterados para Minuta.");
      return;
    }
    
    if (newStatus === 'completo' || newStatus === 'arquivado') {
      if (!confirm(`Tem certeza que deseja alterar o status de ${ptrab.numero_ptrab} para "${newStatus.toUpperCase()}"?`)) {
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('p_trab')
        .update({ status: newStatus })
        .eq('id', ptrab.id)
        .eq('user_id', user!.id);

      if (error) throw error;

      toast.success(`Status de ${ptrab.numero_ptrab} atualizado para ${newStatus.toUpperCase()}!`);
      queryClient.invalidateQueries({ queryKey: ['pTrabs', user!.id] });
    } catch (error: any) {
      toast.error(sanitizeError(error));
    }
  };

  const handleCommentClick = (ptrab: PTrab) => {
    setPTrabToComment(ptrab);
    setCurrentComment(ptrab.comentario || '');
    setCommentDialogOpen(true);
  };

  const handleSaveComment = async () => {
    if (!ptrabToComment || !user?.id) return;

    try {
      const { error } = await supabase
        .from('p_trab')
        .update({ comentario: currentComment.trim() || null })
        .eq('id', ptrabToComment.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success("Comentário salvo!");
      queryClient.invalidateQueries({ queryKey: ['pTrabs', user.id] });
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setCommentDialogOpen(false);
      setPTrabToComment(null);
      setCurrentComment('');
    }
  };

  const handleApproveClick = (ptrab: PTrab) => {
    if (userOms.length === 0) {
      toast.error("Cadastre pelo menos uma OM em Configurações > Relação de OM antes de numerar.");
      navigate('/config/om');
      return;
    }
    setPTrabToApprove(ptrab);
    setOmToApprove(userOms.find(om => om.nome_om === ptrab.nome_om));
    setIsApproveDialogOpen(true);
  };

  const handleConfirmApprove = async () => {
    if (!ptrabToApprove || !omToApprove || !user?.id) {
      toast.error("Selecione a OM e o P Trab.");
      return;
    }

    setLoadingPTrabs(true);
    setIsApproveDialogOpen(false);

    try {
      const newOfficialNumber = generateApprovalPTrabNumber(existingPTrabNumbers, omToApprove.nome_om);

      const { error } = await supabase
        .from('p_trab')
        .update({
          numero_ptrab: newOfficialNumber,
          status: 'aberto',
          nome_om: omToApprove.nome_om,
          codug_om: omToApprove.codug_om,
          rm_vinculacao: omToApprove.rm_vinculacao,
          codug_rm_vinculacao: omToApprove.codug_rm_vinculacao,
          comando_militar_area: omToApprove.rm_vinculacao,
        })
        .eq('id', ptrabToApprove.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success(`P Trab numerado: ${newOfficialNumber}. Status alterado para ABERTO.`);
      queryClient.invalidateQueries({ queryKey: ['pTrabs', user.id] });
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoadingPTrabs(false);
      setPTrabToApprove(null);
      setOmToApprove(undefined);
    }
  };

  const handleConsolidationClick = () => {
    if ((pTrabs?.length || 0) < 2) {
      toast.info("É necessário ter pelo menos 2 Planos de Trabalho cadastrados para realizar a consolidação.");
      return;
    }
    setIsConsolidationDialogOpen(true);
  };

  const handleConsolidationConfirm = async (
    sourcePTrabIds: string[],
    targetPTrabId: string | 'new',
    newPTrabNumber?: string,
    templatePTrabId?: string
  ) => {
    if (!user?.id) return;
    setConsolidationLoading(true);
    setIsConsolidationDialogOpen(false);

    try {
      let finalTargetPTrabId: string;
      let targetPTrab: PTrab | null = null;

      // 1. Criar novo P Trab de destino, se necessário
      if (targetPTrabId === 'new') {
        if (!newPTrabNumber || !templatePTrabId) throw new Error("Dados incompletos para novo P Trab.");
        
        const template = pTrabs?.find(p => p.id === templatePTrabId);
        if (!template) throw new Error("Template de cabeçalho não encontrado.");

        const { id, created_at, updated_at, ...rest } = template;
        
        const newPTrabData = {
          ...rest,
          user_id: user.id,
          numero_ptrab: newPTrabNumber,
          status: 'aberto',
          origem: 'consolidado',
          comentario: `Consolidado de múltiplos P Trabs. Baseado em ${template.numero_ptrab}.`,
        };

        const { data: newPTrab, error: insertPTrabError } = await supabase
          .from('p_trab')
          .insert([newPTrabData])
          .select()
          .single();

        if (insertPTrabError || !newPTrab) throw new Error(`Erro ao criar P Trab consolidado: ${insertPTrabError?.message}`);
        finalTargetPTrabId = newPTrab.id;
        targetPTrab = newPTrab;
      } else {
        finalTargetPTrabId = targetPTrabId;
        targetPTrab = pTrabs?.find(p => p.id === finalTargetPTrabId) || null;
        if (!targetPTrab) throw new Error("P Trab de destino não encontrado.");
      }

      // 2. Copiar registros de origem para o destino
      const dependentTables = [
        'classe_i_registros',
        'classe_ii_registros',
        'classe_iii_registros',
      ];
      
      let totalRecordsCopied = 0;

      for (const sourceId of sourcePTrabIds) {
        for (const table of dependentTables) {
          const { data: sourceRecords, error: fetchError } = await supabase
            .from(table as 'classe_i_registros')
            .select('*')
            .eq('p_trab_id', sourceId);

          if (fetchError) {
            console.error(`Erro ao buscar registros de ${table} para cópia:`, fetchError);
            continue;
          }

          if (sourceRecords && sourceRecords.length > 0) {
            const recordsToInsert = sourceRecords.map(record => {
              const newRecord = { ...record };
              delete (newRecord as any).id;
              delete (newRecord as any).created_at;
              delete (newRecord as any).updated_at;
              (newRecord as any).p_trab_id = finalTargetPTrabId;
              return newRecord;
            });

            const { error: insertError } = await supabase.from(table as 'classe_i_registros').insert(recordsToInsert);
            if (insertError) console.error(`Erro ao inserir registros de ${table} no destino:`, insertError);
            totalRecordsCopied += recordsToInsert.length;
          }
        }
      }
      
      // 3. Atualizar status do PTrab de destino para 'em_andamento'
      await updatePTrabStatusIfAberto(finalTargetPTrabId);

      toast.success(`Consolidação concluída! ${totalRecordsCopied} registros copiados para ${targetPTrab.numero_ptrab}.`);
      queryClient.invalidateQueries({ queryKey: ['pTrabs', user.id] });
      
      // Redireciona para o formulário do P Trab consolidado
      navigate(`/ptrab/form?ptrabId=${finalTargetPTrabId}`);

    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setConsolidationLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  // --- Handlers de Crédito ---
  const handleSaveCredit = (gnd3: number, gnd4: number) => {
    if (!user?.id) {
      toast.error("Erro: Usuário não identificado para salvar créditos.");
      return;
    }
    saveCreditsMutation.mutate({ gnd3, gnd4 });
  };

  const saveCreditsMutation = useMutation({
    mutationFn: ({ gnd3, gnd4 }: { gnd3: number, gnd4: number }) => 
      updateUserCredits(user!.id, gnd3, gnd4),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userCredits', user?.id] });
      toast.success("Créditos disponíveis atualizados e salvos!");
    },
    onError: (error) => {
      toast.error(error.message || "Falha ao salvar créditos.");
    }
  });

  const handlePromptConfirm = () => {
    setShowCreditPromptDialog(false);
    setShowCreditDialog(true);
  };
  
  const handlePromptCancel = () => {
    setShowCreditPromptDialog(false);
  };

  // Efeito para verificar se deve mostrar o prompt de crédito
  useEffect(() => {
    if (!isLoadingCredits && !loadingSession && user?.id && !hasCheckedCredits) {
      const gnd3 = Number(credits.credit_gnd3);
      const gnd4 = Number(credits.credit_gnd4);
      
      if (gnd3 === 0 && gnd4 === 0) {
        setShowCreditPromptDialog(true);
      }
      setHasCheckedCredits(true);
    }
  }, [isLoadingCredits, loadingSession, user?.id, credits, hasCheckedCredits]);

  // --- Renderização ---

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'minuta':
        return <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300">Minuta</Badge>;
      case 'aberto':
        return <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">Aberto</Badge>;
      case 'em_andamento':
        return <Badge variant="default" className="bg-orange-500 hover:bg-orange-600">Em Andamento</Badge>;
      case 'completo':
        return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Completo</Badge>;
      case 'arquivado':
        return <Badge variant="secondary" className="bg-gray-500 hover:bg-gray-600">Arquivado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getOriginBadge = (origem: string) => {
    switch (origem) {
      case 'importado':
        return <Badge variant="outline" className="bg-purple-100 text-purple-600 border-purple-300">Importado</Badge>;
      case 'variacao':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-600 border-yellow-300">Variação</Badge>;
      case 'consolidado':
        return <Badge variant="outline" className="bg-teal-100 text-teal-600 border-teal-300">Consolidado</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold font-display">Planos de Trabalho</h1>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/config/diretrizes')} variant="outline" size="icon" title="Configurações">
              <Settings className="h-4 w-4" />
            </Button>
            <Button onClick={() => navigate('/config/visualizacao')} variant="outline" size="icon" title="Visualização">
              <TrendingUp className="h-4 w-4" />
            </Button>
            <Button onClick={() => navigate('/config/ptrab-export-import')} variant="outline" size="icon" title="Exportar/Importar">
              <Download className="h-4 w-4" />
            </Button>
            <Button onClick={handleConsolidationClick} variant="outline" disabled={isDataLoading || (pTrabs?.length || 0) < 2}>
              <GitBranch className="mr-2 h-4 w-4" />
              Consolidar P Trab
            </Button>
            <Button onClick={handleCreateNewPTrab}>
              <Plus className="mr-2 h-4 w-4" />
              Novo P Trab
            </Button>
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Gerenciamento de P Trabs</CardTitle>
            <CardDescription>
              Visualize, edite e gerencie o ciclo de vida dos seus Planos de Trabalho.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filtros e Busca */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Input
                  placeholder="Buscar por número, operação ou OM..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="minuta">Minuta</SelectItem>
                    <SelectItem value="aberto">Aberto</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="completo">Completo</SelectItem>
                    <SelectItem value="arquivado">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tabela de P Trabs */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[15%]">Número</TableHead>
                    <TableHead className="w-[25%]">Operação / OM</TableHead>
                    <TableHead className="w-[15%]">Status</TableHead>
                    <TableHead className="w-[10%]">Origem</TableHead>
                    <TableHead className="w-[35%] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isDataLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                        Carregando Planos de Trabalho...
                      </TableCell>
                    </TableRow>
                  ) : filteredPTrabs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhum P Trab encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPTrabs.map((ptrab) => (
                      <TableRow key={ptrab.id}>
                        <TableCell className="font-medium">
                          {ptrab.numero_ptrab}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{ptrab.nome_operacao}</p>
                          <p className="text-xs text-muted-foreground">{ptrab.nome_om}</p>
                          {ptrab.comentario && ptrab.origem === 'variacao' && (
                            <Badge variant="secondary" className="mt-1 text-xs bg-secondary/20 text-secondary-foreground/80">
                              <GitBranch className="h-3 w-3 mr-1" />
                              {ptrab.comentario}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(ptrab.status)}
                        </TableCell>
                        <TableCell>
                          {getOriginBadge(ptrab.origem)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {/* Botão Numerar/Aprovar (Apenas Minuta) */}
                            {ptrab.status === 'minuta' && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleApproveClick(ptrab)}
                                title="Numerar e Aprovar"
                              >
                                Numerar
                              </Button>
                            )}
                            
                            {/* Botão de Preencher/Editar (Aberto/Em Andamento) */}
                            {(ptrab.status === 'aberto' || ptrab.status === 'em_andamento' || ptrab.status === 'minuta') && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => navigate(`/ptrab/form?ptrabId=${ptrab.id}`)}
                                title="Preencher Classes"
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Preencher
                              </Button>
                            )}
                            
                            {/* Botão de Visualizar Impressão (Todos, exceto Minuta) */}
                            {ptrab.status !== 'minuta' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/ptrab/print?ptrabId=${ptrab.id}`)}
                                title="Visualizar Impressão"
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            )}
                            
                            {/* Dropdown de Ações */}
                            <Select onValueChange={(value) => {
                              if (value === 'clone') handleClone(ptrab);
                              if (value === 'variation') handleVariationClick(ptrab);
                              if (value === 'delete') handleDeleteClick(ptrab);
                              if (value === 'comment') handleCommentClick(ptrab);
                              if (value.startsWith('status:')) handleStatusChange(ptrab, value.split(':')[1]);
                            }}>
                              <SelectTrigger className="w-[40px] h-9">
                                <SelectValue placeholder="..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="clone">
                                  <div className="flex items-center gap-2">
                                    <Copy className="h-4 w-4" /> Clonar (Novo P Trab)
                                  </div>
                                </SelectItem>
                                <SelectItem value="variation">
                                  <div className="flex items-center gap-2">
                                    <GitBranch className="h-4 w-4" /> Clonar (Variação)
                                  </div>
                                </SelectItem>
                                <SelectItem value="comment">
                                  <div className="flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4" /> Comentário
                                  </div>
                                </SelectItem>
                                <SelectItem value="delete" className="text-destructive">
                                  <div className="flex items-center gap-2">
                                    <Trash2 className="h-4 w-4" /> Excluir
                                  </div>
                                </SelectItem>
                                <SelectItem value="status:aberto" disabled={ptrab.status === 'aberto'}>
                                  <div className="flex items-center gap-2">
                                    <RefreshCw className="h-4 w-4" /> Mudar para Aberto
                                  </div>
                                </SelectItem>
                                <SelectItem value="status:completo" disabled={ptrab.status === 'completo'}>
                                  <div className="flex items-center gap-2">
                                    <Check className="h-4 w-4" /> Mudar para Completo
                                  </div>
                                </SelectItem>
                                <SelectItem value="status:arquivado" disabled={ptrab.status === 'arquivado'}>
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4" /> Mudar para Arquivado
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Clonagem Simples (Novo P Trab) */}
      <Dialog open={isCloneDialogOpen && cloneType === 'new'} onOpenChange={setIsCloneDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5 text-primary" />
              Clonar P Trab
            </DialogTitle>
            <DialogDescription>
              Crie uma cópia completa do P Trab: {ptrabToClone?.numero_ptrab}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-number">Número Sugerido (Minuta)</Label>
              <Input
                id="new-number"
                value={customCloneNumber}
                onChange={(e) => setCustomCloneNumber(e.target.value)}
                placeholder={suggestedCloneNumber}
              />
              <p className="text-xs text-muted-foreground">
                Sugestão: {suggestedCloneNumber}
              </p>
              {isPTrabNumberDuplicate(customCloneNumber, existingPTrabNumbers) && (
                <Badge variant="destructive">Número já existe</Badge>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={handleConfirmCloneNew} 
              disabled={!customCloneNumber.trim() || isPTrabNumberDuplicate(customCloneNumber, existingPTrabNumbers)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Confirmar Clonagem
            </Button>
            <Button variant="outline" onClick={() => setIsCloneDialogOpen(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Variação do Trabalho */}
      {ptrabToClone && (
        <CloneVariationDialog
          open={showCloneVariationDialog}
          onOpenChange={setShowCloneVariationDialog}
          originalNumber={ptrabToClone.numero_ptrab}
          suggestedCloneNumber={suggestedCloneNumber}
          onConfirm={handleConfirmCloneVariation}
        />
      )}

      {/* Dialog de Exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o P Trab "{ptrabToDelete?.numero_ptrab} - {ptrabToDelete?.nome_operacao}"? Esta ação não pode ser desfeita e removerá todos os registros de classes associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPTrabToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Dialog de Comentário */}
      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Comentário - {ptrabToComment?.numero_ptrab}</DialogTitle>
            <DialogDescription>
              Adicione um comentário interno sobre este Plano de Trabalho.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              value={currentComment}
              onChange={(e) => setCurrentComment(e.target.value)}
              placeholder="Digite seu comentário aqui..."
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleSaveComment}>Salvar Comentário</Button>
            <Button variant="outline" onClick={() => setCommentDialogOpen(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Aprovação/Numeração */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              Numerar P Trab (Minuta)
            </DialogTitle>
            <DialogDescription>
              O P Trab "{ptrabToApprove?.numero_ptrab}" será numerado no padrão oficial (N/AAAA/OM_SIGLA) e terá o status alterado para "Aberto".
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>OM de Destino (Para Numeração)</Label>
              <OmSelector
                selectedOmId={omToApprove?.id}
                onChange={setOmToApprove}
                placeholder="Selecione a OM..."
                omsList={userOms}
              />
              {omToApprove && (
                <p className="text-xs text-muted-foreground">
                  OM Selecionada: {omToApprove.nome_om} (UG: {omToApprove.codug_om})
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleConfirmApprove} disabled={!omToApprove}>
              Confirmar Numeração
            </Button>
            <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog de Consolidação */}
      <PTrabConsolidationDialog
        open={isConsolidationDialogOpen}
        onOpenChange={setIsConsolidationDialogOpen}
        pTrabsList={(pTrabs || []).map(p => ({ id: p.id, numero_ptrab: p.numero_ptrab, nome_operacao: p.nome_operacao }))}
        existingPTrabNumbers={existingPTrabNumbers}
        onConfirm={handleConsolidationConfirm}
        loading={consolidationLoading}
      />

      {/* Diálogo de Crédito */}
      <CreditInputDialog
        open={showCreditDialog}
        onOpenChange={setShowCreditDialog}
        totalGND3Cost={0}
        totalGND4Cost={0}
        initialCreditGND3={credits.credit_gnd3}
        initialCreditGND4={credits.credit_gnd4}
        onSave={handleSaveCredit}
      />
      
      {/* Diálogo de Prompt de Crédito */}
      <CreditPromptDialog
        open={showCreditPromptDialog}
        onConfirm={handlePromptConfirm}
        onCancel={handlePromptCancel}
      />
    </div>
  );
};

export default PTrabManager;