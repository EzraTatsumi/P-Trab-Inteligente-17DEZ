import { useState, useEffect, useRef, useCallback } from "react";
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
import { Plus, Edit, Trash2, LogOut, FileText, Printer, Settings, PenSquare, MoreVertical, Pencil, Copy, FileSpreadsheet, Download, MessageSquare, ArrowRight, HelpCircle, CheckCircle, GitBranch, Archive, RefreshCw } from "lucide-react";
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
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { HelpDialog } from "@/components/HelpDialog";
import { CloneVariationDialog } from "@/components/CloneVariationDialog";
import { updateUserCredits } from "@/lib/creditUtils";
import { cn } from "@/lib/utils";

// Define a base type for PTrab data fetched from DB, including the missing 'origem' field
type PTrabDB = Tables<'p_trab'> & {
  origem: 'original' | 'importado' | 'consolidado';
  rotulo_versao: string | null; // ADDED rotulo_versao
};

interface PTrab extends PTrabDB {
  totalLogistica?: number;
  totalOperacional?: number;
}

const PTrabManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pTrabs, setPTrabs] = useState<PTrab[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [existingPTrabNumbers, setExistingPTrabNumbers] = useState<string[]>([]);
  
  // Estado para controlar a abertura do DropdownMenu de configurações
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);

  // Estados para o AlertDialog de status "arquivado"
  const [showArchiveStatusDialog, setShowArchiveStatusDialog] = useState(false);
  const [ptrabToArchiveId, setPtrabToArchiveId] = useState<string | null>(null);
  const [ptrabToArchiveName, setPtrabToArchiveName] = useState<string | null>(null);
  // Ref para controlar quais PTrabs já foram oferecidos para arquivamento na sessão atual
  const promptedForArchive = useRef(new Set<string>());

  // Novos estados para o AlertDialog de reativação
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

  // Estados para o diálogo de comentário
  const [showComentarioDialog, setShowComentarioDialog] = useState(false);
  const [ptrabComentario, setPtrabComentario] = useState<PTrab | null>(null);
  const [comentarioText, setComentarioText] = useState("");

  // NOVO ESTADO: Diálogo de Consolidação
  const [showConsolidationDialog, setShowConsolidationDialog] = useState(false);
  
  // NOVO ESTADO: Diálogo de Aprovação/Numeração
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [ptrabToApprove, setPtrabToApprove] = useState<PTrab | null>(null);
  const [suggestedApproveNumber, setSuggestedApproveNumber] = useState<string>("");
  // REMOVIDO: omSiglaLimpa não é mais necessário como estado

  const currentYear = new Date().getFullYear();
  const yearSuffix = `/${currentYear}`;

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
      rotulo_versao: null, // ADDED
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
    rotulo_versao: null as string | null, // ADDED
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
    try {
      const { data: pTrabsData, error: pTrabsError } = await supabase
        .from("p_trab")
        .select("*, comentario, origem, rotulo_versao") // ADDED rotulo_versao
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

      const pTrabsWithTotals: PTrab[] = await Promise.all(
        (typedPTrabsData || []).map(async (ptrab) => {
          let totalOperacionalCalculado = 0;

          // 1. Fetch Classe I totals (33.90.30)
          const { data: classeIData, error: classeIError } = await supabase
            .from('classe_i_registros')
            .select('total_qs, total_qr')
            .eq('p_trab_id', ptrab.id);

          let totalClasseI = 0;
          if (classeIError) console.error("Erro ao carregar Classe I para PTrab", ptrab.numero_ptrab, classeIError);
          else {
            totalClasseI = (classeIData || []).reduce((sum, record) => sum + record.total_qs + record.total_qr, 0);
          }
          
          // 2. Fetch Classe II totals (33.90.30)
          const { data: classeIIData, error: classeIIError } = await supabase
            .from('classe_ii_registros')
            .select('valor_total')
            .eq('p_trab_id', ptrab.id);

          let totalClasseII = 0;
          if (classeIIError) console.error("Erro ao carregar Classe II para PTrab", ptrab.numero_ptrab, classeIIError);
          else {
            totalClasseII = (classeIIData || []).reduce((sum, record) => sum + record.valor_total, 0);
          }

          // 3. Fetch Classe III totals (Combustível)
          const { data: classeIIIData, error: classeIIIError } = await supabase
            .from('classe_iii_registros')
            .select('valor_total')
            .eq('p_trab_id', ptrab.id);

          let totalClasseIII = 0;
          if (classeIIIError) console.error("Erro ao carregar Classe III para PTrab", ptrab.numero_ptrab, classeIIIError);
          else {
            totalClasseIII = (classeIIIData || []).reduce((sum, record) => sum + record.valor_total, 0);
          }

          const totalLogisticaCalculado = totalClasseI + totalClasseII + totalClasseIII;

          return {
            ...ptrab,
            totalLogistica: totalLogisticaCalculado,
            totalOperacional: totalOperacionalCalculado,
          } as PTrab;
        })
      );

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
  }, [setLoading, setPTrabs, setExistingPTrabNumbers, toast]);

  useEffect(() => {
    checkAuth();
    loadPTrabs();
  }, [loadPTrabs]);

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

    try {
      // MUDANÇA: Reativa para 'em_andamento'
      const { error } = await supabase
        .from("p_trab")
        .update({ status: "em_andamento" })
        .eq("id", ptrabToReactivateId);

      if (error) throw error;

      toast.success(`P Trab ${ptrabToReactivateName} reativado para "Em Andamento"!`);
      setShowReactivateStatusDialog(false);
      setPtrabToReactivateId(null);
      setPtrabToReactivateName(null);
      loadPTrabs();
    } catch (error) {
      console.error("Erro ao reativar P Trab:", error);
      toast.error("Erro ao reativar P Trab.");
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
        } else {
            toast.success("P Trab criado!");
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
      rotulo_versao: ptrab.rotulo_versao || null, // ADDED
    });
    setDialogOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza?")) return;
    try {
      await supabase.from("p_trab").delete().eq("id", id);
      toast.success("P Trab excluído!");
      loadPTrabs();
    } catch (error: any) {
      toast.error("Erro ao excluir");
    }
  };

  // Função para abrir o diálogo de aprovação
  const handleOpenApproveDialog = (ptrab: PTrab) => {
    // 1. A sigla da OM é usada como está (ptrab.nome_om)
    const omSigla = ptrab.nome_om;
    
    // 2. Gerar o número no novo padrão N/YYYY/OM_SIGLA
    const suggestedNumber = generateApprovalPTrabNumber(existingPTrabNumbers, omSigla);
    
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
      // MUDANÇA AQUI: Extrair campos da OM para limpá-los
      const { 
        id, created_at, updated_at, totalLogistica, totalOperacional, 
        rotulo_versao, nome_om, nome_om_extenso, codug_om, rm_vinculacao, codug_rm_vinculacao,
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
        // 2. Cria o novo P Trab com os dados do original, novo número de minuta
        const { id, created_at, updated_at, totalLogistica, totalOperacional, rotulo_versao, ...restOfPTrab } = ptrabToClone;
        
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
        
        // 3. Clona os registros relacionados (Classes I, II, III e LPC)
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
    // 1. Clone Classe I records
    const { data: originalClasseIRecords, error: fetchClasseIError } = await supabase
      .from("classe_i_registros")
      .select("*")
      .eq("p_trab_id", originalPTrabId);

    if (fetchClasseIError) {
      console.error("Erro ao carregar registros da Classe I:", fetchClasseIError);
    } else {
      const newClasseIRecords = (originalClasseIRecords || []).map(record => {
        const { id, created_at, updated_at, ...restOfRecord } = record; // REMOVE ID
        return {
          ...restOfRecord,
          p_trab_id: newPTrabId,
          // Garantir que campos numéricos NOT NULL sejam números
          complemento_qr: record.complemento_qr ?? 0,
          complemento_qs: record.complemento_qs ?? 0,
          dias_operacao: record.dias_operacao ?? 0,
          efetivo: record.efetivo ?? 0,
          etapa_qr: record.etapa_qr ?? 0,
          etapa_qs: record.etapa_qs ?? 0,
          nr_ref_int: record.nr_ref_int ?? 0,
          total_geral: record.total_geral ?? 0,
          total_qr: record.total_qr ?? 0,
          total_qs: record.total_qs ?? 0,
          valor_qr: record.valor_qr ?? 0,
          valor_qs: record.valor_qs ?? 0,
        };
      });

      if (newClasseIRecords.length > 0) {
        const { error: insertClasseIError } = await supabase
          .from("classe_i_registros")
          .insert(newClasseIRecords);
        if (insertClasseIError) {
          console.error("ERRO DE INSERÇÃO CLASSE I:", insertClasseIError);
          toast.error(`Erro ao clonar registros da Classe I: ${sanitizeError(insertClasseIError)}`);
        }
      }
    }
    
    // 2. Clone Classe II records
    const { data: originalClasseIIRecords, error: fetchClasseIIError } = await supabase
      .from("classe_ii_registros")
      .select("*, itens_equipamentos")
      .eq("p_trab_id", originalPTrabId);

    if (fetchClasseIIError) {
      console.error("Erro ao carregar registros da Classe II:", fetchClasseIIError);
    } else {
      const newClasseIIRecords = (originalClasseIIRecords || []).map(record => {
        const { id, created_at, updated_at, ...restOfRecord } = record; // REMOVE ID
        return {
          ...restOfRecord,
          p_trab_id: newPTrabId,
          itens_equipamentos: record.itens_equipamentos ? JSON.parse(JSON.stringify(record.itens_equipamentos)) : null,
          dias_operacao: record.dias_operacao ?? 0,
          valor_total: record.valor_total ?? 0,
        };
      });

      if (newClasseIIRecords.length > 0) {
        const { error: insertClasseIIError } = await supabase
          .from("classe_ii_registros")
          .insert(newClasseIIRecords);
        if (insertClasseIIError) {
          console.error("ERRO DE INSERÇÃO CLASSE II:", insertClasseIIError);
          toast.error(`Erro ao clonar registros da Classe II: ${sanitizeError(insertClasseIIError)}`);
        }
      }
    }

    // 3. Clone Classe III records
    const { data: originalClasseIIIRecords, error: fetchClasseIIIError } = await supabase
      .from("classe_iii_registros")
      .select("*")
      .eq("p_trab_id", originalPTrabId);

    if (fetchClasseIIIError) {
      console.error("Erro ao carregar registros da Classe III:", fetchClasseIIIError);
    } else {
      const newClasseIIIRecords = (originalClasseIIIRecords || []).map(record => {
        const { id, created_at, updated_at, ...restOfRecord } = record; // REMOVE ID
        return {
          ...restOfRecord,
          p_trab_id: newPTrabId,
          itens_equipamentos: record.itens_equipamentos ? JSON.parse(JSON.stringify(record.itens_equipamentos)) : null,
          dias_operacao: record.dias_operacao ?? 0,
          preco_litro: record.preco_litro ?? 0,
          quantidade: record.quantidade ?? 0,
          total_litros: record.total_litros ?? 0,
          valor_total: record.valor_total ?? 0,
          consumo_lubrificante_litro: record.consumo_lubrificante_litro ?? 0,
          preco_lubrificante: record.preco_lubrificante ?? 0,
        };
      });

      if (newClasseIIIRecords.length > 0) {
        const { error: insertClasseIIIError } = await supabase
          .from("classe_iii_registros")
          .insert(newClasseIIIRecords);
        if (insertClasseIIIError) {
          console.error("ERRO DE INSERÇÃO CLASSE III:", insertClasseIIIError);
          toast.error(`Erro ao clonar registros da Classe III: ${sanitizeError(insertClasseIIIError)}`);
        }
      }
    }

    // 4. Clone p_trab_ref_lpc record (if exists)
    const { data: originalRefLPC, error: fetchRefLPCError } = await supabase
      .from("p_trab_ref_lpc")
      .select("*")
      .eq("p_trab_id", originalPTrabId)
      .maybeSingle();

    if (fetchRefLPCError) {
      console.error("Erro ao carregar referência LPC:", fetchRefLPCError);
    } else if (originalRefLPC) {
      const { id, created_at, updated_at, ...restOfRefLPC } = originalRefLPC; // REMOVE ID
      const newRefLPCData = {
        ...restOfRefLPC,
        p_trab_id: newPTrabId,
      };
      const { error: insertRefLPCError } = await supabase
        .from("p_trab_ref_lpc")
        .insert([newRefLPCData]);
      if (insertRefLPCError) {
        console.error("ERRO DE INSERÇÃO REF LPC:", insertRefLPCError);
        toast.error(`Erro ao clonar referência LPC: ${sanitizeError(insertRefLPCError)}`);
      }
    }
  };

  const handleSelectPTrab = (ptrabId: string) => {
    navigate(`/ptrab/form?ptrabId=${ptrabId}`);
  };

  // Nova função para navegar para a página de impressão/exportação
  const handleNavigateToPrintOrExport = (ptrabId: string) => {
    // Agora, esta função apenas navega para a página de visualização de impressão
    navigate(`/ptrab/print?ptrabId=${ptrabId}`);
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

  // Função para determinar a cor e o texto do Badge de Origem
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

  // =================================================================
  // LÓGICA DE CONSOLIDAÇÃO
  // =================================================================

  const handleConfirmConsolidation = useCallback(async (
    sourcePTrabIds: string[],
    targetPTrabId: string | 'new',
    newPTrabNumber?: string,
    templatePTrabId?: string
  ) => {
    if (!sourcePTrabIds.length) return;

    setLoading(true);
    setShowConsolidationDialog(false);
    let finalTargetPTrabId: string;
    let targetPTrab: PTrab | undefined;

    try {
      // 1. Determinar ou Criar o P Trab de Destino
      if (targetPTrabId === 'new') {
        if (!newPTrabNumber || !templatePTrabId) throw new Error("Dados de criação incompletos.");
        
        // Verifica se o número sugerido (ou customizado) já existe
        const isDuplicate = isPTrabNumberDuplicate(newPTrabNumber, existingPTrabNumbers);
        if (isDuplicate) {
          throw new Error("O número sugerido já existe. Tente novamente ou use outro número.");
        }
        
        // Usar o PTrab selecionado como template
        const templatePTrab = pTrabs.find(p => p.id === templatePTrabId);
        if (!templatePTrab) throw new Error("P Trab template não encontrado.");

        // FIX: Explicitly exclude calculated fields and IDs
        const { id, created_at, updated_at, totalLogistica, totalOperacional, rotulo_versao, ...restOfPTrab } = templatePTrab;
        
        const newPTrabData: TablesInsert<'p_trab'> & { origem: PTrabDB['origem'] } = {
          ...restOfPTrab,
          numero_ptrab: newPTrabNumber,
          status: "aberto",
          user_id: (await supabase.auth.getUser()).data.user?.id!,
          nome_operacao: `CONSOLIDADO - ${templatePTrab.nome_operacao}`,
          origem: 'consolidado',
          rotulo_versao: templatePTrab.rotulo_versao, // Copia o rótulo da versão do template
        };

        const { data: newPTrab, error: insertPTrabError } = await supabase
          .from("p_trab")
          .insert([newPTrabData as TablesInsert<'p_trab'>]) // Cast to TablesInsert<'p_trab'>
          .select()
          .single();

        if (insertPTrabError || !newPTrab) throw insertPTrabError;
        finalTargetPTrabId = newPTrab.id;
        targetPTrab = { ...newPTrab, origem: 'consolidado' } as PTrab;
        toast.success(`Novo P Trab ${newPTrabNumber} criado para consolidação.`);
      } else {
        finalTargetPTrabId = targetPTrabId;
        targetPTrab = pTrabs.find(p => p.id === finalTargetPTrabId);
        if (!targetPTrab) throw new Error("P Trab de destino existente não encontrado.");
        
        // Se o P Trab de destino já existe, atualize a origem para 'consolidado'
        const { error: updateOriginError } = await supabase
          .from("p_trab")
          .update({ origem: 'consolidado' } as TablesUpdate<'p_trab'>)
          .eq("id", finalTargetPTrabId);
          
        if (updateOriginError) console.error("Erro ao atualizar origem para consolidado:", updateOriginError);
        targetPTrab = { ...targetPTrab, origem: 'consolidado' } as PTrab;
      }

      // 2. Clonar e Inserir Registros de Classe I, Classe II e Classe III
      let totalRecordsCloned = 0;

      for (const sourceId of sourcePTrabIds) {
        // Clonar Classe I
        const { data: classeIRecords } = await supabase
          .from("classe_i_registros")
          .select("*")
          .eq("p_trab_id", sourceId);

        if (classeIRecords && classeIRecords.length > 0) {
          const recordsToInsert = classeIRecords.map(record => {
            const { id, created_at, updated_at, ...rest } = record; // REMOVE ID
            return { ...rest, p_trab_id: finalTargetPTrabId };
          });
          const { error } = await supabase.from("classe_i_registros").insert(recordsToInsert as Tables<'classe_i_registros'>[]);
          if (error) console.error(`Erro ao clonar Classe I de ${sourceId}:`, error);
          totalRecordsCloned += recordsToInsert.length;
        }
        
        // Clonar Classe II (NOVO)
        const { data: classeIIRecords } = await supabase
          .from("classe_ii_registros")
          .select("*, itens_equipamentos")
          .eq("p_trab_id", sourceId);

        if (classeIIRecords && classeIIRecords.length > 0) {
          const recordsToInsert = classeIIRecords.map(record => {
            const { id, created_at, updated_at, ...rest } = record; // REMOVE ID
            return { ...rest, p_trab_id: finalTargetPTrabId, itens_equipamentos: record.itens_equipamentos ? JSON.parse(JSON.stringify(record.itens_equipamentos)) : null };
          });
          const { error } = await supabase.from("classe_ii_registros").insert(recordsToInsert as Tables<'classe_ii_registros'>[]);
          if (error) console.error(`Erro ao clonar Classe II de ${sourceId}:`, error);
          totalRecordsCloned += recordsToInsert.length;
        }

        // Clonar Classe III
        const { data: classeIIIRecords } = await supabase
          .from("classe_iii_registros")
          .select("*, itens_equipamentos")
          .eq("p_trab_id", sourceId);

        if (classeIIIRecords && classeIIIRecords.length > 0) {
          const recordsToInsert = classeIIIRecords.map(record => {
            const { id, created_at, updated_at, ...rest } = record; // REMOVE ID
            return { ...rest, p_trab_id: finalTargetPTrabId, itens_equipamentos: record.itens_equipamentos ? JSON.parse(JSON.stringify(record.itens_equipamentos)) : null };
          });
          const { error } = await supabase.from("classe_iii_registros").insert(recordsToInsert as Tables<'classe_iii_registros'>[]);
          if (error) console.error(`Erro ao clonar Classe III de ${sourceId}:`, error);
          totalRecordsCloned += recordsToInsert.length;
        }
      }
      
      // 3. Clonar Ref LPC (se existir no primeiro source e não existir no target)
      const { data: targetRefLPC } = await supabase
        .from("p_trab_ref_lpc")
        .select("id")
        .eq("p_trab_id", finalTargetPTrabId)
        .maybeSingle();

      if (!targetRefLPC) {
        const { data: sourceRefLPC } = await supabase
          .from("p_trab_ref_lpc")
          .select("*")
          .eq("p_trab_id", sourcePTrabIds[0])
          .maybeSingle();
        
        if (sourceRefLPC) {
          const { id, created_at, updated_at, ...rest } = sourceRefLPC; // REMOVE ID
          const { error } = await supabase.from("p_trab_ref_lpc").insert([{ ...rest, p_trab_id: finalTargetPTrabId }]);
          if (error) console.error("Erro ao clonar Ref LPC:", error);
        }
      }

      toast.success(`Consolidação concluída! ${totalRecordsCloned} registros copiados para ${targetPTrab?.numero_ptrab}.`);
      loadPTrabs();
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  }, [existingPTrabNumbers, pTrabs, loadPTrabs]);

  const isConsolidationDisabled = pTrabs.length < 2;
  const consolidationTooltipText = "Consolidar dados de múltiplos P Trabs em um único destino.";
    
  // Mensagem detalhada para quando a consolidação está desativada
  const getConsolidationDisabledMessage = () => {
    return "É necessário ter pelo menos 2 Planos de Trabalho cadastrados para realizar a consolidação. Cadastre mais P Trabs para habilitar esta função.";
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
                {pTrabs.map((ptrab) => {
                  const originBadge = getOriginBadge(ptrab.origem);
                  const isMinuta = ptrab.numero_ptrab.startsWith("Minuta");
                  const isNumbered = !needsNumbering(ptrab);
                  const isEditable = ptrab.status !== 'aprovado' && ptrab.status !== 'arquivado'; // MUDANÇA: Editável se não for aprovado/arquivado
                  const isApprovedOrArchived = isFinalStatus(ptrab); // NOVO: Verifica se está em status final
                  
                  return (
                  <TableRow key={ptrab.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col items-center">
                        {ptrab.status === 'aprovado' || ptrab.status === 'arquivado' ? (
                          <span>{ptrab.numero_ptrab}</span>
                        ) : (
                          <span className="text-red-500 font-bold">
                            {ptrab.numero_ptrab.startsWith("Minuta") ? "MINUTA" : "PENDENTE"}
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
                      <div>
                        {new Date(ptrab.periodo_inicio).toLocaleDateString('pt-BR')} - {new Date(ptrab.periodo_fim).toLocaleDateString('pt-BR')}
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
                        <div className="text-xs text-muted-foreground mt-1">
                          Última alteração: {formatDateTime(ptrab.updated_at)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center text-xs">
                        {/* P Trab Logístico (Classe I + Classe II + Classe III) - AGORA EM LARANJA */}
                        {ptrab.totalLogistica !== undefined && (
                          <span className="text-orange-600 font-medium">
                            {formatCurrency(ptrab.totalLogistica)}
                          </span>
                        )}
                        {/* P Trab Operacional (atualmente 0) - AGORA EM AZUL */}
                        {ptrab.totalOperacional !== undefined && (
                          <span className="text-blue-600 font-medium">
                            {formatCurrency(ptrab.totalOperacional)}
                          </span>
                        )}
                        {/* Separador e Total Geral */}
                        {((ptrab.totalLogistica || 0) > 0 || (ptrab.totalOperacional || 0) > 0) && (
                          <>
                            <div className="w-full h-px bg-muted-foreground/30 my-1" />
                            <span className="font-bold text-sm text-foreground">
                              {formatCurrency((ptrab.totalLogistica || 0) + (ptrab.totalOperacional || 0))}
                            </span>
                          </>
                        )}
                        {/* Caso não haja nenhum valor */}
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
                        
                        {/* Botão Aprovar: Aparece SEMPRE se precisar de numeração OU se estiver em status final */}
                        {(needsNumbering(ptrab) || isApprovedOrArchived) && (
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
                          onClick={() => handleSelectPTrab(ptrab.id)}
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
                                onClick={() => handleArchive(ptrab.id, `${ptrab.numero_ptrab} - ${ptrab.nome_operacao}`)}
                              >
                                <Archive className="mr-2 h-4 w-4" />
                                Arquivar
                              </DropdownMenuItem>
                            )}
                            
                            {/* Ação 5: Reativar (Disponível APENAS se estiver arquivado) */}
                            {ptrab.status === 'arquivado' && (
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
                            
                            {/* Ação 6: Excluir (Sempre disponível) */}
                            <DropdownMenuItem 
                              onClick={() => handleDelete(ptrab.id)}
                              className="text-red-600"
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
              Tem certeza que deseja reativar o P Trab "{ptrabToReactivateName}" para "Em Andamento"? Isso permitirá novas edições.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleConfirmReactivateStatus}>Confirmar Reativação</AlertDialogAction>
            <AlertDialogCancel onClick={handleCancelReactivateStatus}>Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
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

      {/* Diálogo de Consolidação */}
      <PTrabConsolidationDialog
        open={showConsolidationDialog}
        onOpenChange={setShowConsolidationDialog}
        pTrabsList={pTrabs.map(p => ({ id: p.id, numero_ptrab: p.numero_ptrab, nome_operacao: p.nome_operacao }))}
        existingPTrabNumbers={existingPTrabNumbers}
        onConfirm={handleConfirmConsolidation}
        loading={loading}
      />
    </div>
  );
};

export default PTrabManager;