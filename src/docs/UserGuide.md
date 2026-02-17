# Guia do Usuário - Funcionalidades da Plataforma

Este guia detalha as funcionalidades da plataforma PTrab Inteligente para o gerenciamento eficiente de Planos de Trabalho.

## 1. Gerenciamento de Planos de Trabalho (PTrabManager)

### Novo P Trab e Consolidação
- **Novo P Trab:** Cria uma "Minuta" preenchendo dados básicos e OM.
- **Consolidar:** Selecione dois ou mais P Trabs para unir seus registros em um novo documento consolidado.

### Ações na Tabela
- **Preencher P Trab:** Acesso aos formulários de classes logísticas e operacionais.
- **Preencher DOR:** Abre o editor do Documento de Operacionalização de Recursos.
- **Aprovar:** Transforma uma "Minuta" em um P Trab numerado oficialmente (ex: 001/2024/OM).
- **Clonar:** Permite criar uma cópia idêntica ou uma "Variação" (mantendo o histórico e alterando apenas o rótulo da versão).

## 2. Colaboração e Compartilhamento

- **Compartilhar:** Gere um link único para convidar colaboradores.
- **Vincular P Trab:** No menu de configurações, cole um link recebido para solicitar acesso.
- **Gerenciar:** O proprietário deve aprovar as solicitações pendentes para que o colaborador possa editar o documento.

## 3. Configurações de Custos Operacionais

Nesta tela, você define os valores de referência para o ano:
- **Diárias:** Tabela completa por posto/graduação e destino.
- **Passagens:** Cadastro de contratos e trechos frequentes.
- **Concessionárias:** Valores de água e energia por categoria.

### Gestão de Subitens da ND (Consumo, Permanente e Serviços)
Para as categorias de **Material de Consumo (ND 30)**, **Material Permanente (ND 52)** e **Serviços de Terceiros (ND 39)**, o sistema oferece ferramentas avançadas de catálogo:
- **Material de Consumo:** Permite organizar itens de custeio por subitem da ND 30 (ex: Material de Expediente, Limpeza).
- **Importar API PNCP:** Busca itens diretamente do Portal Nacional de Contratações Públicas usando o código CATMAT/CATSER ou UASG.
- **Importar Excel:** Carregue planilhas (.xlsx) para cadastrar centenas de itens de uma vez.
- **Drag and Drop:** Arraste itens entre diferentes subitens para organizar seu catálogo rapidamente.

## 4. Preenchimento de Necessidades (PTrabForm)

### Resumo de Custos e Gestão de Crédito
Ao preencher um P Trab, um painel lateral (ou card superior) exibe o **Resumo de Custos**:
- **Monitoramento GND 3 e GND 4:** O sistema separa automaticamente despesas de custeio (GND 3) de investimentos (GND 4).
- **Informar Crédito:** Permite inserir o teto orçamentário disponível. O sistema exibirá o saldo restante e mudará a cor para vermelho caso o planejamento exceda o crédito.
- **Resumo por OM:** Exibe a distribuição dos custos entre as diferentes Organizações Militares envolvidas, facilitando a visualização de quem receberá cada parcela do recurso.

### Fluxo Padronizado de Lançamento
1. **Dados da Organização:** Defina OM solicitante e fornecedora.
2. **Configurar Itens:** Selecione itens do seu catálogo de diretrizes. O sistema calcula o valor total automaticamente.
3. **Alocação ND:** Para classes de manutenção, divida o valor entre Material (ND 30) e Serviço (ND 39).
4. **Memória de Cálculo:** Revise a justificativa gerada automaticamente ou insira uma customizada.

## 5. Relatórios e Impressão

Acesse "Visualizar Impressão" para gerar documentos nos formatos oficiais:
- **Relatório Logístico:** Quadro consolidado de todas as classes.
- **Ração Operacional:** Detalhamento específico de R2 e R3.
- **Relatório Operacional:** Diárias, passagens e verbas.
- **Material Permanente:** Itens de investimento (GND 4).
- **DOR:** Documento completo para submissão ao Ministério da Defesa.

*Todos os relatórios suportam exportação para **PDF** (impressão) e **Excel** (análise de dados).*

## 6. Assistente Dyad (IA)
Use o chat no canto inferior direito para tirar dúvidas sobre regras de cálculo, siglas militares ou navegação no sistema.