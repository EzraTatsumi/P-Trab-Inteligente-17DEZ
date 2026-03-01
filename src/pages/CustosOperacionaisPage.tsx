"use client";

import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import "./tour.css"; 
import { markMissionCompleted } from "@/lib/missionUtils";

let activeMissionDriver: any = null;

if (typeof window !== 'undefined') {
  window.addEventListener('tour:avancar', () => {
    if (activeMissionDriver) {
      const currentIndex = activeMissionDriver.getActiveIndex();
      const steps = activeMissionDriver.getConfig().steps;
      const totalSteps = steps.length;

      // Proteção de Transbordamento: Se já estivermos no último passo, não avance!
      if (currentIndex >= totalSteps - 1) {
        return; 
      }
      
      // TRAVA MANUAL: Se estiver no Passo 09 (índice 8), ignore avanços automáticos
      // Isso força o usuário a clicar em "Próximo" após revisar a tabela
      if (currentIndex === 8) {
        console.log("[Tour] Em modo manual no Passo 09. Aguardando clique do usuário.");
        return;
      }

      const popover = document.querySelector('.driver-popover') as HTMLElement;
      if (popover) {
        popover.style.opacity = '0';
        popover.style.transition = 'none';
      }

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

export const runMission01 = (userId: string, onComplete: () => void) => {
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
          description: 'Dúvidas sobre normas ou uso do sistema? Aqui você accesses os manuais e guias rápidos.',
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
          align: 'end',
          popoverClass: 'popover-wide'
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
          showButtons: ['next', 'previous']
        },
        onHighlighted: () => {
          if ((window as any).openActions) (window as any).openActions();
        },
        onDeselected: () => {
          if ((window as any).closeActions) (window as any).closeActions();
        }
      }
    ],
    onDestroyed: () => {
      markMissionCompleted(1, userId);
      if (onComplete) onComplete();
    }
  });
  d.drive();
};

export const runMission02 = (userId: string, onComplete: () => void) => {
  const d = driver({
    ...commonConfig,
    allowClose: false, 
      steps: [
      {
        element: '.card-diretrizes-operacionais',
        popover: {
          title: 'Missão 02: Inteligência PNCP',
          description: 'Aqui definimos os valores de referência. É a base de cálculo que garante que nenhum P Trab use valores defasados.',
          side: 'left',
          align: 'start'
        },
        onHighlighted: () => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      },
      {
        element: '.aba-material-consumo',
        popover: {
          title: 'Organização por ND',
          description: 'A seção de Material de Consumo organiza tudo por Subitem da Natureza de Despesa. Veja que já temos alguns itens cadastrados.',
          side: 'left',
          align: 'start'
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
        element: '.tour-dados-subitem', 
        popover: { 
          title: 'Campos Obrigatórios', 
          description: 'Primeiro, preencha o "Número do Subitem" (ex: 24) e o "Nome do Subitem" (ex: Material p/ Manutenção de Bens Imóveis/Instalação).', 
          side: 'top', 
          align: 'center'
        }
      },
      {
        element: '.btn-importar-pncp', 
        popover: { 
          title: 'O Salto Tecnológico', 
          description: 'Agora, clique no botão "Importar via API PNCP" para buscar dados de itens em ARP/Pregões.', 
          side: 'left', 
          align: 'start', 
          showButtons: []
        }
      },
      {
        element: '.form-busca-uasg-tour',
        popover: {
          title: 'Busca por UASG',
          description: 'O formulário agora está liberado! Digite a UASG 160222 e clique no botão "Buscar ARPs por UASG" logo abaixo.',
          side: 'bottom',
          align: 'center',
          showButtons: []
        }
      },
      {
        element: '.modal-importar-pncp',
        popover: {
          title: 'Navegação de Resultados',
          description: 'O sistema encontrou os resultados! Agora, clique na seta para expandir o Pregão, selecione o item desejado e clique em "Preparar Importação" no rodapé.',
          side: 'top', 
          align: 'center',
          showButtons: []
        }
      },
      {
        element: '.tour-inspection-dialog',
        popover: {
          title: 'Esteira de Inspeção',
          description: 'Este é o cérebro do sistema. Aqui verificamos se o item é novo ou duplicado. Se o item estiver "Pronto", clique em "Importar" para levá-lo à sua grade.',
          side: 'top', 
          align: 'center',
          showButtons: []
        }
      },
      {
        element: '.tabela-itens-aquisicao',
        popover: {
          title: 'Item na Grade',
          description: 'Excelente! O item foi validado e importado. Revise as informações na tabela e, quando estiver pronto, clique em "Próximo" para finalizar o cadastro do Subitem.',
          side: 'top', 
          align: 'center',
          showButtons: ['next', 'previous']
        },
        onHighlighted: (el) => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      },
      {
        element: '.btn-salvar-subitem',
        popover: {
          title: 'Finalização do Cadastro',
          description: 'Excelente! Agora clique em "Cadastrar Subitem" para salvar este novo grupo no seu catálogo.',
          side: 'top', 
          align: 'end',
          showButtons: []
        }
      },
      {
        element: '#diretriz-material-consumo-ghost-subitem-24',
        popover: {
          title: 'Missão Cumprida!',
          description: 'Excelente trabalho! O Subitem 24 foi registrado. Clique no botão abaixo para concluir formalmente esta missão.',
          side: 'top',
          align: 'center',
          showButtons: ['next'],
          nextBtnText: 'Concluir Missão',
          doneBtnText: 'Concluir Missão',
        },
        onHighlighted: (el) => {
          el.style.zIndex = "1000001";
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // TRAVA DE SEGURANÇA: Impede que o tour feche ao clicar no elemento iluminado
          htmlEl.addEventListener('click', (e) => e.stopPropagation(), { capture: true });
        };
        }
      }
    ],
    onDestroyed: () => {
      markMissionCompleted(2, userId);
      if (onComplete) onComplete();
    }
  });
  activeMissionDriver = d;
  d.drive();
};

