"use client";

import { supabase } from "@/integrations/supabase/client";

/**
 * Utilitários para gerenciar o progresso das missões de treinamento (Onboarding).
 */

export const TOTAL_MISSIONS = 6;

const getBaseKey = (userId?: string) => userId ? `completed_missions_${userId}` : 'completed_missions';
const VICTORY_SHOWN_KEY = (userId?: string) => userId ? `victory_shown_${userId}` : 'victory_shown';
const GHOST_MODE_KEY = 'is_ghost_mode';
const ACTIVE_MISSION_KEY = 'active_mission_id';

/**
 * Inicia uma missão específica, ativando o modo fantasma e redirecionando o usuário.
 */
export const startMission = (missionId: number, userId?: string) => {
  if (typeof window === 'undefined') return;

  localStorage.setItem(GHOST_MODE_KEY, 'true');
  localStorage.setItem(ACTIVE_MISSION_KEY, String(missionId));
  
  // Notifica o sistema para mostrar o banner imediatamente
  window.dispatchEvent(new CustomEvent('ghost-mode:change'));
  
  // Define o destino inicial com base na missão
  let targetPath = '/ptrab?startTour=true';
  
  if (missionId === 2) {
    targetPath = '/config/custos-operacionais?startTour=true';
  } else if (missionId === 3 || missionId === 4) {
    // Para missões de formulário, usamos o ID fantasma definido no ghostStore
    targetPath = '/ptrab/form?ptrabId=ghost-ptrab-123&startTour=true';
  } else if (missionId === 5) {
    targetPath = '/ptrab/dor?ptrabId=ghost-ptrab-123&startTour=true';
  } else if (missionId === 6) {
    targetPath = '/ptrab/print?ptrabId=ghost-ptrab-123&startTour=true';
  }

  window.location.href = targetPath;
};

/**
 * Busca as missões concluídas do banco de dados e atualiza o cache local.
 * @returns Array de IDs de missões concluídas.
 */
export const fetchCompletedMissions = async (userId: string): Promise<number[]> => {
  try {
    const { data, error } = await supabase
      .from('user_missions' as any)
      .select('mission_id')
      .eq('user_id', userId);

    if (error) throw error;

    const missionIds = (data as any[] || []).map(m => m.mission_id);
    
    // Atualiza o cache local para consistência síncrona
    if (typeof window !== 'undefined') {
      localStorage.setItem(getBaseKey(userId), JSON.stringify(missionIds));
    }
    
    return missionIds;
  } catch (error) {
    console.error("Erro ao buscar missões do banco:", error);
    return getCompletedMissions(userId); // Fallback para o cache
  }
};

/**
 * Marca uma missão como concluída no Supabase e no cache local.
 */
export const markMissionCompleted = async (missionId: number, userId?: string) => {
  if (typeof window === 'undefined') return;
  
  // Se não houver userId, não podemos salvar no banco devido às políticas de RLS
  if (!userId) {
    console.warn("markMissionCompleted: userId não fornecido, salvando apenas localmente.");
    const key = getBaseKey();
    const completed = getCompletedMissions();
    if (!completed.includes(missionId)) {
      localStorage.setItem(key, JSON.stringify([...completed, missionId]));
    }
    return;
  }

  try {
    // 1. Salva no Supabase (Fonte da Verdade)
    // Usamos o upsert para garantir que não haja duplicidade
    const { error } = await supabase
      .from('user_missions' as any)
      .upsert(
        { user_id: userId, mission_id: missionId },
        { onConflict: 'user_id, mission_id' }
      );

    if (error) throw error;

    // 2. Atualiza o cache local e dispara eventos
    const key = getBaseKey(userId);
    const completed = getCompletedMissions(userId);
    
    if (!completed.includes(missionId)) {
      const updated = [...completed, missionId];
      localStorage.setItem(key, JSON.stringify(updated));
      
      window.dispatchEvent(new CustomEvent('mission:completed', { detail: { missionId, userId } }));
      
      if (updated.length >= TOTAL_MISSIONS) {
        window.dispatchEvent(new CustomEvent('tour:todas-concluidas', { detail: { userId } }));
      }
    }
  } catch (error) {
    console.error("Erro ao persistir conclusão da missão:", error);
    // Em caso de erro no banco, ainda atualizamos o local para não travar a UI do usuário
    const key = getBaseKey(userId);
    const completed = getCompletedMissions(userId);
    if (!completed.includes(missionId)) {
      localStorage.setItem(key, JSON.stringify([...completed, missionId]));
    }
  }
};

export const getCompletedMissions = (userId?: string): number[] => {
  if (typeof window === 'undefined') return [];
  try {
    const key = getBaseKey(userId);
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

export const isMissionCompleted = (missionId: number, userId?: string): boolean => {
  return getCompletedMissions(userId).includes(missionId);
};

export const shouldShowVictory = (userId?: string): boolean => {
  const completed = getCompletedMissions(userId);
  const alreadyShown = localStorage.getItem(VICTORY_SHOWN_KEY(userId)) === 'true';
  return completed.length >= TOTAL_MISSIONS && !alreadyShown;
};

export const markVictoryAsShown = (userId?: string) => {
  localStorage.setItem(VICTORY_SHOWN_KEY(userId), 'true');
};

export const exitGhostMode = (userId?: string) => {
  localStorage.removeItem(GHOST_MODE_KEY);
  localStorage.removeItem(ACTIVE_MISSION_KEY);
  window.location.href = '/ptrab';
};