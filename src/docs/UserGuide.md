# Guia do Usuário - Funcionalidades da Plataforma

Este guia detalha as funcionalidades de cada tela e elemento da plataforma PTrab Inteligente, ajudando você a gerenciar seus Planos de Trabalho com eficiência.

## 1. Acesso e Autenticação

### Login
Para acessar a plataforma, utilize o e-mail e a senha cadastrados.

- **Lembrar de mim:** Mantém sua sessão ativa no dispositivo.
- **Esqueceu sua senha?:** Abre o diálogo de recuperação de senha.

### Criar Conta
Se você ainda não possui uma conta, clique em "Não tem conta? Crie uma agora!".

---

## 2. Gerenciamento de Planos de Trabalho (PTrabManager)

Esta é a tela principal após o login, onde você gerencia todos os seus Planos de Trabalho.

### Novo P Trab (Botão)
Cria um novo Plano de Trabalho. Você deve preencher os dados básicos (Número, Operação, Período, OM, etc.).

### Consolidar P Trab (Botão)
Permite combinar os registros de múltiplos P Trabs de origem em um único P Trab de destino (Minuta).

### Tabela de P Trabs

- **Status:** Indica o estado atual (Aberto, Em Andamento, Aprovado, Arquivado).
- **Preencher (Botão):** Navega para a tela de edição de classes logísticas e operacionais.
- **Preencher DOR (Botão):** Abre o editor de Documento de Oficialização de Demanda.
- **Visualizar Impressão (Ação):** Abre a tela de relatórios (PDF e Excel).
- **Clonar P Trab (Ação):** Cria uma cópia exata do P Trab.
- **Aprovar (Botão):** Atribui o número oficial e altera o status para "Aprovado".

## 3. Colaboração e Compartilhamento

O sistema permite o compartilhamento seguro de P Trabs para edição colaborativa.

### Compartilhar (Ação - Proprietário)
Gera um link seguro para enviar ao colaborador.

### Vincular P Trab (Ação - Colaborador)
Permite colar o link de compartilhamento recebido para solicitar acesso.

---

## 4. Assistente Dyad (IA)

O Assistente Dyad é um chatbot de Inteligência Artificial integrado que pode ajudar com dúvidas sobre a usabilidade e regras de negócio.

---

## 5. Configurações

Acessível pelo ícone de engrenagem (Settings) na tela de Gerenciamento de Planos de Trabalho.

### Perfil do Usuário (Página)
Permite atualizar informações pessoais e OM de vinculação.

### Diretrizes (Custeio e Operacional)
Permite configurar os valores e fatores de cálculo utilizados pelo sistema.

- **Diretriz de Custeio Logístico:** Define valores de etapa (Classe I), manutenção (Classes II a IX) e consumos de equipamentos.
- **Diretriz de Custos Operacionais:** Define os valores de diárias (por localidade), teto de complemento de alimentação, valores de hora de voo por aeronave e trechos de passagens aéreas.

#### Importação e Exportação de Diretrizes
Para facilitar a padronização entre diferentes usuários ou realizar backups:
- **Exportar Diretrizes:** Gera um arquivo JSON contendo todas as configurações de valores do ano selecionado.
- **Importar Diretrizes:** Permite carregar um arquivo JSON de diretrizes. O sistema atualizará os valores para o ano correspondente, facilitando a replicação de tabelas de custos oficiais.

### Relação de OM (Página)
Gerencia a lista de Organizações Militares (OM) e seus respectivos CODUGs.

### Exportar e Importar P Trabs (Página)
Permite gerenciar backups e transferências de dados de Planos de Trabalho completos.

---

## 6. Formulários de Classes (PTrabForm)

### Resumo de Custos (Card)
Exibe o custo total calculado para o P Trab.

- **Visão Global:** Total acumulado por GND 3 e GND 4.
- **Visão por OM:** Detalha o consumo orçamentário por Organização Militar participante.
- **Informar Crédito (Botão):** Permite inserir os valores de crédito disponíveis para cálculo automático de saldo.

### Fluxo de Lançamento de Necessidades (5 Passos)
Todos os formulários seguem um fluxo padronizado: Dados da Organização, Configurar Itens, Itens Adicionados, OMs Cadastradas e Memórias de Cálculo.

---

## 7. Editor de DOR (Documento de Oficialização de Demanda)

O Editor de DOR permite formalizar as necessidades levantadas no P Trab para o setor de aquisições.