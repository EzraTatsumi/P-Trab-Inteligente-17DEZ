-- Adicionar campo para nome completo da OM na tabela p_trab
ALTER TABLE p_trab 
  ADD COLUMN IF NOT EXISTS nome_om_extenso TEXT;

COMMENT ON COLUMN p_trab.nome_om_extenso IS 'Nome completo/por extenso da OM (usado no cabeçalho do P Trab)';
COMMENT ON COLUMN p_trab.nome_om IS 'Nome da OM em sigla (usado como referência)';