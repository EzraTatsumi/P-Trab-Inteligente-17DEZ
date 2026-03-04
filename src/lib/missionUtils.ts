"use client";

import { supabase } from "@/integrations/supabase/client";

/**
 * Busca as missões concluídas do banco e sincroniza com o localStorage.
 */
export const fetchCompletedMissions = async (userId: string): Promise<number[]> => {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('user_missions')
      .select('mission_id')
      .eq('user_id', userId);

    if (error) throw error;

    const missionIds = (data || []).map(m => m.mission_id);
    
    // Sincroniza com localStorage para uso imediato (inclusive Ghost Mode)
    localStorage.setItem(`completed_missions_${userId}`, JSON.stringify(missionIds));
    
    return missionIds;
  } catch (error) {
    console.error("Erro ao carregar missões do banco:", error);
    // Fallback para o que estiver no localStorage
    return JSON.parse(localStorage.getItem(`completed_missions_${userId}`) || '[]');
  }
};

/**
 * Marca uma missão como concluída, salva no banco e dispara o evento global.
 */
export const markMissionCompleted = async (missionId: number, userId: string) => {
  if (!userId) return;

  // 1. Atualiza localStorage para feedback instantâneo
  const completedKey = `completed_missions_${userId}`;
  const localData = JSON.parse(localStorage.getItem(completedKey) || '[]');
  if (!localData.includes(missionId)) {
    localStorage.setItem(completedKey, JSON.stringify([...localData, missionId]));
  }

  // 2. Salva no Supabase (se não estiver em Ghost Mode ou se quiser persistir o progresso real)
  try {
    const { error } = await supabase
      .from('user_missions')
      .insert([{ user_id: userId, mission_id: missionId }]);
    
    // 409 significa que já existe, o que é aceitável
    if (error && error.code !== '23505') throw error;
  } catch (err) {
    console.error("Erro ao persistir missão:", err);
  }

  // 3. DISPARO CRÍTICO: Evento global que o App.tsx ou PTrabManager estarão ouvindo
  console.log(`[Missão] Disparando evento de conclusão para missão: ${missionId}`);
  window.dispatchEvent(new CustomEvent('mission:completed', {
    detail: { missionId, userId }
  }));

  // 4. Verifica se todas as missões (1 a 6) foram concluídas para o Trophy final
  const updatedMissions = JSON.parse(localStorage.getItem(completedKey) || '[]');
  if ([1, 2, 3, 4, 5, 6].every(id => updatedMissions.includes(id))) {
    window.dispatchEvent(new CustomEvent('tour:todas-concluidas', {
      detail: { userId }
    }));
  }
};

export const shouldShowVictory = (userId: string) => {
  const shown = localStorage.getItem(`victory_shown_${userId}`);
  return !shown;
};

export const markVictoryAsShown = (userId: string) => {
  localStorage.setItem(`victory_shown_${userId}`, 'true');
};

export const exitGhostMode = (userId?: string) => {
  localStorage.removeItem('is_ghost_mode');
  localStorage.removeItem('active_mission_id');
  window.location.href = '/ptrab';
};