import { Tables } from "@/integrations/supabase/types";

type PTrabRow = Tables<'p_trab'>;

/**
 * Prepara um objeto PTrab existente para ser clonado e inserido como um novo registro.
 * Remove campos gerados pelo banco de dados (id, timestamps, share_token)
 * e redefine o status e a origem.
 * @param ptrab O objeto PTrab a ser clonado.
 * @param userId O ID do usuário que está clonando.
 * @returns Um objeto pronto para inserção no Supabase.
 */
export const preparePTrabForCloning = (ptrab: PTrabRow, userId: string) => {
  // Usamos destructuring para remover explicitamente todos os campos que não devem ser copiados
  const { 
    id, 
    created_at, 
    updated_at, 
    share_token, // ESTE CAMPO DEVE SER EXCLUÍDO PARA QUE O DB GERE UM NOVO UUID
    shared_with, 
    origem, 
    status, 
    // Campos que podem estar anexados ao objeto mas não são colunas do DB
    totalLogistica,
    totalOperacional,
    totalMaterialPermanente,
    totalAviacaoExercito,
    ...dataToClone 
  } = ptrab as any; 

  return {
    ...dataToClone,
    user_id: userId,
    status: 'aberto', // Novo PTrab sempre começa como aberto
    origem: 'clonado', // Marca como clonado
    shared_with: [], // Limpa compartilhamentos
    // share_token é omitido, permitindo que o DB use o default gen_random_uuid()
  };
};