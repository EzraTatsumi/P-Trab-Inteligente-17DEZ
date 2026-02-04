-- Adiciona as colunas nr_subitem e descricao à tabela material_consumo_subitens
ALTER TABLE public.material_consumo_subitens
ADD COLUMN nr_subitem TEXT,
ADD COLUMN descricao TEXT;

-- Garante que o RLS continue funcionando corretamente (não é estritamente necessário, mas boa prática)
-- As políticas existentes já cobrem as operações.

-- Atualiza a função set_updated_at para incluir a nova tabela
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_temp, public'
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- Cria o trigger para a nova tabela (se ainda não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'set_updated_at_material_consumo_subitens'
    ) THEN
        CREATE TRIGGER set_updated_at_material_consumo_subitens
        BEFORE UPDATE ON public.material_consumo_subitens
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END
$$;