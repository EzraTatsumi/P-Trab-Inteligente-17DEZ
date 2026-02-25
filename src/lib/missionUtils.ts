"use client";

/**
 * Utilitários para gerenciar o progresso das missões de treinamento (Onboarding).
 */

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
 * Marca uma missão como concluída.
 */
export const markMissionCompleted = (missionId: number, userId?: string) => {
  if (typeof window === 'undefined') return;
  
  const key = getBaseKey(userId);
  const completed = getCompletedMissions(userId);
  
  if (!completed.includes(missionId)) {
    const updated = [...completed, missionId];
    localStorage.setItem(key, JSON.stringify(updated));
    
    window.dispatchEvent(new CustomEvent('mission:completed', { detail: { missionId, userId } }));
    
    if (updated.length >= 6) {
      window.dispatchEvent(new CustomEvent('tour:todas-concluidas', { detail: { userId } }));
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
  return completed.length >= 6 && !alreadyShown;
};

export const markVictoryAsShown = (userId?: string) => {
  localStorage.setItem(VICTORY_SHOWN_KEY(userId), 'true');
};

export const exitGhostMode = (userId?: string) => {
  localStorage.removeItem(GHOST_MODE_KEY);
  localStorage.removeItem(ACTIVE_MISSION_KEY);
  window.location.href = '/ptrab';
};