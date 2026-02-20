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
        intro: 'Nesta tabela aparecerão todos os seus trabalhos. Você poderá acompanhar o status, os valores totais e realizar ações rápidas.',
        position: 'top',
      }
    ];

    // Só adicionamos o passo de ações se houver dados na tabela
    if (hasPTrabs) {
      baseSteps.push({
        element: '#tour-actions',
        intro: 'Em cada item, você encontrará botões para preencher os detalhes, gerar o relatório para impressão ou clonar o trabalho.',
        position: 'left',
      });
    }

    return baseSteps;
  }, [hasPTrabs]);

  const options = {
    nextLabel: 'Próximo',
    prevLabel: 'Anterior',
    doneLabel: 'Entendi!',
    hidePrev: true,
    showStepNumbers: true,
    showBullets: true,
    exitOnOverlayClick: false,
    overlayOpacity: 0.8,
    scrollToElement: true,
    // Evita erro se um elemento não for encontrado
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