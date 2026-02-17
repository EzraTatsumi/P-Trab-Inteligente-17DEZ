# Guia do Usuário - Funcionalidades da Plataforma

Este guia detalha as funcionalidades de cada tela e elemento da plataforma PTrab Inteligente, ajudando você a gerenciar seus Planos de Trabalho com eficiência.

## 1. Acesso e Autenticação

### Login
Para acessar a plataforma, utilize o e-mail e a senha cadastrados.

- **Lembrar de mim:** Mantém sua sessão ativa no dispositivo.
- **Esqueceu sua senha?:** Abre o diálogo de recuperação de senha, que enviará um link de redefinição para o seu e-mail.

### Criar Conta
Se você ainda não possui uma conta, clique em "Não tem conta? Crie uma agora!".

- **Registro:** O cadastro requer seu e-mail, senha, posto/graduação, nome de guerra e OM de vinculação.
- **Confirmação de E-mail:** Após o registro, um link de confirmação será enviado para o seu e-mail. Você só poderá fazer login após confirmar seu endereço.

---

## 2. Gerenciamento de Planos de Trabalho (PTrabManager)

Esta é a tela principal após o login, onde você gerencia todos os seus Planos de Trabalho.

### Novo P Trab (Botão)
Cria um novo Plano de Trabalho. Você deve preencher os dados básicos (Número, Operação, Período, OM, etc.).

### Consolidar P Trab (Botão)
Permite combinar os registros de Classe I, II, III, V, VI, VII, VIII e IX de múltiplos P Trabs de origem em um único P Trab de destino (Minuta). Útil para consolidar dados de várias OM em um único P Trab de Comando.

### Tabela de P Trabs

- **Status:** Indica o estado atual (Aberto, Em Andamento, Aprovado, Arquivado).
- **Preencher (Botão):** Navega para a tela de edição de classes logísticas e operacionais.
- **Preencher DOR (Botão):** Abre o editor de Documento de Oficialização de Demanda para o P Trab selecionado.
- **Visualizar Impressão (Ação):** Abre a tela de relatórios, onde você pode selecionar o tipo de relatório desejado (Logístico, Ração Operacional, Operacional, Material Permanente, Hora de Voo, DOR). Todos os relatórios podem ser exportados para **PDF** e **Excel** no formato oficial.
- **Clonar P Trab (Ação):** Cria uma cópia exata do P Trab, incluindo todos os registros de Classes e a Referência LPC, com um novo número de Minuta.
- **Comentário (Ícone):** Permite adicionar ou editar um comentário interno sobre o P Trab.
- **Aprovar (Botão):** Disponível para P Trabs em status "Minuta" ou "Em Andamento". Permite atribuir o número oficial no padrão **Número/Ano/Sigla da OM** e alterar o status para "Aprovado".
- **Arquivar (Ação):** Finaliza o P Trab, alterando o status para "Arquivado" e restringindo edições.
- **Reativar (Ação):** Disponível para P Trabs arquivados. Retorna o status para "Aprovado" ou "Aberto" (se for Minuta).

## 3. Colaboração e Compartilhamento

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

## 4. Assistente Dyad (IA)

O Assistente Dyad é um chatbot de Inteligência Artificial integrado que pode ajudar com dúvidas sobre a usabilidade, regras de negócio e funcionalidades da plataforma.

- **Acesso:** Clique no ícone de balão de chat (MessageSquare) no canto inferior direito da tela.
- **Funcionalidade:** Faça perguntas sobre como usar um formulário, o significado de um campo, ou as regras de cálculo de uma classe específica.
- **Limpar Chat:** Use o botão "Limpar" dentro do diálogo para apagar o histórico da conversa.

## 5. Configurações

Acessível pelo ícone de engrenagem (Settings) na tela de Gerenciamento de Planos de Trabalho. As opções disponíveis são:

### Perfil do Usuário (Página)
Permite atualizar informações pessoais, como nome de guerra, posto/graduação e OM de vinculação.

### Diretriz de Custeio (Página)
Permite configurar os valores e fatores de cálculo utilizados pelo sistema, garantindo a conformidade com as diretrizes do COLOG para o ano de referência.

- **Classe I:** Define os valores de etapa QS e QR.
- **Classes II, V, VI, VII, VIII (Saúde/Remonta):** Define os valores de manutenção por dia para itens de intendência, armamento, engenharia, comunicações, informática, saúde e remonta.
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

### Vincular P Trab (Ação)
Permite ao usuário colar um link de compartilhamento para solicitar acesso a um P Trab de outro proprietário.

## 6. Formulários de Classes (PTrabForm)

Acessível pelo botão "Preencher" na tela principal.

