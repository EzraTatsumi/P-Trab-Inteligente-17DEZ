"use client";

import { supabase } from "@/integrations/supabase/client";

export const TOTAL_MISSIONS = 6;

const getBaseKey = (userId?: string) => userId ? `completed_missions_${userId}` : 'completed_missions';
const VICTORY_SHOWN_KEY = (userId?: string) => userId ? `victory_shown_${userId}` : 'victory_shown';
const WELCOME_SHOWN_KEY = (userId?: string) => userId ? `welcome_shown_${userId}` : 'welcome_shown';
const GHOST_MODE_KEY = 'is_ghost_mode';
const ACTIVE_MISSION_KEY = 'active_mission_id';

export const resetMissionCache = (userId: string) => {
  localStorage.removeItem(`completed_missions_${userId}`);
  localStorage.removeItem(`victory_shown_${userId}`);
  localStorage.removeItem(`welcome_shown_${userId}`);
  window.location.reload(); 
};

export const startMission = (missionId: number, userId?: string) => {
  if (typeof window === 'undefined') return;

  localStorage.setItem(GHOST_MODE_KEY, 'true');
  localStorage.setItem(ACTIVE_MISSION_KEY, String(missionId));
  
  window.dispatchEvent(new CustomEvent('ghost-mode:change'));
  
  let targetPath = '/ptrab?startTour=true';
  if (missionId === 2) targetPath = '/config/custos-operacionais?startTour=true';
  else if (missionId === 3 || missionId === 4) targetPath = '/ptrab/form?ptrabId=ghost-ptrab-123&startTour=true';
  else if (missionId === 5) targetPath = '/ptrab/dor?ptrabId=ghost-ptrab-123&startTour=true';
  else if (missionId === 6) targetPath = '/ptrab/print?ptrabId=ghost-ptrab-123&startTour=true';

  window.location.href = targetPath;
};

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

export const markMissionCompleted = async (missionId: number, providedUserId?: string) => {
  if (typeof window === 'undefined') return;
  try {
    let userId = providedUserId;
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id;
    }

    const key = getBaseKey(userId);
    const stored = localStorage.getItem(key);
    const completed = stored ? JSON.parse(stored) : [];
    
    let updated = completed;
    if (!completed.includes(missionId)) {
      updated = [...completed, missionId];
      localStorage.setItem(key, JSON.stringify(updated));

      if (userId) {
        const { error } = await supabase
          .from('user_missions' as any)
          .insert({ user_id: userId, mission_id: missionId });
        if (error) console.error(`[Árbitro] Erro no banco:`, error);
      }
    }

    window.dispatchEvent(new CustomEvent('mission:completed', { detail: { missionId, userId } }));
    
    const alreadyShown = localStorage.getItem(VICTORY_SHOWN_KEY(userId)) === 'true';

    // A LÓGICA DE OURO DO FLUXO:
    setTimeout(() => {
      if (updated.length >= TOTAL_MISSIONS && !alreadyShown) {
        // 1. PRIMEIRA VEZ VENCENDO: Força ida pra tela principal para estourar o banner (Modo Fantasma continua ligado atrás do banner)
        if (window.location.pathname !== '/ptrab') {
            window.location.href = '/ptrab'; 
        } else {
            window.dispatchEvent(new CustomEvent('tour:todas-concluidas', { detail: { userId } }));
        }
      } else {
        // 2. MISSÃO COMUM OU REVISÃO: Continua no Modo Fantasma e apenas volta para o Hub
        if (window.location.pathname !== '/ptrab') {
            window.location.href = '/ptrab?showHub=true';
        } else {
            window.dispatchEvent(new CustomEvent('instruction-hub:open'));
            window.dispatchEvent(new CustomEvent('welcome-modal:refresh'));
        }
      }
    }, 500);

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

// 🎯 FUNÇÕES HÍBRIDAS (localStorage + Supabase)
export const fetchOnboardingStatus = async (userId: string): Promise<{ welcome_shown: boolean; victory_shown: boolean }> => {
  try {
    // Tenta buscar do Supabase primeiro
    const { data, error } = await supabase
      .from('user_onboarding_status' as any)
      .select('welcome_shown, victory_shown')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      console.error("Erro ao buscar status do onboarding:", error);
    }

    // Se encontrou no banco, sincroniza com localStorage
    if (data && !error) {
      const statusData = data as any;
      if (statusData.welcome_shown) {
        localStorage.setItem(WELCOME_SHOWN_KEY(userId), 'true');
      }
      if (statusData.victory_shown) {
        localStorage.setItem(VICTORY_SHOWN_KEY(userId), 'true');
      }
      return statusData;
    }

    // Se não encontrou, usa localStorage como fallback
    return {
      welcome_shown: localStorage.getItem(WELCOME_SHOWN_KEY(userId)) === 'true',
      victory_shown: localStorage.getItem(VICTORY_SHOWN_KEY(userId)) === 'true'
    };
  } catch (error) {
    console.error("Erro ao sincronizar status do onboarding:", error);
    // Fallback para localStorage
    return {
      welcome_shown: localStorage.getItem(WELCOME_SHOWN_KEY(userId)) === 'true',
      victory_shown: localStorage.getItem(VICTORY_SHOWN_KEY(userId)) === 'true'
    };
  }
};

