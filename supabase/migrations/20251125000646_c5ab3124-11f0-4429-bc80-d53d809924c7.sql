-- Adicionar colunas opcionais à tabela p_trab para armazenar dados da OM selecionada
ALTER TABLE p_trab 
  ADD COLUMN IF NOT EXISTS codug_om TEXT,
  ADD COLUMN IF NOT EXISTS rm_vinculacao TEXT,
  ADD COLUMN IF NOT EXISTS codug_rm_vinculacao TEXT;

COMMENT ON COLUMN p_trab.codug_om IS 'CODUG da OM selecionada (opcional)';
COMMENT ON COLUMN p_trab.rm_vinculacao IS 'RM de vinculação da OM (opcional)';
COMMENT ON COLUMN p_trab.codug_rm_vinculacao IS 'CODUG da RM de vinculação (opcional)';