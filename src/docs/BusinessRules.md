# Regras de Negócio e Cálculo (Diretrizes COLOG/COTER)

Este documento detalha as regras de cálculo e as diretrizes de custeio implementadas no sistema PTrab Inteligente.

## 1. Classe I - Subsistência (Alimentação)

A Classe I é dividida em QS e QR, alocados na ND **33.90.30**.

### 1.1. Fórmulas de Cálculo

**Cálculo de Dias de Etapa Solicitada:**
Representa os dias de etapa completa além do complemento de refeições intermediárias.
1. `Ciclos Completos = FLOOR(Dias Operação / 30)`
2. `Dias Restantes = Dias Operação MOD 30`
3. Se `Dias Restantes > 22` e `Dias Operação >= 30`: `Dias Etapa Solicitada = (Dias Restantes - 22) + (Ciclos Completos * 8)`
4. Se `Dias Restantes <= 22` e `Dias Operação >= 30`: `Dias Etapa Solicitada = Ciclos Completos * 8`
5. Se `Dias Operação < 30`: `Dias Etapa Solicitada = 0`

**Cálculo do Complemento:**
- `Valor Complemento = Efetivo x Nr Ref Int x (Valor Etapa / 3) x Dias Operação`

---

## 2. Classes de Manutenção (II, V, VI, VII, VIII, IX)

Estas classes cobrem a manutenção de material e são alocadas entre **ND 33.90.30 (Material)** e **ND 33.90.39 (Serviço)**.

### 2.1. Fórmulas de Cálculo

- **Classes II, V, VI, VII:** `Valor Item = Quantidade x Valor Mnt/Dia x Dias Operação`.
- **Classe IX (Motomecanização):** Soma o custo base (`Nr Vtr x Valor Mnt/Dia x Dias Operação`) ao custo de acionamento mensal (`Nr Vtr x Valor Acionamento/Mês x CEIL(Dias Operação / 30)`).

---

## 3. Custos Operacionais (GND 3 e GND 4)

O sistema diferencia custos de custeio (GND 3) de investimentos em material permanente (GND 4).

### 3.1. Material Permanente (GND 4)

Alocado na ND **44.90.52**.
- O cálculo é baseado no valor unitário do item multiplicado pela quantidade solicitada.
- Os itens podem ser importados via API do PNCP ou planilha Excel.

### 3.2. Serviços de Terceiros e Locações

Alocados predominantemente na ND **33.90.39** (Serviços) ou **33.90.33** (Passagens).
- O sistema permite o detalhamento por subitem da ND, com itens vinculados a pregões e UASG específicos.

---

## 4. DOR (Documento de Operacionalização de Recursos)

O DOR é um documento de planejamento que consolida as necessidades de recursos para uma operação específica.

- **Estrutura:** Dividido em Evento, Finalidade, Motivação, Consequência e Observações.
- **Itens:** Vincula itens de aquisição (Material de Consumo, Permanente ou Serviços) ao documento, permitindo a geração de um relatório consolidado para submissão ao MD.

---

## 5. Classe III - Combustíveis e Lubrificantes

- **Margem de Segurança:** Aplicação automática de 30% sobre o consumo estimado (`Total Litros = Litros Sem Margem x 1.30`).
- **Preços:** Utiliza a referência LPC (Licitação Pública Centralizada) ou consulta em tempo real via Edge Function.