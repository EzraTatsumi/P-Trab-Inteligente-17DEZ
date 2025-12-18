export const helpContent = [
  {
    id: "fluxo-ptrab",
    title: "Fluxo Básico do P Trab",
    content: `O fluxo de trabalho no PTrab Inteligente é dividido em três etapas principais:

1.  **Criação (Minuta):** Crie um novo P Trab, que inicialmente é uma **Minuta**.
2.  **Preenchimento:** Acesse o formulário do P Trab e preencha as classes logísticas (I, II, III, V, VI, VII, VIII, IX) e operacionais. O sistema calcula os custos em tempo real.
3.  **Aprovação e Numeração:** Após o preenchimento, o P Trab deve ser **Aprovado**. Ao aprovar, você atribui o número oficial (ex: \`1/2025/OM_SIGLA\`) e o status muda para 'Aprovado'.
4.  **Exportação e Arquivamento:** Após a aprovação, você pode exportar os relatórios oficiais (Excel/PDF). O sistema sugere o arquivamento após a exportação para evitar edições futuras.`,
  },
  {
    id: "classes-logistica",
    title: "O que são as Classes Logísticas?",
    content: `O PTrab Inteligente utiliza a classificação logística padrão do Exército Brasileiro para organizar os custos:

*   **Classe I (Subsistência):** Custeio de ração quente (QS/QR) e rações operacionais (R2/R3).
*   **Classe II (Intendência):** Material de uso individual, proteção balística, material de estacionamento.
*   **Classe III (Combustíveis):** Custeio de Óleo Diesel (OD) e Gasolina para viaturas, geradores e embarcações.
*   **Classe V (Armamento):** Custeio de armamento leve, pesado, IODCT e DQBRN.
*   **Classe VI (Engenharia):** Custeio de embarcações e equipamentos de engenharia.
*   **Classe VII (Comunicações/Informática):** Custeio de material de comunicações e informática.
*   **Classe VIII (Saúde/Remonta):** Custeio de material de saúde (KPSI/KPT) e remonta/veterinária.
*   **Classe IX (Motomecanização):** Custeio de manutenção de viaturas administrativas e operacionais.`,
  },
  {
    id: "compartilhamento",
    title: "Como funciona o Compartilhamento?",
    content: `O compartilhamento permite que o proprietário de um P Trab convide outros usuários para colaborar na edição.

1.  **Proprietário:** Gera um link de compartilhamento na tela de Gerenciamento.
2.  **Colaborador:** Usa a opção **"Vincular P Trab"** no menu de Configurações e cola o link para enviar uma solicitação de acesso.
3.  **Aprovação:** O proprietário deve ir em **"Gerenciar Compartilhamento"** (ícone de usuários) e aprovar a solicitação.
4.  **Acesso:** Após a aprovação, o colaborador pode editar o P Trab. Apenas o proprietário pode aprovar, arquivar ou excluir o P Trab.`,
  },
  {
    id: "credito-gnd",
    title: "Crédito GND 3 e GND 4",
    content: `O sistema rastreia o uso dos créditos orçamentários (GND 3 e GND 4) informados pelo usuário.

*   **GND 3 (Custeio):** Usado para a maioria das Classes Logísticas (I, II, III, V, VI, VII, VIII, IX) e Operacionais.
*   **GND 4 (Investimento):** Usado para Material Permanente.

Se o saldo ficar negativo, o sistema emitirá um alerta, mas não impedirá o preenchimento. Você pode atualizar os valores de crédito a qualquer momento no painel de resumo de custos do P Trab.`,
  },
];