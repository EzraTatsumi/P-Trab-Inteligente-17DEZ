import { Tables } from "@/integrations/supabase/types";

// Tipos de Registro de Classes
export type ClasseIRegistro = Tables<'classe_i_registros'>;
export type ClasseIIRegistro = Tables<'classe_ii_registros'>;
export type ClasseIIIRegistro = Tables<'classe_iii_registros'>;
export type ClasseVRegistro = Tables<'classe_v_registros'>;
export type ClasseVIRegistro = Tables<'classe_vi_registros'>;
export type ClasseVIIRegistro = Tables<'classe_vii_registros'>;
export type ClasseVIIISaudeRegistro = Tables<'classe_viii_saude_registros'>;
export type ClasseVIIIRemontaRegistro = Tables<'classe_viii_remonta_registros'>;
export type ClasseIXRegistro = Tables<'classe_ix_registros'>;
export type DiariaRegistro = Tables<'diaria_registros'>;
export type VerbaOperacionalRegistro = Tables<'verba_operacional_registros'>;
export type PassagemRegistro = Tables<'passagem_registros'>;

// Tipos de Diretrizes
export type DiretrizCusteio = Tables<'diretrizes_custeio'>;
export type DiretrizOperacional = Tables<'diretrizes_operacionais'>;
export type DiretrizClasseII = Tables<'diretrizes_classe_ii'>;
export type DiretrizClasseIX = Tables<'diretrizes_classe_ix'>;
export type DiretrizEquipamentoClasseIII = Tables<'diretrizes_equipamentos_classe_iii'>;
export type DiretrizPassagem = Tables<'diretrizes_passagens'>;

// Tipos de Perfil e OM
export type Profile = Tables<'profiles'>;
export type OrganizacaoMilitar = Tables<'organizacoes_militares'>;

// Tipos de Compartilhamento
export type PTrabShareRequest = Tables<'ptrab_share_requests'>;