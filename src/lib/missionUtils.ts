"use client";

import { supabase } from "@/integrations/supabase/client";

const TOTAL_MISSIONS = 6;

/**
 * Marca uma missão como concluída, salva no localStorage e sincroniza com o Supabase.
 * Se todas as missões forem concluídas, dispara o evento de vitória.
 */
export const markMissionCompleted = async (missionId: number) => {
  // 1. Atualiza o localStorage (persistência imediata no navegador)
  let completed: number[] = JSON.parse(localStorage.getItem('completed_missions') || '[]');
  
  if (!completed.includes(missionId)) {
    completed.push(missionId);
    localStorage.setItem('completed_missions', JSON.stringify(completed));
    
    // 2. Sincroniza com o Supabase (persistência permanente na nuvem)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Nota: Assumimos que a coluna 'missoes_concluidas' existe ou será criada no perfil.
        // Como alternativa segura, podemos usar o campo 'raw_user_meta_data' que já existe.
        const { data: profile } = await supabase
            .from('profiles')
            .select('raw_user_meta_data')
            .eq('id', user.id)
            .single();

        const currentMetadata = (profile?.raw_user_meta_data as any) || {};
        
        await supabase
          .from('profiles')
          .update({ 
            raw_user_meta_data: {
                ...currentMetadata,
                missoes_concluidas: completed
            }
          }) 
          .eq('id', user.id);
      }
    } catch (error) {
      console.error("Erro ao sincronizar progresso na nuvem:", error);
    }

    // 3. Verifica se o álbum está completo (Bingo!)
    if (completed.length >= TOTAL_MISSIONS) {
      window.dispatchEvent(new CustomEvent('tour:todas-concluidas'));
    }
  }
};

/**
 * Recupera as missões concluídas do localStorage.
 */
export const getCompletedMissions = (): number[] => {
    return JSON.parse(localStorage.getItem('completed_missions') || '[]');
};