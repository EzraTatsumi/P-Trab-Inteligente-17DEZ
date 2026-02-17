# Regras de Negócio e Cálculo (Diretrizes COLOG/COTER)

Este documento detalha as regras de cálculo e as diretrizes de custeio implementadas no sistema PTrab Inteligente, garantindo a conformidade com as normas do COLOG e COTER.

## 1. Classe I - Subsistência (Alimentação)

A Classe I é dividida em Quantitativo de Subsistência (QS) e Quantitativo de Rancho (QR), ambos alocados na Natureza de Despesa (ND) **33.90.30**.

### 1.1. Fórmulas de Cálculo

O cálculo é baseado no efetivo empregado, nos dias de operação, no número de refeições intermediárias (Ref Int) e nos valores de etapa (QS e QR) definidos na Diretriz de Custeio.

**Variáveis:**
- `Efetivo`: Número de militares empregados.
- `Dias Operação`: Duração total da atividade.
- `Nr Ref Int`: Número de refeições intermediárias (1, 2 ou 3).
- `Valor Etapa QS`: Valor da etapa QS (Diretriz de Custeio).
- `Valor Etapa QR`: Valor da etapa QR (Diretriz de Custeio).

**Cálculo de Dias de Etapa Solicitada (Dias Etapa Solicitada):**
Este valor representa os dias de etapa completa solicitada (além do complemento).
1. `Ciclos Completos = FLOOR(Dias Operação / 30)`
2. `Dias Restantes = Dias Operação MOD 30`
3. Se `Dias Restantes > 22` e `Dias Operação >= 30`:
   `Dias Etapa Solicitada = (Dias Restantes - 22) + (Ciclos Completos * 8)`
4. Se `Dias Restantes <= 22` e `Dias Operação >= 30`:
   `Dias Etapa Solicitada = Ciclos Completos * 8`
5. Se `Dias Operação < 30`:
   `Dias Etapa Solicitada = 0`

**Cálculo do Complemento (Refeições Intermediárias):**
O complemento é o valor destinado às refeições intermediárias.
- `Valor Complemento = Efetivo x MIN(Nr Ref Int, 3) x (Valor Etapa / 3) x Dias Operação`

**Cálculo da Etapa Solicitada (Etapa Completa):**
- `Valor Etapa Solicitada = Efetivo x Valor Etapa x Dias Etapa Solicitada`

**Total QS (Quantitativo de Subsistência):**
- `Total QS = Valor Complemento (QS) + Valor Etapa Solicitada (QS)`
- **Destino:** OM Fornecedora (RM ou OM de Apoio).

**Total QR (Quantitativo de Rancho):**
- `Total QR = Valor Complemento (QR) + Valor Etapa Solicitada (QR)`
- **Destino:** OM de Destino (OM Detentora do PTrab).

**Total Geral Classe I:** `Total QS + Total QR`

---

## 2. Classes II, V, VI, VII, VIII (Saúde/Remonta) - Material e Serviço

Estas classes cobrem a manutenção de material e são alocadas entre **ND 33.90.30 (Material)** e **ND 33.90.39 (Serviço)**.

### 2.1. Fórmulas de Cálculo (Classes II, V, VI, VII, VIII - Saúde)

O cálculo é baseado em um valor de manutenção por dia (`Valor Mnt/Dia`) definido na Diretriz de Custeio (ou valor unitário para Classe VIII - Saúde).

**Cálculo do Valor Total por Item:**
- `Valor Item = Quantidade x Valor Mnt/Dia x Dias Operação` (Para Classes II, V, VI, VII)
- `Valor Item = Quantidade x Valor Unitário` (Para Classe VIII - Saúde, se aplicável)

**Cálculo do Valor Total por Categoria:**
- `Total Categoria = SOMA(Valor Item)` para todos os itens daquela categoria.

### 2.2. Alocação de Natureza de Despesa (ND)

O valor total da categoria é dividido conforme a alocação manual do usuário:

- `ND 33.90.39 (Serviço)`: Valor inserido pelo usuário (máximo: `Total Categoria`).
- `ND 33.90.30 (Material)`: `Total Categoria - ND 33.90.39`.

**Regra de Negócio:** A soma de ND 30 e ND 39 deve ser exatamente igual ao `Total Categoria`.

---

## 3. Classe IX - Motomecanização (Manutenção e Acionamento)

A Classe IX cobre os custos de manutenção e acionamento de viaturas, alocados entre **ND 33.90.30 (Material)** e **ND 33.90.39 (Serviço)**.

### 3.1. Fórmulas de Cálculo

O cálculo combina um custo base diário e um custo de acionamento mensal.

**Variáveis:**
- `Nr Vtr`: Quantidade de viaturas.
- `Dias Operação`: Duração total da atividade.
- `Valor Mnt/Dia`: Valor de manutenção diária (Diretriz de Custeio).
- `Valor Acionamento/Mês`: Valor de acionamento mensal (Diretriz de Custeio).

**Cálculo do Custo Base:**
- `Custo Base = Nr Vtr x Valor Mnt/Dia x Dias Operação`

**Cálculo do Custo de Acionamento:**
- `Nr Meses = CEIL(Dias Operação / 30)`
- `Custo Acionamento = Nr Vtr x Valor Acionamento/Mês x Nr Meses`

