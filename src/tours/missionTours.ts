import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export const runMission01 = (onComplete: () => void) => {
  const driverObj = driver({
    showProgress: true,
    allowClose: false,
    steps: [
      {
        element: '.btn-novo-ptrab',
        popover: {
          title: 'Missão 01: Criar P Trab',
          description: 'Vamos começar criando um novo Plano de Trabalho.',
          side: "bottom",
          align: 'start'
        }
      }
    ],
    onDestroyed: () => {
      onComplete();
    }
  });
  driverObj.drive();
};

export const runMission02 = (onComplete: () => void) => {
  const driverObj = driver({
    showProgress: true,
    allowClose: false,
    steps: [
      {
        element: '.card-diretrizes-operacionais',
        popover: {
          title: 'Missão 02: Custos Operacionais',
          description: 'Nesta missão, vamos configurar as diretrizes para Material de Consumo.',
          side: "bottom",
          align: 'start'
        }
      },
      {
        element: '.lista-subitens-nd',
        popover: {
          title: 'Subitens Cadastrados',
          description: 'Aqui você visualiza todos os subitens da Natureza de Despesa (ND) já configurados para este ano.',
          side: "top",
          align: 'center'
        }
      },
      {
        element: '.btn-novo-subitem',
        popover: {
          title: 'Criar Novo Subitem',
          description: 'Este botão permite cadastrar novos Subitens de ND para Material de Consumo. Clique em "Próximo" para abrir o formulário.',
          side: "top",
          align: 'center'
        },
        onDeselected: () => {
          // Quando o usuário sai deste passo (clica em Próximo), abrimos o formulário
          if (typeof (window as any).openMaterialConsumoForm === 'function') {
            (window as any).openMaterialConsumoForm();
          }
        }
      },
      {
        element: '.modal-novo-subitem',
        popover: {
          title: 'Formulário de Subitem',
          description: 'Agora preencha os dados do novo subitem e seus respectivos itens de aquisição.',
          side: "left",
          align: 'start'
        }
      },
      {
        element: '.btn-adotar-padrao',
        popover: {
          title: 'Finalizando',
          description: 'Após configurar tudo, não esqueça de salvar as diretrizes para que fiquem disponíveis nos cálculos.',
          side: "top",
          align: 'end'
        }
      }
    ],
    onDestroyed: () => {
      onComplete();
    }
  });

  driverObj.drive();
};

export const runMission03 = (onComplete: () => void) => {
  const driverObj = driver({
    showProgress: true,
    allowClose: false,
    steps: [
      {
        element: '.tabs-logistica',
        popover: {
          title: 'Missão 03: Logística',
          description: 'Vamos explorar a aba de logística do P Trab.',
          side: "bottom",
          align: 'start'
        }
      }
    ],
    onDestroyed: () => {
      onComplete();
    }
  });
  driverObj.drive();
};

export const runMission04 = (onComplete: () => void) => {
  const driverObj = driver({
    showProgress: true,
    allowClose: false,
    steps: [
      {
        element: '.tabs-operacional',
        popover: {
          title: 'Missão 04: Operacional',
          description: 'Vamos explorar a aba operacional do P Trab.',
          side: "bottom",
          align: 'start'
        }
      }
    ],
    onDestroyed: () => {
      onComplete();
    }
  });
  driverObj.drive();
};