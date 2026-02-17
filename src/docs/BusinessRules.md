# Regras de Negócio e Lógica de Cálculo

O PTrab Inteligente segue diretrizes rigorosas para garantir a precisão dos cálculos orçamentários.

## 1. Lógica de Cálculo Logístico
- **Classe I:** Baseado no valor da Etapa Comum (QS) e Etapa de Operação (QR), considerando o efetivo e dias de operação.
- **Classe III:** Utiliza o consumo por hora ou quilômetro, integrado aos preços médios de combustíveis (Diesel/Gasolina) buscados via API.

## 2. Lógica de Cálculo Operacional
- **Diárias:** Calculadas conforme a localidade (Brasília, Capitais ou Demais) e o posto/graduação do militar, seguindo a tabela vigente.
- **HV AvEx:** O valor total é derivado da quantidade de horas solicitadas multiplicada pelo custo da hora de voo definido nas diretrizes anuais.

## 3. Status e Fluxo de Trabalho
- **Aberto:** Edição livre pelo proprietário.
- **Em Andamento:** Status automático ao iniciar o preenchimento de classes.
- **Aprovado:** Bloqueia edições parciais e atribui numeração oficial.
- **Arquivado:** PTrabs antigos ou finalizados, mantidos para histórico.

## 4. Consolidação
Ao consolidar PTrabs, o sistema soma todos os registros de classes e itens operacionais, criando um novo PTrab "Consolidado" que mantém a rastreabilidade dos originais.

## 5. Validação de Créditos
O sistema alerta visualmente quando o custo total do PTrab excede os créditos (GND 3 ou GND 4) informados pelo usuário no perfil ou no formulário.