export const runMission03 = (userId: string, onComplete: () => void) => {
  const d = driver({
    ...commonConfig,
    stagePadding: 15, 
    steps: [
      {
        element: '.card-selecao-material',
        popover: {
          title: 'Missão 03: Detalhamento Operacional',
          description: 'Nesta missão, vamos aprender a detalhar as necessidades operacionais do seu P Trab.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '.tabs-logistica',
        popover: {
          title: 'Classes de Suprimento',
          description: 'Aqui você detalha itens de Classe I a IX. O sistema já conhece os fatores de consumo baseados suas diretrizes.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '.tabs-operacional',
        popover: {
          title: 'Custos de Missão',
          description: 'Diárias, passagens e serviços de terceiros são lançados aqui, integrando-se ao cálculo global.',
          side: 'bottom',
          align: 'center'
        },
        onHighlighted: () => {
          if ((window as any).setTabOperacional) (window as any).setTabOperacional();
        }
      },
      {
        element: '.btn-material-consumo',
        popover: {
          title: 'Material de Consumo',
          description: 'Agora, clique em "Material de Consumo" para iniciar o detalhamento desta categoria.',
          side: 'top',
          align: 'center',
          showButtons: []
        }
      },
      {
        element: '.secao-1-form-material',
        popover: {
          title: 'Dados Identificados',
          description: 'Para agilizar, a OM e a Fase da Atividade já foram preenchidas automaticamente.',
          side: 'top',
          align: 'center'
        },
        onHighlighted: () => {
          if ((window as any).forcePrefillMission03) (window as any).forcePrefillMission03();
        }
      },
      {
        element: '.secao-2-planejamento',
        popover: {
          title: 'Planejamento de Custos',
          description: 'Preenchemos o período (15 dias) e o efetivo (150 militares). Agora, clique em "Criar Novo Grupo de Aquisição" para selecionar os itens.',
          side: 'top',
          align: 'center',
          showButtons: ['previous']
        },
        onHighlighted: () => {
          if ((window as any).prefillSection2) (window as any).prefillSection2();
        }
      },
      {
        element: '.tour-group-form-card', 
        popover: {
          title: 'Criação do Grupo',
          description: 'Preenchemos o nome do grupo como "Material de Construção". Agora clique em "Importar/Alterar Itens" para selecionar os materiais.',
          side: 'top',
          align: 'center',
          showButtons: []
        },
        onHighlighted: () => {
          if ((window as any).prefillGroupName) (window as any).prefillGroupName();
        }
      },
      {
        element: '.tour-item-selector-dialog',
        popover: {
          title: 'Seleção de Itens',
          description: 'Aqui estão os subitens disponíveis. Selecione o item desejado e clique em "Confirmar Seleção". Eu avançarei assim que você fechar esta janela!',
          side: 'top',
          align: 'center',
          showButtons: []
        }
      },
      {
        element: '.tour-group-form-card', 
        popover: {
          title: 'Definindo Quantidades',
          description: 'Excelente! O item foi importado. Definimos automaticamente 5 unidades para ele. Agora, clique em "Salvar Grupo" para finalizar esta etapa.',
          side: 'top',
          align: 'center',
          showButtons: []
        },
        onHighlighted: () => {
          const input = document.querySelector('.tour-item-quantity-input') as HTMLInputElement;
          if (input) {
            input.value = '5';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      },
      {
        element: '.tour-planning-container', 
        popover: {
          title: 'Revisão do Lote',
          description: 'O grupo "Material de Construção" foi criado com sucesso. Agora, clique em "Salvar Itens na Lista" para preparar o envio dos dados.',
          side: 'top',
          align: 'center',
          showButtons: []
        },
        onHighlighted: (element) => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      },
      {
        element: '.tour-section-3-pending',
        popover: {
          title: 'Conferência Final',
          description: 'Confira os dados consolidados do lote. Se tudo estiver correto, clique em "Salvar Registros" para gravar permanentemente no P Trab.',
          side: 'top',
          align: 'center',
          showButtons: []
        },
        onHighlighted: (element) => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      },
      {
        element: '.tour-section-4-saved',
        popover: {
          title: 'Registros Salvos',
          description: 'Parabéns! Os registros agora estão salvos e aparecem na lista de OMs Cadastradas, somando ao valor total do seu Plano de Trabalho.',
          side: 'top',
          align: 'center'
        },
        onHighlighted: (element) => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      },
      {
        element: '.tour-section-5-memories',
        popover: {
          title: 'Memórias de Cálculo',
          description: 'O sistema gerou automaticamente as memórias de cálculo detalhadas. Você pode editá-las manualmente se precisar de justificativas técnicas específicas.',
          side: 'top',
          align: 'center'
        },
        onHighlighted: (element) => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    ],
    onDestroyed: () => {
      markMissionCompleted(3, userId);
      if (onComplete) onComplete();
    }
  });
  activeMissionDriver = d;
  
  setTimeout(() => {
    d.drive();
  }, 300);
};

export const runMission04 = (userId: string, onComplete: () => void) => {
  const d = driver({
    ...commonConfig,
    steps: [
      {
        element: '.tour-cost-summary-card',
        popover: {
          title: 'Missão 04: Contabilidade Gerencial',
          description: 'Este painel é o coração financeiro do seu P Trab. Ele consolida todos os custos lançados e monitora o teto orçamentário em tempo real. Clique em "MAIS DETALHES" para ver o custo de cada categoria.',
          side: 'left',
          align: 'start',
          showButtons: [] 
        }
      },
      {
        element: '#tour-material-consumo-row',
        popover: {
          title: 'Detalhamento de Custos',
          description: 'Veja que o "Material de Consumo" que detalhamos na Missão 3 já está contabilizado aqui, com o valor mockado de R$ 1.250,50.',
          side: 'left',
          align: 'center'
        }
      },
      {
        element: '.tour-btn-view-by-om',
        popover: {
          title: 'Visão por Organização',
          description: 'Além da visão global, você pode analisar os custos distribuídos por cada Organização Militar. Clique em "Ver por OM" para alternar a visão.',
          side: 'top',
          align: 'start',
          showButtons: []
        }
      },
      {
        element: '.tour-costs-by-om-list',
        popover: {
          title: 'Custos por OM',
          description: 'Agora a lista exibe o impacto financeiro individual de cada OM no Plano de Trabalho.',
          side: 'left',
          align: 'start'
        },
        onHighlighted: () => {
          if ((window as any).switchToByOmView) (window as any).switchToByOmView();
        }
      },
      {
        element: '.tour-om-grouping-controls',
        popover: {
          title: 'Agrupamento Inteligente',
          description: 'Você pode alternar entre "OM Solicitante" (quem executa) ou "OM Destino" (quem detém o recurso), facilitando a prestação de contas.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '.tour-mock-om-item',
        popover: {
          title: 'Análise Individual',
          description: 'Clique na OM "1º BIS" para ver o detalhamento completo dos gastos vinculados a ela.',
          side: 'top',
          align: 'center',
          showButtons: []
        }
      },
      {
        element: '.tour-om-details-dialog',
        popover: {
          title: 'Raio-X da OM',
          description: 'Este diálogo mostra exatamente onde o recurso será aplicado dentro desta OM específica. Missão cumprida! Você agora domina a gestão de custos do P Trab Inteligente.',
          side: 'top',
          align: 'center'
        }
      }
    ],
    onDestroyed: () => {
      markMissionCompleted(4, userId);
      if (onComplete) onComplete();
    }
  });
  activeMissionDriver = d;
  d.drive();
};

export const runMission05 = (userId: string, onComplete: () => void) => {
  const d = driver({
    ...commonConfig,
    steps: [
      {
        element: '.tour-dor-document',
        popover: {
          title: 'Missão 05: Editor de DOR',
          description: 'O Documento de Oficialização da Requisição (DOR) é a peça formal que inicia o processo de contratação. Este editor permite redigir o documento com agilidade, integrando os dados do P Trab.',
          side: 'top',
          align: 'center'
        },
        onHighlighted: () => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      },
      {
        element: '#tour-dor-number',
        popover: {
          title: 'Número do Documento',
          description: 'Comece preenchendo o número sequencial do DOR (ex: 01). Este número identificará a requisição no seu controle interno.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '.tour-dor-contato',
        popover: {
          title: 'Dados de Contato',
          description: 'Preencha seu e-mail institucional e um telefone de contato. Estas dados são essenciais para que o setor de aquisições possa tirar dúvidas técnicas.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '.tour-dor-finalidade',
        popover: {
          title: 'Finalidade Técnica',
          description: 'A finalidade foi preenchida automaticamente com base na Operação SENTINELA. Você pode ajustar o texto conforme a necessidade específica deste documento.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '.tour-dor-motivacao',
        popover: {
          title: 'Motivação da Demanda',
          description: 'A motivação foi preenchida com a referência da Mensagem de Operações (Msg Op nº 196 - CCOp/CMN, de 15 ABR 24).',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '.tour-dor-consequencia',
        popover: {
          title: 'Justificativa de Risco',
          description: 'Aqui descremeos o impacto negativo caso a requisição não seja atendida. Este campo é crucial para a análise do Ordenador de Despesas.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '.tour-dor-observacoes',
        popover: {
          title: 'Observações e Normas',
          description: 'As observações gerais já incluem as cláusulas padrão de conformidade com o SIOP e memórias de cálculo. Revise-as e adicione pontos específicos se houver.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '.tour-dor-descricao-item',
        popover: {
          title: 'Descrição do Item',
          description: 'Esta seção detalha o que está sendo requisitado, incluindo UGE, GND e valores consolidados.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '.btn-importar-dados-dor',
        popover: {
          title: 'Importação de Dados',
          description: 'Clique no botão para abrir a sessão de importação e agrupar os custos do seu P Trab.',
          side: 'top',
          align: 'center',
          showButtons: []
        }
      },
      {
        element: '.tour-dor-importer-content',
        popover: {
          title: 'Assistente de Agrupamento',
          description: 'Esta ferramenta permite consolidar diversos itens do P Trab em grupos lógicos para o DOR, facilitando a leitura e o empenho.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '.tour-group-creation-container',
        popover: {
          title: 'Criando Grupos',
          description: "Digite 'Material de Consumo' no campo de texto e clique em 'Criar Grupo'.",
          side: 'bottom',
          align: 'center',
          showButtons: []
        }
      },
      {
        element: '.tour-item-material-consumo',
        popover: {
          title: 'Agrupando Custos',
          description: "Agora, clique na seta à direita do item 'Material de Consumo' para movê-lo para o grupo que você acabou de criar.",
          side: 'right',
          align: 'center',
          showButtons: []
        }
      },
      {
        element: '.btn-confirmar-importacao-dor',
        popover: {
          title: 'Confirmar Importação',
          description: "Excelente! O item foi alocado. Agora clique em 'Confirmar Importação' para levar os dados para o documento.",
          side: 'top',
          align: 'center',
          showButtons: []
        }
      },
      {
        element: '.tour-dor-items-section',
        popover: {
          title: 'Dados Importados',
          description: 'Veja! Os dados foram importados e formatados na tabela do documento, agrupados por UGE e GND.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '.btn-salvar-dor',
        popover: {
          title: 'Finalização',
          description: 'Tudo pronto! Agora basta salvar o DOR para concluir o processo. Missão cumprida!',
          side: 'bottom',
          align: 'end',
          showButtons: ['next', 'previous']
        }
      }
    ],
    onDestroyed: () => {
      markMissionCompleted(5, userId);
      if (onComplete) onComplete();
    }
  });
  activeMissionDriver = d;
  d.drive();
};

export const runMission06 = (userId: string, onComplete: () => void) => {
  const d = driver({
    ...commonConfig,
    steps: [
      {
        element: '.tour-material-row',
        popover: {
          title: 'Material de Consumo',
          description: 'Veja aqui o item que mockamos. Ele aparece com todos os valores e a memória de cálculo que definimos.',
          side: 'bottom',
          align: 'center'
        },
        onHighlighted: () => {
          const el = document.querySelector('.tour-material-row');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      },
      {
        element: '.btn-export-pdf',
        popover: {
          title: 'Exportar PDF',
          description: 'Gere o documento oficial em formato PDF pronto para assinatura.',
          side: 'bottom',
          align: 'center'
        },
        onHighlighted: () => { window.scrollTo({ top: 0, behavior: 'smooth' }); }
      },
      {
        element: '.btn-export-excel',
        popover: {
          title: 'Exportar Excel',
          description: 'Precisa manipular os dados? Exporte para planilha com um clique.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '.btn-print',
        popover: {
          title: 'Impressão Direta',
          description: 'Envie o relatório para a impressora sem precisar baixar arquivos.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '.tour-report-selector',
        popover: {
          title: 'Outros Relatórios',
          description: 'Missão cumprida! Utilize este menu para navegar entre os anexos Logístico, de Ração, Horas de Voo e DOR.',
          side: 'left',
          align: 'start'
        },
        onHighlighted: () => {
          if ((window as any).openReportMenu) {
            (window as any).openReportMenu();
          }
          setTimeout(() => {
            const portal = document.querySelector('.z-tour-portal');
            if (portal) portal.classList.add('driver-active-element');
          }, 100);
        },
        onDeselected: () => {
          if ((window as any).closeReportMenu) {
            (window as any).closeReportMenu();
          }
        }
      }
    ],
    onDestroyed: () => {
      markMissionCompleted(6, userId);
      if (onComplete) onComplete();
    }
  });
  
  activeMissionDriver = d;
  d.drive();
};