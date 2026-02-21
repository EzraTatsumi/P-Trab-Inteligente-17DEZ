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
          description: 'Aqui você gerencia o ciclo de vida completo dos seus Planos de Trabalho. Vamos conhecer as ferramentas de controle.',
        }
      },
      {
        element: '.btn-novo-ptrab',
        popover: {
          title: 'Criar Novo Plano',
          description: 'Aqui você inicia um novo P Trab do zero. O sistema só permite a criação se as OMs e Diretrizes de custos estiverem configuradas no seu perfil.',
        }
      },
      {
        element: '.btn-consolidar',
        popover: {
          title: 'Consolidar Planos',
          description: 'Precisa unir vários P Trabs em um único relatório para um Comando Superior? Este botão realiza a soma automática de todos os dados e custos de planos selecionados.',
        }
      },
      {
        element: '.btn-ajuda',
        popover: {
          title: 'Central de Ajuda',
          description: 'Acesse manuais, regras de negócio e documentação técnica sempre que tiver dúvidas sobre o preenchimento ou cálculos.',
        }
      },
      {
        element: '.btn-configuracoes',
        popover: {
          title: 'Configurações do Sistema',
          description: 'Gerencie suas OMs vinculadas, defina os anos de referência para os cálculos e ajuste seus dados de perfil que sairão nos cabeçalhos dos documentos.',
        }
      },
      {
        element: '.tabela-ptrabs',
        popover: {
          title: 'Quadro de Situação',
          description: 'Nesta grade você acompanha o número, a operação, o status e os valores totais de cada projeto em tempo real.',
        }
      },
      {
        element: '.btn-comentarios',
        popover: {
          title: 'Comunicação Interna',
          description: 'Utilize os comentários para trocar mensagens entre quem preenche e quem revisa, mantendo o histórico de orientações no próprio documento.',
        }
      },
      {
        element: '.btn-preencher-ptrab',
        popover: {
          title: 'Detalhamento de Custos',
          description: 'Este é o coração do sistema. Aqui você lança todos os itens logísticos e operacionais da sua missão.',
        }
      },
      {
        element: '.btn-preencher-dor',
        popover: {
          title: 'Justificativa Técnica (DOR)',
          description: 'Após concluir os custos, o sistema gera automaticamente a sua Documentação de Oficialização de Demanda baseada nos números inseridos.',
        }
      },
      {
        element: '.btn-aprovar',
        popover: {
          title: 'Homologação e Numeração',
          description: 'O selo de qualidade. Quando o plano está pronto, este botão atribui o número oficial e encerra a fase de minuta para emissão dos relatórios.',
        }
      },
      {
        element: '.btn-acoes',
        popover: {
          title: 'Clonagem e Compartilhamento',
          description: 'No menu de ações, você pode CLONAR planos de anos anteriores para ganhar tempo, ou COMPARTILHAR o acesso para que outros militares ajudem no preenchimento.',
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