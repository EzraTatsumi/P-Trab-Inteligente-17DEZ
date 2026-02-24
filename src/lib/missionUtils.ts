"use client";

/**
 * Retorna a chave do localStorage para missões, vinculada ao usuário
 */
const getMissionKey = (userId: string) => {
  return `completed_missions_${userId}`;
};

/**
 * Marca uma missão como concluída para o usuário atual (Síncrono para evitar race conditions)
 */
export const markMissionCompleted = (missionId: number, userId: string) => {
  if (!userId) return;

  const key = getMissionKey(userId);
  const completed = JSON.parse(localStorage.getItem(key) || '[]');
  
  if (!completed.includes(missionId)) {
    const updated = [...completed, missionId];
    localStorage.setItem(key, JSON.stringify(updated));
    
    // Dispara evento para atualizar UI em tempo real
    window.dispatchEvent(new CustomEvent('mission:completed', { 
      detail: { missionId, userId } 
    }));

    // Se completou as 6 missões, dispara evento de vitória total
    if (updated.length >= 6) {
      window.dispatchEvent(new CustomEvent('tour:todas-concluidas', { 
        detail: { userId } 
      }));
    }
  }
};

/**
 * Verifica se o usuário deve ver a tela de vitória
 */
export const shouldShowVictory = (userId: string) => {
  const key = getMissionKey(userId);
  const completed = JSON.parse(localStorage.getItem(key) || '[]');
  const victoryShown = localStorage.getItem(`victory_shown_${userId}`) === 'true';
  
  return completed.length >= 6 && !victoryShown;
};

/**
 * Marca que a tela de vitória já foi exibida
 */
export const markVictoryAsShown = (userId: string) => {
  localStorage.setItem(`victory_shown_${userId}`, 'true');
};

/**
 * Sai do modo Ghost/Simulação
 */
export const exitGhostMode = (userId?: string) => {
  localStorage.removeItem('is_ghost_mode');
  localStorage.removeItem('active_mission_id');
  if (userId) {
    localStorage.setItem(`onboarding_tutorial_done_${userId}`, 'true');
  }
  window.location.reload();
};