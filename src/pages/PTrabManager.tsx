import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, FileText, GitBranch, RefreshCw, User, Link, Users, Bell } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import AIChatDrawer from "@/components/AIChatDrawer";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { generateUniqueMinutaNumber, generateApprovalPTrabNumber, isPTrabNumberDuplicate } from "@/lib/ptrabNumberUtils";
import { updateUserCredits } from "@/lib/creditUtils";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { OMData } from "@/lib/omUtils";
import PTrabHeaderActions from "@/components/PTrabHeaderActions";
import PTrabTable from "@/components/PTrabTable";
import PTrabModals from "@/components/PTrabModals";
import { formatCurrency } from "@/lib/formatUtils"; // Importar formatCurrency

// Define a base type for PTrab data fetched from DB, including the missing 'origem' field
export type PTrabDB = Tables<'p_trab'> & {
  origem: 'original' | 'importado' | 'consolidado';
  rotulo_versao: string | null;
  shared_with: string[] | null; // Incluir shared_with
};

export interface SimplePTrab {
  id: string;
  numero_ptrab: string;
  nome_operacao: string;
}

export interface PTrab extends PTrabDB {
  totalLogistica?: number;
  totalOperacional?: number;
  totalMaterialPermanente?: number;
  quantidadeRacaoOp?: number;
  quantidadeHorasVoo?: number;
  isShared: boolean; // Indica se o PTrab está compartilhado com o usuário logado
  pendingRequestsCount: number; // NOVO: Contagem de solicitações pendentes
}

// --- UTILITY FUNCTIONS (Exported for use in PTrabTable) ---

