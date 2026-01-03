import { Tables } from "@/integrations/supabase/types";

/**
 * Tipo para um registro de Diária (Daily Allowance) conforme a tabela 'diaria_registros'.
 */
export type DiariaRegistro = Tables<'diaria_registros'> & {
    // Campos adicionados via migração
    nr_viagens: number;
    local_atividade: string | null;
    quantidades_por_posto: { posto_graduacao: string, qtd: number }[] | null;
};

/**
 * Tipo para um item de diária (usado internamente no formulário, se necessário).
 * Neste caso, o registro inteiro já é o item.
 */
export type DiariaItem = DiariaRegistro;