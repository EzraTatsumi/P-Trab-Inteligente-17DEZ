import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { sanitizeError } from "@/lib/errorUtils";
import { generateUniqueMinutaNumber, generateApprovalPTrabNumber, isPTrabNumberDuplicate } from "@/lib/ptrabNumberUtils";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// Define a base type for PTrab data fetched from DB, including the missing 'origem' field
export type PTrabDB = Tables<'p_trab'> & {
  origem: 'original' | 'importado' | 'consolidado';
  rotulo_versao: string | null;
};

export interface PTrab extends PTrabDB {
  totalLogistica?: number;
  totalOperacional?: number;
}

const initialFormState = {
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
};

export const usePTrabManager = () => {
  const navigate = useNavigate();
  const [pTrabs, setPTrabs] = useState<PTrab[]>([]);
  const [loading, setLoading] = useState(true);
  const [existingPTrabNumbers, setExistingPTrabNumbers] = useState<string[]>([]);
  const [formData, setFormData] = useState(initialFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ptrabToClone, setPtrabToClone] = useState<PTrab | null>(null);
  const [originalPTrabIdToClone, setOriginalPTrabIdToClone] = useState<string | null>(null);
  const [ptrabToApprove, setPtrabToApprove] = useState<PTrab | null>(null);
  const [suggestedApproveNumber, setSuggestedApproveNumber] = useState<string>("");
  const [ptrabToArchiveId, setPtrabToArchiveId] = useState<string | null>(null);
  const [ptrabToArchiveName, setPtrabToArchiveName] = useState<string | null>(null);
  const [ptrabToReactivateId, setPtrabToReactivateId] = useState<string | null>(null);
  const [ptrabToReactivateName, setPtrabToReactivateName] = useState<string | null>(null);
  const [ptrabComentario, setPtrabComentario] = useState<PTrab | null>(null);
  const [comentarioText, setComentarioText] = useState("");
  
  const promptedForArchive = useRef(new Set<string>());

  const resetForm = useCallback(() => {
    setEditingId(null);
    setOriginalPTrabIdToClone(null);
    const uniqueMinutaNumber = generateUniqueMinutaNumber(existingPTrabNumbers);
    setFormData({ ...initialFormState, numero_ptrab: uniqueMinutaNumber });
  }, [existingPTrabNumbers]);

  const loadPTrabs = useCallback(async () => {
    setLoading(true);
    try {
      const { data: pTrabsData, error: pTrabsError } = await supabase
        .from("p_trab")
        .select("*, comentario, origem, rotulo_versao")
        .order("created_at", { ascending: false });

      if (pTrabsError) throw pTrabsError;

      const typedPTrabsData = pTrabsData as unknown as PTrabDB[];

      const numbers = (typedPTrabsData || []).map(p => p.numero_ptrab);
      setExistingPTrabNumbers(numbers);

      const pTrabsWithTotals: PTrab[] = await Promise.all(
        (typedPTrabsData || []).map(async (ptrab) => {
          // Simplificação: Apenas calcula a soma total para exibição rápida
          const [
            { data: classeIData },
            { data: classeIIData },
            { data: classeIIIData },
          ] = await Promise.all([
            supabase.from('classe_i_registros').select('total_qs, total_qr').eq('p_trab_id', ptrab.id),
            supabase.from('classe_ii_registros').select('valor_total').eq('p_trab_id', ptrab.id),
            supabase.from('classe_iii_registros').select('valor_total').eq('p_trab_id', ptrab.id),
          ]);

          const totalClasseI = (classeIData || []).reduce((sum, record) => sum + record.total_qs + record.total_qr, 0);
          const totalClasseII = (classeIIData || []).reduce((sum, record) => sum + record.valor_total, 0);
          const totalClasseIII = (classeIIIData || []).reduce((sum, record) => sum + record.valor_total, 0);

          const totalLogistica = totalClasseI + totalClasseII + totalClasseIII;
          const totalOperacional = 0; // Placeholder

          return {
            ...ptrab,
            totalLogistica,
            totalOperacional,
          } as PTrab;
        })
      );

      setPTrabs(pTrabsWithTotals);

      // Lógica para perguntar sobre arquivamento (se aprovado há mais de 10 dias)
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
          promptedForArchive.current.add(ptrab.id);
          break;
        }
      }

    } catch (error: any) {
      toast.error("Erro ao carregar P Trabs");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPTrabs();
  }, [loadPTrabs]);

  const handleEdit = (ptrab: PTrab) => {
    setEditingId(ptrab.id);
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
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este P Trab?")) return;
    try {
      await supabase.from("p_trab").delete().eq("id", id);
      toast.success("P Trab excluído!");
      loadPTrabs();
    } catch (error: any) {
      toast.error("Erro ao excluir");
    }
  };

  const handleArchive = async (ptrabId: string, ptrabName: string) => {
    if (!confirm(`Tem certeza que deseja ARQUIVAR o P Trab "${ptrabName}"?`)) return;
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

  const handleReactivate = (ptrabId: string, ptrabName: string) => {
    setPtrabToReactivateId(ptrabId);
    setPtrabToReactivateName(ptrabName);
  };

  const handleConfirmReactivate = async () => {
    if (!ptrabToReactivateId) return;

    setLoading(true);
    try {
      const { data: ptrab } = await supabase
        .from("p_trab")
        .select("numero_ptrab")
        .eq("id", ptrabToReactivateId)
        .single();

      const isMinuta = ptrab?.numero_ptrab.startsWith("Minuta");
      const newStatus = isMinuta ? 'aberto' : 'aprovado';

      const { error: updateError } = await supabase
        .from("p_trab")
        .update({ status: newStatus })
        .eq("id", ptrabToReactivateId);

      if (updateError) throw updateError;

      toast.success(`P Trab ${ptrabToReactivateName} reativado para "${newStatus.toUpperCase()}"!`);
      setPtrabToReactivateId(null);
      setPtrabToReactivateName(null);
      loadPTrabs();
    } catch (error: any) {
      console.error("Erro ao reativar P Trab:", error);
      toast.error(error.message || "Erro ao reativar P Trab.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenApproveDialog = (ptrab: PTrab) => {
    const omSigla = ptrab.nome_om;
    const suggestedNumber = generateApprovalPTrabNumber(existingPTrabNumbers, omSigla);
    
    setPtrabToApprove(ptrab);
    setSuggestedApproveNumber(suggestedNumber);
  };

  const handleApproveAndNumber = async (newNumber: string) => {
    if (!ptrabToApprove) return;

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
      setPtrabToApprove(null);
      setSuggestedApproveNumber("");
      loadPTrabs();
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenComentario = (ptrab: PTrab) => {
    setPtrabComentario(ptrab);
    setComentarioText(ptrab.comentario || "");
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
      setPtrabComentario(null);
      setComentarioText("");
      loadPTrabs();
    } catch (error) {
      console.error("Erro ao salvar comentário:", error);
      toast.error("Erro ao salvar comentário. Tente novamente.");
    }
  };

  const cloneRelatedRecords = async (originalPTrabId: string, newPTrabId: string) => {
    const tables: (keyof Tables)[] = ['classe_i_registros', 'classe_ii_registros', 'classe_iii_registros', 'p_trab_ref_lpc'];
    
    for (const table of tables) {
        const { data: originalRecords, error: fetchError } = await supabase
            .from(table)
            .select("*")
            .eq("p_trab_id", originalPTrabId);

        if (fetchError) {
            console.error(`Erro ao carregar registros de ${table}:`, fetchError);
            continue;
        }

        if (originalRecords && originalRecords.length > 0) {
            const recordsToInsert = originalRecords.map(record => {
                const { id, created_at, updated_at, ...restOfRecord } = record;
                const newRecord = { ...restOfRecord, p_trab_id: newPTrabId };
                
                // Handle JSONB fields explicitly for deep copy if necessary (e.g., itens_equipamentos)
                if ('itens_equipamentos' in newRecord && newRecord.itens_equipamentos) {
                    (newRecord as any).itens_equipamentos = JSON.parse(JSON.stringify(newRecord.itens_equipamentos));
                }
                
                // Ensure numeric fields are handled correctly for insertion
                Object.keys(newRecord).forEach(key => {
                    const value = (newRecord as any)[key];
                    if (typeof value === 'number' && isNaN(value)) {
                        (newRecord as any)[key] = 0; // Default to 0 if NaN
                    }
                });
                
                return newRecord;
            });

            const { error: insertError } = await supabase
                .from(table)
                .insert(recordsToInsert as TablesInsert<typeof table>[]);
            
            if (insertError) {
                console.error(`ERRO DE INSERÇÃO ${table}:`, insertError);
                toast.error(`Erro ao clonar registros de ${table}: ${sanitizeError(insertError)}`);
            }
        }
    }
    
    // Copy rotulo_versao
    const { data: originalPTrabData } = await supabase
        .from("p_trab")
        .select("rotulo_versao")
        .eq("id", originalPTrabId)
        .single();
        
    if (originalPTrabData?.rotulo_versao) {
        await supabase
            .from("p_trab")
            .update({ rotulo_versao: originalPTrabData.rotulo_versao })
            .eq("id", newPTrabId);
    }
  };

  const handleConfirmCloneVariation = async (versionName: string, suggestedNumber: string) => {
    if (!ptrabToClone || !suggestedNumber.trim()) {
      toast.error("Erro: Dados de clonagem incompletos.");
      return;
    }
    
    setLoading(true);

    try {
        const { id, created_at, updated_at, totalLogistica, totalOperacional, rotulo_versao, ...restOfPTrab } = ptrabToClone;
        
        const newPTrabData: TablesInsert<'p_trab'> & { origem: PTrabDB['origem'] } = {
            ...restOfPTrab,
            numero_ptrab: suggestedNumber,
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
        
        toast.success(`Variação "${versionName}" criada como Minuta ${suggestedNumber} e registros clonados!`);
        loadPTrabs();
        
    } catch (error: any) {
        console.error("Erro ao clonar variação:", error);
        toast.error(sanitizeError(error));
    } finally {
        setLoading(false);
    }
  };

  return {
    pTrabs,
    loading,
    existingPTrabNumbers,
    formData,
    setFormData,
    editingId,
    setEditingId,
    resetForm,
    loadPTrabs,
    handleEdit,
    handleDelete,
    handleArchive,
    handleReactivate,
    handleConfirmReactivate,
    ptrabToReactivateId,
    ptrabToReactivateName,
    handleOpenApproveDialog,
    ptrabToApprove,
    suggestedApproveNumber,
    setSuggestedApproveNumber,
    handleApproveAndNumber,
    handleOpenComentario,
    ptrabComentario,
    comentarioText,
    setComentarioText,
    handleSaveComentario,
    ptrabToArchiveId,
    ptrabToArchiveName,
    handleOpenCloneOptions: setPtrabToClone,
    ptrabToClone,
    originalPTrabIdToClone,
    setOriginalPTrabIdToClone,
    handleConfirmCloneVariation,
    cloneRelatedRecords,
    needsNumbering: (ptrab: PTrab) => ptrab.status === 'aberto' || ptrab.status === 'em_andamento',
    isFinalStatus: (ptrab: PTrab) => ptrab.status === 'aprovado' || ptrab.status === 'arquivado',
    isEditable: (ptrab: PTrab) => ptrab.status !== 'aprovado' && ptrab.status !== 'arquivado',
    getMinutaNumber: () => generateUniqueMinutaNumber(existingPTrabNumbers),
  };
};