export const markWelcomeAsShown = async (userId?: string) => {
  if (!userId) return;
  
  // Salva no localStorage imediatamente (performance)
  localStorage.setItem(WELCOME_SHOWN_KEY(userId), 'true');
  
  // Salva no Supabase em background (só se tabela existir)
  try {
    const { error } = await supabase
      .from('user_onboarding_status' as any)
      .upsert({ 
        user_id: userId, 
        welcome_shown: true,
        updated_at: new Date().toISOString()
      });
    
    // Ignora erro de tabela não existente (23505 = duplicate key, 42P01 = tabela não existe)
    if (error && !error.code?.includes('23505') && !error.message?.includes('42P01')) {
      console.error("Erro ao salvar welcome_shown no banco:", error);
    }
  } catch (error) {
    // Ignora erros relacionados à tabela não existir
    console.log("Tabela user_onboarding_status não existe ainda, usando apenas localStorage");
  }
};

export const shouldShowWelcome = async (userId?: string): Promise<boolean> => {
  if (!userId) return false;
  
  // Primeiro verifica localStorage (performance)
  const localStatus = localStorage.getItem(WELCOME_SHOWN_KEY(userId)) === 'true';
  if (localStatus) return false;
  
  // Se não tem no localStorage, busca do banco
  try {
    const status = await fetchOnboardingStatus(userId);
    return !status.welcome_shown;
  } catch (error) {
    // Fallback: assume que deve mostrar se não conseguir verificar
    return true;
  }
};

export const markVictoryAsShownSync = async (userId?: string) => {
  if (!userId) return;
  
  // Salva no localStorage imediatamente
  localStorage.setItem(VICTORY_SHOWN_KEY(userId), 'true');
  
  // Salva no Supabase em background
  try {
    const { error } = await supabase
      .from('user_onboarding_status' as any)
      .upsert({ 
        user_id: userId, 
        victory_shown: true,
        updated_at: new Date().toISOString()
      });
    
    if (error) {
      console.error("Erro ao salvar victory_shown no banco:", error);
    }
  } catch (error) {
    console.error("Erro ao marcar victory como shown:", error);
  }
};

export const shouldShowVictorySync = async (userId?: string): Promise<boolean> => {
  if (!userId) return false;
  
  const completed = getCompletedMissions(userId);
  if (completed.length < TOTAL_MISSIONS) return false;
  
  // Primeiro verifica localStorage
  const localStatus = localStorage.getItem(VICTORY_SHOWN_KEY(userId)) === 'true';
  if (localStatus) return false;
  
  // Se não tem no localStorage, busca do banco
  try {
    const status = await fetchOnboardingStatus(userId);
    return !status.victory_shown;
  } catch (error) {
    // Fallback: assume que deve mostrar se não conseguir verificar
    return true;
  }
};

// VERSÕES SYNC (para compatibilidade temporária)
export const shouldShowWelcomeSync = (userId?: string): boolean => {
  // NOVA LÓGICA: Só mostra se welcome_shown NÃO for true
  const welcomeCompleted = localStorage.getItem(WELCOME_SHOWN_KEY(userId)) === 'true';
  console.log(`[DEBUG] shouldShowWelcomeSync for ${userId}:`, welcomeCompleted, 'localStorage:', localStorage.getItem(WELCOME_SHOWN_KEY(userId)));
  return !welcomeCompleted;
};

export const markWelcomeAsShownSync = (userId?: string) => {
  if (!userId) return;
  localStorage.setItem(WELCOME_SHOWN_KEY(userId), 'true');
  
  // Salva no Supabase em background (fire and forget)
  markWelcomeAsShown(userId);
};

export const shouldShowVictorySyncVersion = (userId?: string): boolean => {
  const completed = getCompletedMissions(userId);
  const alreadyShown = localStorage.getItem(VICTORY_SHOWN_KEY(userId)) === 'true';
  return completed.length >= TOTAL_MISSIONS && !alreadyShown;
};

export const markVictoryAsShownSyncVersion = (userId?: string) => {
  localStorage.setItem(VICTORY_SHOWN_KEY(userId), 'true');
  // Salva no Supabase em background (fire and forget)
  markVictoryAsShownSync(userId);
};

// FUNÇÃO ESPECIAL: Marca Welcome como concluído SÓ após "Começar a Operar"
export const markWelcomeAsCompleted = async (userId?: string) => {
  if (!userId) return;
  
  // Salva no localStorage imediatamente
  localStorage.setItem(WELCOME_SHOWN_KEY(userId), 'true');
  
  // Salva no Supabase em background
  try {
    const { error } = await supabase
      .from('user_onboarding_status' as any)
      .upsert({ 
        user_id: userId, 
        welcome_shown: true,
        updated_at: new Date().toISOString()
      });
    
    // Ignora erro de tabela não existir
    if (error && !error.code?.includes('23505') && !error.message?.includes('42P01')) {
      console.error("Erro ao salvar welcome_shown no banco:", error);
    }
  } catch (error) {
    console.log("Tabela user_onboarding_status não existe ainda, usando apenas localStorage");
  }
};

// Versão síncrona para compatibilidade
export const markWelcomeAsCompletedSync = (userId?: string) => {
  if (!userId) return;
  localStorage.setItem(WELCOME_SHOWN_KEY(userId), 'true');
  
  // Salva no Supabase em background (fire and forget)
  markWelcomeAsCompleted(userId);
};

/**
 * Sai do modo fantasma. Aceita um caminho de redirecionamento opcional.
 */
export const exitGhostMode = (userId?: string, redirectPath: string = '/ptrab') => {
  localStorage.removeItem(GHOST_MODE_KEY);
  localStorage.removeItem(ACTIVE_MISSION_KEY);
  window.location.href = redirectPath;
};