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

## 2. Configurações

Acessível pelo ícone de engrenagem (Settings).

### Diretriz de Custeio (Página)
Permite configurar os valores e fatores de cálculo utilizados pelo sistema, garantindo a conformidade com as diretrizes do COLOG para o ano de referência.

- **Classe I:** Define os valores de etapa QS e QR.
- **Classe II:** Define os valores de manutenção por dia para itens de intendência.
- **Classe III:** Permite cadastrar e editar equipamentos (Geradores, Viaturas, etc.) e seus consumos padrão.

### Relação de OM (Página)
Gerencia a lista de Organizações Militares (OM) e seus respectivos CODUGs.

- **Nova OM (Botão):** Adiciona uma OM manualmente.
- **Upload em Massa (Botão):** Permite importar uma lista completa de OMs a partir de um arquivo CSV, substituindo os dados existentes.

## 3. Formulários de Classes (PTrabForm)

Acessível pelo botão "Preencher" na tela principal.

### Resumo de Custos (Card)
Exibe o custo total calculado para cada aba (Logística, Operacional, etc.) e o saldo em relação ao crédito disponível (GND 3 e GND 4).

- **Informar Crédito (Botão):** Abre um diálogo para inserir os valores de crédito orçamentário disponíveis para GND 3 e GND 4.

### Abas de Classes (Logística)

- **Classe I - Subsistência:** Abre o formulário para calcular as necessidades de alimentação (QS e QR).
- **Classe II - Material de Intendência:** Abre o formulário para calcular as necessidades de manutenção de material de intendência.
- **Classe III - Combustíveis e Lubrificantes:** Abre o formulário para calcular as necessidades de combustível e lubrificante.

## 4. Formulário Classe I - Subsistência

### Campos Principais
- **OM de Destino (QR):** A OM que receberá o recurso de Rancho Pronto (QR).
- **RM que receberá o QS:** A OM (geralmente a RM) que fornecerá o Quantitativo de Subsistência (QS).
- **Efetivo de Militares / Dias de Atividade:** Usados para calcular os ciclos e valores de complemento/etapa.
- **Fase da Atividade:** Permite selecionar ou digitar a fase da operação para a memória de cálculo.

### Memória de Cálculo Detalhada
Após salvar, o sistema gera automaticamente a memória de cálculo. Você pode usar o botão **Editar Memória** para personalizar o texto, se necessário.

## 5. Formulário Classe II - Material de Intendência

### Configurar Itens por Categoria (Abas)
Permite selecionar a categoria (Ex: Proteção Balística) e inserir a **Quantidade** de cada item necessário.

### Alocação de Recursos (ND 30/39)
- **OM de Destino do Recurso:** A OM que receberá o recurso (ND 30/39).
- **ND 33.90.39 (Serviço):** Campo onde você insere o valor que será alocado para serviços (o restante vai para ND 33.90.30 - Material).
- **Salvar Itens da Categoria (Botão):** Consolida os itens e a alocação de ND da aba atual no formulário principal.

## 6. Formulário Classe III - Combustíveis e Lubrificantes

### Referência de Preços - Consulta LPC (Seção)
Deve ser preenchida primeiro. Define o preço do Diesel e da Gasolina para o cálculo.

### Adicionar Equipamentos (Seção)
Permite selecionar o tipo de equipamento (Gerador, Viatura, etc.) e inserir os dados de consumo (Horas/dia, KM/dia, Quantidade).

- **Consolidação de Custos:** O sistema agrupa automaticamente os itens por tipo de combustível e gera a memória de cálculo com a margem de 30% aplicada.