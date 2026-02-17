# Regras de Negócio e Cálculo (Diretrizes COLOG/COTER)

Este documento detalha as regras de cálculo e as diretrizes de custeio implementadas no sistema PTrab Inteligente.

## 1. Classe I - Subsistência (Alimentação)
Alocada na ND **33.90.30**. Dividida em QS (OM Fornecedora) e QR (OM de Destino).
- **Cálculo de Etapa:** Baseado no ciclo de 30 dias. Se a operação for >= 30 dias, calcula-se a etapa completa para os dias que excedem o ciclo administrativo (conforme diretriz COTER).
- **Complemento:** Destinado a refeições intermediárias (Ref Int), limitado a 3 por dia.

## 2. Classes de Manutenção (II, V, VI, VII, VIII, IX)
- **Cálculo Base:** `Quantidade x Valor Mnt/Dia x Dias Operação`.
- **Alocação ND:** O usuário divide o valor total entre **ND 30 (Material)** e **ND 39 (Serviço)**. O sistema valida se a soma corresponde ao total calculado.
- **Classe IX (Motomecanização):** Inclui o **Custo de Acionamento** (fixo por mês/fração de 30 dias) somado ao custo de manutenção diária.

## 3. Classe III - Combustíveis e Lubrificantes
- **Combustível:** `Litros Sem Margem x 1.30 (Margem de Segurança) x Preço LPC`.
- **Lubrificante:** Calculado como uma porcentagem ou valor fixo sobre o consumo de combustível, alocado na ND 30.

## 4. Itens Operacionais (Aba Operacional)
- **Diárias (ND 33.90.14):** Baseadas na tabela de diárias da diretriz (Of Gen, Of Sup, Of Int/Sgt, Praças) e no destino (Brasília, Capitais, Demais).
- **Passagens (ND 33.90.33):** Baseadas em trechos cadastrados nas diretrizes ou valores manuais.
- **Verba Operacional / Suprimento de Fundos:** Calculados por equipe/dia conforme teto da diretriz.
- **Material de Consumo / Permanente:** Itens individuais ou grupos de aquisição com alocação em ND 30, 39 ou 52.

## 5. DOR (Documento de Oficialização de Demanda)
O DOR consolida as necessidades de um PTrab para fins de contratação ou descentralização.
- **Agrupamento:** Os itens podem ser agrupados por finalidade ou natureza.
- **Campos Obrigatórios:** Evento, Finalidade, Motivação e Consequência da não realização.
- **Relação com PTrab:** O DOR herda os itens já lançados nas classes, permitindo o detalhamento técnico necessário para o termo de referência.

## 6. Consolidação de PTrabs
Permite somar as necessidades de múltiplos PTrabs (ex: de várias OM subordinadas) em um novo PTrab "Consolidado".
- **Regra:** Mantém a rastreabilidade dos PTrabs de origem no campo de comentários.