export const statusConfig = {
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

export const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

export const getOriginBadge = (origem: PTrabDB['origem']) => {
  switch (origem) {
      case 'importado':
          return { label: 'Importado', className: 'bg-purple-500 text-white hover:bg-purple-600' };
      case 'consolidado':
          return { label: 'Consolidado', className: 'bg-teal-500 text-white hover:bg-teal-600' };
      case 'original':
      default:
          return { label: 'Original', className: 'bg-blue-600 text-white hover:bg-blue-700' }; 
  }
};

export const cleanOperationName = (name: string, origem: PTrabDB['origem']) => {
  if (origem === 'consolidado' && name.startsWith('CONSOLIDADO - ')) {
      return name.replace('CONSOLIDADO - ', '');
  }
  return name;
};

export const getShareStatusBadge = (ptrab: PTrab, currentUserId: string | undefined) => {
  if (!currentUserId) return null;
  
  const isOwner = ptrab.user_id === currentUserId;
  const isSharedWithMe = ptrab.shared_with?.includes(currentUserId);
  
  if (isOwner && (ptrab.shared_with?.length || 0) > 0) {
      return { label: 'Compartilhando', className: 'bg-indigo-600 text-white hover:bg-indigo-700' };
  }
  
  if (!isOwner && isSharedWithMe) {
      return { label: 'Compartilhado', className: 'bg-pink-600 text-white hover:bg-pink-700' };
  }
  
  return null;
};

export const needsNumbering = (ptrab: PTrab) => {
  return ptrab.status === 'aberto' || ptrab.status === 'em_andamento';
};

export const isFinalStatus = (ptrab: PTrab) => {
  return ptrab.status === 'aprovado' || ptrab.status === 'arquivado';
};

// --- END UTILITY FUNCTIONS ---


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
  
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);

  const [showArchiveStatusDialog, setShowArchiveStatusDialog] = useState(false);
  const [ptrabToArchiveId, setPtrabToArchiveId] = useState<string | null>(null);
  const [ptrabToArchiveName, setPtrabToArchiveName] = useState<string | null>(null);
  const promptedForArchive = useRef(new Set<string>());

  const [showReactivateStatusDialog, setShowReactivateStatusDialog] = useState(false);
  const [ptrabToReactivateId, setPtrabToReactivateId] = useState<string | null>(null);
  const [ptrabToReactivateName, setPtrabToReactivateName] = useState<string | null>(null);

  const [showCloneOptionsDialog, setShowCloneOptionsDialog] = useState(false);
  const [showCloneVariationDialog, setShowCloneVariationDialog] = useState(false);
  const [ptrabToClone, setPtrabToClone] = useState<PTrab | null>(null);
  const [cloneType, setCloneType, ] = useState<'new' | 'variation'>('new');
  const [suggestedCloneNumber, setSuggestedCloneNumber] = useState<string>("");
  
  const [originalPTrabIdToClone, setOriginalPTrabIdToClone] = useState<string | null>(null);

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
  
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [ptrabToShare, setPtrabToShare] = useState<Tables<'p_trab'> | null>(null);
  
  const [showShareRequestDialog, setShowShareRequestDialog] = useState(false);
  const [shareLinkInput, setShareLinkInput] = useState("");
  
  const [showShareRequestsDialog, setShowShareRequestsDialog] = useState(false);
  const [ptrabToManageRequests, setPtrabToManageRequests] = useState<string | null>(null);
  const [totalPendingRequests, setTotalPendingRequests] = useState(0);

  const currentYear = new Date().getFullYear();
  const yearSuffix = `/${currentYear}`;

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

  // --- HANDLERS ---

  const cloneRelatedRecords = async (originalPTrabId: string, newPTrabId: string) => {
    
    const cloneClassRecords = async (tableName: keyof Tables, jsonbField: string, numericFields: string[]) => {
        const { data: originalRecords, error: fetchError } = await supabase
            .from(tableName)
            .select(`*, ${jsonbField}`)
            .eq("p_trab_id", originalPTrabId);

        if (fetchError) {
            console.error(`Erro ao carregar registros da ${tableName}:`, fetchError);
            return 0;
        }

        const newRecords = (originalRecords || []).map(record => {
            const { id, created_at, updated_at, ...restOfRecord } = record;
            
            const newRecord: Record<string, any> = {
                ...restOfRecord,
                p_trab_id: newPTrabId,
                [jsonbField]: record[jsonbField] ? JSON.parse(JSON.stringify(record[jsonbField])) : null,
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
                .insert(newRecords as TablesInsert<typeof tableName>[]);
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

  const fetchUserName = useCallback(async (userId: string, userMetadata: any) => {
    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('last_name') 
        .eq('id', userId)
        .single();

    if (profileError) {
        console.error("Error fetching user profile:", profileError);
    }
    
    const nomeGuerra = profileData?.last_name || '';
    const postoGraduacao = userMetadata?.posto_graduacao || '';
    
    if (postoGraduacao && nomeGuerra) {
        return `${postoGraduacao} ${nomeGuerra}`;
    }
    
    if (nomeGuerra) {
        return nomeGuerra;
    }
    
    if (postoGraduacao) {
        return postoGraduacao;
    }

    return null; 
  }, []);

  const fetchPendingRequests = useCallback(async (ptrabIds: string[]) => {
    if (!ptrabIds.length) return 0;
    
    const { count, error } = await supabase
        .from('ptrab_share_requests')
        .select('id', { count: 'exact', head: true })
        .in('ptrab_id', ptrabIds)
        .eq('status', 'pending');
        
    if (error) {
        console.error("Error fetching pending requests count:", error);
        return 0;
    }
    
    return count || 0;
  }, []);

  const loadPTrabs = useCallback(async () => {
    const currentUserId = user?.id;
    if (!currentUserId) return;
    
    try {
      const { data: pTrabsData, error: pTrabsError } = await supabase
        .from("p_trab")
        .select("*, comentario, origem, rotulo_versao, shared_with")
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
      
      const ownedPTrabIds = typedPTrabsData.filter(p => p.user_id === currentUserId).map(p => p.id);
      
      const totalPending = await fetchPendingRequests(ownedPTrabIds);
      setTotalPendingRequests(totalPending);

      const pTrabsWithTotals: PTrab[] = await Promise.all(
        (typedPTrabsData || []).map(async (ptrab) => {
          let totalOperacionalCalculado = 0;
          let totalLogisticaCalculado = 0;
          let totalMaterialPermanenteCalculado = 0;
          let quantidadeRacaoOpCalculada = 0;
          let quantidadeHorasVooCalculada = 0;

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
          
          const [
            { data: classeIIData }, { data: classeVData }, { data: classeVIData },
            { data: classeVIIData }, { data: classeVIIISaudeData }, { data: classeVIIIRemontaData },
            { data: classeIXData },
          ] = await Promise.all([
            supabase.from('classe_ii_registros').select('valor_total').eq('p_trab_id', ptrab.id),
            supabase.from('classe_v_registros').select('valor_total').eq('p_trab_id', ptrab.id),
            supabase.from('classe_vi_registros').select('valor_total').eq('p_trab_id', ptrab.id),
            supabase.from('classe_vii_registros').select('valor_total').eq('p_trab_id', ptrab.id),
            supabase.from('classe_viii_saude_registros').select('valor_total').eq('p_trab_id', ptrab.id),
            supabase.from('classe_viii_remonta_registros').select('valor_total').eq('p_trab_id', ptrab.id),
            supabase.from('classe_ix_registros').select('valor_total').eq('p_trab_id', ptrab.id),
          ]);

          let totalClassesDiversas = 0;
          totalClassesDiversas += (classeIIData || []).reduce((sum, record) => sum + record.valor_total, 0);
          totalClassesDiversas += (classeVData || []).reduce((sum, record) => sum + record.valor_total, 0);
          totalClassesDiversas += (classeVIData || []).reduce((sum, record) => sum + record.valor_total, 0);
          totalClassesDiversas += (classeVIIData || []).reduce((sum, record) => sum + record.valor_total, 0);
          totalClassesDiversas += (classeVIIISaudeData || []).reduce((sum, record) => sum + record.valor_total, 0);
          totalClassesDiversas += (classeVIIIRemontaData || []).reduce((sum, record) => sum + record.valor_total, 0);
          totalClassesDiversas += (classeIXData || []).reduce((sum, record) => sum + record.valor_total, 0);


          const { data: classeIIIData, error: classeIIIError } = await supabase
            .from('classe_iii_registros')
            .select('valor_total')
            .eq('p_trab_id', ptrab.id);

          let totalClasseIII = 0;
          if (classeIIIError) console.error("Erro ao carregar Classe III para PTrab", ptrab.numero_ptrab, classeIIIError);
          else {
            totalClasseIII = (classeIIIData || []).reduce((sum, record) => sum + record.valor_total, 0);
          }

          totalLogisticaCalculado = totalClasseI + totalClassesDiversas + totalClasseIII;
          
          let pendingRequestsCount = 0;
          if (ptrab.user_id === currentUserId) {
              const { count } = await supabase
                  .from('ptrab_share_requests')
                  .select('id', { count: 'exact', head: true })
                  .eq('ptrab_id', ptrab.id)
                  .eq('status', 'pending');
              pendingRequestsCount = count || 0;
          }


          return {
            ...ptrab,
            totalLogistica: totalLogisticaCalculado,
            totalOperacional: totalOperacionalCalculado,
            totalMaterialPermanente: totalMaterialPermanenteCalculado,
            quantidadeRacaoOp: quantidadeRacaoOpCalculada,
            quantidadeHorasVoo: quantidadeHorasVooCalculada,
            isShared: ptrab.shared_with?.includes(currentUserId) || false,
            pendingRequestsCount: pendingRequestsCount,
          } as PTrab;
        })
      );

      setPTrabs(pTrabsWithTotals);

      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      for (const ptrab of pTrabsWithTotals) {
        if (
          ptrab.status === 'aprovado' &&
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
  }, [user, fetchPendingRequests]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } = {} } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
      }
    };
    checkAuth();
    
    if (user?.id) {
        loadPTrabs();
        fetchUserName(user.id, user.user_metadata).then(name => {
            setUserName(name || ""); 
        });
    }
  }, [loadPTrabs, user, fetchUserName]);

  useEffect(() => {
    if (ptrabToClone) {
      let newSuggestedNumber = generateUniqueMinutaNumber(existingPTrabNumbers); 
      setSuggestedCloneNumber(newSuggestedNumber);
    }
  }, [ptrabToClone, existingPTrabNumbers]);

  // --- ACTION HANDLERS ---

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

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza?")) return;
    try {
      await supabase.from("p_trab").delete().eq("id", id);
      toast.success("P Trab excluído!");
      loadPTrabs();
    } catch (error: any) {
      toast.error("Erro ao excluir. Apenas o proprietário pode excluir o P Trab.");
    }
  };

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
      
      const { 
        id, created_at, updated_at, totalLogistica, totalOperacional, 
        totalMaterialPermanente, quantidadeRacaoOp, quantidadeHorasVoo, 
        share_token, shared_with, 
        ...restOfPTrab 
      } = ptrabToClone;
      
      setFormData({
        ...restOfPTrab,
        numero_ptrab: suggestedCloneNumber,
        status: "aberto",
        origem: ptrabToClone.origem,
        comentario: "",
        rotulo_versao: ptrabToClone.rotulo_versao,
        
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
        const { 
            id, created_at, updated_at, totalLogistica, totalOperacional, 
            totalMaterialPermanente, quantidadeRacaoOp, quantidadeHorasVoo, 
            share_token, shared_with, 
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
        
        const { 
            id, created_at, updated_at, share_token, shared_with,
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
        
        const tablesToConsolidate: (keyof Tables)[] = [
            'classe_i_registros', 'classe_ii_registros', 'classe_iii_registros', 
            'classe_v_registros', 'classe_vi_registros', 'classe_vii_registros', 
            'classe_viii_saude_registros', 'classe_viii_remonta_registros', 'classe_ix_registros'
        ];
        
        for (const tableName of tablesToConsolidate) {
            const { data: records, error: recordsError } = await supabase
                .from(tableName)
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
                        ...(record.itens_equipamentos ? { itens_equipamentos: JSON.parse(JSON.stringify(record.itens_equipamentos)) } : {}),
                        ...(record.itens_saude ? { itens_saude: JSON.parse(JSON.stringify(record.itens_saude)) } : {}),
                        ...(record.itens_remonta ? { itens_remonta: JSON.parse(JSON.stringify(record.itens_remonta)) } : {}),
                        ...(record.itens_motomecanizacao ? { itens_motomecanizacao: JSON.parse(JSON.stringify(record.itens_motomecanizacao)) } : {}),
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
  
  const handleOpenShareDialog = (ptrab: PTrab) => {
    setPtrabToShare(ptrab);
    setShowShareDialog(true);
  };
  
  const handleOpenShareRequestDialog = () => {
    setShowShareRequestDialog(true);
  };
  
  const handleProcessShareLink = async (link: string) => {
    if (!user?.id) {
        toast.error("Você precisa estar logado para solicitar acesso.");
        return;
    }
    
    setLoading(true);
    
    try {
        const url = new URL(link);
        const ptrabId = url.searchParams.get('ptrabId');
        const token = url.searchParams.get('token');
        
        if (!ptrabId || !token) {
            throw new Error("Link inválido. Certifique-se de que o link contém o ID do P Trab e o token.");
        }
        
        navigate(`/share?ptrabId=${ptrabId}&token=${token}`);
        
    } catch (e: any) {
        toast.error(e.message || "Erro ao processar o link de compartilhamento.");
    } finally {
        setLoading(false);
        setShowShareRequestDialog(false);
    }
  };
  
  const handleOpenShareRequestsDialog = (ptrabId: string) => {
    setPtrabToManageRequests(ptrabId);
    setShowShareRequestsDialog(true);
  };
  
  const handleUnshare = async (ptrabId: string, ptrabName: string) => {
    if (!user?.id) return;
    if (!confirm(`Tem certeza que deseja DESVINCULAR-SE do P Trab "${ptrabName}"? Você perderá o acesso colaborativo.`)) return;

    setLoading(true);
    try {
        const { error } = await supabase
            .from('p_trab')
            .update({ 
                shared_with: pTrabs.find(p => p.id === ptrabId)?.shared_with?.filter(id => id !== user.id) || []
            })
            .eq('id', ptrabId);

        if (error) throw error;

        toast.success(`Você foi desvinculado do P Trab ${ptrabName}.`);
        loadPTrabs();
    } catch (error) {
        console.error("Erro ao desvincular P Trab:", error);
        toast.error("Erro ao desvincular P Trab. Tente novamente.");
    } finally {
        setLoading(false);
    }
  };

  // --- RENDER ---

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* HEADER ACTIONS */}
        <PTrabHeaderActions
            loading={loading}
            userName={userName}
            user={user}
            dialogOpen={dialogOpen}
            setDialogOpen={setDialogOpen}
            resetForm={resetForm}
            isConsolidationDisabled={isConsolidationDisabled}
            getConsolidationDisabledMessage={getConsolidationDisabledMessage}
            setShowConsolidationDialog={setShowConsolidationDialog}
            handleOpenShareRequestDialog={handleOpenShareRequestDialog}
            totalPendingRequests={totalPendingRequests}
            settingsDropdownOpen={settingsDropdownOpen}
            setSettingsDropdownOpen={setSettingsDropdownOpen}
            handleLogout={handleLogout}
        />

        <Card>
          <CardHeader>
            <CardTitle>Planos de Trabalho Cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            {/* MAIN TABLE */}
            <PTrabTable
                pTrabs={pTrabs}
                user={user}
                loading={loading}
                handleSelectPTrab={(ptrab) => navigate(`/ptrab/form?ptrabId=${ptrab.id}`)}
                handleOpenComentario={handleOpenComentario}
                handleOpenApproveDialog={handleOpenApproveDialog}
                handleNavigateToPrintOrExport={(id) => navigate(`/ptrab/print?ptrabId=${id}`)}
                handleEdit={handleEdit}
                handleOpenCloneOptions={handleOpenCloneOptions}
                handleArchive={handleArchive}
                handleUnshare={handleUnshare}
                handleDelete={handleDelete}
                setShowReactivateStatusDialog={setShowReactivateStatusDialog}
                setPtrabToReactivateId={setPtrabToReactivateId}
                setPtrabToReactivateName={setPtrabToReactivateName}
                handleOpenShareDialog={handleOpenShareDialog}
                handleOpenShareRequestsDialog={handleOpenShareRequestsDialog}
            />
          </CardContent>
        </Card>
      </div>

      {/* MODALS AND DIALOGS */}
      <PTrabModals
        // New/Edit Dialog Props
        dialogOpen={dialogOpen}
        setDialogOpen={setDialogOpen}
        editingId={editingId}
        formData={formData}
        setFormData={setFormData}
        handleSubmit={handleSubmit}
        loading={loading}
        originalPTrabIdToClone={originalPTrabIdToClone}
        selectedOmId={selectedOmId}
        setSelectedOmId={setSelectedOmId}
        
        // Archive Dialog Props
        showArchiveStatusDialog={showArchiveStatusDialog}
        setShowArchiveStatusDialog={setShowArchiveStatusDialog}
        ptrabToArchiveName={ptrabToArchiveName}
        handleConfirmArchiveStatus={handleConfirmArchiveStatus}
        handleCancelArchiveStatus={handleCancelArchiveStatus}

        // Reactivate Dialog Props
        showReactivateStatusDialog={showReactivateStatusDialog}
        setShowReactivateStatusDialog={setShowReactivateStatusDialog}
        ptrabToReactivateName={ptrabToReactivateName}
        handleConfirmReactivateStatus={handleConfirmReactivateStatus}
        handleCancelReactivateStatus={handleCancelReactivateStatus}

        // Clone Dialogs Props
        showCloneOptionsDialog={showCloneOptionsDialog}
        setShowCloneOptionsDialog={setShowCloneOptionsDialog}
        ptrabToClone={ptrabToClone}
        cloneType={cloneType}
        setCloneType={setCloneType}
        suggestedCloneNumber={suggestedCloneNumber}
        handleConfirmCloneOptions={handleConfirmCloneOptions}
        showCloneVariationDialog={showCloneVariationDialog}
        setShowCloneVariationDialog={setShowCloneVariationDialog}
        handleConfirmCloneVariation={handleConfirmCloneVariation}

        // Approve Dialog Props
        showApproveDialog={showApproveDialog}
        setShowApproveDialog={setShowApproveDialog}
        ptrabToApprove={ptrabToApprove}
        suggestedApproveNumber={suggestedApproveNumber}
        setSuggestedApproveNumber={setSuggestedApproveNumber}
        handleApproveAndNumber={handleApproveAndNumber}
        currentYear={currentYear}
        yearSuffix={yearSuffix}

        // Comentario Dialog Props
        showComentarioDialog={showComentarioDialog}
        setShowComentarioDialog={setShowComentarioDialog}
        ptrabComentario={ptrabComentario}
        comentarioText={comentarioText}
        setComentarioText={setComentarioText}
        handleSaveComentario={handleSaveComentario}

        // Consolidation Dialogs Props
        showConsolidationDialog={showConsolidationDialog}
        setShowConsolidationDialog={setShowConsolidationDialog}
        pTrabsList={pTrabs.filter(p => p.status !== 'arquivado').map(p => ({ id: p.id, numero_ptrab: p.numero_ptrab, nome_operacao: p.nome_operacao }))}
        existingPTrabNumbers={existingPTrabNumbers}
        handleOpenConsolidationNumberDialog={handleOpenConsolidationNumberDialog}
        showConsolidationNumberDialog={showConsolidationNumberDialog}
        setShowConsolidationNumberDialog={setShowConsolidationNumberDialog}
        suggestedConsolidationNumber={suggestedConsolidationNumber}
        simplePTrabsToConsolidate={simplePTrabsToConsolidate}
        handleConfirmConsolidation={handleConfirmConsolidation}

        // Share Dialogs Props
        showShareDialog={showShareDialog}
        setShowShareDialog={setShowShareDialog}
        ptrabToShare={ptrabToShare}
        showShareRequestDialog={showShareRequestDialog}
        setShowShareRequestDialog={setShowShareRequestDialog}
        handleProcessShareLink={handleProcessShareLink}
        showShareRequestsDialog={showShareRequestsDialog}
        setShowShareRequestsDialog={setShowShareRequestsDialog}
        ptrabToManageRequests={ptrabToManageRequests}
        onUpdate={loadPTrabs}
      />
      
      {/* Diálogo de Prompt de Crédito (Mantido aqui pois usa estado local) */}
      <CreditPromptDialog
        open={showCreditPrompt}
        onConfirm={() => { /* Placeholder */ }}
        onCancel={() => { /* Placeholder */ }}
      />
      
      <AIChatDrawer />
    </div>
  );
};

export default PTrabManager;