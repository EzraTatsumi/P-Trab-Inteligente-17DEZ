"use client";

import { supabase } from "@/integrations/supabase/client";

/**
 * Marca uma missão como concluída tanto localmente quanto na nuvem (Supabase).
 */
export const markMissionCompleted = async (missionId: number) => {
  if (typeof window === 'undefined') return;

  // 1. Gravação Rápida (localStorage)
  const completed = JSON.parse(localStorage.getItem('completed_missions') || '[]');
  if (!completed.includes(missionId)) {
    const newCompleted = [...completed, missionId].sort((a, b) => a - b);
    localStorage.setItem('completed_missions', JSON.stringify(newCompleted));
    
    // 2. Gravação Definitiva (Supabase)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Buscamos o perfil atual para não sobrescrever outros metadados
        const { data: profile } = await supabase
          .from('profiles')
          .select('raw_user_meta_data')
          .eq('id', user.id)
          .single();
          
        const currentMeta = (profile?.raw_user_meta_data as any) || {};
        
        await supabase
          .from('profiles')
          .update({
            raw_user_meta_data: {
              ...currentMeta,
              missoes_concluidas: newCompleted
            }
          })
          .eq('id', user.id);
      }
    } catch (error) {
      console.error("Erro ao sincronizar progresso com a nuvem:", error);
    }
  }
};

/**
 * Retorna as missões concluídas do localStorage.
 */
export const getLocalCompletedMissions = (): number[] => {
  if (typeof window === 'undefined') return [];
  return JSON.parse(localStorage.getItem('completed_missions') || '[]');
};