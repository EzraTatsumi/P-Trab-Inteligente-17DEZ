"use client";

/**
 * Utilitários para gerenciar o progresso das missões de treinamento.
 */

export const getCompletedMissions = (userId: string): number[] => {
  if (typeof window === 'undefined') return [];
  const completed = localStorage.getItem(`completed_missions_${userId}`);
  return completed ? JSON.parse(completed) : [];
};

export const markMissionCompleted = (missionId: number, userId: string) => {
  const completed = getCompletedMissions(userId);
  if (!completed.includes(missionId)) {
    const newList = [...completed, missionId];
    localStorage.setItem(`completed_missions_${userId}`, JSON.stringify(newList));
    
    // Verifica se todas as missões foram concluídas (assumindo 6 missões)
    if (newList.length >= 6) {
      window.dispatchEvent(new CustomEvent('tour:todas-concluidas', { detail: { userId } }));
    }
  }
};

export const shouldShowVictory = (userId: string): boolean => {
  const completed = getCompletedMissions(userId);
  const shown = localStorage.getItem(`victory_shown_${userId}`) === 'true';
  return completed.length >= 6 && !shown;
};

export const markVictoryAsShown = (userId: string) => {
  localStorage.setItem(`victory_shown_${userId}`, 'true');
};

export const exitGhostMode = (userId?: string) => {
  localStorage.removeItem('is_ghost_mode');
  localStorage.removeItem('active_mission_id');
  window.dispatchEvent(new CustomEvent('ghost-mode:change', { detail: { active: false } }));
  // Recarrega a página para limpar estados de query e cache real
  window.location.reload();
};