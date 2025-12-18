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
- `Valor Total = Litros Lubrificante x Preço Lubrificante (R$/L)`