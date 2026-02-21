import { driver } from "driver.js";
import "driver.js/dist/driver.css";

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
          description: 'Este botão permite cadastrar novos Subitens de ND para Material de Consumo. Clique nele para continuar.',
          side: "top",
          align: 'center'
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