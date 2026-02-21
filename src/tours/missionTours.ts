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
          title: 'Missão 01: Centro de Comando',
          description: 'Bem-vindo à sua mesa de operações. Aqui você controla o ciclo de vida completo dos seus Planos de Trabalho.',
        }
      },
      {
        element: '.btn-novo-ptrab',
        popover: {
          title: 'Criar Novo Plano',
          description: 'Aqui você inicia um novo P Trab do zero. Lembre-se: o sistema só permitirá a criação se as diretrizes de custos estiverem configuradas.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '.btn-consolidar',
        popover: {
          title: 'Consolidar Planos',
          description: 'Precisa unir vários P Trabs em um único relatório para um Comando Superior? Este botão faz a consolidação automática de dados e custos.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '.btn-ajuda',
        popover: {
          title: 'Suporte e Manuais',
          description: 'Dúvidas sobre normas ou uso do sistema? Aqui você acessa os manuais e guias rápidos.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: '.btn-configuracoes',
        popover: {
          title: 'Configurações do Sistema',
          description: 'Gerencie OMs vinculadas, anos de referência para cálculos e dados de perfil que sairão nos cabeçalhos dos documentos.',
          side: 'left', 
          align: 'start',
          popoverOffset: 60 // Aumentado para 60px para livrar totalmente o menu
        },
        onHighlighted: () => {
          if ((window as any).openSettings) (window as any).openSettings();
        },
        onDeselected: () => {
          if ((window as any).closeSettings) (window as any).closeSettings();
        }
      },
      {
        element: '.btn-chat-ia',
        popover: {
          title: 'Assistente IA',
          description: 'Dúvidas sobre o DOR ou Natureza de Despesa? O ChatIA conhece todas as normas e ajuda você a redigir justificativas técnicas.',
          side: 'left',
          align: 'end'
        }
      },
      {
        element: '.tabela-ptrabs',
        popover: {
          title: 'Quadro de Situação',
          description: 'Nesta grade, você acompanha o número, a operação e o status de cada plano em tempo real.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '.btn-comentarios',
        popover: {
          title: 'Comunicação Interna',
          description: 'Troque mensagens entre quem preenche e quem revisa, mantendo todo o histórico de alterações no mesmo lugar.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '.btn-preencher-ptrab',
        popover: {
          title: 'Detalhamento de Custos',
          description: 'Use este botão para entrar no formulário e detalhar todas as necessidades logísticas e operacionais da missão.',
          side: 'left',
          align: 'center'
        }
      },
      {
        element: '.btn-preencher-dor',
        popover: {
          title: 'Redação Técnica (DOR)',
          description: 'Após os custos estarem prontos, o sistema gera automaticamente a sua justificativa técnica baseada nos números inseridos.',
          side: 'left',
          align: 'center'
        }
      },
      {
        element: '.btn-aprovar',
        popover: {
          title: 'Homologação Oficial',
          description: 'Este é o selo de qualidade. Quando o plano atende aos requisitos, ele é Aprovado para emissão dos relatórios oficiais.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '.btn-acoes-ptrab',
        popover: {
          title: 'Agilidade e Colaboração',
          description: 'No menu de ações, você pode CLONAR planos complexos de anos anteriores para economizar tempo, ou COMPARTILHAR o acesso com outros militares para trabalho colaborativo.',
          side: 'left', 
          align: 'start',
          popoverOffset: 60 // Aumentado para 60px para livrar totalmente o menu
        },
        onHighlighted: () => {
          if ((window as any).openActions) (window as any).openActions();
        },
        onDeselected: () => {
          if ((window as any).closeActions) (window as any).closeActions();
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