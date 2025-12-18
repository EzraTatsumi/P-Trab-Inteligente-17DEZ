# Guia do Usuário - Funcionalidades da Plataforma

Este guia detalha as funcionalidades de cada tela e elemento da plataforma PTrab Inteligente, ajudando você a gerenciar seus Planos de Trabalho com eficiência.

## 1. Gerenciamento de Planos de Trabalho (PTrabManager)

Esta é a tela principal após o login, onde você gerencia todos os seus Planos de Trabalho.

### Novo P Trab (Botão)
Cria um novo Plano de Trabalho. Você deve preencher os dados básicos (Número, Operação, Período, OM, etc.).

### Consolidar P Trab (Botão)
Permite combinar os registros de Classe I, II e III de múltiplos P Trabs de origem em um único P Trab de destino (novo ou existente). Útil para consolidar dados de várias OM em um único P Trab de Comando.

### Tabela de P Trabs

- **Status (Dropdown):** Permite alterar o status do P Trab (Aberto, Em Andamento, Completo, Arquivado).
- **Preencher (Botão):** Navega para a tela de edição de classes logísticas e operacionais.
- **Visualizar Impressão (Ação):** Abre a tela de visualização do P Trab no formato oficial, permitindo exportação para PDF e Excel.
- **Clonar P Trab (Ação):** Cria uma cópia exata do P Trab, incluindo todos os registros de Classes I, II, III e a Referência LPC, com um novo número sequencial.
- **Comentário (Ícone):** Permite adicionar ou editar um comentário interno sobre o P Trab.
- **Numerar (Botão):** Disponível para P Trabs em status "Minuta". Permite atribuir o número oficial no padrão **Número/Ano/Sigla da OM** e alterar o status para "Em Andamento".
- **Compartilhar (Ação):** Gera um link seguro para convidar outro usuário a colaborar neste P Trab.
- **Gerenciar Compartilhamento (Ação):** Permite ao proprietário aprovar/rejeitar solicitações de acesso e remover colaboradores ativos.

## 2. Configurações

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

### Vincular P Trab Compartilhado (Diálogo)
Acessível no menu de configurações. Permite colar um link de compartilhamento recebido para enviar uma solicitação de acesso ao proprietário do P Trab.

## 3. Formulários de Classes (PTrabForm)

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

## 4. Formulário Classe I - Subsistência

### Campos Principais
- **OM de Destino (QR):** A OM que receberá o recurso de Rancho Pronto (QR).
- **RM que receberá o QS:** A OM (geralmente a RM) que fornecerá o Quantitativo de Subsistência (QS).
- **Efetivo de Militares / Dias de Atividade:** Usados para calcular os ciclos e valores de complemento/etapa.
- **Fase da Atividade:** Permite selecionar ou digitar a fase da operação para a memória de cálculo.

### Memória de Cálculo Detalhada
Após salvar, o sistema gera automaticamente a memória de cálculo. Você pode usar o botão **Editar Memória** para personalizar o texto, se necessário.

## 5. Formulário Classe IX - Motomecanização (Exemplo de Nova Classe)

### Configurar Itens por Categoria
Permite selecionar a categoria (Ex: Vtr Operacional) e inserir a **Quantidade** de viaturas.

### Cálculo
O sistema calcula o custo total com base no valor de manutenção por dia e no valor de acionamento mensal, conforme as diretrizes.

- **Alocação de ND:** O valor total é dividido entre ND 33.90.30 (Material) e ND 33.90.39 (Serviço), conforme a alocação manual do usuário.