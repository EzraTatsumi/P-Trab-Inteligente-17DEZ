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
import { formatCurrency, formatDate } from "@/lib/formatUtils";
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
import ShareLinkDialog from "@/components/ShareLinkDialog";
import LinkPTrabDialog from "@/components/LinkPTrabDialog";
import ManageSharingDialog from "@/components/ManageSharingDialog";
import UnlinkPTrabDialog from "@/components/UnlinkPTrabDialog";

// Define the union of all table names based on the generated types.ts
type TableName = 
    'classe_i_registros' | 'classe_ii_registros' | 'classe_iii_registros' | 
    'classe_v_registros' | 'classe_vi_registros' | 'classe_vii_registros' | 
    'classe_viii_remonta_registros' | 'classe_viii_saude_registros' | 'classe_ix_registros' |
    'diaria_registros' | 'diretrizes_classe_ii' | 'diretrizes_custeio' | 
    'diretrizes_equipamentos_classe_iii' | 'diretrizes_passagens' | 'organizacoes_militares' | 
    'p_trab' | 'p_trab_ref_lpc' | 'passagem_registros' | 'profiles' | 
    'ptrab_share_requests' | 'verba_operacional_registros';

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

const PTrabManager = () => {
  const navigate = useNavigate();
  const { session, isLoading: isSessionLoading } = useSession();
  const [ptrabs, setPTrabs] = useState<PTrab[]>([]);
  const [oms, setOMs] = useState<OMData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPTrabData, setNewPTrabData] = useState<Partial<TablesInsert<'p_trab'>>>({});
  const [existingPTrabNumbers, setExistingPTrabNumbers] = useState<string[]>([]);
  const [isConsolidationDialogOpen, setIsConsolidationDialogOpen] = useState(false);
  const [selectedPTrabs, setSelectedPTrabs] = useState<string[]>([]);
  const [isCloneVariationDialogOpen, setIsCloneVariationDialogOpen] = useState(false);
  const [ptrabToClone, setPTrabToClone] = useState<PTrab | null>(null);
  const [isCreditPromptOpen, setIsCreditPromptOpen] = useState(false);
  const [userCredits, setUserCredits] = useState({ credit_gnd3: 0, credit_gnd4: 0 });
  const [isManageSharingOpen, setIsManageSharingOpen] = useState(false);
  const [ptrabToManageSharing, setPTrabToManageSharing] = useState<PTrab | null>(null);
  const [shareRequests, setShareRequests] = useState<ShareRequest[]>([]);
  const [isLinkPTrabOpen, setIsLinkPTrabOpen] = useState(false);
  const [isUnlinkPTrabOpen, setIsUnlinkPTrabOpen] = useState(false);
  const [ptrabToUnlink, setPTrabToUnlink] = useState<PTrab | null>(null);
  const [isConsolidationNumberOpen, setIsConsolidationNumberOpen] = useState(false);
  const [consolidationTargetPTrab, setConsolidationTargetPTrab] = useState<PTrab | null>(null);
  const [consolidationType, setConsolidationType] = useState<'new' | 'approval'>('new');
  const [omSiglaForApproval, setOmSiglaForApproval] = useState('');
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [ptrabToDelete, setPTrabToDelete] = useState<PTrab | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [ptrabToArchive, setPTrabToArchive] = useState<PTrab | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [ptrabToRestore, setPTrabToRestore] = useState<PTrab | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchPTrabs = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);
    setError(null);
    setIsRefreshing(true);

    try {
      // 1. Fetch PTrabs (owned or shared)
      const { data: ptrabData, error: ptrabError } = await supabase
        .from('p_trab')
        .select('*')
        .order('updated_at', { ascending: false });

      if (ptrabError) throw ptrabError;

      const currentUserId = session.user.id;
      const allPTrabs: PTrab[] = (ptrabData || []).map(p => ({
        ...p,
        isOwner: p.user_id === currentUserId,
        isShared: (p.shared_with || []).includes(currentUserId),
        hasPendingRequests: false, // Será atualizado na próxima etapa
        origem: p.origem as 'original' | 'importado' | 'consolidado',
      }));
      
      // 2. Fetch pending share requests (only for PTrabs owned by the current user)
      const ownedPTrabIds = allPTrabs.filter(p => p.isOwner).map(p => p.id);
      
      let requests: ShareRequest[] = [];
      if (ownedPTrabIds.length > 0) {
          const { data: requestData, error: requestError } = await supabase
              .from('ptrab_share_requests')
              .select(`
                  *,
                  requester_profile:profiles(id, first_name, last_name, raw_user_meta_data)
              `)
              .in('ptrab_id', ownedPTrabIds)
              .eq('status', 'pending');
              
          if (requestError) {
              console.error("Erro ao buscar solicitações de compartilhamento:", requestError);
          } else {
              requests = requestData as ShareRequest[];
          }
      }
      setShareRequests(requests);

      // Update PTrabs with pending request status
      const finalPTrabs = allPTrabs.map(p => ({
          ...p,
          hasPendingRequests: requests.some(r => r.ptrab_id === p.id),
      }));

      setPTrabs(finalPTrabs);
      setExistingPTrabNumbers(finalPTrabs.map(p => p.numero_ptrab));
      
      // 3. Fetch OMs
      const { data: omData, error: omError } = await supabase
        .from('organizacoes_militares')
        .select('*')
        .eq('user_id', currentUserId)
        .eq('ativo', true);

      if (omError) throw omError;
      setOMs(omData as OMData[]);

    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      setError(sanitizeError(err));
      toast.error(`Falha ao carregar dados: ${sanitizeError(err)}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchPTrabs();
    } else if (!isSessionLoading) {
      // Se não estiver carregando a sessão e não houver sessão, redireciona para o login
      navigate('/login');
    }
  }, [session, isSessionLoading, navigate, fetchPTrabs]);

  // --- Handlers de Ação ---

  const handleCreatePTrab = async (data: Partial<TablesInsert<'p_trab'>>) => {
    if (!session) return;
    
    const newPTrab: TablesInsert<'p_trab'> = {
      user_id: session.user.id,
      numero_ptrab: data.numero_ptrab || generateUniquePTrabNumber(existingPTrabNumbers),
      comando_militar_area: data.comando_militar_area || COMANDOS_MILITARES_AREA[0],
      nome_om: data.nome_om || oms[0]?.nome_om || 'OM Padrão',
      codug_om: data.codug_om || oms[0]?.codug_om || '000000',
      rm_vinculacao: data.rm_vinculacao || oms[0]?.rm_vinculacao || 'RM Padrão',
      codug_rm_vinculacao: data.codug_rm_vinculacao || oms[0]?.codug_rm_vinculacao || '000000',
      nome_operacao: data.nome_operacao || 'Nova Operação',
      periodo_inicio: data.periodo_inicio || new Date().toISOString().split('T')[0],
      periodo_fim: data.periodo_fim || new Date().toISOString().split('T')[0],
      efetivo_empregado: data.efetivo_empregado || '0',
      status: 'aberto',
      origem: 'original',
      // Campos opcionais
      nome_om_extenso: data.nome_om_extenso || null,
      local_om: data.local_om || null,
      nome_cmt_om: data.nome_cmt_om || null,
      acoes: data.acoes || null,
      comentario: data.comentario || null,
    };

    if (isPTrabNumberDuplicate(newPTrab.numero_ptrab, existingPTrabNumbers)) {
        toast.error("O número do PTrab gerado já existe. Tente novamente.");
        return;
    }

    const { data: insertedPTrab, error } = await supabase
      .from('p_trab')
      .insert(newPTrab)
      .select()
      .single();

    if (error) {
      console.error("Erro ao criar PTrab:", error);
      toast.error(`Falha ao criar PTrab: ${sanitizeError(error)}`);
      return;
    }

    toast.success(`PTrab ${insertedPTrab.numero_ptrab} criado com sucesso!`);
    setIsDialogOpen(false);
    fetchPTrabs();
    navigate(`/ptrab/${insertedPTrab.id}`);
  };

  const handleEditPTrab = (ptrab: PTrab) => {
    setNewPTrabData(ptrab);
    setIsDialogOpen(true);
  };

  const handleSavePTrab = async (data: Partial<TablesInsert<'p_trab'>>) => {
    if (!newPTrabData.id) return;

    const updateData: TablesUpdate<'p_trab'> = {
      comando_militar_area: data.comando_militar_area,
      nome_om: data.nome_om,
      codug_om: data.codug_om,
      rm_vinculacao: data.rm_vinculacao,
      codug_rm_vinculacao: data.codug_rm_vinculacao,
      nome_operacao: data.nome_operacao,
      periodo_inicio: data.periodo_inicio,
      periodo_fim: data.periodo_fim,
      efetivo_empregado: data.efetivo_empregado,
      acoes: data.acoes,
      comentario: data.comentario,
      nome_om_extenso: data.nome_om_extenso,
      local_om: data.local_om,
      nome_cmt_om: data.nome_cmt_om,
      updated_at: new Date().toISOString(),
    };

    // Se o número do PTrab foi alterado, verifica duplicidade
    if (data.numero_ptrab && data.numero_ptrab !== newPTrabData.numero_ptrab) {
        const otherNumbers = existingPTrabNumbers.filter(n => n !== newPTrabData.numero_ptrab);
        if (isPTrabNumberDuplicate(data.numero_ptrab, otherNumbers)) {
            toast.error("O número do PTrab já existe. Escolha outro.");
            return;
        }
        updateData.numero_ptrab = data.numero_ptrab;
    }

    const { error } = await supabase
      .from('p_trab')
      .update(updateData)
      .eq('id', newPTrabData.id);

    if (error) {
      console.error("Erro ao salvar PTrab:", error);
      toast.error(`Falha ao salvar PTrab: ${sanitizeError(error)}`);
      return;
    }

    toast.success(`PTrab ${updateData.numero_ptrab} atualizado com sucesso!`);
    setIsDialogOpen(false);
    setNewPTrabData({});
    fetchPTrabs();
  };

  const handleDeletePTrab = async () => {
    if (!ptrabToDelete) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('p_trab')
        .delete()
        .eq('id', ptrabToDelete.id);

      if (error) throw error;

      toast.success(`PTrab ${ptrabToDelete.numero_ptrab} excluído com sucesso.`);
      fetchPTrabs();
    } catch (err) {
      console.error("Erro ao excluir PTrab:", err);
      toast.error(`Falha ao excluir PTrab: ${sanitizeError(err)}`);
    } finally {
      setIsDeleting(false);
      setPTrabToDelete(null);
    }
  };
  
  const handleArchivePTrab = async () => {
    if (!ptrabToArchive) return;
    setIsArchiving(true);

    try {
      const { error } = await supabase
        .from('p_trab')
        .update({ status: 'arquivado', updated_at: new Date().toISOString() })
        .eq('id', ptrabToArchive.id);

      if (error) throw error;

      toast.success(`PTrab ${ptrabToArchive.numero_ptrab} arquivado com sucesso.`);
      fetchPTrabs();
    } catch (err) {
      console.error("Erro ao arquivar PTrab:", err);
      toast.error(`Falha ao arquivar PTrab: ${sanitizeError(err)}`);
    } finally {
      setIsArchiving(false);
      setPTrabToArchive(null);
    }
  };
  
  const handleRestorePTrab = async () => {
    if (!ptrabToRestore) return;
    setIsRestoring(true);

    try {
      const { error } = await supabase
        .from('p_trab')
        .update({ status: 'aberto', updated_at: new Date().toISOString() })
        .eq('id', ptrabToRestore.id);

      if (error) throw error;

      toast.success(`PTrab ${ptrabToRestore.numero_ptrab} restaurado com sucesso.`);
      fetchPTrabs();
    } catch (err) {
      console.error("Erro ao restaurar PTrab:", err);
      toast.error(`Falha ao restaurar PTrab: ${sanitizeError(err)}`);
    } finally {
      setIsRestoring(false);
      setPTrabToRestore(null);
    }
  };

  const handleClonePTrab = async (ptrab: PTrab, cloneType: 'minuta' | 'variation') => {
    if (!session) return;
    
    let newNumber = '';
    let newStatus = 'aberto';
    let newOrigin: 'original' | 'importado' | 'consolidado' = 'original';
    let newRotuloVersao: string | null = null;

    if (cloneType === 'minuta') {
        newNumber = generateUniqueMinutaNumber(existingPTrabNumbers);
        newStatus = 'minuta';
        newRotuloVersao = 'Minuta Inicial';
    } else { // variation
        newNumber = generateVariationPTrabNumber(ptrab.numero_ptrab, existingPTrabNumbers);
        newStatus = 'em_andamento';
        newRotuloVersao = `Variação de ${ptrab.numero_ptrab}`;
    }

    if (isPTrabNumberDuplicate(newNumber, existingPTrabNumbers)) {
        toast.error(`O número ${newNumber} já existe. Tente novamente.`);
        return;
    }

    const newPTrab: TablesInsert<'p_trab'> = {
      user_id: session.user.id,
      numero_ptrab: newNumber,
      comando_militar_area: ptrab.comando_militar_area,
      nome_om: ptrab.nome_om,
      codug_om: ptrab.codug_om,
      rm_vinculacao: ptrab.rm_vinculacao,
      codug_rm_vinculacao: ptrab.codug_rm_vinculacao,
      nome_operacao: ptrab.nome_operacao,
      periodo_inicio: ptrab.periodo_inicio,
      periodo_fim: ptrab.periodo_fim,
      efetivo_empregado: ptrab.efetivo_empregado,
      acoes: ptrab.acoes,
      comentario: ptrab.comentario,
      nome_om_extenso: ptrab.nome_om_extenso,
      local_om: ptrab.local_om,
      nome_cmt_om: ptrab.nome_cmt_om,
      status: newStatus,
      origem: newOrigin,
      rotulo_versao: newRotuloVersao,
    };

    try {
      const { data: insertedPTrab, error } = await supabase
        .from('p_trab')
        .insert(newPTrab)
        .select()
        .single();

      if (error) throw error;

      await cloneRelatedRecords(ptrab.id, insertedPTrab.id);

      toast.success(`PTrab ${newNumber} criado com sucesso!`);
      setIsCloneVariationDialogOpen(false);
      setPTrabToClone(null);
      fetchPTrabs();
      navigate(`/ptrab/${insertedPTrab.id}`);

    } catch (err) {
      console.error("Erro ao clonar PTrab:", err);
      toast.error(`Falha ao clonar PTrab: ${sanitizeError(err)}`);
    }
  };

  const cloneRelatedRecords = async (originalPTrabId: string, newPTrabId: string) => {
    
    const cloneClassRecords = async <T extends TableName>(tableName: T, jsonbField: string, numericFields: string[]) => {
        const { data: originalRecords, error: fetchError } = await supabase
            .from(tableName as T)
            .select(`*, ${jsonbField}`)
            .eq('p_trab_id', originalPTrabId); // Adicionado filtro pelo ID do PTrab original

        if (fetchError) {
            console.error(`Erro ao carregar registros da ${tableName}:`, fetchError);
            return 0;
        }

        const newRecords = (originalRecords || []).map(record => {
            const typedRecord = record as Tables<T>;
            const { id, created_at, updated_at, ...restOfRecord } = typedRecord;
            
            const newRecord: Record<string, any> = {
                ...restOfRecord,
                p_trab_id: newPTrabId,
                [jsonbField]: typedRecord[jsonbField] ? JSON.parse(JSON.stringify(typedRecord[jsonbField])) : null,
            };
            
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

    await cloneClassRecords('classe_ii_registros', 'itens_equipamentos', genericNumericFields);

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
    
    await cloneClassRecords('classe_v_registros', 'itens_equipamentos', genericNumericFields);
    await cloneClassRecords('classe_vi_registros', 'itens_equipamentos', genericNumericFields);
    await cloneClassRecords('classe_vii_registros', 'itens_equipamentos', genericNumericFields);
    await cloneClassRecords('classe_viii_saude_registros', 'itens_saude', genericNumericFields);
    await cloneClassRecords('classe_viii_remonta_registros', 'itens_remonta', [...genericNumericFields, 'quantidade_animais']);
    await cloneClassRecords('classe_ix_registros', 'itens_motomecanizacao', genericNumericFields);
    
    // Registros de Diária
    await cloneClassRecords('diaria_registros', 'quantidades_por_posto', ['dias_operacao', 'nr_viagens', 'quantidade', 'valor_diaria_unitario', 'valor_taxa_embarque', 'valor_total', 'valor_nd_15', 'valor_nd_30']);
    
    // Registros de Passagem
    await cloneClassRecords('passagem_registros', 'detalhamento', ['dias_operacao', 'quantidade_passagens', 'valor_unitario', 'valor_total', 'valor_nd_33']);
    
    // Registros de Verba Operacional
    await cloneClassRecords('verba_operacional_registros', 'detalhamento', ['dias_operacao', 'quantidade_equipes', 'valor_total_solicitado', 'valor_nd_30', 'valor_nd_39']);


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

  const handleConsolidatePTrabs = async (selectedPTrabsToConsolidate: string[], newPTrabId: string) => {
        const tablesToConsolidate: TableName[] = [
            'classe_i_registros', 'classe_ii_registros', 'classe_iii_registros', 
            'classe_v_registros', 'classe_vi_registros', 'classe_vii_registros', 
            'classe_viii_saude_registros', 'classe_viii_remonta_registros', 'classe_ix_registros',
            'diaria_registros', 
            'verba_operacional_registros', 
            'passagem_registros', 
        ];
        
        for (const tableName of tablesToConsolidate) {
            const { data: records, error: recordsError } = await supabase
                .from(tableName as TableName)
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
                    
                    const newRecord: TablesInsert<typeof tableName> = {
                        ...restOfRecord,
                        p_trab_id: newPTrabId,
                        // Tratamento de campos JSONB
                        ...(record.itens_equipamentos ? { itens_equipamentos: JSON.parse(JSON.stringify(record.itens_equipamentos)) } : {}),
                        ...(record.itens_saude ? { itens_saude: JSON.parse(JSON.stringify(record.itens_saude)) } : {}),
                        ...(record.itens_remonta ? { itens_remonta: JSON.parse(JSON.stringify(record.itens_remonta)) } : {}),
                        ...(record.itens_motomecanizacao ? { itens_motomecanizacao: JSON.parse(JSON.stringify(record.itens_motomecanizacao)) } : {}),
                        ...(record.quantidades_por_posto ? { quantidades_por_posto: JSON.parse(JSON.stringify(record.quantidades_por_posto)) } : {}),
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
  };

  // --- Funções de Renderização ---

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aberto':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-400">Aberto</Badge>;
      case 'em_andamento':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-400">Em Andamento</Badge>;
      case 'minuta':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-400">Minuta</Badge>;
      case 'aprovado':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-400">Aprovado</Badge>;
      case 'arquivado':
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-400">Arquivado</Badge>;
      case 'consolidado':
        return <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-400">Consolidado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const getOriginBadge = (origem: string) => {
    switch (origem) {
      case 'original':
        return <Badge variant="secondary" className="bg-gray-200 text-gray-700">Original</Badge>;
      case 'importado':
        return <Badge variant="secondary" className="bg-indigo-200 text-indigo-700">Importado</Badge>;
      case 'consolidado':
        return <Badge variant="secondary" className="bg-purple-200 text-purple-700">Consolidado</Badge>;
      default:
        return null;
    }
  };

  const filteredPTrabs = useMemo(() => {
    return ptrabs.filter(p => showArchived ? p.status === 'arquivado' : p.status !== 'arquivado');
  }, [ptrabs, showArchived]);

  if (isLoading || isSessionLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-muted-foreground">Carregando dados...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-red-600">Erro ao Carregar</h2>
        <p className="text-muted-foreground mt-2">{error}</p>
        <Button onClick={() => fetchPTrabs()} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
        </Button>
      </div>
    );
  }

  // --- JSX Principal ---
  return (
    <div className="p-4 md:p-8 space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
          Gerenciamento de Planos de Trabalho (P Trab)
        </h1>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? <Archive className="h-4 w-4 mr-2" /> : <ArrowDownUp className="h-4 w-4 mr-2" />}
            {showArchived ? 'Ver Ativos' : 'Ver Arquivados'}
          </Button>
          <Button onClick={() => setIsConsolidationDialogOpen(true)} disabled={selectedPTrabs.length < 2}>
            <GitBranch className="h-4 w-4 mr-2" /> Consolidar ({selectedPTrabs.length})
          </Button>
          <Button onClick={() => { setNewPTrabData({}); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Novo P Trab
          </Button>
        </div>
      </header>

      {/* Tabela de PTrabs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl">
            {showArchived ? 'P Trabs Arquivados' : 'P Trabs Ativos'} ({filteredPTrabs.length})
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={fetchPTrabs} disabled={isRefreshing}>
                  <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Atualizar Lista</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      checked={selectedPTrabs.length > 0 && selectedPTrabs.length === filteredPTrabs.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPTrabs(filteredPTrabs.map(p => p.id));
                        } else {
                          setSelectedPTrabs([]);
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Operação</TableHead>
                  <TableHead>OM</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPTrabs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      {showArchived ? 'Nenhum P Trab arquivado encontrado.' : 'Nenhum P Trab ativo encontrado.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPTrabs.map((ptrab) => (
                    <TableRow key={ptrab.id} className={cn(
                        ptrab.status === 'aprovado' && 'bg-green-50/50 hover:bg-green-50',
                        ptrab.status === 'minuta' && 'bg-gray-50/50 hover:bg-gray-50',
                        ptrab.status === 'consolidado' && 'bg-purple-50/50 hover:bg-purple-50',
                        ptrab.status === 'arquivado' && 'opacity-60'
                    )}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={selectedPTrabs.includes(ptrab.id)}
                          onChange={() => {
                            setSelectedPTrabs(prev => 
                              prev.includes(ptrab.id) 
                                ? prev.filter(id => id !== ptrab.id) 
                                : [...prev, ptrab.id]
                            );
                          }}
                          disabled={ptrab.status === 'arquivado'}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                            <span className={cn(ptrab.status === 'aprovado' && 'text-green-700 font-semibold')}>
                                {ptrab.numero_ptrab}
                            </span>
                            {ptrab.hasPendingRequests && ptrab.isOwner && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Users className="h-4 w-4 text-yellow-600 cursor-pointer" onClick={() => { setPTrabToManageSharing(ptrab); setIsManageSharingOpen(true); }} />
                                        </TooltipTrigger>
                                        <TooltipContent>Solicitação de Compartilhamento Pendente</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>
                      </TableCell>
                      <TableCell>{ptrab.nome_operacao}</TableCell>
                      <TableCell>{ptrab.nome_om}</TableCell>
                      <TableCell>{formatDate(ptrab.periodo_inicio)} - {formatDate(ptrab.periodo_fim)}</TableCell>
                      <TableCell>{getStatusBadge(ptrab.status)}</TableCell>
                      <TableCell>{getOriginBadge(ptrab.origem)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menu</span>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => navigate(`/ptrab/${ptrab.id}`)}>
                              <ArrowRight className="mr-2 h-4 w-4" /> Abrir
                            </DropdownMenuItem>
                            
                            {ptrab.status !== 'arquivado' && (
                                <>
                                    <DropdownMenuItem onClick={() => handleEditPTrab(ptrab)}>
                                      <Pencil className="mr-2 h-4 w-4" /> Editar Dados
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { setPTrabToClone(ptrab); setIsCloneVariationDialogOpen(true); }}>
                                      <Copy className="mr-2 h-4 w-4" /> Clonar/Criar Variação
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { setPTrabToArchive(ptrab); }}>
                                      <Archive className="mr-2 h-4 w-4" /> Arquivar
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => navigate(`/ptrab/${ptrab.id}/report`)}>
                                      <Printer className="mr-2 h-4 w-4" /> Gerar Relatório
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => { setPTrabToManageSharing(ptrab); setIsManageSharingOpen(true); }}>
                                      <Share2 className="mr-2 h-4 w-4" /> Gerenciar Compartilhamento
                                    </DropdownMenuItem>
                                </>
                            )}
                            
                            {ptrab.status === 'arquivado' && (
                                <DropdownMenuItem onClick={() => { setPTrabToRestore(ptrab); }}>
                                  <RefreshCw className="mr-2 h-4 w-4" /> Restaurar
                                </DropdownMenuItem>
                            )}
                            
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                                onClick={() => { setPTrabToDelete(ptrab); }}
                                className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Diálogos */}
      
      {/* 1. Novo/Editar PTrab Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{newPTrabData.id ? 'Editar P Trab' : 'Novo Plano de Trabalho'}</DialogTitle>
            <DialogDescription>
              Preencha os dados básicos do Plano de Trabalho.
            </DialogDescription>
          </DialogHeader>
          <PTrabForm 
            initialData={newPTrabData} 
            oms={oms} 
            onSubmit={newPTrabData.id ? handleSavePTrab : handleCreatePTrab} 
            onCancel={() => setIsDialogOpen(false)}
            existingNumbers={existingPTrabNumbers}
          />
        </DialogContent>
      </Dialog>
      
      {/* 2. Consolidação Dialog */}
      <PTrabConsolidationDialog
        open={isConsolidationDialogOpen}
        onOpenChange={setIsConsolidationDialogOpen}
        selectedPTrabs={selectedPTrabs.map(id => filteredPTrabs.find(p => p.id === id)).filter((p): p is PTrab => !!p)}
        onConsolidate={(targetPTrab) => {
            setConsolidationTargetPTrab(targetPTrab);
            setIsConsolidationDialogOpen(false);
            setIsConsolidationNumberOpen(true);
        }}
      />
      
      {/* 3. Consolidation Number Dialog */}
      <ConsolidationNumberDialog
        open={isConsolidationNumberOpen}
        onOpenChange={setIsConsolidationNumberOpen}
        targetPTrab={consolidationTargetPTrab}
        existingNumbers={existingPTrabNumbers}
        omSigla={consolidationTargetPTrab?.nome_om || ''}
        onConfirm={async (newNumber, type) => {
            if (!consolidationTargetPTrab) return;
            
            const newPTrab: TablesInsert<'p_trab'> = {
                ...consolidationTargetPTrab,
                id: undefined, // Ensure new ID is generated
                user_id: session!.user.id,
                numero_ptrab: newNumber,
                status: type === 'approval' ? 'aprovado' : 'consolidado',
                origem: 'consolidado',
                rotulo_versao: type === 'approval' ? 'Aprovado' : 'Consolidado',
                created_at: undefined,
                updated_at: undefined,
                share_token: undefined,
                shared_with: null,
            };
            
            try {
                const { data: insertedPTrab, error } = await supabase
                    .from('p_trab')
                    .insert(newPTrab)
                    .select()
                    .single();

                if (error) throw error;
                
                await handleConsolidatePTrabs(selectedPTrabs, insertedPTrab.id);
                
                toast.success(`PTrab ${newNumber} consolidado com sucesso!`);
                setIsConsolidationNumberOpen(false);
                setSelectedPTrabs([]);
                fetchPTrabs();
                navigate(`/ptrab/${insertedPTrab.id}`);
                
            } catch (err) {
                console.error("Erro ao consolidar PTrab:", err);
                toast.error(`Falha ao consolidar PTrab: ${sanitizeError(err)}`);
            }
        }}
      />
      
      {/* 4. Clonar/Variação Dialog */}
      <CloneVariationDialog
        open={isCloneVariationDialogOpen}
        onOpenChange={setIsCloneVariationDialogOpen}
        ptrab={ptrabToClone}
        onClone={handleClonePTrab}
      />
      
      {/* 5. Gerenciar Compartilhamento Dialog */}
      <ManageSharingDialog
        open={isManageSharingOpen}
        onOpenChange={setIsManageSharingOpen}
        ptrab={ptrabToManageSharing}
        requests={shareRequests.filter(r => r.ptrab_id === ptrabToManageSharing?.id)}
        onUpdate={fetchPTrabs}
      />
      
      {/* 6. Excluir Dialog */}
      <AlertDialog open={!!ptrabToDelete} onOpenChange={() => setPTrabToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja excluir?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o P Trab 
              <span className="font-semibold text-red-600"> {ptrabToDelete?.numero_ptrab}</span> e todos os seus registros associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePTrab} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* 7. Arquivar Dialog */}
      <AlertDialog open={!!ptrabToArchive} onOpenChange={() => setPTrabToArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar P Trab?</AlertDialogTitle>
            <AlertDialogDescription>
              O P Trab <span className="font-semibold"> {ptrabToArchive?.numero_ptrab}</span> será movido para o arquivo. Ele não aparecerá na lista principal, mas poderá ser restaurado a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchivePTrab} disabled={isArchiving} className="bg-yellow-600 hover:bg-yellow-700">
              {isArchiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* 8. Restaurar Dialog */}
      <AlertDialog open={!!ptrabToRestore} onOpenChange={() => setPTrabToRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar P Trab?</AlertDialogTitle>
            <AlertDialogDescription>
              O P Trab <span className="font-semibold"> {ptrabToRestore?.numero_ptrab}</span> será movido de volta para a lista de P Trabs ativos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestorePTrab} disabled={isRestoring}>
              {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* 9. Link PTrab Dialog */}
      <LinkPTrabDialog
        open={isLinkPTrabOpen}
        onOpenChange={setIsLinkPTrabOpen}
        onLinkSuccess={fetchPTrabs}
      />
      
      {/* 10. Unlink PTrab Dialog */}
      <UnlinkPTrabDialog
        open={isUnlinkPTrabOpen}
        onOpenChange={setIsUnlinkPTrabOpen}
        ptrab={ptrabToUnlink}
        onUnlinkSuccess={fetchPTrabs}
      />
      
      {/* 11. Help Dialog */}
      <HelpDialog
        open={isHelpDialogOpen}
        onOpenChange={setIsHelpDialogOpen}
        title="Ajuda - Gerenciamento de P Trabs"
        content="Aqui você pode criar, editar, clonar, consolidar e gerenciar o compartilhamento dos seus Planos de Trabalho. Use a opção 'Clonar/Criar Variação' para criar minutas ou variações de um P Trab existente."
      />
      
      {/* 12. AI Chat Drawer */}
      <AIChatDrawer
        open={isAIOpen}
        onOpenChange={setIsAIOpen}
      />
      
      {/* 13. Credit Prompt Dialog (Placeholder) */}
      <CreditPromptDialog
        open={isCreditPromptOpen}
        onOpenChange={setIsCreditPromptOpen}
        creditsGND3={userCredits.credit_gnd3}
        creditsGND4={userCredits.credit_gnd4}
        onUpdateCredits={async (gnd3, gnd4) => {
            if (session) {
                await updateUserCredits(session.user.id, gnd3, gnd4);
                setUserCredits({ credit_gnd3: gnd3, credit_gnd4: gnd4 });
                toast.success("Créditos atualizados com sucesso!");
            }
        }}
      />
      
      {/* Botões de Ação Flutuantes (Placeholder) */}
      <div className="fixed bottom-4 right-4 flex flex-col space-y-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full shadow-lg" onClick={() => setIsAIOpen(true)}>
                <MessageSquare className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Assistente IA</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full shadow-lg" onClick={() => setIsHelpDialogOpen(true)}>
                <HelpCircle className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ajuda</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full shadow-lg" onClick={() => setIsCreditPromptOpen(true)}>
                <Settings className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Configurar Créditos</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

// --- Componente de Formulário (Mínimo) ---
// Este componente precisa ser definido para que o PTrabManager compile.
interface PTrabFormProps {
    initialData: Partial<TablesInsert<'p_trab'>>;
    oms: OMData[];
    onSubmit: (data: Partial<TablesInsert<'p_trab'>>) => void;
    onCancel: () => void;
    existingNumbers: string[];
}

const PTrabForm: React.FC<PTrabFormProps> = ({ initialData, oms, onSubmit, onCancel, existingNumbers }) => {
    const [data, setData] = useState<Partial<TablesInsert<'p_trab'>>>(initialData);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [omSelecionada, setOmSelecionada] = useState<OMData | undefined>(
        oms.find(om => om.nome_om === initialData.nome_om) || oms[0]
    );
    
    useEffect(() => {
        if (omSelecionada) {
            setData(prev => ({
                ...prev,
                nome_om: omSelecionada.nome_om,
                codug_om: omSelecionada.codug_om,
                rm_vinculacao: omSelecionada.rm_vinculacao,
                codug_rm_vinculacao: omSelecionada.codug_rm_vinculacao,
            }));
        }
    }, [omSelecionada]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        // Simulação de validação mínima
        if (!data.nome_operacao || !data.nome_om) {
            toast.error("Preencha todos os campos obrigatórios.");
            setIsSubmitting(false);
            return;
        }
        
        // Se for um novo PTrab e o número não foi fornecido, gera um
        const finalData = {
            ...data,
            numero_ptrab: data.numero_ptrab || generateUniquePTrabNumber(existingNumbers),
        };
        
        onSubmit(finalData);
        setIsSubmitting(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="numero_ptrab">Número do P Trab (Opcional)</Label>
                    <Input
                        id="numero_ptrab"
                        value={data.numero_ptrab || ''}
                        onChange={(e) => setData({ ...data, numero_ptrab: e.target.value })}
                        placeholder={initialData.id ? 'Manter número atual' : generateUniquePTrabNumber(existingNumbers)}
                        disabled={!!initialData.id}
                    />
                    {initialData.id && <p className="text-xs text-muted-foreground">O número só pode ser alterado se o P Trab não tiver registros associados.</p>}
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor="nome_operacao">Nome da Operação/Atividade *</Label>
                    <Input
                        id="nome_operacao"
                        value={data.nome_operacao || ''}
                        onChange={(e) => setData({ ...data, nome_operacao: e.target.value })}
                        required
                    />
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor="om_selector">OM Detentora do P Trab *</Label>
                    <OmSelector
                        oms={oms}
                        selectedOm={omSelecionada}
                        onSelectOm={setOmSelecionada}
                        placeholder="Selecione a OM"
                    />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="periodo_inicio">Início do Período *</Label>
                        <Input
                            id="periodo_inicio"
                            type="date"
                            value={data.periodo_inicio || ''}
                            onChange={(e) => setData({ ...data, periodo_inicio: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="periodo_fim">Fim do Período *</Label>
                        <Input
                            id="periodo_fim"
                            type="date"
                            value={data.periodo_fim || ''}
                            onChange={(e) => setData({ ...data, periodo_fim: e.target.value })}
                            required
                        />
                    </div>
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor="efetivo_empregado">Efetivo Empregado (Total)</Label>
                    <Input
                        id="efetivo_empregado"
                        type="number"
                        value={data.efetivo_empregado || '0'}
                        onChange={(e) => setData({ ...data, efetivo_empregado: e.target.value })}
                        min="0"
                    />
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor="comando_militar_area">Comando Militar de Área *</Label>
                    <Select
                        value={data.comando_militar_area || COMANDOS_MILITARES_AREA[0]}
                        onValueChange={(value) => setData({ ...data, comando_militar_area: value })}
                        required
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione o CMA" />
                        </SelectTrigger>
                        <SelectContent>
                            {COMANDOS_MILITARES_AREA.map(cma => (
                                <SelectItem key={cma} value={cma}>{cma}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor="comentario">Comentário/Observações</Label>
                    <Textarea
                        id="comentario"
                        value={data.comentario || ''}
                        onChange={(e) => setData({ ...data, comentario: e.target.value })}
                        rows={3}
                    />
                </div>
            </div>
            
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline" onClick={onCancel}>
                        Cancelar
                    </Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {initialData.id ? 'Salvar Alterações' : 'Criar P Trab'}
                </Button>
            </DialogFooter>
        </form>
    );
};

export default PTrabManager;