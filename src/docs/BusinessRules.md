# Regras de Negócio e Cálculo

Este documento detalha as diretrizes de custeio e fórmulas de cálculo do sistema.

## Classe I - Subsistência
A Classe I (Alimentação) é calculada com base no efetivo, dias de operação e valores de etapa (QS/QR).
- **Complemento:** `Efetivo x Nr Refeições x (Valor Etapa / 3) x Dias`.
- **Etapa Solicitada:** Calculada automaticamente para períodos superiores a 30 dias, descontando os dias de guarnição.

## Classes de Manutenção (II, V, VI, VII, VIII, IX)
Cobre a manutenção de materiais e equipamentos.
- **Cálculo Base:** `Quantidade x Valor Mnt/Dia x Dias Operação`.
- **Classe IX:** Inclui adicional de acionamento mensal para viaturas.

## Material de Consumo (GND 3)
Itens de uso imediato alocados na ND 33.90.30.
- **Organização:** Agrupados por subitens da ND (Expediente, Limpeza, etc.).
- **Cálculo:** `Quantidade x Valor Unitário`. Os valores podem ser importados via PNCP ou Excel.

## Material Permanente (GND 4)
Equipamentos e materiais de vida útil longa alocados na ND 44.90.52.
- **Investimento:** Diferenciado do custeio para fins de teto orçamentário.
- **Cálculo:** `Quantidade x Valor Unitário`.

## Resumo de Custos e Crédito
O sistema consolida todos os lançamentos em um painel gerencial.
- **GND 3 vs GND 4:** Separação automática para controle de limites.
- **Gestão de Saldo:** Ao informar o crédito disponível, o sistema exibe o saldo restante. Valores negativos (excesso) são destacados em vermelho.
- **Rateio por OM:** Demonstra quanto de recurso cada Organização Militar receberá no Plano de Trabalho.

## Combustíveis (Classe III)
- **Margem:** Aplicação de 30% de margem de segurança sobre o consumo estimado.
- **Preços:** Referência baseada na tabela LPC ou consulta em tempo real.