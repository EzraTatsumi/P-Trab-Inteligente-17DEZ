"use client";

import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import "./tour.css"; 

let activeMissionDriver: any = null;

if (typeof window !== 'undefined') {
  window.addEventListener('tour:avancar', () => {
    if (activeMissionDriver) {
      setTimeout(() => {
        activeMissionDriver.moveNext();
      }, 300); 
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
      { popover: { title: 'Missão 01: Gerencie o seu P Trab', description: 'Bem-vindo ao Gerenciamento de P Trab. Aqui você controla o ciclo de vida completo dos seus Planos de Trabalho.' } },
      { element: '.btn-novo-ptrab', popover: { title: 'Criar Novo Plano', description: 'Aqui você inicia um novo P Trab do zero.', side: 'bottom', align: 'start' } },
      { element: '.btn-consolidar', popover: { title: 'Consolidar Planos', description: 'Precisa unir vários P Trabs em um único relatório? Este botão faz a consolidação automática.', side: 'bottom', align: 'start' } },
      { element: '.btn-ajuda', popover: { title: 'Suporte e Manuais', description: 'Dúvidas sobre normas ou uso do sistema? Aqui você acessa os manuais.', side: 'bottom', align: 'start' } },
      { element: '.btn-configuracoes', popover: { title: 'Configurações do Sistema', description: 'Vincule trabalhos, configure diretrizes e importe/exporte dados.', side: 'left', align: 'end', offset: 20 }, onHighlighted: () => { if ((window as any).openSettings) (window as any).openSettings(); }, onDeselected: () => { if ((window as any).closeSettings) (window as any).closeSettings(); } },
      { element: '.btn-chat-ia', popover: { title: 'Assistente IA', description: 'Dúvidas sobre o DOR ou Natureza de Despesa? O ChatIA ajuda você.', side: 'left', align: 'end' } },
      { element: '.tabela-ptrabs', popover: { title: 'Quadro de Dados do P Trab', description: 'Acompanhe o número, a operação e o status de cada plano.', side: 'top', align: 'start' } },
      { element: '.btn-comentarios', popover: { title: 'Comunicação Interna', description: 'Troque mensagens entre quem preenche e quem revisa.', side: 'top', align: 'center' } },
      { element: '.btn-preencher-ptrab', popover: { title: 'Detalhamento de Necessidades', description: 'Use este botão para entrar no formulário e detalhar as necessidades.', side: 'left', align: 'center' } },
      { element: '.btn-preencher-dor', popover: { title: 'Preenchimento do DOR', description: 'Ferramenta que auxilia na montagem do DOR.', side: 'left', align: 'center' } },
      { element: '.btn-aprovar', popover: { title: 'Pronto para Despacho', description: 'Quando finalizado, basta APROVAR para gerar o número de controle.', side: 'top', align: 'center' } },
      { element: '.btn-acoes-ptrab', popover: { title: 'Agilidade e Colaboração', description: 'CLONE planos complexos ou COMPARTILHE o acesso com outros militares.', side: 'top', align: 'end' }, onHighlighted: () => { if ((window as any).openActions) (window as any).openActions(); }, onDeselected: () => { if ((window as any).closeActions) (window as any).closeActions(); } }
    ],
    onDestroyed: onComplete
  });
  d.drive();
};

export const runMission02 = (onComplete: () => void) => {
  const d = driver({
    ...commonConfig,
    steps: [
      { element: '.card-diretrizes-operacionais', popover: { title: 'Missão 02: Inteligência PNCP', description: 'Aqui definimos os valores de referência.', side: 'left', align: 'start', offset: 20 }, onHighlighted: () => { window.scrollTo({ top: 0, behavior: 'smooth' }); } },
      { element: '.aba-material-consumo', popover: { title: 'Organização por ND', description: 'A seção de Material de Consumo organiza tudo por Subitem da ND.', side: 'left', align: 'start', offset: 40 }, onHighlighted: () => { if ((window as any).expandMaterialConsumo) (window as any).expandMaterialConsumo(); } },
      { element: '.btn-novo-subitem', popover: { title: 'Sua Vez: Mão na Massa!', description: 'Clique neste botão para abrir a janela de criação de Subitem.', side: 'top', align: 'center', showButtons: [] } },
      { element: '.tour-dados-subitem', popover: { title: 'Campos Obrigatórios', description: 'Preencha o "Número do Subitem" (ex: 24) e o "Nome do Subitem".', side: 'top', align: 'center', offset: 30 } },
      { element: '.btn-importar-pncp', popover: { title: 'O Salto Tecnológico', description: 'Clique em "Importar via API PNCP" para buscar dados de itens.', side: 'left', align: 'start', offset: 30, showButtons: [] } },
      { element: '.form-busca-uasg-tour', popover: { title: 'Busca por UASG', description: 'Digite a UASG 160222 e clique em "Buscar ARPs por UASG".', side: 'bottom', align: 'center', showButtons: [] } },
      { element: '.modal-importar-pncp', popover: { title: 'Navegação de Resultados', description: 'Expanda o Pregão, veja os itens, selecione o "Cimento Portland" e importe.', side: 'top', align: 'center', offset: 10, showButtons: [] } },
      { element: '.tabela-itens-aquisicao', popover: { title: 'Item Importado com Sucesso', description: 'O item foi importado com todos os dados técnicos e valores atualizados.', side: 'top', align: 'center' } },
      { element: '.btn-salvar-subitem', popover: { title: 'Finalização do Cadastro', description: 'Clique em "Cadastrar Subitem" para salvar este novo grupo.', side: 'top', align: 'end', showButtons: [] } },
      { element: '#diretriz-material-consumo-ghost-subitem-24', popover: { title: 'Missão Cumprida!', description: 'O novo Subitem da ND (24) foi criado e já aparece na sua lista.', side: 'top', align: 'center' } }
    ],
    onDestroyed: onComplete
  });
  activeMissionDriver = d;
  d.drive();
};

