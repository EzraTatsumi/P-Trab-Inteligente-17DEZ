"use client";

import { driver } from "driver.js";
import "driver.js/dist/driver.css";

const commonConfig = {
  showProgress: true,
  allowClose: true,
  nextBtnText: 'Próximo',
  prevBtnText: 'Anterior',
  doneBtnText: 'Concluir Missão',
};

export const runMission01 = (onComplete: () => void) => {
  const d = driver({
    ...commonConfig,
    steps: [
      {
        popover: {
          title: 'Bem-vindo ao Centro de Comando!',
          description: 'Aqui você gerencia todos os seus Planos de Trabalho. Vamos conhecer as ferramentas principais.',
        }
      },
      {
        element: '.btn-novo-ptrab',
        popover: {
          title: 'Criação de Planos',
          description: 'Este botão inicia um novo P Trab. Note que ele só habilita quando sua base (OM e Diretrizes) está configurada.',
        }
      },
      {
        element: '.ptrab-original',
        popover: {
          title: 'Origem do Documento',
          description: 'Identifique rapidamente se o P Trab é Original, Importado ou uma Consolidação de vários outros.',
        }
      },
      {
        element: 'button:has(svg.lucide-copy)', // Seletor alternativo para o botão de clonar se estiver visível
        popover: {
          title: 'O Pulo do Gato',
          description: 'Não refaça o trabalho! Use a clonagem para aproveitar dados de operações anteriores e apenas ajustar as quantidades.',
        }
      }
    ],
    onDestroyed: onComplete
  });
  d.drive();
};

export const runMission02 = (onComplete: () => void) => {
  const d = driver({
    ...commonConfig,
    steps: [
      {
        element: '.aba-material-consumo',
        popover: {
          title: 'Diretrizes Operacionais',
          description: 'Aqui definimos os preços de referência. Vamos ver como a inteligência do sistema funciona.',
        }
      },
      {
        element: '.btn-importar-pncp',
        popover: {
          title: 'Inteligência PNCP',
          description: 'Este é o nosso grande diferencial. Em vez de digitar preços, vamos buscar dados oficiais.',
        }
      },
      {
        element: 'input[placeholder*="Ex: 604269"]',
        popover: {
          title: 'Busca por Código',
          description: 'Ao inserir o código CATMAT/CATSER, o sistema consulta o Portal Nacional de Contratações Públicas em tempo real.',
        }
      },
      {
        popover: {
          title: 'Resultado da Simulação',
          description: 'O sistema traria a descrição oficial e o preço homologado (ex: Cimento Portland por R$ 42,50), garantindo conformidade jurídica total.',
        }
      }
    ],
    onDestroyed: onComplete
  });
  d.drive();
};

export const runMission03 = (onComplete: () => void) => {
  const d = driver({
    ...commonConfig,
    steps: [
      {
        element: '.lg\\:col-span-2',
        popover: {
          title: 'O Formulário Padrão',
          description: 'Todos os itens seguem a mesma lógica de preenchimento, facilitando o aprendizado.',
        }
      },
      {
        element: '.tabs-logistica',
        popover: {
          title: 'Classes de Suprimento',
          description: 'Aqui você detalha itens de Classe I a IX. O sistema já conhece os fatores de consumo baseados nas suas diretrizes.',
        }
      },
      {
        element: '.tabs-operacional',
        popover: {
          title: 'Custos de Missão',
          description: 'Diárias, passagens e serviços de terceiros são lançados aqui, integrando-se ao cálculo global.',
        }
      }
    ],
    onDestroyed: onComplete
  });
  d.drive();
};

export const runMission04 = (onComplete: () => void) => {
  const d = driver({
    ...commonConfig,
    steps: [
      {
        element: '.card-cost-summary',
        popover: {
          title: 'Contabilidade Gerencial',
          description: 'Este painel monitora o teto orçamentário em tempo real.',
        }
      }
    ],
    onDestroyed: onComplete
  });
  d.drive();
};