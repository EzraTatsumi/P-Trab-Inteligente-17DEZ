import { Database } from "@/types/supabase";

export type PassagemRegistro = Database['public']['Tables']['passagem_registros']['Row'];
export type PassagemRegistroInsert = Database['public']['Tables']['passagem_registros']['Insert'];
export type PassagemRegistroUpdate = Database['public']['Tables']['passagem_registros']['Update'];

export interface PassagemResumo {
  total_passagens: number;
  total_nd_33: number;
}