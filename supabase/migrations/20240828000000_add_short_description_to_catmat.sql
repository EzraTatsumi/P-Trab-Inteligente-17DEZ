-- Adiciona a coluna short_description à tabela catalogo_catmat
ALTER TABLE public.catalogo_catmat
ADD COLUMN short_description TEXT NULL;

-- Cria um índice para otimizar buscas por descrição
CREATE INDEX IF NOT EXISTS idx_catalogo_catmat_short_description ON public.catalogo_catmat (short_description);

-- Atualiza a função set_updated_at para incluir a nova coluna
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

-- A política de SELECT existente ('Authenticated users can read catmat catalog') já permite a leitura.
-- Não é necessário alterar a política, apenas garantir que o trigger de update funcione.