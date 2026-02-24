"use client";

import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import "./tour.css"; 
import { markMissionCompleted } from "@/lib/missionUtils";

let activeMissionDriver: any = null;

if (typeof window !== 'undefined') {
  window.addEventListener('tour:avancar', () => {
    if (activeMissionDriver) {
      const popover = document.querySelector('.driver-popover') as HTMLElement;
      if (popover) {
        popover.style.opacity = '0';
        popover.style.transition = 'none';
      }

      const currentIndex = activeMissionDriver.getActiveIndex();
      const steps = activeMissionDriver.getConfig().steps;
      const nextStep = steps[currentIndex + 1];

      if (nextStep && nextStep.element) {
        let attempts = 0;
        const checkInterval = setInterval(() => {
          const el = document.querySelector(nextStep.element as string);
          attempts++;

          if (el || attempts > 30) {
            clearInterval(checkInterval);
            setTimeout(() => {
              if (activeMissionDriver.hasNextStep()) {
                activeMissionDriver.moveNext();
              }
            }, 100);
          }
        }, 100);
      } else {
        setTimeout(() => {
          if (activeMissionDriver.hasNextStep()) activeMissionDriver.moveNext();
        }, 300);
      }
    }
  });
}

const commonConfig = {
  showProgress: true,
  allowClose: true,
  nextBtnText: 'Próximo',
  prevBtnText: 'Anterior',
  doneBtnText: 'Concluir Missão',
};

// ... runMission01, 02, 03, 04, 05 permanecem iguais ...
// (Omitindo para brevidade, mas mantendo a lógica de exportação completa)

export { runMission01, runMission02, runMission03, runMission04, runMission05 };

export const runMission06 = (onComplete: () => void) => {
  const d = driver({
    ...commonConfig,
    steps: [
      {
        element: '#tour-mat-consumo-row',
        popover: {
          title: 'O Resultado do seu Trabalho',
          description: 'Lembra-se da Missão 3? Aqui está o seu Grupo de Material de Construção, consolidado com o valor de R$ 1.250,50 e a respectiva memória de cálculo gerada pronta para o ordenador de despesas.',
          side: 'bottom',
          align: 'center'
        },
        onHighlighted: () => {
          const el = document.querySelector('#tour-mat-consumo-row');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      },
      {
        element: '.btn-export-pdf',
        popover: {
          title: 'Documento Oficial',
          description: 'Precisa anexar ao processo administrativo? Exporte o relatório em PDF.',
          side: 'bottom',
          align: 'center'
        },
        onHighlighted: () => { window.scrollTo({ top: 0, behavior: 'smooth' }); }
      },
      {
        element: '.btn-export-excel',
        popover: {
          title: 'Versão Editável',
          description: 'Para ajustes manuais, exporte a planilha completa para o Excel com todas as colunas separadas.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '.btn-print',
        popover: {
          title: 'Impressão Direta',
          description: 'Envie diretamente para a impressora sem precisar baixar o arquivo.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '.tour-report-selector',
        popover: {
          title: 'Explore os Anexos',
          description: 'Nesta lista, pode acessar a todos os outros relatórios (Logístico, DOR, etc.). Missão cumprida!',
          side: 'left',
          align: 'start',
          popoverClass: 'z-tour-portal'
        },
        onHighlighted: (element) => {
          // Expande a lista e garante que o portal do Select fique visível
          setTimeout(() => {
            const trigger = document.querySelector('.tour-report-selector') as HTMLElement;
            if (trigger) trigger.click();
          }, 300);
        }
      }
    ],
    onDestroyed: () => {
      markMissionCompleted(6);
      if (onComplete) onComplete();
    }
  });
  
  activeMissionDriver = d;
  d.drive();
};