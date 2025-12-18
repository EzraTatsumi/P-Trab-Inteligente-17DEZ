export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      classe_i_registros: {
        Row: {
          complemento_qr: number
          complemento_qs: number
          created_at: string
          dias_operacao: number
          efetivo: number
          etapa_qr: number
          etapa_qs: number
          fase_atividade: string | null
          id: string
          memoria_calculo_qr_customizada: string | null
          memoria_calculo_qs_customizada: string | null
          nr_ref_int: number
          om_qs: string
          organizacao: string
          p_trab_id: string
          total_geral: number
          total_qr: number
          total_qs: number
          ug: string
          ug_qs: string
          updated_at: string
          valor_qr: number
          valor_qs: number
          categoria: string
          quantidade_r2: number
          quantidade_r3: number
        }
        Insert: {
          complemento_qr?: number
          complemento_qs?: number
          created_at?: string
          dias_operacao: number
          efetivo: number
          etapa_qr?: number
          etapa_qs?: number
          fase_atividade?: string | null
          id?: string
          memoria_calculo_qr_customizada?: string | null
          memoria_calculo_qs_customizada?: string | null
          nr_ref_int: number
          om_qs: string
          organizacao: string
          p_trab_id: string
          total_geral: number
          total_qr?: number
          total_qs?: number
          ug: string
          ug_qs: string
          updated_at?: string
          valor_qr: number
          valor_qs: number
          categoria?: string
          quantidade_r2?: number
          quantidade_r3?: number
        }
        Update: {
          complemento_qr?: number
          complemento_qs?: number
          created_at?: string
          dias_operacao?: number
          efetivo?: number
          etapa_qr?: number
          etapa_qs?: number
          fase_atividade?: string | null
          id?: string
          memoria_calculo_qr_customizada?: string | null
          memoria_calculo_qs_customizada?: string | null
          nr_ref_int?: number
          om_qs?: string
          organizacao?: string
          p_trab_id?: string
          total_geral?: number
          total_qr?: number
          total_qs?: number
          ug?: string
          ug_qs?: string
          updated_at?: string
          valor_qr?: number
          valor_qs?: number
          categoria?: string
          quantidade_r2?: number
          quantidade_r3?: number
        }
        Relationships: [
          {
            foreignKeyName: "classe_i_registros_p_trab_id_fkey"
            columns: ["p_trab_id"]
            isOneToOne: false
            referencedRelation: "p_trab"
            referencedColumns: ["id"]
          },
        ]
      }
      classe_ii_registros: {
        Row: {
          categoria: string
          created_at: string
          detalhamento: string | null
          detalhamento_customizado: string | null
          dias_operacao: number
          fase_atividade: string | null
          id: string
          itens_equipamentos: Json
          organizacao: string
          p_trab_id: string
          ug: string
          updated_at: string
          valor_nd_30: number
          valor_nd_39: number
          valor_total: number
        }
        Insert: {
          categoria: string
          created_at?: string
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao: number
          fase_atividade?: string | null
          id?: string
          itens_equipamentos: Json
          organizacao: string
          p_trab_id: string
          ug: string
          updated_at?: string
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total: number
        }
        Update: {
          categoria?: string
          created_at?: string
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          fase_atividade?: string | null
          id?: string
          itens_equipamentos?: Json
          organizacao?: string
          p_trab_id?: string
          ug?: string
          updated_at?: string
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "classe_ii_registros_p_trab_id_fkey"
            columns: ["p_trab_id"]
            isOneToOne: false
            referencedRelation: "p_trab"
            referencedColumns: ["id"]
          },
        ]
      }
      classe_iii_registros: {
        Row: {
          consumo_hora: number | null
          consumo_km_litro: number | null
          consumo_lubrificante_litro: number | null
          created_at: string
          detalhamento: string | null
          detalhamento_customizado: string | null
          dias_operacao: number
          fase_atividade: string | null
          horas_dia: number | null
          id: string
          itens_equipamentos: Json | null
          km_dia: number | null
          organizacao: string
          p_trab_id: string
          potencia_hp: number | null
          preco_litro: number
          preco_lubrificante: number | null
          quantidade: number
          tipo_combustivel: string
          tipo_equipamento: string
          tipo_equipamento_detalhe: string | null
          total_litros: number
          total_litros_sem_margem: number | null
          ug: string
          updated_at: string
          valor_nd_30: number
          valor_nd_39: number
          valor_total: number
        }
        Insert: {
          consumo_hora?: number | null
          consumo_km_litro?: number | null
          consumo_lubrificante_litro?: number | null
          created_at?: string
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao: number
          fase_atividade?: string | null
          horas_dia?: number | null
          id?: string
          itens_equipamentos?: Json | null
          km_dia?: number | null
          organizacao: string
          p_trab_id: string
          potencia_hp?: number | null
          preco_litro: number
          preco_lubrificante?: number | null
          quantidade: number
          tipo_combustivel: string
          tipo_equipamento: string
          tipo_equipamento_detalhe?: string | null
          total_litros: number
          total_litros_sem_margem?: number | null
          ug: string
          updated_at?: string
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total: number
        }
        Update: {
          consumo_hora?: number | null
          consumo_km_litro?: number | null
          consumo_lubrificante_litro?: number | null
          created_at?: string
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          fase_atividade?: string | null
          horas_dia?: number | null
          id?: string
          itens_equipamentos?: Json | null
          km_dia?: number | null
          organizacao?: string
          p_trab_id?: string
          potencia_hp?: number | null
          preco_litro?: number
          preco_lubrificante?: number | null
          quantidade?: number
          tipo_combustivel?: string
          tipo_equipamento?: string
          tipo_equipamento_detalhe?: string | null
          total_litros?: number
          total_litros_sem_margem?: number | null
          ug?: string
          updated_at?: string
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "classe_iii_registros_p_trab_id_fkey"
            columns: ["p_trab_id"]
            isOneToOne: false
            referencedRelation: "p_trab"
            referencedColumns: ["id"]
          },
        ]
      }
      classe_v_registros: {
        Row: {
          categoria: string
          created_at: string
          detalhamento: string | null
          detalhamento_customizado: string | null
          dias_operacao: number
          fase_atividade: string | null
          id: string
          itens_equipamentos: Json
          organizacao: string
          p_trab_id: string
          ug: string
          updated_at: string
          valor_nd_30: number
          valor_nd_39: number
          valor_total: number
        }
        Insert: {
          categoria: string
          created_at?: string
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao: number
          fase_atividade?: string | null
          id?: string
          itens_equipamentos: Json
          organizacao: string
          p_trab_id: string
          ug: string
          updated_at?: string
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total: number
        }
        Update: {
          categoria?: string
          created_at?: string
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          fase_atividade?: string | null
          id?: string
          itens_equipamentos?: Json
          organizacao?: string
          p_trab_id?: string
          ug?: string
          updated_at?: string
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "classe_v_registros_p_trab_id_fkey"
            columns: ["p_trab_id"]
            isOneToOne: false
            referencedRelation: "p_trab"
            referencedColumns: ["id"]
          },
        ]
      }
      classe_vi_registros: {
        Row: {
          categoria: string
          created_at: string
          detalhamento: string | null
          detalhamento_customizado: string | null
          dias_operacao: number
          fase_atividade: string | null
          id: string
          itens_equipamentos: Json
          organizacao: string
          p_trab_id: string
          ug: string
          updated_at: string
          valor_nd_30: number
          valor_nd_39: number
          valor_total: number
        }
        Insert: {
          categoria: string
          created_at?: string
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao: number
          fase_atividade?: string | null
          id?: string
          itens_equipamentos: Json
          organizacao: string
          p_trab_id: string
          ug: string
          updated_at?: string
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total: number
        }
        Update: {
          categoria?: string
          created_at?: string
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          fase_atividade?: string | null
          id?: string
          itens_equipamentos?: Json
          organizacao?: string
          p_trab_id?: string
          ug?: string
          updated_at?: string
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "classe_vi_registros_p_trab_id_fkey"
            columns: ["p_trab_id"]
            isOneToOne: false
            referencedRelation: "p_trab"
            referencedColumns: ["id"]
          },
        ]
      }
      classe_vii_registros: {
        Row: {
          categoria: string
          created_at: string
          detalhamento: string | null
          detalhamento_customizado: string | null
          dias_operacao: number
          fase_atividade: string | null
          id: string
          itens_equipamentos: Json
          organizacao: string
          p_trab_id: string
          ug: string
          updated_at: string
          valor_nd_30: number
          valor_nd_39: number
          valor_total: number
        }
        Insert: {
          categoria: string
          created_at?: string
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao: number
          fase_atividade?: string | null
          id?: string
          itens_equipamentos: Json
          organizacao: string
          p_trab_id: string
          ug: string
          updated_at?: string
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total: number
        }
        Update: {
          categoria?: string
          created_at?: string
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          fase_atividade?: string | null
          id?: string
          itens_equipamentos?: Json
          organizacao?: string
          p_trab_id?: string
          ug?: string
          updated_at?: string
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "classe_vii_registros_p_trab_id_fkey"
            columns: ["p_trab_id"]
            isOneToOne: false
            referencedRelation: "p_trab"
            referencedColumns: ["id"]
          },
        ]
      }
      classe_viii_remonta_registros: {
        Row: {
          animal_tipo: string
          created_at: string
          detalhamento: string | null
          detalhamento_customizado: string | null
          dias_operacao: number
          fase_atividade: string | null
          id: string
          itens_remonta: Json
          organizacao: string
          p_trab_id: string
          quantidade_animais: number
          ug: string
          updated_at: string
          valor_nd_30: number
          valor_nd_39: number
          valor_total: number
        }
        Insert: {
          animal_tipo: string
          created_at?: string
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao: number
          fase_atividade?: string | null
          id?: string
          itens_remonta: Json
          organizacao: string
          p_trab_id: string
          quantidade_animais: number
          ug: string
          updated_at?: string
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total: number
        }
        Update: {
          animal_tipo?: string
          created_at?: string
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          fase_atividade?: string | null
          id?: string
          itens_remonta?: Json
          organizacao?: string
          p_trab_id?: string
          quantidade_animais?: number
          ug?: string
          updated_at?: string
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "classe_viii_remonta_registros_p_trab_id_fkey"
            columns: ["p_trab_id"]
            isOneToOne: false
            referencedRelation: "p_trab"
            referencedColumns: ["id"]
          },
        ]
      }
      classe_viii_saude_registros: {
        Row: {
          categoria: string
          created_at: string
          detalhamento: string | null
          detalhamento_customizado: string | null
          dias_operacao: number
          fase_atividade: string | null
          id: string
          itens_saude: Json
          organizacao: string
          p_trab_id: string
          ug: string
          updated_at: string
          valor_nd_30: number
          valor_nd_39: number
          valor_total: number
        }
        Insert: {
          categoria?: string
          created_at?: string
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao: number
          fase_atividade?: string | null
          id?: string
          itens_saude: Json
          organizacao: string
          p_trab_id: string
          ug: string
          updated_at?: string
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total: number
        }
        Update: {
          categoria?: string
          created_at?: string
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          fase_atividade?: string | null
          id?: string
          itens_saude?: Json
          organizacao?: string
          p_trab_id?: string
          ug?: string
          updated_at?: string
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "classe_viii_saude_registros_p_trab_id_fkey"
            columns: ["p_trab_id"]
            isOneToOne: false
            referencedRelation: "p_trab"
            referencedColumns: ["id"]
          },
        ]
      }
      classe_ix_registros: {
        Row: {
          categoria: string
          created_at: string
          detalhamento: string | null
          detalhamento_customizado: string | null
          dias_operacao: number
          fase_atividade: string | null
          id: string
          itens_motomecanizacao: Json
          organizacao: string
          p_trab_id: string
          ug: string
          updated_at: string
          valor_nd_30: number
          valor_nd_39: number
          valor_total: number
        }
        Insert: {
          categoria: string
          created_at?: string
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao: number
          fase_atividade?: string | null
          id?: string
          itens_motomecanizacao: Json
          organizacao: string
          p_trab_id: string
          ug: string
          updated_at?: string
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total: number
        }
        Update: {
          categoria?: string
          created_at?: string
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          fase_atividade?: string | null
          id?: string
          itens_motomecanizacao?: Json
          organizacao?: string
          p_trab_id?: string
          ug?: string
          updated_at?: string
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "classe_ix_registros_p_trab_id_fkey"
            columns: ["p_trab_id"]
            isOneToOne: false
            referencedRelation: "p_trab"
            referencedColumns: ["id"]
          },
        ]
      }
      diretrizes_classe_ii: {
        Row: {
          ano_referencia: number
          ativo: boolean | null
          categoria: string
          created_at: string
          id: string
          item: string
          updated_at: string
          user_id: string
          valor_mnt_dia: number
        }
        Insert: {
          ano_referencia: number
          ativo?: boolean | null
          categoria: string
          created_at?: string
          id?: string
          item: string
          updated_at?: string
          user_id: string
          valor_mnt_dia: number
        }
        Update: {
          ano_referencia?: number
          ativo?: boolean | null
          categoria?: string
          created_at?: string
          id?: string
          item?: string
          updated_at?: string
          user_id?: string
          valor_mnt_dia?: number
        }
        Relationships: []
      }
      diretrizes_custeio: {
        Row: {
          ano_referencia: number
          classe_i_valor_qr: number
          classe_i_valor_qs: number
          classe_iii_fator_embarcacao: number
          classe_iii_fator_equip_engenharia: number
          classe_iii_fator_gerador: number
          created_at: string
          id: string
          observacoes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ano_referencia: number
          classe_i_valor_qr?: number
          classe_i_valor_qs?: number
          classe_iii_fator_embarcacao?: number
          classe_iii_fator_equip_engenharia?: number
          classe_iii_fator_gerador?: number
          created_at?: string
          id?: string
          observacoes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ano_referencia?: number
          classe_i_valor_qr?: number
          classe_i_valor_qs?: number
          classe_iii_fator_embarcacao?: number
          classe_iii_fator_equip_engenharia?: number
          classe_iii_fator_gerador?: number
          created_at?: string
          id?: string
          observacoes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      diretrizes_equipamentos_classe_iii: {
        Row: {
          ano_referencia: number
          ativo: boolean
          categoria: string
          consumo: number
          created_at: string
          id: string
          nome_equipamento: string
          tipo_combustivel: string
          unidade: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ano_referencia: number
          ativo?: boolean
          categoria: string
          consumo: number
          created_at?: string
          id?: string
          nome_equipamento: string
          tipo_combustivel: string
          unidade: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ano_referencia?: number
          ativo?: boolean
          categoria?: string
          consumo?: number
          created_at?: string
          id?: string
          nome_equipamento?: string
          tipo_combustivel?: string
          unidade?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      organizacoes_militares: {
        Row: {
          ativo: boolean | null
          codug_om: string
          codug_rm_vinculacao: string
          created_at: string | null
          id: string
          nome_om: string
          rm_vinculacao: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          codug_om: string
          codug_rm_vinculacao: string
          created_at?: string | null
          id?: string
          nome_om: string
          rm_vinculacao: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          codug_om?: string
          codug_rm_vinculacao?: string
          created_at?: string | null
          id?: string
          nome_om?: string
          rm_vinculacao?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      p_trab: {
        Row: {
          acoes: string | null
          codug_om: string | null
          codug_rm_vinculacao: string | null
          comando_militar_area: string
          comentario: string | null
          created_at: string
          efetivo_empregado: string
          id: string
          local_om: string | null
          nome_cmt_om: string | null
          nome_om: string
          nome_om_extenso: string | null
          nome_operacao: string
          numero_ptrab: string
          periodo_fim: string
          periodo_inicio: string
          rm_vinculacao: string | null
          rotulo_versao: string | null
          status: string
          updated_at: string
          user_id: string
          share_token: string
          shared_with: string[] | null
          origem: string
        }
        Insert: {
          acoes?: string | null
          codug_om?: string | null
          codug_rm_vinculacao?: string | null
          comando_militar_area: string
          comentario?: string | null
          created_at?: string
          efetivo_empregado: string
          id?: string
          local_om?: string | null
          nome_cmt_om?: string | null
          nome_om: string
          nome_om_extenso?: string | null
          nome_operacao: string
          numero_ptrab: string
          periodo_fim: string
          periodo_inicio: string
          rm_vinculacao?: string | null
          rotulo_versao?: string | null
          status?: string
          updated_at?: string
          user_id: string
          share_token?: string
          shared_with?: string[] | null
          origem?: string
        }
        Update: {
          acoes?: string | null
          codug_om?: string | null
          codug_rm_vinculacao?: string | null
          comando_militar_area?: string
          comentario?: string | null
          created_at?: string
          efetivo_empregado?: string
          id?: string
          local_om?: string | null
          nome_cmt_om?: string | null
          nome_om?: string
          nome_om_extenso?: string | null
          nome_operacao?: string
          numero_ptrab?: string
          periodo_fim?: string
          periodo_inicio?: string
          rm_vinculacao?: string | null
          rotulo_versao?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          share_token?: string
          shared_with?: string[] | null
          origem?: string
        }
        Relationships: []
      }
      p_trab_ref_lpc: {
        Row: {
          ambito: string
          created_at: string
          data_fim_consulta: string
          data_inicio_consulta: string
          id: string
          nome_local: string | null
          p_trab_id: string
          preco_diesel: number
          preco_gasolina: number
          updated_at: string
          source: string
        }
        Insert: {
          ambito: string
          created_at?: string
          data_fim_consulta: string
          data_inicio_consulta: string
          id?: string
          nome_local?: string | null
          p_trab_id: string
          preco_diesel: number
          preco_gasolina: number
          updated_at?: string
          source?: string
        }
        Update: {
          ambito?: string
          created_at?: string
          data_fim_consulta?: string
          data_inicio_consulta?: string
          id?: string
          nome_local?: string | null
          p_trab_id?: string
          preco_diesel?: number
          preco_gasolina?: number
          updated_at?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "p_trab_ref_lpc_p_trab_id_fkey"
            columns: ["p_trab_id"]
            isOneToOne: true
            referencedRelation: "p_trab"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          credit_gnd3: number
          credit_gnd4: number
          default_diretriz_year: number | null
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string | null
          raw_user_meta_data: Json | null
        }
        Insert: {
          avatar_url?: string | null
          credit_gnd3?: number
          credit_gnd4?: number
          default_diretriz_year?: number | null
          first_name?: string | null
          id: string
          last_name?: string | null
          updated_at?: string | null
          raw_user_meta_data?: Json | null
        }
        Update: {
          avatar_url?: string | null
          credit_gnd3?: number
          credit_gnd4?: number
          default_diretriz_year?: number | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string | null
          raw_user_meta_data?: Json | null
        }
        Relationships: []
      }
      ptrab_share_requests: {
        Row: {
          created_at: string
          id: string
          ptrab_id: string
          requester_id: string
          share_token: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          ptrab_id: string
          requester_id: string
          share_token: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          ptrab_id?: string
          requester_id?: string
          share_token?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ptrab_share_requests_ptrab_id_fkey"
            columns: ["ptrab_id"]
            isOneToOne: false
            referencedRelation: "p_trab"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ptrab_share_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const