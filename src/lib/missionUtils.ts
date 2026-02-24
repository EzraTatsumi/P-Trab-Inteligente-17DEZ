"use client";

/**
 * Utilitários para gerenciar o progresso das missões de treinamento (Onboarding).
 * Atualmente utiliza LocalStorage para persistência simples.
 */

const COMPLETED_MISSIONS_KEY = 'completed_missions';
const GHOST_MODE_KEY = 'is_ghost_mode';
const ACTIVE_MISSION_KEY = 'active_mission_id';

/**
 * Marca uma missão como concluída.
 */
export const markMissionCompleted = (missionId: number) => {
  if (typeof window === 'undefined') return;
  
  const completed = getCompletedMissions();
  if (!completed.includes(missionId)) {
    const updated = [...completed, missionId];
    localStorage.setItem(COMPLETED_MISSIONS_KEY, JSON.stringify(updated));
    
    // Dispara evento para que componentes React possam reagir
    window.dispatchEvent(new CustomEvent('mission:completed', { detail: missionId }));
    
    // Verifica se todas as missões foram concluídas (assumindo 6 missões principais)
    if (updated.length >= 6) {
      window.dispatchEvent(new CustomEvent('tour:todas-concluidas'));
    }
  }
};

/**
 * Retorna a lista de IDs de missões concluídas.
 */
export const getCompletedMissions = (): number[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(COMPLETED_MISSIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

/**
 * Verifica se uma missão específica foi concluída.
 */
export const isMissionCompleted = (missionId: number): boolean => {
  return getCompletedMissions().includes(missionId);
};

/**
 * Reseta todo o progresso de treinamento (útil para testes).
 */
export const resetTrainingProgress = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(COMPLETED_MISSIONS_KEY);
  localStorage.removeItem(GHOST_MODE_KEY);
  localStorage.removeItem(ACTIVE_MISSION_KEY);
  window.location.reload();
};

/**
 * Ativa ou desativa o Modo Fantasma.
 */
export const setGhostMode = (active: boolean) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GHOST_MODE_KEY, active ? 'true' : 'false');
};