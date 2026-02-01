-- Adicionar 'efetivo' à classe_vi_registros
ALTER TABLE public.classe_vi_registros ADD COLUMN IF NOT EXISTS efetivo INTEGER DEFAULT 0;

-- Adicionar 'efetivo' à classe_vii_registros
ALTER TABLE public.classe_vii_registros ADD COLUMN IF NOT EXISTS efetivo INTEGER DEFAULT 0;

-- Adicionar 'efetivo' à classe_viii_saude_registros
ALTER TABLE public.classe_viii_saude_registros ADD COLUMN IF NOT EXISTS efetivo INTEGER DEFAULT 0;

-- Adicionar 'efetivo' à classe_viii_remonta_registros
ALTER TABLE public.classe_viii_remonta_registros ADD COLUMN IF NOT EXISTS efetivo INTEGER DEFAULT 0;

-- Adicionar 'efetivo' à classe_ix_registros
ALTER TABLE public.classe_ix_registros ADD COLUMN IF NOT EXISTS efetivo INTEGER DEFAULT 0;

-- Adicionar 'efetivo' à verba_operacional_registros (Suprimento de Fundos)
ALTER TABLE public.verba_operacional_registros ADD COLUMN IF NOT EXISTS efetivo INTEGER DEFAULT 0;