"use client";

/**
 * Utilitários para gerenciar o progresso das missões de treinamento (Onboarding).
 */

const getBaseKey = (userId?: string) => userId ? `completed_missions_${userId}` : 'completed_missions';
const VICTORY_SHOWN_KEY = (userId?: string) => userId ? `victory_shown_${userId}` : 'victory_shown';
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
    
    // Se completou as 6 missões, dispara evento de vitória
    if (updated.length >= 6) {
      window.dispatchEvent(new CustomEvent('tour:todas-concluidas', { detail: { userId } }));
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
 * Verifica se o usuário deve ver a tela de vitória (todas as missões concluídas e ainda não mostrada).
 */
export const shouldShowVictory = (userId?: string): boolean => {
  const completed = getCompletedMissions(userId);
  const alreadyShown = localStorage.getItem(VICTORY_SHOWN_KEY(userId)) === 'true';
  return completed.length >= 6 && !alreadyShown;
};

/**
 * Marca que a tela de vitória já foi exibida para evitar repetições.
 */
export const markVictoryAsShown = (userId?: string) => {
  localStorage.setItem(VICTORY_SHOWN_KEY(userId), 'true');
};

/**
 * Finaliza o treinamento, limpando as flags de modo fantasma.
 */
export const exitGhostMode = (userId?: string) => {
  localStorage.removeItem(GHOST_MODE_KEY);
  localStorage.removeItem(ACTIVE_MISSION_KEY);
  window.location.href = '/ptrab'; // Recarrega para limpar estados de memória
};

/**
 * Reseta o progresso (Limpeza de pane).
 */
export const resetTrainingProgress = (userId?: string) => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(getBaseKey(userId));
  localStorage.removeItem(VICTORY_SHOWN_KEY(userId));
  localStorage.removeItem(GHOST_MODE_KEY);
  localStorage.removeItem(ACTIVE_MISSION_KEY);
  window.location.reload();
};