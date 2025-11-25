-- Adicionar colunas para armazenar memórias de cálculo customizadas
ALTER TABLE classe_i_registros 
ADD COLUMN memoria_calculo_qs_customizada TEXT,
ADD COLUMN memoria_calculo_qr_customizada TEXT;

COMMENT ON COLUMN classe_i_registros.memoria_calculo_qs_customizada IS 'Memória de cálculo de QS editada manualmente pelo usuário';
COMMENT ON COLUMN classe_i_registros.memoria_calculo_qr_customizada IS 'Memória de cálculo de QR editada manualmente pelo usuário';