### Resumo de Custos (Card)
Exibe o custo total calculado para cada aba (Logística, Operacional, etc.) e o saldo em relação ao crédito disponível (GND 3 e GND 4).

- **Informar Crédito (Botão):** Abre um diálogo para inserir os valores de crédito orçamentário disponíveis para GND 3 e GND 4.

### Fluxo de Lançamento de Necessidades (5 Passos)

Todos os formulários de classes logísticas (I, II, III, V, VI, VII, VIII, IX) seguem um fluxo de trabalho padronizado para garantir a rastreabilidade e a conformidade.

#### 6.1. Dados da Organização
Nesta seção, você define a OM (Organização Militar) que está solicitando o recurso e a OM que irá fornecer o material (se aplicável, como na Classe I).

- **OM Solicitante:** A OM detentora do P Trab.
- **OM Fornecedora (Classe I):** A OM (geralmente RM) que fornecerá a alimentação (QS).
- **Dias de Operação e Fase:** Define o período e a fase da atividade para o cálculo.

#### 6.2. Configurar Itens por Categoria e Alocação de Recursos
Esta é a seção central para o cálculo das necessidades.

- **Seleção de Itens:** Você seleciona os itens de material ou equipamento necessários (ex: Ração Quente, Fuzil, Gerador, Viatura).
- **Integração PNCP:** Em itens operacionais e materiais, você pode buscar Atas de Registro de Preços vigentes no Portal Nacional de Contratações Públicas informando a UASG ou o código CATMAT.
- **Cálculo Automático:** O sistema aplica as fórmulas de cálculo (baseadas nas Diretrizes de Custeio) para determinar o **Valor Total** da necessidade.
- **Alocação ND 30 / ND 39 (Classes II, V, VI, VII, VIII, IX):** O Valor Total é dividido manualmente entre a Natureza de Despesa 33.90.30 (Material) e 33.90.39 (Serviço). A soma deve ser igual ao Valor Total calculado.
- **Particularidade Classe III (Combustível):**
    - **Consulta LPC:** Permite buscar o preço do litro de combustível (Diesel/Gasolina) em tempo real via API externa (ANP) ou inserir manualmente.
    - **Lubrificantes:** O cálculo de lubrificante é feito separadamente, com base no consumo por litro de combustível e no preço do lubrificante.

#### 6.3. Itens Adicionados
Exibe uma lista de todos os registros de necessidades que foram salvos para o P Trab na classe atual. Você pode editar ou excluir registros nesta lista.

#### 6.4. OMs Cadastradas
Exibe a lista de Organizações Militares cadastradas no sistema, facilitando a consulta de CODUGs e RMs.

#### 6.5. Memórias de Cálculo Detalhadas
Após salvar um registro, o sistema gera automaticamente a memória de cálculo completa, detalhando a fórmula utilizada, os valores de entrada e o resultado final.

- **Customização:** Você pode optar por substituir a memória de cálculo automática por um detalhamento customizado, se necessário.
- **Conformidade:** Este detalhamento é crucial para a rastreabilidade e auditoria do P Trab.

### Abas de Classes (Logística)

- **Classe I - Subsistência:** Abre o formulário para calcular as necessidades de alimentação (QS e QR).
- **Classe II - Material de Intendência:** Abre o formulário para calcular as necessidades de manutenção de material de intendência.
- **Classe III - Combustíveis e Lubrificantes:** Abre o formulário para calcular as necessidades de combustível e lubrificante.
- **Classe V - Armamento:** Abre o formulário para calcular as necessidades de manutenção de armamento.
- **Classe VI - Material de Engenharia:** Abre o formulário para calcular as necessidades de manutenção de material de engenharia.
- **Classe VII - Comunicações e Informática:** Abre o formulário para calcular as necessidades de manutenção de material de comunicações e informática.
- **Classe VIII - Material de Saúde e Remonta/Veterinária:** Abre o formulário para calcular as necessidades de saúde (KPSI/KPT) e remonta (animais).
- **Classe IX - Material de Motomecanização:** Abre o formulário para calcular os custos de manutenção e acionamento de viaturas.

## 7. Editor de DOR (Documento de Oficialização de Demanda)

O Editor de DOR permite formalizar as necessidades levantadas no P Trab para o setor de aquisições.

- **Seleção de Itens:** Importe itens já lançados nas classes logísticas ou operacionais.
- **Agrupamento:** Organize os itens em grupos lógicos para facilitar a análise do ordenador de despesas.
- **Justificativa Técnica:** Preencha os campos de Motivação, Finalidade e Consequência para gerar o documento oficial em PDF ou Excel.