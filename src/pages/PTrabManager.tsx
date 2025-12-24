import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
// ... (outras importações)

// ... (definições de tipos e constantes)

const PTrabManager = () => {
  // ... (estados e hooks)

  // ... (funções auxiliares)

  // Função de reset do formulário (usando useCallback para evitar recriação desnecessária)
  const resetForm = useCallback(() => {
    setEditingId(null);
    setSelectedOmId(undefined); // Mantém undefined para novos PTrabs
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

  // ... (estados e useFormNavigation)

  // ... (loadPTrabs e outros effects)

  // ... (handleSubmit)

  const handleEdit = (ptrab: PTrab) => {
    setEditingId(ptrab.id);
    
    // NOVO: Força a busca do ID da OM para garantir a exibição correta no OmSelector
    if (ptrab.nome_om && ptrab.codug_om) {
        const lookupOmId = async () => {
            const { data, error } = await supabase
                .from('organizacoes_militares')
                .select('id')
                .eq('nome_om', ptrab.nome_om)
                .eq('codug_om', ptrab.codug_om)
                .maybeSingle();

            if (data && data.id) {
                setSelectedOmId(data.id); // Define o ID para o OmSelector usar a busca robusta
            } else {
                // Se a busca falhar, define como undefined para que o OmSelector use o nome (currentOmName)
                setSelectedOmId(undefined); 
            }
        };
        lookupOmId();
    } else {
        setSelectedOmId(undefined);
    }
    
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

  // ... (restante do componente)
};

export default PTrabManager;