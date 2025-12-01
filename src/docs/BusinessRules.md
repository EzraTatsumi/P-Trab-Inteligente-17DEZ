# Regras de Negócio e Diretrizes de Custeio

Este documento detalha as regras de cálculo e as diretrizes de custeio implementadas no sistema PTrab Inteligente, baseadas nas normas do COLOG e COTER.

## 1. Classe I - Subsistência (Alimentação)

A Classe I é dividida em Quantitativo de Subsistência (QS) e Quantitativo de Rancho (QR). O cálculo é baseado no Efetivo, Dias de Operação, Número de Refeições Intermediárias (Nr Ref Int) e nos Valores de Etapa (QS e QR) definidos na Diretriz de Custeio.

### 1.1. Fórmulas de Cálculo

O cálculo é feito para cada registro de OM, considerando o ciclo de 30 dias.

**Variáveis Chave:**
- `Efetivo`: Número de militares empregados.
- `DiasOperacao`: Duração total da atividade.
- `NrRefInt`: Número de refeições intermediárias (1, 2 ou 3).
- `ValorEtapa`: Valor diário da etapa (QS ou QR) definido na Diretriz.

**Cálculo de Dias de Etapa Solicitada (`DiasEtapaSolicitada`):**
1. Calcula-se o número de ciclos de 30 dias: `CiclosCompletos = FLOOR(DiasOperacao / 30)`.
2. Calcula-se os dias restantes no ciclo: `DiasRestantes = DiasOperacao MOD 30`.
3. Se `DiasRestantes <= 22` e `DiasOperacao >= 30`: `DiasEtapaSolicitada = CiclosCompletos * 8`.
4. Se `DiasRestantes > 22`: `DiasEtapaSolicitada = (DiasRestantes - 22) + (CiclosCompletos * 8)`.
5. Caso contrário (DiasOperacao < 30 e <= 22): `DiasEtapaSolicitada = 0`.

**Cálculo do Complemento:**
O complemento é calculado para todos os dias de operação, limitado a 3 refeições intermediárias.
$$Complemento = Efetivo \times \min(NrRefInt, 3) \times \frac{ValorEtapa}{3} \times DiasOperacao$$

**Cálculo da Etapa Solicitada:**
A etapa solicitada é calculada apenas para os dias de etapa completa solicitada.
$$EtapaSolicitada = Efetivo \times ValorEtapa \times DiasEtapaSolicitada$$

**Total por Tipo (QS ou QR):**
$$Total = Complemento + EtapaSolicitada$$

### 1.2. Alocação de Recursos (ND)

| Tipo | ND | Destino do Recurso |
| :--- | :--- | :--- |
| **QS** | 33.90.30 | OM Fornecedora (RM) |
| **QR** | 33.90.30 | OM de Destino (Detentora) |

---

## 2. Classe II - Material de Intendência

A Classe II cobre o custeio de manutenção de material de intendência (Equipamento Individual, Proteção Balística, Material de Estacionamento).

### 2.1. Fórmulas de Cálculo

O cálculo é baseado no valor de manutenção por dia (`ValorMntDia`) definido na Diretriz de Custeio.

$$ValorTotalCategoria = \sum_{i} (Quantidade_i \times ValorMntDia_i \times DiasOperacao)$$

### 2.2. Alocação de Recursos (ND)

O valor total da categoria é dividido entre ND 33.90.30 (Material) e ND 33.90.39 (Serviço) conforme a alocação manual definida pelo usuário no formulário.

- **ND 33.90.39 (Serviço):** Valor inserido pelo usuário (limitado ao `ValorTotalCategoria`).
- **ND 33.90.30 (Material):** Calculado por diferença: $$ND30 = ValorTotalCategoria - ND39$$

| ND | Propósito | Destino do Recurso |
| :--- | :--- | :--- |
| **33.90.30** | Aquisição de Material | OM de Destino (Definida por Categoria) |
| **33.90.39** | Contratação de Serviço | OM de Destino (Definida por Categoria) |

---

## 3. Classe III - Combustíveis e Lubrificantes

A Classe III é dividida em Combustível (ND 33.90.30) e Lubrificante (ND 33.90.30).

### 3.1. Fórmulas de Cálculo - Combustível

O cálculo varia conforme o tipo de equipamento (Gerador, Embarcação, Motomecanização, Engenharia).

**Variáveis Chave:**
- `PrecoLitro`: Preço do combustível (Diesel ou Gasolina) obtido da Referência LPC.
- `ConsumoFixo`: Consumo base (L/h ou km/L) da Diretriz de Equipamentos.
- `MargemSeguranca`: Fator fixo de 30% (multiplicador de 1.3).

**A. Equipamentos por Consumo/Hora (Geradores, Embarcações, Engenharia):**
$$LitrosSemMargem = \sum_{i} (Quantidade_i \times HorasDia_i \times ConsumoFixo_i \times DiasOperacao)$$
$$LitrosTotais = LitrosSemMargem \times 1.3$$
$$ValorTotal = LitrosTotais \times PrecoLitro$$

**B. Equipamentos por Consumo/Km (Motomecanização):**
$$LitrosSemMargem = \sum_{i} \frac{(DistanciaPercorrida_i \times Quantidade_i \times Deslocamentos_i)}{ConsumoFixo_i}$$
$$LitrosTotais = LitrosSemMargem \times 1.3$$
$$ValorTotal = LitrosTotais \times PrecoLitro$$

### 3.2. Fórmulas de Cálculo - Lubrificante

O cálculo de lubrificante é feito separadamente e alocado à OM detentora do recurso (ND 33.90.30).

**A. Geradores (Consumo por 100h):**
$$TotalHoras = \sum_{i} (Quantidade_i \times HorasDia_i \times DiasOperacao)$$
$$LitrosTotais = \sum_{i} \frac{TotalHoras_i}{100} \times ConsumoLubrificanteLitro_i$$
$$ValorTotal = LitrosTotais \times PrecoLubrificante$$

**B. Embarcações (Consumo por Hora):**
$$TotalHoras = \sum_{i} (Quantidade_i \times HorasDia_i \times DiasOperacao)$$
$$LitrosTotais = \sum_{i} TotalHoras_i \times ConsumoLubrificanteLitro_i$$
$$ValorTotal = LitrosTotais \times PrecoLubrificante$$

### 3.3. Alocação de Recursos (ND)

| Tipo | ND | Destino do Recurso |
| :--- | :--- | :--- |
| **Combustível** | 33.90.30 | RM de Fornecimento |
| **Lubrificante** | 33.90.30 | OM de Destino (Definida no Formulário) |