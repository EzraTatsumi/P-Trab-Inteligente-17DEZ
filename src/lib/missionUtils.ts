"use client";

/**
 * Utilitários para gerenciar o progresso das missões de treinamento (Onboarding).
 * As chaves são prefixadas com o userId para garantir isolamento entre contas.
 */

const getKeys = (userId: string) => ({
  COMPLETED: `completed_missions_${userId}`,
  GHOST: `is_ghost_mode_${userId}`,
  ACTIVE: `active_mission_id_${userId}`,
  VICTORY: `victory_message_shown_${userId}`,
});

export const TOTAL_MISSIONS = 6;

/**
 * Retorna a lista de IDs de missões concluídas para um usuário específico.
 */
export const getCompletedMissions = (userId: string | undefined): number[] => {
  if (!userId || typeof window === 'undefined') return [];
  try {
    const keys = getKeys(userId);
    const stored = localStorage.getItem(keys.COMPLETED);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

/**
 * Verifica se todas as missões foram cumpridas por um usuário.
 */
export const isAllMissionsCompleted = (userId: string | undefined): boolean => {
  if (!userId) return false;
  return getCompletedMissions(userId).length >= TOTAL_MISSIONS;
};

/**
 * Verifica se a mensagem de vitória deve ser exibida para o usuário.
 */
export const shouldShowVictory = (userId: string | undefined): boolean => {
  if (!userId) return false;
  const keys = getKeys(userId);
  return isAllMissionsCompleted(userId) && localStorage.getItem(keys.VICTORY) !== 'true';
};

/**
 * Marca que a mensagem de vitória já foi vista por este usuário.
 */
export const markVictoryAsShown = (userId: string | undefined) => {
  if (!userId) return;
  const keys = getKeys(userId);
  localStorage.setItem(keys.VICTORY, 'true');
};

/**
 * Sai do modo fantasma para o usuário.
 */
export const exitGhostMode = (userId: string | undefined) => {
  if (!userId) return;
  const keys = getKeys(userId);
  localStorage.setItem(keys.GHOST, 'false');
  // Recarrega para limpar estados simulados
  window.location.reload();
};

/**
 * Marca uma missão como concluída para o usuário atual.
 */
export const markMissionCompleted = (userId: string | undefined, missionId: number) => {
  if (!userId || typeof window === 'undefined') return;
  
  const keys = getKeys(userId);
  const completed = getCompletedMissions(userId);
  
  if (!completed.includes(missionId)) {
    const updated = [...completed, missionId];
    localStorage.setItem(keys.COMPLETED, JSON.stringify(updated));
    
    window.dispatchEvent(new CustomEvent('mission:completed', { 
      detail: { missionId, userId } 
    }));
    
    if (updated.length >= TOTAL_MISSIONS) {
      window.dispatchEvent(new CustomEvent('tour:todas-concluidas', { 
        detail: { userId } 
      }));
    }
  }
};

/**
 * Reseta o progresso apenas do usuário logado.
 */
export const resetTrainingProgress = (userId: string | undefined) => {
  if (!userId || typeof window === 'undefined') return;
  const keys = getKeys(userId);
  localStorage.removeItem(keys.COMPLETED);
  localStorage.removeItem(keys.GHOST);
  localStorage.removeItem(keys.ACTIVE);
  localStorage.removeItem(keys.VICTORY);
  window.location.reload();
};