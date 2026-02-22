"use client";

import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import "./tour.css"; // Importando estilos customizados centralizados

let activeMissionDriver: any = null;

// Escuta o sinal do React para avançar o tour magicamente
if (typeof window !== 'undefined') {
  window.addEventListener('tour:avancar', () => {
    if (activeMissionDriver) {
      // O setTimeout garante que a janela do Shadcn termine de abrir antes de iluminar
      setTimeout(() => {
        activeMissionDriver.moveNext();
      }, 400); 
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

export const runMission01 = (onComplete: () => void) => {
  const d = driver({
    ...commonConfig,
    steps: [
      {
        popover: {
          title: 'Missão 01: Gerencie o seu P Trab',
          description: 'Bem-vindo ao Gerenciamento de P Trab. Aqui você controla o ciclo de vida completo dos seus Planos de Trabalho.',
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
          description: 'Precisa unir vários P Trabs em um único relatório? Este botão faz a consolidação automática de dados e custos.',
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
          description: 'Vincule trabalhos colaborativos, Diretrizes de Custeio Logístico e de Custos Operacionais e Importe/Exporte dados de P Trab.',
          side: 'left',
          align: 'start',
          popoverClass: 'popover-wide',
          offset: 20 // Adiciona 20px de distância do botão para não bater no menu
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
          title: 'Quadro de Dados do P Trab',
          description: 'Nesta grade, você acompanha o número, a operação e o status de cada plano em tempo real.',
          side: 'top',
          align: 'start'
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
          title: 'Detalhamento de Necessidades',
          description: 'Use este botão para entrar no formulário e detalhar todas as necessidades logísticas e operacionais da operação.',
          side: 'left',
          align: 'center'
        }
      },
      {
        element: '.btn-preencher-dor',
        popover: {
          title: 'Preenchimento do DOR',
          description: 'Finalizado o P Trab, essa ferramenta auxilia na montagem do DOR, expecialmente ao agrupar os custos conforme a sua necessidade.',
          side: 'left',
          align: 'center'
        }
      },
      {
        element: '.btn-aprovar',
        popover: {
          title: 'Pronto para Despacho',
          description: 'Quando finalizado o P Trab e deseja gerar o seu número de controle, basta APROVAR que ficará registrado como finalizado',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '.btn-acoes-ptrab',
        popover: {
          title: 'Agilidade e Colaboração',
          description: 'No menu de ações, você pode CLONAR planos complexos de anos anteriores para economizar tempo, ou COMPARTILHAR o acesso com outros militares para trabalho colaborativo.',
          side: 'top',
          align: 'end',
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
        element: '.card-diretrizes-operacionais',
        popover: {
          title: 'Missão 02: Inteligência PNCP',
          description: 'Aqui definimos os preços de referência. É a base de cálculo que garante que nenhum P Trab use valores defasados.',
          side: 'bottom'
        }
      },
      {
        element: '.aba-material-consumo',
        popover: {
          title: 'Organização por ND',
          description: 'A seção de Material de Consumo organiza tudo por Subitem da Natureza de Despesa (ND). Veja que já temos alguns itens cadastrados.',
          side: 'left',
          align: 'start',
          offset: 40
        },
        onHighlighted: () => {
          if ((window as any).expandMaterialConsumo) {
            (window as any).expandMaterialConsumo();
          }
        }
      },
      {
        element: '.btn-novo-subitem', 
        popover: { 
          title: 'Sua Vez: Mão na Massa!', 
          description: 'Clique neste botão para abrir a janela de criação de Subitem. Eu espero por você!', 
          side: 'top', 
          align: 'center',
          showButtons: [] 
        }
      },
      {
        element: '.modal-novo-subitem', 
        popover: { 
          title: 'Campos Obrigatórios', 
          description: 'Primeiro, preencha o "Número do Subitem" (ex: 22) e o "Nome do Subitem" (ex: Material de Limpeza). Estes campos são essenciais para a organização.', 
          side: 'left', 
          align: 'start', 
          offset: 30
        }
      },
      {
        element: '.btn-importar-pncp', 
        popover: { 
          title: 'O Salto Tecnológico', 
          description: 'Agora, clique no botão "Importar via API PNCP" para buscar preços oficiais sem precisar digitar.', 
          side: 'left', 
          align: 'start', 
          offset: 30,
          showButtons: []
        }
      },
      {
        element: '.form-busca-uasg-tour',
        popover: {
          title: 'Busca por UASG',
          description: 'Digite a UASG 160222 e clique em "Buscar ARPs por UASG". Vamos listar as atas vigentes desta Organização Militar.',
          side: 'bottom',
          align: 'center',
          showButtons: []
        }
      },
      {
        element: '.modal-importar-pncp',
        popover: {
          title: 'Navegação de Resultados',
          description: 'O sistema encontrou os resultados! Agora, clique em "Expandir" no Pregão, depois em "Ver Itens" na ARP, selecione o "Cimento Portland" e clique em "Importar Selecionados".',
          side: 'top', 
          align: 'center',
          offset: 30,
          showButtons: []
        }
      },
      {
        element: '.btn-salvar-subitem',
        popover: {
          title: 'Finalização e Salvamento',
          description: 'Excelente! O item foi importado com todos os dados oficiais. Agora basta clicar em "Cadastrar Subitem" para salvar no seu catálogo.',
          side: 'top',
          align: 'end'
        }
      }
    ],
    onDestroyed: onComplete
  });
  activeMissionDriver = d;
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