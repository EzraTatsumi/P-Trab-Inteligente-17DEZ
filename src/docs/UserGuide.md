# Guia do Usuário - Funcionalidades da Plataforma

Este guia detalha as funcionalidades de cada tela e elemento da plataforma PTrab Inteligente, ajudando você a gerenciar seus Planos de Trabalho com eficiência.

## 1. Gerenciamento de Planos de Trabalho (PTrabManager)

Esta é a tela principal após o login, onde você gerencia todos os seus Planos de Trabalho.

### Novo P Trab (Botão)
Cria um novo Plano de Trabalho. Você deve preencher os dados básicos (Número, Operação, Período, OM, etc.).

### Consolidar P Trab (Botão)
Permite combinar os registros de Classe I, II, III, V, VI, VII, VIII e IX de múltiplos P Trabs de origem em um único P Trab de destino (Minuta). Útil para consolidar dados de várias OM em um único P Trab de Comando.

### Tabela de P Trabs

- **Status:** Indica o estado atual (Aberto, Em Andamento, Aprovado, Arquivado).
- **Preencher (Botão):** Navega para a tela de edição de classes logísticas e operacionais.
- **Visualizar Impressão (Ação):** Abre a tela de relatórios, onde você pode selecionar o tipo de relatório desejado (Logístico, Ração Operacional, Operacional, Material Permanente, Hora de Voo, DOR). Todos os relatórios podem ser exportados para **PDF** e **Excel** no formato oficial.
- **Clonar P Trab (Ação):** Cria uma cópia exata do P Trab, incluindo todos os registros de Classes e a Referência LPC, com um novo número de Minuta.
- **Comentário (Ícone):** Permite adicionar ou editar um comentário interno sobre o P Trab.
- **Aprovar (Botão):** Disponível para P Trabs em status "Minuta" ou "Em Andamento". Permite atribuir o número oficial no padrão **Número/Ano/Sigla da OM** e alterar o status para "Aprovado".
- **Arquivar (Ação):** Finaliza o P Trab, alterando o status para "Arquivado" e restringindo edições.
- **Reativar (Ação):** Disponível para P Trabs arquivados. Retorna o status para "Aprovado" ou "Aberto" (se for Minuta).

## 2. Colaboração e Compartilhamento

O sistema permite o compartilhamento seguro de P Trabs para edição colaborativa.

### Compartilhar (Ação - Proprietário)
Gera um link seguro contendo o ID do P Trab e um token. Este link deve ser enviado ao colaborador.

### Gerenciar Compartilhamento (Ação - Proprietário)
Permite ao proprietário:
- Visualizar colaboradores ativos.
- Aprovar ou rejeitar solicitações de acesso pendentes.
- Remover o acesso de colaboradores ativos.

### Vincular P Trab (Ação - Colaborador)
Acessível no menu de Configurações. Permite colar o link de compartilhamento recebido para enviar uma solicitação de acesso ao proprietário. Após a aprovação, o P Trab aparece na sua lista com o status "Compartilhado".

### Desvincular (Ação - Colaborador)
Remove o seu acesso de edição ao P Trab compartilhado.

## 3. Assistente Dyad (IA)

O Assistente Dyad é um chatbot de Inteligência Artificial integrado que pode ajudar com dúvidas sobre a usabilidade, regras de negócio e funcionalidades da plataforma.

- **Acesso:** Clique no ícone de balão de chat (MessageSquare) no canto inferior direito da tela.
- **Funcionalidade:** Faça perguntas sobre como usar um formulário, o significado de um campo, ou as regras de cálculo de uma classe específica.
- **Limpar Chat:** Use o botão "Limpar" dentro do diálogo para apagar o histórico da conversa.

## 4. Configurações

Acessível pelo ícone de engrenagem (Settings).

### Diretriz de Custeio (Página)
Permite configurar os valores e fatores de cálculo utilizados pelo sistema, garantindo a conformidade com as diretrizes do COLOG para o ano de referência.

- **Classe I:** Define os valores de etapa QS e QR.
- **Classe II:** Define os valores de manutenção por dia para itens de intendência.
- **Classe III:** Permite cadastrar e editar equipamentos (Geradores, Viaturas, etc.) e seus consumos padrão.
- **Classe IX:** Permite cadastrar e editar os valores de manutenção e acionamento para viaturas de Motomecanização.

### Relação de OM (Página)
Gerencia a lista de Organizações Militares (OM) e seus respectivos CODUGs.

- **Nova OM (Botão):** Adiciona uma OM manualmente.
- **Upload em Massa (Botão):** Permite importar uma lista completa de OMs a partir de um arquivo CSV, substituindo os dados existentes.

### Exportar e Importar P Trabs (Página)
Permite gerenciar backups e transferências de dados.

- **Exportar:** Cria um arquivo JSON criptografado (com senha) de um P Trab único ou de um Backup Completo (incluindo todas as configurações e P Trabs).
- **Importar:** Descriptografa e importa um arquivo. O sistema verifica conflitos de numeração e sugere a criação de uma Minuta se necessário.

## 5. Formulários de Classes (PTrabForm)

Acessível pelo botão "Preencher" na tela principal.

### Resumo de Custos (Card)
Exibe o custo total calculado para cada aba (Logística, Operacional, etc.) e o saldo em relação ao crédito disponível (GND 3 e GND 4).

- **Informar Crédito (Botão):** Abre um diálogo para inserir os valores de crédito orçamentário disponíveis para GND 3 e GND 4.

### Abas de Classes (Logística)

- **Classe I - Subsistência:** Abre o formulário para calcular as necessidades de alimentação (QS e QR).
- **Classe II - Material de Intendência:** Abre o formulário para calcular as necessidades de manutenção de material de intendência.
- **Classe III - Combustíveis e Lubrificantes:** Abre o formulário para calcular as necessidades de combustível e lubrificante.
- **Classe V - Armamento:** Abre o formulário para calcular as necessidades de manutenção de armamento.
- **Classe VI - Material de Engenharia:** Abre o formulário para calcular as necessidades de manutenção de material de engenharia.
- **Classe VII - Comunicações e Informática:** Abre o formulário para calcular as necessidades de manutenção de material de comunicações e informática.
- **Classe VIII - Material de Saúde e Remonta/Veterinária:** Abre o formulário para calcular as necessidades de saúde (KPSI/KPT) e remonta (animais).
- **Classe IX - Material de Motomecanização:** Abre o formulário para calcular os custos de manutenção e acionamento de viaturas.