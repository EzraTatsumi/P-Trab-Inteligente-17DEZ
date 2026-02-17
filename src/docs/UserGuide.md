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
Exibe o custo total calculado para o P Trab, permitindo o monitoramento em tempo real do orçamento.

- **Visão Global:** Mostra o total acumulado de todas as classes e itens operacionais, dividido por GND 3 (Custeio) e GND 4 (Investimento).
- **Visão por OM:** Permite alternar para uma visualização que detalha quanto cada Organização Militar participante está consumindo do orçamento total.
- **Informar Crédito (Botão):** Abre um diálogo para inserir os valores de crédito orçamentário disponíveis (GND 3 e GND 4). O sistema calculará automaticamente o saldo restante.

### Fluxo de Lançamento de Necessidades (5 Passos)

Todos os formulários de classes logísticas e operacionais seguem um fluxo de trabalho padronizado.

#### 6.1. Dados da Organização
Define a OM solicitante e os parâmetros temporais (dias de operação).

#### 6.2. Configurar Itens e Alocação
- **Material Permanente:** Utilize este formulário para itens de ND 52. Você pode buscar especificações e preços no PNCP.
- **Cálculo Automático:** O sistema multiplica a quantidade pelo valor unitário.
- **Integração PNCP:** Facilita a busca de Atas de Registro de Preços vigentes.

#### 6.3. Itens Adicionados
Lista de registros salvos para edição ou exclusão.

#### 6.4. OMs Cadastradas
Consulta rápida de CODUGs e RMs.

#### 6.5. Memórias de Cálculo
Detalhamento automático de como o valor final foi atingido, essencial para auditoria.

## 7. Editor de DOR (Documento de Oficialização de Demanda)

O Editor de DOR permite formalizar as necessidades levantadas no P Trab para o setor de aquisições.

- **Seleção de Itens:** Importe itens já lançados nas classes logísticas ou operacionais.
- **Agrupamento:** Organize os itens em grupos lógicos para facilitar a análise do ordenador de despesas.
- **Justificativa Técnica:** Preencha os campos de Motivação, Finalidade e Consequência para gerar o documento oficial em PDF ou Excel.