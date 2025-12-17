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
  const { 
    id, 
    created_at, 
    updated_at, 
    share_token, // Omitido para que o DB gere um novo UUID
    shared_with, // Limpo
    origem, // Redefinido
    status, // Redefinido
    ...dataToClone 
  } = ptrab;

  return {
    ...dataToClone,
    user_id: userId,
    status: 'aberto', // Novo PTrab sempre começa como aberto
    origem: 'clonado', // Marca como clonado
    shared_with: [], // Limpa compartilhamentos
    // share_token é omitido, permitindo que o DB use o default gen_random_uuid()
  };
};