**Total Categoria:**
- `Total Categoria = Custo Base + Custo Acionamento`

### 3.2. Alocação de Natureza de Despesa (ND)

Segue a mesma regra das Classes II, V, VI, VII e VIII (Saúde): divisão manual entre ND 30 e ND 39.

---

## 4. Classe III - Combustíveis e Lubrificantes

A Classe III é alocada na ND **33.90.30**. O valor do Combustível é alocado na coluna **COMBUSTÍVEL** do PTrab, e o valor do Lubrificante é alocado na coluna **NATUREZA DE DESPESA (33.90.30)**.

### 4.1. Fórmulas de Cálculo de Combustível (ND 33.90.30 - Coluna Combustível)

**Aplicação da Margem de Segurança:**
- `Total Litros = Litros Sem Margem x 1.30` (Margem de 30% para segurança/imprevistos).

**Valor Total Combustível:**
- `Valor Total = Total Litros x Preço Unitário (LPC)`

### 4.2. Fórmulas de Cálculo de Lubrificante (ND 33.90.30 - Coluna ND)

O cálculo de lubrificante é feito separadamente e alocado na coluna **NATUREZA DE DESPESA (33.90.30)**.

**Valor Total Lubrificante:**
- `Valor Total = Litros Lubrificante x Preço Lubrificante (R$/L)`.

---

## 5. Itens Operacionais (Aba Operacional)

Os itens operacionais abrangem diversas naturezas de despesa e seguem regras específicas de teto e destino.

### 5.1. Diárias (ND 33.90.14)
- **Cálculo:** Baseado no posto/graduação do militar e na localidade de destino (Brasília, Capitais ou Demais Localidades), conforme tabela da Diretriz Operacional.
- **Taxa de Embarque:** Adicionada ao valor total quando o transporte é aéreo.

### 5.2. Passagens (ND 33.90.33)
- **Cálculo:** Baseado em trechos pré-cadastrados na diretriz ou inserção manual de valores de mercado.

### 5.3. Verba Operacional e Suprimento de Fundos
- **Cálculo:** `Quantidade de Equipes x Valor Diário da Diretriz x Dias de Operação`.
- **Alocação:** Dividida entre ND 30 (Material) e ND 39 (Serviço) conforme a necessidade da equipe.

### 5.4. Complemento de Alimentação
- **Finalidade:** Aquisição de gêneros para reforço calórico ou água mineral.
- **Cálculo:** Baseado no efetivo e dias de operação, respeitando o teto per capita definido na diretriz.

### 5.5. Horas de Voo (AvEx)
- **Cálculo:** `Quantidade de Horas x Valor da Hora de Voo (por modelo de aeronave)`.
- **Alocação:** Geralmente alocado em ND 30 (Combustível de Aviação) e ND 39 (Manutenção/Serviços).

### 5.6. Material de Consumo e Permanente
- **Cálculo:** Baseado em cotações de mercado ou Atas de Registro de Preços (ARP) via PNCP.
- **Alocação:** ND 30 (Consumo) ou ND 52 (Equipamentos e Material Permanente).

### 5.7. Pagamento de Concessionárias
- **Finalidade:** Custear despesas de água, energia e esgoto em locais de apoio.
- **Cálculo:** Baseado no consumo estimado por pessoa/dia e tarifas locais.

### 5.8. Serviços de Terceiros e Locações (ND 33.90.39)
Este formulário é destinado à contratação de serviços especializados e locação de infraestrutura temporária.

#### 5.8.1. Categorias de Serviços
O sistema organiza os serviços em categorias baseadas nos subitens da ND 39:
- **Locação de Viaturas:** Administrativas, operacionais ou blindadas.
- **Locação de Máquinas e Equipamentos:** Tratores, motoniveladoras, etc.
- **Locação de Estruturas:** Tendas, banheiros químicos, containers e geradores.
- **Serviços Técnicos Profissionais:** Consultorias, instrutoria ou serviços especializados.
- **Manutenção e Conservação:** De bens móveis ou imóveis durante a operação.
- **Serviços de Apoio:** Limpeza, vigilância ou apoio logístico terceirizado.

#### 5.8.2. Lógica de Lançamento
- **Catálogo de Subitens:** O usuário seleciona o subitem específico (ex: 33.90.39.48 - Locação de Máquinas).
- **Detalhamento do Planejamento:** Inclui a descrição do serviço, unidade de medida (diária, mês, serviço global), quantidade e valor unitário.
- **Integração PNCP:** Permite importar preços de referência de Atas de Registro de Preços vigentes para garantir a vantajosidade da estimativa.

---

## 6. DOR (Documento de Oficialização de Demanda)

O DOR é um documento de planejamento que consolida as necessidades para fins de contratação.
- **Regra de Agrupamento:** Permite agrupar itens de diferentes classes por finalidade comum.
- **Justificativa:** Exige o preenchimento obrigatório de Motivação, Finalidade e Consequência para conformidade com a legislação de licitações.

---

## 7. Consolidação de PTrabs

A consolidação permite somar os registros de múltiplos PTrabs em um novo documento.
- **Rastreabilidade:** O sistema mantém o histórico dos PTrabs de origem no campo de comentários do novo PTrab consolidado.