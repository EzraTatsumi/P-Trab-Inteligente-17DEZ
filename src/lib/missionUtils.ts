"use client";

import { supabase } from "@/integrations/supabase/client";

/**
 * Marca uma missão como concluída, mesclando com os dados existentes no Supabase
 * para evitar sobrescrever missões concluídas anteriormente.
 */
export const markMissionCompleted = async (missionId: number) => {
  if (typeof window === 'undefined') return;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // Se não houver usuário (ex: modo fantasma), salva apenas localmente
      const local = JSON.parse(localStorage.getItem('completed_missions') || '[]');
      if (!local.includes(missionId)) {
        localStorage.setItem('completed_missions', JSON.stringify([...local, missionId].sort()));
      }
      return;
    }

    // Busca o estado mais atual do banco de dados antes de atualizar
    const { data: profile } = await supabase
      .from('profiles')
      .select('raw_user_meta_data')
      .eq('id', user.id)
      .single();
      
    const currentMeta = (profile?.raw_user_meta_data as any) || {};
    const dbMissions = currentMeta.missoes_concluidas || [];
    
    // Mescla: pega o que já tem no banco + o que tem no local + a nova missão
    const localMissions = JSON.parse(localStorage.getItem('completed_missions') || '[]');
    const allCompleted = Array.from(new Set([...dbMissions, ...localMissions, missionId]))
      .map(Number)
      .sort((a, b) => a - b);
    
    // Atualiza localmente para resposta imediata
    localStorage.setItem('completed_missions', JSON.stringify(allCompleted));

    // Salva na nuvem a lista completa mesclada
    await supabase
      .from('profiles')
      .update({
        raw_user_meta_data: {
          ...currentMeta,
          missoes_concluidas: allCompleted
        }
      })
      .eq('id', user.id);

  } catch (error) {
    console.error("Erro ao sincronizar missão:", error);
  }
};

/**
 * Retorna as missões concluídas do localStorage.
 */
export const getLocalCompletedMissions = (): number[] => {
  if (typeof window === 'undefined') return [];
  return JSON.parse(localStorage.getItem('completed_missions') || '[]');
};