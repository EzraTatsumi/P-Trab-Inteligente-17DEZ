-- Adicionar coluna para memória de cálculo customizada na Classe III
ALTER TABLE classe_iii_registros 
ADD COLUMN detalhamento_customizado TEXT;

COMMENT ON COLUMN classe_iii_registros.detalhamento_customizado IS 
'Memória de cálculo editada manualmente pelo usuário. Quando NULL, usa o detalhamento automático.';