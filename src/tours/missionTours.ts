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

/**
 * Função auxiliar que vigia o DOM até que um elemento apareça.
 * Quando o elemento é encontrado, avança o tour automaticamente.
 */
const waitForElement = (selector: string, driverInstance: any) => {
  console.log(`🔍 [TOUR DEBUG] Aguardando elemento: ${selector}...`);
  let attempts = 0;
  const checker = setInterval(() => {
    attempts++;
    const element = document.querySelector(selector);
    if (element) {
      console.log(`✅ [TOUR DEBUG] Elemento ${selector} encontrado após ${attempts * 100}ms!`);
      clearInterval(checker);
      driverInstance.moveNext();
    } else if (attempts > 30) { // Timeout de 3 segundos
      clearInterval(checker);
      console.error(`❌ [TOUR DEBUG] Timeout: O elemento ${selector} não apareceu no DOM.`);
    }
  }, 100);
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
          align: 'end',
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
          side: 'top',
          align: 'center',
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
          description: 'A seção de Material de Consumo organiza tudo por Subitem da Natureza de Despesa (ND).',
          side: 'left',
          align: 'start',
          offset: 40
        },
        onHighlighted: () => {
          if ((window as any).expandMaterialConsumo) {
            (window as any).expandMaterialConsumo();
          }
        },
        onNextClick: () => {
          console.log("🚀 [TOUR DEBUG] Disparando abertura forçada do modal...");
          // 1. Manda o React abrir a janela IMEDIATAMENTE via função blindada
          if ((window as any).__forceOpenModalNovoSubitem) {
            (window as any).__forceOpenModalNovoSubitem();
          }
          
          // 2. Aguarda o modal aparecer no DOM antes de avançar
          waitForElement('.modal-novo-subitem', d);
        }
      },
      {
        element: '.modal-novo-subitem',
        popover: {
          title: 'Novo Subitem de ND',
          description: 'Nesta janela configuramos a categoria e importamos os itens de aquisição.',
          side: 'top',
          align: 'center',
          offset: 20
        },
        onNextClick: () => {
          // 1. Clica no botão de Importar PNCP
          const btnImportar = document.querySelector('.btn-importar-pncp') as HTMLElement;
          if (btnImportar) {
            console.log("🚀 [TOUR DEBUG] Clicando em Importar PNCP...");
            btnImportar.click();
            
            // 2. Aguarda o segundo modal (PNCP) aparecer no DOM
            waitForElement('.modal-importar-pncp', d);
          } else {
            d.moveNext();
          }
        }
      },
      {
        element: '.modal-importar-pncp',
        popover: {
          title: 'Portal Nacional (PNCP)',
          description: 'Esta é a central de integração. Vamos buscar um preço oficial diretamente no PNCP.',
          side: 'top',
          align: 'center',
          offset: 20
        }
      },
      {
        element: '.form-busca-uasg-tour',
        popover: {
          title: 'Busca por UASG',
          description: 'Aqui informamos a UASG da Organização Militar para listar suas ARPs vigentes. Vamos simular a busca para a UASG 160222.',
          side: 'bottom',
          align: 'center'
        },
        onNextClick: () => {
          const input = document.querySelector('.form-busca-uasg-tour input') as HTMLInputElement;
          if (input) {
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
              nativeInputValueSetter?.call(input, '160222');
              input.dispatchEvent(new Event('input', { bubbles: true }));
              
              const btnBusca = document.querySelector('.form-busca-uasg-tour button[type="submit"]') as HTMLElement;
              if (btnBusca) btnBusca.click();
          }

          setTimeout(() => {
            d.moveNext();
          }, 1200);
        }
      },
      {
        element: '.modal-importar-pncp',
        popover: {
          title: 'Navegação de Resultados',
          description: 'O sistema encontrou o Pregão Eletrônico, a ARP correspondente, e finalmente o "Cimento Portland".',
          side: 'left',
          offset: 30
        },
        onHighlighted: () => {
          setTimeout(() => {
            const btnPregao = document.querySelector('.tour-expand-pregao') as HTMLElement;
            if (btnPregao) btnPregao.click();
            
            setTimeout(() => {
              const btnArp = document.querySelector('.tour-expand-arp') as HTMLElement;
              if (btnArp) btnArp.click();

              setTimeout(() => {
                const itemLinha = document.querySelector('.tour-item-mockado') as HTMLElement;
                if (itemLinha) {
                  itemLinha.style.transition = 'background-color 0.5s ease';
                  itemLinha.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                }
              }, 400);
            }, 400);
          }, 400);
        }
      },
      {
        element: '.btn-salvar-subitem',
        popover: {
          title: 'Finalização e Salvamento',
          description: 'Ao salvar, este item passa a compor seu catálogo oficial.',
          side: 'top',
          align: 'end'
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