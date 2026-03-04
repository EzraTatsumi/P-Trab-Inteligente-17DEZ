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
 * Reseta o cache local de missões e recarrega a página.
 */
export const resetMissionCache = (userId: string) => {
  localStorage.removeItem(`completed_missions_${userId}`);
  localStorage.removeItem(`victory_shown_${userId}`);
  window.location.reload(); // Força o refresh para limpar o estado do React
};

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
    
    if (typeof window !== 'undefined') {
      const key = getBaseKey(userId);
      const victoryKey = VICTORY_SHOWN_KEY(userId);
      
      // RESET TOTAL LOCAL se o banco estiver zerado
      if (missionIds.length === 0) {
        localStorage.removeItem(key);
        localStorage.removeItem(victoryKey);
        localStorage.removeItem(GHOST_MODE_KEY);
        localStorage.removeItem(ACTIVE_MISSION_KEY);
      } else {
        localStorage.setItem(key, JSON.stringify(missionIds));
      }
    }
    
    return missionIds;
  } catch (error) {
    console.error("Erro ao sincronizar missões:", error);
    return getCompletedMissions(userId);
  }
};

/**
 * Marca uma missão como concluída no Supabase e no cache local.
 */
export const markMissionCompleted = async (missionId: number, userId?: string) => {
  if (typeof window === 'undefined') return;
  try {
    const key = getBaseKey(userId);
    const stored = localStorage.getItem(key);
    const completed = stored ? JSON.parse(stored) : [];
    
    // Adiciona a missão à lista se ela ainda não estiver lá
    let updated = completed;
    if (!completed.includes(missionId)) {
      updated = [...completed, missionId];
      
      // 1. Salva no cache local para a interface reagir imediatamente
      localStorage.setItem(key, JSON.stringify(updated));

      // 2. SALVA DEFINITIVAMENTE NO SUPABASE
      if (userId) {
        const { error } = await supabase
          .from('user_missions' as any)
          .insert({ user_id: userId, mission_id: missionId });
          
        if (error) {
          console.error(`[Árbitro] Erro ao salvar a missão ${missionId} no banco:`, error);
        } else {
          console.log(`[Árbitro] Missão ${missionId} salva no Supabase com sucesso!`);
        }
      }
    }

    // 3. O Árbitro sempre avisa que uma missão individual terminou (para a UI atualizar barras de progresso, etc)
    window.dispatchEvent(new CustomEvent('mission:completed', { detail: { missionId, userId } }));
    
    // 4. O Árbitro checa o placar geral e se o troféu já foi entregue
    const alreadyShown = localStorage.getItem(VICTORY_SHOWN_KEY(userId)) === 'true';

    if (updated.length >= TOTAL_MISSIONS && !alreadyShown) {
      console.log(`[Árbitro] Missão ${missionId} concluída. Placar total: ${updated.length}/${TOTAL_MISSIONS}. Disparando Vitória!`);
      
      setTimeout(() => {
        // O megafone do Árbitro gritando "VITÓRIA" pela primeira e única vez
        window.dispatchEvent(new CustomEvent('tour:todas-concluidas', { detail: { userId } }));
        window.dispatchEvent(new CustomEvent('welcome-modal:refresh'));
      }, 500);
      
    } else if (updated.length >= TOTAL_MISSIONS && alreadyShown) {
      // O usuário está apenas fazendo uma revisão! 
      console.log(`[Árbitro] Revisão da Missão ${missionId} concluída. O usuário já possui o troféu.`);
      
      setTimeout(() => {
        // Atualiza os status silenciosamente, sem estourar confetes
        window.dispatchEvent(new CustomEvent('welcome-modal:refresh'));
      }, 500);
    }
  } catch (error) {
    console.error("Erro ao persistir conclusão:", error);
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