// PARTE 1: Seleção de Categoria (PTrabForm)
export const runMission03Part1 = (onComplete: () => void) => {
  const d = driver({
    ...commonConfig,
    steps: [
      { element: '.card-selecao-material', popover: { title: 'Missão 03: Detalhamento Operacional', description: 'Vamos aprender a detalhar as necessidades operacionais do seu P Trab.', side: 'top', align: 'center' } },
      { element: '.tabs-logistica', popover: { title: 'Classes de Suprimento', description: 'Aqui você detalha itens de Classe I a IX.', side: 'bottom', align: 'center' } },
      { element: '.tabs-operacional', popover: { title: 'Custos de Missão', description: 'Diárias, passagens e serviços de terceiros são lançados aqui.', side: 'bottom', align: 'center' }, onHighlighted: () => { if ((window as any).setTabOperacional) (window as any).setTabOperacional(); } },
      { element: '.btn-material-consumo', popover: { title: 'Material de Consumo', description: 'Clique em "Material de Consumo" para iniciar o detalhamento.', side: 'top', align: 'center', showButtons: [] } }
    ],
    onDestroyed: () => {
        // Se não estivermos indo para a página de material de consumo, volta para o manager
        if (!window.location.pathname.includes('/ptrab/material-consumo')) {
            onComplete();
        }
    }
  });
  activeMissionDriver = d;
  d.drive();
};

// PARTE 2: Detalhamento de Itens (MaterialConsumoForm)
export const runMission03Part2 = (onComplete: () => void) => {
  const d = driver({
    ...commonConfig,
    steps: [
      { element: '.secao-1-form-material', popover: { title: 'Dados Identificados', description: 'A OM e a Fase da Atividade já foram preenchidas automaticamente para você.', side: 'top', align: 'center', offset: 100 } },
      { element: '.secao-2-planejamento', popover: { title: 'Planejamento de Custos', description: 'Preencha o Período (15 dias) e o Efetivo (150). Em seguida, clique em "Criar Novo Grupo de Aquisição".', side: 'top', align: 'center', showButtons: [] }, onHighlighted: () => { if ((window as any).prefillSection2) (window as any).prefillSection2(); } },
      { element: '.tour-nome-grupo', popover: { title: 'Identificação do Grupo', description: 'Preencha o Nome do Grupo com "Material de Construção" e clique no botão de Importar.', side: 'top', align: 'center', showButtons: [] } },
      { element: '.tour-dialog-selector', popover: { title: 'Catálogo Sincronizado', description: 'Clique em "Material p/ Manutenção de Bens Imóveis/Instalação" (Subitem 24) para expandir.', side: 'top', align: 'center', showButtons: [] } },
      { element: '.tour-item-cimento', popover: { title: 'Seleção do Item', description: 'Selecione o "Cimento Portland" que importamos anteriormente.', side: 'top', align: 'center', showButtons: [] } },
      { element: '.tour-btn-confirmar-selecao', popover: { title: 'Confirmar Seleção', description: 'Clique em "Confirmar Seleção" para levar o item para o planejamento.', side: 'top', align: 'center', showButtons: [] } },
      { element: '.tour-btn-salvar-grupo', popover: { title: 'Finalizar Grupo', description: 'Clique em "Salvar Grupo no Formulário" para concluir esta etapa.', side: 'top', align: 'center', showButtons: [] } }
    ],
    onDestroyed: onComplete
  });
  activeMissionDriver = d;
  d.drive();
};

export const runMission04 = (onComplete: () => void) => {
  const d = driver({
    ...commonConfig,
    steps: [
      { element: '.card-cost-summary', popover: { title: 'Contabilidade Gerencial', description: 'Este painel monitora o teto orçamentário em tempo real.' } }
    ],
    onDestroyed: onComplete
  });
  d.drive();
};