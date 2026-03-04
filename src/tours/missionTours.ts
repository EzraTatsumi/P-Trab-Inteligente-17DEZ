"use client";

import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { markMissionCompleted } from "@/lib/missionUtils";

let activeMissionDriver: any = null;

// --- FUNÇÃO CENTRAL DE TÉRMINO DE MISSÃO (O "JUIZ") ---
/**
 * Finaliza uma missão, marca o progresso e verifica se o treinamento completo foi concluído.
 */
const finalizarMissao = (missionId: number, userId: string, onComplete?: () => void) => {
  // 1. Executa a marcação padrão no banco/estado
  markMissionCompleted(missionId, userId);

  // 2. Lê o progresso local (garantindo que a missão atual entre na conta imediatamente)
  const progressoAtual = JSON.parse(localStorage.getItem(`completed_missions_${userId}`) || '[]');
  const missoesConcluidas = new Set([...progressoAtual, missionId]);

  // 3. O Juiz verifica: Bateu as 6 missões concluídas no total?
  if (missoesConcluidas.size >= 6) {
    console.log(`[Tour] Missão ${missionId} era a peça que faltava! Disparando vitória...`);
    window.dispatchEvent(
      new CustomEvent('tour:todas-concluidas', { 
          detail: { userId: userId } 
      })
    );
  }

  // 4. Executa o callback final da interface
  if (onComplete) onComplete();
};

export const runMission01 = (userId: string, onComplete?: () => void) => {
  if (activeMissionDriver) activeMissionDriver.destroy();

  activeMissionDriver = driver({
    showProgress: true,
    steps: [
      { 
        element: '.btn-novo-ptrab', 
        popover: { 
          title: 'Missão 1: Criar P Trab', 
          description: 'Clique aqui para iniciar a criação do seu primeiro Plano de Trabalho de simulação.',
          side: "bottom", 
          align: 'start' 
        } 
      }
    ],
    onDestroyed: () => finalizarMissao(1, userId, onComplete)
  });

  activeMissionDriver.drive();
};

export const runMission02 = (userId: string, onComplete?: () => void) => {
  if (activeMissionDriver) activeMissionDriver.destroy();

  activeMissionDriver = driver({
    showProgress: true,
    steps: [
      { 
        element: '.card-diretrizes-operacionais', 
        popover: { 
          title: 'Missão 2: Diretrizes', 
          description: 'Configure os valores base que serão usados nos cálculos automáticos.',
          side: "bottom" 
        } 
      }
    ],
    onDestroyed: () => finalizarMissao(2, userId, onComplete)
  });

  activeMissionDriver.drive();
};

export const runMission03 = (userId: string, onComplete?: () => void) => {
  if (activeMissionDriver) activeMissionDriver.destroy();

  activeMissionDriver = driver({
    showProgress: true,
    steps: [
      { 
        element: '.tabs-logistica', 
        popover: { 
          title: 'Missão 3: Logística', 
          description: 'Preencha os dados de suprimento e manutenção nesta aba.',
          side: "bottom" 
        } 
      }
    ],
    onDestroyed: () => finalizarMissao(3, userId, onComplete)
  });

  activeMissionDriver.drive();
};

export const runMission04 = (userId: string, onComplete?: () => void) => {
  if (activeMissionDriver) activeMissionDriver.destroy();

  activeMissionDriver = driver({
    showProgress: true,
    steps: [
      { 
        element: '.tabs-operacional', 
        popover: { 
          title: 'Missão 4: Operacional', 
          description: 'Preencha diárias e passagens para completar os custos de pessoal.',
          side: "bottom" 
        } 
      }
    ],
    onDestroyed: () => finalizarMissao(4, userId, onComplete)
  });

  activeMissionDriver.drive();
};

export const runMission05 = (userId: string, onComplete?: () => void) => {
  if (activeMissionDriver) activeMissionDriver.destroy();

  activeMissionDriver = driver({
    showProgress: true,
    steps: [
      { 
        element: '.btn-consolidar', 
        popover: { 
          title: 'Missão 5: Consolidação', 
          description: 'Aprenda a unir múltiplos P Trabs em um único documento.',
          side: "bottom" 
        } 
      }
    ],
    onDestroyed: () => finalizarMissao(5, userId, onComplete)
  });

  activeMissionDriver.drive();
};

export const runMission06 = (userId: string, onComplete?: () => void) => {
  if (activeMissionDriver) activeMissionDriver.destroy();

  activeMissionDriver = driver({
    showProgress: true,
    steps: [
      { 
        element: '.btn-acoes-ptrab', 
        popover: { 
          title: 'Missão 6: Finalização', 
          description: 'Visualize a impressão final ou exporte seu trabalho para Excel.',
          side: "left" 
        } 
      }
    ],
    onDestroyed: () => finalizarMissao(6, userId, onComplete)
  });

  activeMissionDriver.drive();
};