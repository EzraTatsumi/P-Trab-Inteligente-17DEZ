"use client";

import React from 'react';
import { Steps } from 'intro.js-react';
import 'intro.js/introjs.css';

interface OnboardingTourProps {
  enabled: boolean;
  onExit: () => void;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ enabled, onExit }) => {
  const steps = [
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
    },
    {
      element: '#tour-actions',
      intro: 'Em cada item, você encontrará botões para preencher os detalhes, gerar o relatório para impressão ou clonar o trabalho.',
      position: 'left',
    }
  ];

  const options = {
    nextLabel: 'Próximo',
    prevLabel: 'Anterior',
    doneLabel: 'Entendi!',
    hidePrev: true,
    showStepNumbers: true,
    showBullets: true,
    exitOnOverlayClick: false,
    overlayOpacity: 0.8,
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