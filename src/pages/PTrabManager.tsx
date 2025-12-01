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
  DialogClose
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Edit, Trash2, LogOut, FileText, Printer, Settings, PenSquare, MoreVertical, Pencil, Copy, FileSpreadsheet, Download, MessageSquare, ArrowRight, HelpCircle, CheckCircle } from "lucide-react";
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
import { generateUniquePTrabNumber, generateVariationPTrabNumber, isPTrabNumberDuplicate } from "@/lib/ptrabNumberUtils";
import PTrabConsolidationDialog from "@/components/PTrabConsolidationDialog";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { HelpDialog } from "@/components/HelpDialog";

// Define a base type for PTrab data fetched from DB, including the missing 'origem' field
type PTrabDB = Tables<'p_trab'> & {
  origem: 'original' | 'importado' | 'consolidado';
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
  // existingPTrabNumbers agora armazena o número COMPLETO (ex: 1/2025/OM)
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
  const [ptrabToClone, setPtrabToClone] = useState<PTrab | null>(null);
  const [cloneType, setCloneType, ] = useState<'new' | 'variation'>('new');
  const [suggestedCloneNumber, setSuggestedCloneNumber] = useState<string>(""); // Ex: 1/2025
  const [customCloneNumber, setCustomCloneNumber] = useState<string>(""); // Ex: 1/2025

  // Estados para o diálogo de comentário
  const [showComentarioDialog, setShowComentarioDialog] = useState(false);
  const [ptrabComentario, setPtrabComentario] = useState<PTrab | null>(null);
  const [comentarioText, setComentarioText] = useState("");

  // NOVO ESTADO: Diálogo de Consolidação
  const [showConsolidationDialog, setShowConsolidationDialog] = useState(false);
  
  // NOVO ESTADO: Diálogo de Aprovação/Numeração
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [ptrabToApprove, setPtrabToApprove] = useState<PTrab | null>(null);
  const [suggestedApproveNumber, setSuggestedApproveNumber] = useState<string>(""); // Ex: 1/2025
  const [customApproveNumber, setCustomApproveNumber] = useState<string>(""); // Ex: 1/2025


  const currentYear = new Date().getFullYear();
  const yearSuffix = `/${currentYear}`;

  // Função de reset do formulário (usando useCallback para evitar recriação desnecessária)
  const resetForm = useCallback(() => {
    setEditingId(null);
    setSelectedOmId(undefined);
    setFormData({
      numero_ptrab: "MINUTA", // Valor obrigatório para Minuta
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
      status: "minuta", // Novo status inicial
      origem: 'original',
    });
  }, []);

  const [formData, setFormData] = useState({
    numero_ptrab: "MINUTA",
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
    status: "minuta" as 'minuta' | 'aberto' | 'em_andamento' | 'completo' | 'arquivado' | 'aprovado',
    origem: 'original' as 'original' | 'importado' | 'consolidado',
  });

  const [selectedOmId, setSelectedOmId] = useState<string | undefined>(undefined);

  const { handleEnterToNextField } = useFormNavigation();

  useEffect(() => {
    checkAuth();
    loadPTrabs();
  }, []);

  // Efeito para atualizar o número sugerido no diálogo de clonagem
  useEffect(() => {
    if (ptrabToClone) {
      // Se o PTrab original não tem número (é minuta), usa o próximo número base
      const baseNumber = ptrabToClone.numero_ptrab || generateUniquePTrabNumber(existingPTrabNumbers);
      
      let newSuggestedNumber = "";
      if (cloneType === 'new') {
        newSuggestedNumber = generateUniquePTrabNumber(existingPTrabNumbers);
      } else { // 'variation'
        // Se for variação, usa o número base do original (se existir)
        newSuggestedNumber = generateVariationPTrabNumber(baseNumber, existingPTrabNumbers);
      }
      setSuggestedCloneNumber(newSuggestedNumber);
      setCustomCloneNumber(newSuggestedNumber); // Inicializa o campo editável com a sugestão
    }
  }, [ptrabToClone, cloneType, existingPTrabNumbers]);
  
  // Efeito para atualizar o número sugerido no diálogo de aprovação
  useEffect(() => {
    if (ptrabToApprove) {
      const newSuggestedNumber = generateUniquePTrabNumber(existingPTrabNumbers);
      setSuggestedApproveNumber(newSuggestedNumber);
      setCustomApproveNumber(newSuggestedNumber);
    }
  }, [ptrabToApprove, existingPTrabNumbers]);


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

  const loadPTrabs = async () => {
    try {
      const { data: pTrabsData, error: pTrabsError } = await supabase
        .from("p_trab")
        .select("*, comentario, origem")
        .order("created_at", { ascending: false });

      if (pTrabsError) throw pTrabsError;

      if (!Array.isArray(pTrabsData)) {
        console.error("Invalid data received from p_trab table");
        setPTrabs([]);
        return;
      }

      // Cast pTrabsData to the expected structure PTrabDB[]
      const typedPTrabsData = pTrabsData as unknown as PTrabDB[];

      // Filtra apenas números válidos (não 'MINUTA') para a lista de números existentes
      // Agora, armazena o número COMPLETO (ex: 1/2025/OM)
      const numbers = (typedPTrabsData || [])
        .map(p => p.numero_ptrab)
        .filter((num): num is string => !!num && num !== 'MINUTA');
        
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
          ptrab.status === 'completo' &&
          new Date(ptrab.updated_at) < tenDaysAgo &&
          !promptedForArchive.current.has(ptrab.id)
        ) {
          setPtrabToArchiveId(ptrab.id);
          setPtrabToArchiveName(`${ptrab.numero_ptrab || 'MINUTA'} - ${ptrab.nome_operacao}`);
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
  };

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

  const statusConfig = {
    'minuta': { 
      variant: 'outline' as const, 
      label: 'Minuta',
      className: 'bg-gray-100 text-gray-800 hover:bg-gray-200'
    },
    'aberto': { 
      variant: 'default' as const, 
      label: 'Aberto',
      className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
    },
    'em_andamento': { 
      variant: 'secondary' as const, 
      label: 'Em Andamento',
      className: 'bg-blue-100 text-blue-800 hover:bg-blue-200'
    },
    'completo': { 
      variant: 'default' as const, 
      label: 'Completo',
      className: 'bg-green-100 text-green-800 hover:bg-green-200'
    },
    'aprovado': { 
      variant: 'default' as const, 
      label: 'Aprovado',
      className: 'bg-primary/10 text-primary hover:bg-primary/20'
    },
    'arquivado': { 
      variant: 'outline' as const, 
      label: 'Arquivado',
      className: 'bg-gray-100 text-gray-800 hover:bg-gray-200'
    }
  };

  const handleStatusChange = async (ptrabId: string, oldStatus: string, newStatus: string) => {
    if (oldStatus === 'completo' && newStatus === 'em_andamento') {
      const ptrab = pTrabs.find(p => p.id === ptrabId);
      if (ptrab) {
        setPtrabToReactivateId(ptrab.id);
        setPtrabToReactivateName(`${ptrab.numero_ptrab || 'MINUTA'} - ${ptrab.nome_operacao}`);
        setShowReactivateStatusDialog(true);
      }
      return;
    }
    
    // Se tentar mudar de 'minuta' para 'aprovado', abre o diálogo de aprovação
    if (oldStatus === 'minuta' && newStatus === 'aprovado') {
        const ptrab = pTrabs.find(p => p.id === ptrabId);
        if (ptrab) {
            setPtrabToApprove(ptrab);
            setShowApproveDialog(true);
        }
        return;
    }

    try {
      const { error } = await supabase
        .from("p_trab")
        .update({ status: newStatus })
        .eq("id", ptrabId);

      if (error) throw error;

      toast.success("Status atualizado com sucesso!");
      loadPTrabs();
    } catch (error: any) {
      toast.error("Erro ao atualizar status");
      console.error(error);
    }
  };

  const handleConfirmReactivateStatus = async () => {
    if (!ptrabToReactivateId) return;

    try {
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

  // Removido handleNumeroPTrabChange pois o campo foi removido do formulário principal

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Se estiver editando um PTrab JÁ NUMERADO, verifica duplicidade
      if (editingId && formData.numero_ptrab && formData.numero_ptrab !== 'MINUTA') {
        const isDuplicate = isPTrabNumberDuplicate(formData.numero_ptrab, existingPTrabNumbers) && 
                           formData.numero_ptrab !== pTrabs.find(p => p.id === editingId)?.numero_ptrab;

        if (isDuplicate) {
          toast.error("Já existe um P Trab com este número. Por favor, proponha outro.");
          setLoading(false);
          return;
        }
      }
      
      // O numero_ptrab é sempre 'MINUTA' na criação/edição de minuta
      const finalNumeroPTrab = formData.status === 'minuta' ? 'MINUTA' : formData.numero_ptrab;

      const ptrabData = {
        ...formData,
        numero_ptrab: finalNumeroPTrab,
        user_id: user.id,
        origem: editingId ? formData.origem : 'original',
      };

      if (editingId) {
        const { error } = await supabase.from("p_trab").update(ptrabData).eq("id", editingId);
        if (error) throw error;
        toast.success("P Trab atualizado!");
      } else {
        const { error } = await supabase.from("p_trab").insert([ptrabData]);
        if (error) throw error;
        toast.success("Minuta criada!");
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
    setSelectedOmId(ptrab.codug_om ? ptrab.codug_om : undefined); // Usando CODUG como ID temporário para OmSelector
    setFormData({
      numero_ptrab: ptrab.numero_ptrab || "MINUTA",
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
      status: ptrab.status as 'minuta' | 'aberto' | 'em_andamento' | 'completo' | 'arquivado' | 'aprovado',
      origem: ptrab.origem,
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

  // Função para executar o processo de clonagem
  const executeCloningProcess = async (originalPTrabId: string, newNumeroPTrab: string) => {
    setLoading(true);
    try {
      // 1. Fetch the original PTrab
      const { data: originalPTrab, error: fetchPTrabError } = await supabase
        .from("p_trab")
        .select("*, origem") // Ensure 'origem' is selected
        .eq("id", originalPTrabId)
        .single();

      if (fetchPTrabError || !originalPTrab) {
        console.error("ERRO AO CARREGAR P TRAB ORIGINAL:", fetchPTrabError);
        throw new Error("Erro ao carregar o P Trab original.");
      }
      
      const typedOriginalPTrab = originalPTrab as unknown as PTrabDB; // Cast to PTrabDB

      // 2. Create the new PTrab object
      // Destructure only fields present in the DB schema (PTrabDB)
      const { id, created_at, updated_at, totalLogistica, totalOperacional, numero_ptrab, status, ...restOfPTrab } = typedOriginalPTrab; 
      
      const newPTrabData: TablesInsert<'p_trab'> & { origem: PTrabDB['origem'] } = {
        ...restOfPTrab,
        numero_ptrab: "MINUTA", // Sempre começa como MINUTA
        status: "minuta", // Clones sempre começam como minuta
        user_id: (await supabase.auth.getUser()).data.user?.id!,
        origem: typedOriginalPTrab.origem,
      };

      const { data: newPTrab, error: insertPTrabError } = await supabase
        .from("p_trab")
        .insert([newPTrabData as TablesInsert<'p_trab'>]) // Cast to TablesInsert<'p_trab'>
        .select()
        .single();

      if (insertPTrabError || !newPTrab) {
        console.error("ERRO DE INSERÇÃO P TRAB:", insertPTrabError);
        throw new Error("Erro ao criar o novo P Trab.");
      }

      const newPTrabId = newPTrab.id;

      // 3. Clone Classe I records
      const { data: originalClasseIRecords, error: fetchClasseIError } = await supabase
        .from("classe_i_registros")
        .select("*")
        .eq("p_trab_id", originalPTrabId);

      if (fetchClasseIError) {
        console.error("Erro ao carregar registros da Classe I:", fetchClasseIError);
      } else {
        const newClasseIRecords = (originalClasseIRecords || []).map(record => {
          const { id, created_at, updated_at, ...restOfRecord } = record;
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
      
      // 4. Clone Classe II records (NOVO)
      const { data: originalClasseIIRecords, error: fetchClasseIIError } = await supabase
        .from("classe_ii_registros")
        .select("*, itens_equipamentos")
        .eq("p_trab_id", originalPTrabId);

      if (fetchClasseIIError) {
        console.error("Erro ao carregar registros da Classe II:", fetchClasseIIError);
      } else {
        const newClasseIIRecords = (originalClasseIIRecords || []).map(record => {
          const { id, created_at, updated_at, ...restOfRecord } = record;
          return {
            ...restOfRecord,
            p_trab_id: newPTrabId,
            itens_equipamentos: record.itens_equipamentos ? JSON.parse(JSON.stringify(record.itens_equipamentos)) : null,
            // Garantir que campos numéricos NOT NULL sejam números
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

      // 5. Clone Classe III records
      const { data: originalClasseIIIRecords, error: fetchClasseIIIError } = await supabase
        .from("classe_iii_registros")
        .select("*")
        .eq("p_trab_id", originalPTrabId);

      if (fetchClasseIIIError) {
        console.error("Erro ao carregar registros da Classe III:", fetchClasseIIIError);
      } else {
        const newClasseIIIRecords = (originalClasseIIIRecords || []).map(record => {
          const { id, created_at, updated_at, ...restOfRecord } = record;
          return {
            ...restOfRecord,
            p_trab_id: newPTrabId,
            itens_equipamentos: record.itens_equipamentos ? JSON.parse(JSON.stringify(record.itens_equipamentos)) : null,
            // Garantir que campos numéricos NOT NULL sejam números
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

      // 6. Clone p_trab_ref_lpc record (if exists)
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
        };
        const { error: insertRefLPCError } = await supabase
          .from("p_trab_ref_lpc")
          .insert([newRefLPCData]);
        if (insertRefLPCError) {
          console.error("ERRO DE INSERÇÃO REF LPC:", insertRefLPCError);
          toast.error(`Erro ao clonar referência LPC: ${sanitizeError(insertRefLPCError)}`);
        }
      }

      toast.success(`Minuta clonada com sucesso!`);
      await loadPTrabs();
      
      // Limpar todos os estados relacionados ao diálogo de clonagem
      setPtrabToClone(null);
      setCloneType('new');
      setSuggestedCloneNumber("");
      setCustomCloneNumber("");
      setShowCloneOptionsDialog(false);
    } catch (error: any) {
      console.error("ERRO GERAL AO CLONAR P TRAB (RAW):", error);
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

  // Função para confirmar a clonagem a partir do diálogo
  const handleConfirmClone = async () => {
    if (!ptrabToClone) return;
    
    // O número sugerido/customizado é apenas o número base (ex: 1/2025)
    let finalNumberBase = "";
    if (cloneType === 'variation') {
        // Se for variação, usa o número base do original (se existir)
        finalNumberBase = generateVariationPTrabNumber(ptrabToClone.numero_ptrab || `1${yearSuffix}`, existingPTrabNumbers);
    } else {
        // Se for novo, usa o campo customizável e valida
        if (!customCloneNumber.trim()) {
            toast.error("Número do P Trab para o clone é obrigatório.");
            return;
        }
        // A validação de duplicidade é complexa aqui, pois o número final inclui a OM.
        // Por enquanto, validamos apenas o número base para evitar conflitos óbvios.
        // A validação final de duplicidade (com OM) ocorrerá na aprovação.
        finalNumberBase = customCloneNumber;
    }

    // Não fechar o diálogo aqui - deixar executeCloningProcess fazer isso após sucesso
    await executeCloningProcess(ptrabToClone.id, finalNumberBase);
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
  // LÓGICA DE APROVAÇÃO / NUMERAÇÃO
  // =================================================================
  
  const handleConfirmApprove = async () => {
    if (!ptrabToApprove || !customApproveNumber.trim()) {
        toast.error("O número do P Trab é obrigatório.");
        return;
    }
    
    // 1. Construir o número final no formato: número/ano/OM
    const omSigla = ptrabToApprove.nome_om.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const finalNumeroPTrab = `${customApproveNumber}/${omSigla}`;
    
    // 2. Validar duplicidade do número COMPLETO
    const isDuplicate = isPTrabNumberDuplicate(finalNumeroPTrab, existingPTrabNumbers);
    if (isDuplicate) {
        toast.error(`O número ${finalNumeroPTrab} já existe. Por favor, altere o número base.`);
        return;
    }
    
    setLoading(true);
    try {
        const { error } = await supabase
            .from("p_trab")
            .update({ 
                numero_ptrab: finalNumeroPTrab, 
                status: 'aprovado' 
            })
            .eq("id", ptrabToApprove.id);

        if (error) throw error;

        toast.success(`P Trab ${finalNumeroPTrab} aprovado e numerado com sucesso!`);
        setShowApproveDialog(false);
        setPtrabToApprove(null);
        loadPTrabs();
    } catch (error) {
        console.error("Erro ao aprovar P Trab:", error);
        toast.error(sanitizeError(error));
    } finally {
        setLoading(false);
    }
  };

  // =================================================================
  // LÓGICA DE CONSOLIDAÇÃO
  // =================================================================

  const handleConfirmConsolidation = async (
    sourcePTrabIds: string[],
    targetPTrabId: string | 'new',
    newPTrabNumberBase?: string, // Agora é o número base (ex: 1/2025)
    templatePTrabId?: string
  ) => {
    if (!sourcePTrabIds.length) return;

    setLoading(true);
    setShowConsolidationDialog(false);
    let finalTargetPTrabId: string;
    let targetPTrab: PTrab | undefined;
    let finalNumeroPTrab: string | null = null;

    try {
      // 1. Determinar ou Criar o P Trab de Destino
      if (targetPTrabId === 'new') {
        if (!newPTrabNumberBase || !templatePTrabId) throw new Error("Dados de criação incompletos.");
        
        const templatePTrab = pTrabs.find(p => p.id === templatePTrabId);
        if (!templatePTrab) throw new Error("P Trab template não encontrado.");
        
        // Construir o número final (número/ano/OM)
        const omSigla = templatePTrab.nome_om.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        finalNumeroPTrab = `${newPTrabNumberBase}/${omSigla}`;
        
        // Validar duplicidade do número COMPLETO
        if (isPTrabNumberDuplicate(finalNumeroPTrab, existingPTrabNumbers)) {
            throw new Error(`O número consolidado ${finalNumeroPTrab} já existe. Por favor, altere o número base.`);
        }

        // FIX: Explicitly exclude calculated fields and IDs
        const { id, created_at, updated_at, totalLogistica, totalOperacional, numero_ptrab, status, ...restOfPTrab } = templatePTrab;
        
        const newPTrabData: TablesInsert<'p_trab'> & { origem: PTrabDB['origem'] } = {
          ...restOfPTrab,
          numero_ptrab: finalNumeroPTrab, // Número completo
          status: "aprovado", // PTrabs consolidados são aprovados diretamente
          user_id: (await supabase.auth.getUser()).data.user?.id!,
          nome_operacao: `CONSOLIDADO - ${templatePTrab.nome_operacao}`,
          origem: 'consolidado',
        };

        const { data: newPTrab, error: insertPTrabError } = await supabase
          .from("p_trab")
          .insert([newPTrabData as TablesInsert<'p_trab'>]) // Cast to TablesInsert<'p_trab'>
          .select()
          .single();

        if (insertPTrabError || !newPTrab) throw insertPTrabError;
        finalTargetPTrabId = newPTrab.id;
        targetPTrab = { ...newPTrab, origem: 'consolidado' } as PTrab;
        toast.success(`Novo P Trab ${finalNumeroPTrab} criado para consolidação.`);
      } else {
        finalTargetPTrabId = targetPTrabId;
        targetPTrab = pTrabs.find(p => p.id === finalTargetPTrabId);
        if (!targetPTrab) throw new Error("P Trab de destino existente não encontrado.");
        
        // Se o P Trab de destino já existe, atualize a origem para 'consolidado' e status para 'aprovado'
        const { error: updateOriginError } = await supabase
          .from("p_trab")
          .update({ origem: 'consolidado', status: 'aprovado' } as TablesUpdate<'p_trab'>)
          .eq("id", finalTargetPTrabId);
          
        if (updateOriginError) console.error("Erro ao atualizar origem para consolidado:", updateOriginError);
        targetPTrab = { ...targetPTrab, origem: 'consolidado' } as PTrab;
        finalNumeroPTrab = targetPTrab.numero_ptrab;
      }

      // 2. Clonar e Inserir Registros de Classes (Lógica de clonagem mantida)
      let totalRecordsCloned = 0;

      for (const sourceId of sourcePTrabIds) {
        // Clonar Classe I
        const { data: classeIRecords } = await supabase
          .from("classe_i_registros")
          .select("*")
          .eq("p_trab_id", sourceId);

        if (classeIRecords && classeIRecords.length > 0) {
          const recordsToInsert = classeIRecords.map(record => {
            const { id, created_at, updated_at, ...rest } = record;
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
            const { id, created_at, updated_at, ...rest } = record;
            return { ...rest, p_trab_id: finalTargetPTrabId, itens_equipamentos: record.itens_equipamentos ? JSON.parse(JSON.stringify(record.itens_equipamentos)) : null };
          });
          const { error } = await supabase.from("classe_ii_registros").insert(recordsToInsert as Tables<'classe_ii_registros'>[]);
          if (error) console.error(`Erro ao clonar Classe II de ${sourceId}:`, error);
          totalRecordsCloned += recordsToInsert.length;
        }

        // Clonar Classe III
        const { data: classeIIIRecords } = await supabase
          .from("classe_iii_registros")
          .select("*")
          .eq("p_trab_id", sourceId);

        if (classeIIIRecords && classeIIIRecords.length > 0) {
          const recordsToInsert = classeIIIRecords.map(record => {
            const { id, created_at, updated_at, ...rest } = record;
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
          const { id, created_at, updated_at, ...rest } = sourceRefLPC;
          const { error } = await supabase.from("p_trab_ref_lpc").insert([{ ...rest, p_trab_id: finalTargetPTrabId }]);
          if (error) console.error("Erro ao clonar Ref LPC:", error);
        }
      }

      toast.success(`Consolidação concluída! ${totalRecordsCloned} registros copiados para ${finalNumeroPTrab}.`);
      loadPTrabs();
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const isConsolidationDisabled = pTrabs.length < 2;
  const consolidationTooltipText = "Consolidar dados de múltiplos P Trabs em um único destino.";
    
  // Mensagem detalhada para quando a consolidação está desativada
  const getConsolidationDisabledMessage = () => {
    return "É necessário ter pelo menos 2 Planos de Trabalho cadastrados para realizar a consolidação. Cadastre mais P Trabs para habilitar esta função.";
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
                  Nova Minuta
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Editar P Trab" : "Nova Minuta de P Trab"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* L1L: Número do P Trab (REMOVIDO DO FORMULÁRIO PRINCIPAL) */}
                    <div className="space-y-2">
                      <Label htmlFor="numero_ptrab_display">Número do P Trab</Label>
                      <Input
                        id="numero_ptrab_display"
                        value={formData.numero_ptrab}
                        readOnly
                        disabled
                        className="disabled:opacity-100 font-bold"
                      />
                      <p className="text-xs text-muted-foreground">
                          O número será atribuído no momento da aprovação.
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
                      <Label htmlFor="local_om">Local da OM</Label>
                      <Input
                        id="local_om"
                        value={formData.local_om}
                        onChange={(e) => setFormData({ ...formData, local_om: e.target.value })}
                        placeholder="Ex: Marabá/PA"
                        maxLength={200}
                        onKeyDown={handleEnterToNextField}
                      />
                    </div>
                    {/* L5R: Nome do Comandante da OM */}
                    <div className="space-y-2">
                      <Label htmlFor="nome_cmt_om">Nome do Comandante da OM</Label>
                      <Input
                        id="nome_cmt_om"
                        value={formData.nome_cmt_om}
                        onChange={(e) => setFormData({ ...formData, nome_cmt_om: e.target.value })}
                        maxLength={200}
                        onKeyDown={handleEnterToNextField}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="acoes">Ações realizadas ou a serem realizadas</Label>
                    <Textarea
                      id="acoes"
                      value={formData.acoes}
                      onChange={(e) => setFormData({ ...formData, acoes: e.target.value })}
                      rows={4}
                      maxLength={2000}
                      onKeyDown={handleEnterToNextField}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="submit" disabled={loading}>
                      {loading ? "Aguarde..." : (editingId ? "Atualizar" : "Criar Minuta")}
                    </Button>
                    <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                  </div>
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
                  const isMinuta = ptrab.status === 'minuta';
                  const isApproved = ptrab.status === 'aprovado';
                  
                  return (
                  <TableRow key={ptrab.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col items-center">
                        <span>{ptrab.numero_ptrab || 'MINUTA'}</span>
                        <Badge 
                          variant="outline" 
                          className={`mt-1 text-xs font-semibold ${originBadge.className}`}
                        >
                          {originBadge.label}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>{ptrab.nome_operacao}</TableCell>
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
                        <Select
                          value={ptrab.status}
                          onValueChange={(value) => handleStatusChange(ptrab.id, ptrab.status, value)}
                          disabled={isApproved} // Não permite mudar o status de um PTrab aprovado
                        >
                          <SelectTrigger className={`w-[140px] h-7 text-xs ${statusConfig[ptrab.status as keyof typeof statusConfig]?.className || 'bg-background'}`}>
                            <SelectValue>
                              {statusConfig[ptrab.status as keyof typeof statusConfig]?.label || ptrab.status}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="bg-background border shadow-lg z-50">
                            {Object.entries(statusConfig).map(([key, config]) => (
                              <SelectItem 
                                key={key} 
                                value={key}
                                className="cursor-pointer hover:bg-accent"
                                disabled={isApproved && key !== 'aprovado'} // Se aprovado, só pode ser selecionado 'aprovado'
                              >
                                <span className={`inline-block px-2 py-1 rounded text-xs ${config.className}`}>
                                  {config.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                                  ptrab.comentario 
                                    ? "text-green-600 fill-green-600" 
                                    : "text-gray-300"
                                }`}
                              />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{ptrab.comentario ? "Editar comentário" : "Adicionar comentário"}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {isMinuta && (
                            <Button
                                onClick={() => {
                                    setPtrabToApprove(ptrab);
                                    setShowApproveDialog(true);
                                }}
                                size="sm"
                                variant="default"
                                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                            >
                                <CheckCircle className="h-4 w-4" />
                                Aprovar
                            </Button>
                        )}
                        <Button
                          onClick={() => handleSelectPTrab(ptrab.id)}
                          size="sm"
                          className="flex items-center gap-2"
                          disabled={ptrab.status === 'completo' || ptrab.status === 'arquivado' || isApproved}
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
                            <DropdownMenuItem onClick={() => handleNavigateToPrintOrExport(ptrab.id)}>
                              <Printer className="mr-2 h-4 w-4" />
                              Visualizar Impressão
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(ptrab)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar P Trab
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenCloneOptions(ptrab)}>
                              <Copy className="mr-2 h-4 w-4" />
                              Clonar P Trab
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
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
              O P Trab "{ptrabToArchiveName}" está com status "Completo" há mais de 10 dias. Deseja arquivá-lo?
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

      {/* Diálogo de Aprovação / Numeração */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                Aprovar e Numerar P Trab
            </DialogTitle>
            <DialogDescription>
              Atribua o número oficial do P Trab para a minuta: <span className="font-medium">{ptrabToApprove?.nome_operacao}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="approve-number">Número Base do P Trab (Ex: 1/2025) *</Label>
              <Input
                id="approve-number"
                value={customApproveNumber}
                onChange={(e) => setCustomApproveNumber(e.target.value)}
                placeholder={suggestedApproveNumber}
                maxLength={10}
                required
                onKeyDown={handleEnterToNextField}
              />
              <p className="text-xs text-muted-foreground">
                Sugestão: {suggestedApproveNumber}
              </p>
            </div>
            <div className="space-y-2 p-3 border rounded-md bg-muted/50">
                <Label>Número Final Proposto</Label>
                <p className="font-bold text-sm">
                    {customApproveNumber.trim() ? `${customApproveNumber}/${ptrabToApprove?.nome_om.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}` : 'Aguardando número base...'}
                </p>
                <p className="text-xs text-destructive">
                    Atenção: O número final deve ser único.
                </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleConfirmApprove} disabled={loading || !customApproveNumber.trim() || isPTrabNumberDuplicate(`${customApproveNumber}/${ptrabToApprove?.nome_om.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`, existingPTrabNumbers)}>
              {loading ? "Aprovando..." : "Aprovar e Numerar"}
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Opções de Clonagem */}
      <Dialog open={showCloneOptionsDialog} onOpenChange={setShowCloneOptionsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clonar Plano de Trabalho</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Clonando: <span className="font-medium">{ptrabToClone?.numero_ptrab || 'MINUTA'} - {ptrabToClone?.nome_operacao}</span>
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
                <span className="mb-3 text-lg font-semibold">Novo Trabalho</span>
                <p className="text-sm text-muted-foreground text-center">
                  Cria uma nova Minuta com o próximo número oficial sugerido.
                </p>
              </Label>
              <Label
                htmlFor="clone-variation"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
              >
                <RadioGroupItem id="clone-variation" value="variation" className="sr-only" />
                <span className="mb-3 text-lg font-semibold">Variação do Trabalho</span>
                <p className="text-sm text-muted-foreground text-center">
                  Cria uma nova Minuta com um número de variação (ex: {ptrabToClone?.numero_ptrab?.split('/')[0] || '1'}.1/{currentYear}).
                </p>
              </Label>
            </RadioGroup>

            <div className="space-y-2">
              <Label htmlFor="clone-number">Número Base Sugerido (Ex: 1/2025)</Label>
              <Input
                id="clone-number"
                value={customCloneNumber}
                onChange={(e) => setCustomCloneNumber(e.target.value)}
                placeholder={suggestedCloneNumber}
                maxLength={10}
                disabled={cloneType === 'variation'}
                onKeyDown={handleEnterToNextField}
              />
              <p className="text-xs text-muted-foreground">
                Este número será usado como base para a numeração oficial na aprovação.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleConfirmClone}>Confirmar Clone</Button>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Comentário */}
      <Dialog open={showComentarioDialog} onOpenChange={setShowComentarioDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Comentário do P Trab</DialogTitle>
            {ptrabComentario && (
              <p className="text-sm text-muted-foreground">
                {ptrabComentario.numero_ptrab || 'MINUTA'} - {ptrabComentario.nome_operacao}
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

      {/* Diálogo de Consolidação */}
      <PTrabConsolidationDialog
        open={showConsolidationDialog}
        onOpenChange={setShowConsolidationDialog}
        pTrabsList={pTrabs.map(p => ({ id: p.id, numero_ptrab: p.numero_ptrab || 'MINUTA', nome_operacao: p.nome_operacao }))}
        existingPTrabNumbers={existingPTrabNumbers}
        onConfirm={handleConfirmConsolidation}
        loading={loading}
      />
    </div>
  );
};

export default PTrabManager;