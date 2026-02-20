"use client";

import React, { useMemo } from 'react';
import { Steps } from 'intro.js-react';
import 'intro.js/introjs.css';

interface OnboardingTourProps {
  enabled: boolean;
  onExit: () => void;
  hasPTrabs: boolean;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ enabled, onExit, hasPTrabs }) => {
  // Memoizamos os passos para evitar que o Intro.js reinicie ou perca a referência
  const steps = useMemo(() => {
    const baseSteps = [
      {
        element: '#tour-welcome',
        intro: 'Bem-vindo ao PTrab Inteligente! Vamos te mostrar como gerenciar seus Planos de Trabalho de forma eficiente.',
        position: 'bottom',
      },
      {
        element: '#tour-new-ptrab',
        intro: 'Clique aqui para criar um novo Plano de Trabalho (Minuta). Você preencherá os dados básicos da operação.',
        position: 'bottom',
      },
      {
        element: '#tour-consolidate',
        intro: 'Tem vários PTrabs da mesma operação? Selecione-os na lista e use este botão para consolidar todos os custos em um único documento.',
        position: 'bottom',
      },
      {
        element: '#tour-settings',
        intro: 'Aqui você configura seu perfil, as diretrizes de custeio logístico e os valores operacionais (diárias, passagens, etc).',
        position: 'left',
      },
      {
        element: '#tour-table',
        intro: 'Nesta tabela aparecerão todos os seus trabalhos. Vamos ver o que cada coluna significa.',
        position: 'top',
      },
      {
        element: '#tour-col-number',
        intro: 'Aqui fica o número oficial do PTrab. Enquanto não for aprovado, ele aparecerá como "MINUTA".',
        position: 'bottom',
      },
      {
        element: '#tour-col-operation',
        intro: 'O nome da operação e o rótulo da versão (caso seja uma variação de um trabalho existente).',
        position: 'bottom',
      },
      {
        element: '#tour-col-period',
        intro: 'O período de execução e a duração total em dias da operação.',
        position: 'bottom',
      },
      {
        element: '#tour-col-status',
        intro: 'O status atual (Aberto, Em Andamento, Aprovado ou Arquivado) e se o trabalho é compartilhado.',
        position: 'bottom',
      },
      {
        element: '#tour-col-value',
        intro: 'O resumo financeiro: custos de Logística, Operacional e Material Permanente, além do total geral.',
        position: 'bottom',
      }
    ];

    // Só adicionamos o passo de ações se houver dados na tabela
    if (hasPTrabs) {
      baseSteps.push({
        element: '#tour-actions',
        intro: 'Use estes botões para preencher os detalhes das classes, gerar o relatório para impressão ou realizar ações avançadas no menu.',
        position: 'left',
      });
    }

    return baseSteps;
  }, [hasPTrabs]);

  const options = {
    nextLabel: 'Próximo',
    prevLabel: 'Anterior',
    doneLabel: 'Finalizar Tour',
    hidePrev: false,
    showStepNumbers: true,
    showBullets: true,
    exitOnOverlayClick: false,
    overlayOpacity: 0.8,
    scrollToElement: true,
    exitOnInvalidCriterion: false,
    disableInteraction: true
  };

  return (
    <Steps
      enabled={enabled}
      steps={steps}
      initialStep={0}
      onExit={onExit}
      options={options}
    />
  );
};

export default OnboardingTour;