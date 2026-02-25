"use client";

/**
 * Utilitários para gerenciar o progresso das missões de treinamento (Onboarding).
 */

const getBaseKey = (userId?: string) => userId ? `completed_missions_${userId}` : 'completed_missions';
const GHOST_MODE_KEY = 'is_ghost_mode';
const ACTIVE_MISSION_KEY = 'active_mission_id';

/**
 * Marca uma missão como concluída, disparando eventos para atualização da UI.
 */
export const markMissionCompleted = (missionId: number, userId?: string) => {
  if (typeof window === 'undefined') return;
  
  const key = getBaseKey(userId);
  const completed = getCompletedMissions(userId);
  
  if (!completed.includes(missionId)) {
    const updated = [...completed, missionId];
    localStorage.setItem(key, JSON.stringify(updated));
    
    console.log(`[Missão] ${missionId} marcada como concluída para o usuário ${userId || 'anônimo'}`);
    
    // Notifica o sistema via eventos customizados
    window.dispatchEvent(new CustomEvent('mission:completed', { detail: { missionId, userId } }));
    
    if (updated.length >= 6) {
      window.dispatchEvent(new CustomEvent('tour:todas-concluidas'));
    }
  }
};

/**
 * Retorna a lista de IDs de missões concluídas.
 */
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

/**
 * Verifica se uma missão específica foi concluída.
 */
export const isMissionCompleted = (missionId: number, userId?: string): boolean => {
  return getCompletedMissions(userId).includes(missionId);
};

/**
 * Reseta o progresso (Limpeza de pane).
 */
export const resetTrainingProgress = (userId?: string) => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(getBaseKey(userId));
  localStorage.removeItem(GHOST_MODE_KEY);
  localStorage.removeItem(ACTIVE_MISSION_KEY);
  window.location.reload();
};