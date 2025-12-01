## Regras de Negócio e Cálculo (Diretrizes COLOG/COTER)

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

## 2. Classe II - Material de Intendência

A Classe II cobre a manutenção de material de intendência (barracas, coletes, etc.). O valor é calculado com base em um valor de manutenção por dia (`Valor Mnt/Dia`) definido na Diretriz de Custeio.

### 2.1. Fórmulas de Cálculo

**Cálculo do Valor Total por Item:**
- `Valor Item = Quantidade x Valor Mnt/Dia x Dias Operação`

**Cálculo do Valor Total por Categoria:**
- `Total Categoria = SOMA(Valor Item)` para todos os itens daquela categoria.

### 2.2. Alocação de Natureza de Despesa (ND)

O valor total da categoria é dividido entre **ND 33.90.30 (Material)** e **ND 33.90.39 (Serviço)**, conforme a alocação manual do usuário.

- `ND 33.90.39 (Serviço)`: Valor inserido pelo usuário (máximo: `Total Categoria`).
- `ND 33.90.30 (Material)`: `Total Categoria - ND 33.90.39`.

**Regra de Negócio:** O sistema garante que a soma de ND 30 e ND 39 seja exatamente igual ao `Total Categoria`.

## 3. Classe III - Combustíveis e Lubrificantes

A Classe III é dividida em Combustível (para Geradores, Embarcações, Motomecanização, Engenharia) e Lubrificantes. Ambos são alocados na ND **33.90.30** (exceto o valor do combustível, que é alocado na coluna de Combustível do PTrab).

### 3.1. Referência de Preços (LPC)

O cálculo depende dos preços unitários de Diesel e Gasolina, que são configurados na seção **Referência LPC** do PTrab.

### 3.2. Fórmulas de Cálculo de Combustível (ND 33.90.30)

O cálculo é feito por tipo de equipamento (Gerador, Embarcação, Motomecanização, Engenharia) e consolidado por tipo de combustível (Diesel/Gasolina).

**Fórmula Base (Consumo por Hora - Geradores, Embarcações, Engenharia):**
1. `Litros Sem Margem = (Quantidade x Horas/dia x Consumo Fixo (L/h)) x Dias Operação`

**Fórmula Base (Consumo por Distância - Motomecanização):**
1. `Litros Sem Margem = (Distância a percorrer x Quantidade x Nr Deslocamentos) ÷ Consumo Fixo (km/L)`

**Aplicação da Margem de Segurança:**
- `Total Litros = Litros Sem Margem x 1.30` (Margem de 30% para segurança/imprevistos).

**Valor Total Combustível:**
- `Valor Total = Total Litros x Preço Unitário (LPC)`
- **Alocação:** Coluna **COMBUSTÍVEL** do PTrab (ND 33.90.30).

### 3.3. Fórmulas de Cálculo de Lubrificante (ND 33.90.30)

O cálculo de lubrificante é feito separadamente e alocado na coluna **NATUREZA DE DESPESA (33.90.30)**.

**Lubrificante para Geradores (Consumo por 100h):**
1. `Total Horas = Quantidade x Horas/dia x Dias Operação`
2. `Litros Lubrificante = (Total Horas / 100) x Consumo Lubrificante (L/100h)`

**Lubrificante para Embarcações (Consumo por Hora):**
1. `Total Horas = Quantidade x Horas/dia x Dias Operação`
2. `Litros Lubrificante = Total Horas x Consumo Lubrificante (L/h)`

**Valor Total Lubrificante:**
- `Valor Total = Litros Lubrificante x Preço Lubrificante (R$/L)`
- **Alocação:** Coluna **NATUREZA DE DESPESA (33.90.30)**.