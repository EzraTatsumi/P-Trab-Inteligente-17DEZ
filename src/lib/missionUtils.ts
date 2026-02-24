"use client";

const COMPLETED_MISSIONS_KEY = 'completed_missions';
const GHOST_MODE_KEY = 'is_ghost_mode';
const ACTIVE_MISSION_KEY = 'active_mission_id';
const VICTORY_SHOWN_KEY = 'victory_message_shown';

export const TOTAL_MISSIONS = 6;

export const getCompletedMissions = (): number[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(COMPLETED_MISSIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

export const isAllMissionsCompleted = (): boolean => {
  return getCompletedMissions().length >= TOTAL_MISSIONS;
};

export const shouldShowVictory = (): boolean => {
  return isAllMissionsCompleted() && localStorage.getItem(VICTORY_SHOWN_KEY) !== 'true';
};

export const markVictoryAsShown = () => {
  localStorage.setItem(VICTORY_SHOWN_KEY, 'true');
};

export const markMissionCompleted = (missionId: number) => {
  if (typeof window === 'undefined') return;
  
  const completed = getCompletedMissions();
  if (!completed.includes(missionId)) {
    const updated = [...completed, missionId];
    localStorage.setItem(COMPLETED_MISSIONS_KEY, JSON.stringify(updated));
    
    window.dispatchEvent(new CustomEvent('mission:completed', { detail: missionId }));
    
    if (updated.length >= TOTAL_MISSIONS) {
      window.dispatchEvent(new CustomEvent('tour:todas-concluidas'));
    }
  }
};

export const resetTrainingProgress = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(COMPLETED_MISSIONS_KEY);
  localStorage.removeItem(GHOST_MODE_KEY);
  localStorage.removeItem(ACTIVE_MISSION_KEY);
  localStorage.removeItem(VICTORY_SHOWN_KEY);
  window.location.reload();
};

export const setGhostMode = (active: boolean) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GHOST_MODE_KEY, active ? 'true' : 'false');
};