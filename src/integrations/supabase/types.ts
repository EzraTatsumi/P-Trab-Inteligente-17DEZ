export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      classe_i_registros: {
        Row: {
          categoria: string
          codug_om: string
          complemento_qr: number
          complemento_qs: number
          created_at: string | null
          dias_operacao: number
          efetivo: number
          etapa_qr: number
          etapa_qs: number
          fase_atividade: string | null
          id: string
          memoria_calculo_op_customizada: string | null
          memoria_calculo_qr_customizada: string | null
          memoria_calculo_qs_customizada: string | null
          nr_ref_int: number
          om_qs: string
          organizacao: string
          p_trab_id: string
          quantidade_r2: number
          quantidade_r3: number
          total_geral: number
          total_qr: number
          total_qs: number
          ug: string
          ug_qs: string
          updated_at: string | null
          valor_qr: number
          valor_qs: number
        }
        Insert: {
          categoria?: string
          codug_om: string
          complemento_qr?: number
          complemento_qs?: number
          created_at?: string | null
          dias_operacao: number
          efetivo: number
          etapa_qr?: number
          etapa_qs?: number
          fase_atividade?: string | null
          id?: string
          memoria_calculo_op_customizada?: string | null
          memoria_calculo_qr_customizada?: string | null
          memoria_calculo_qs_customizada?: string | null
          nr_ref_int: number
          om_qs: string
          organizacao: string
          p_trab_id: string
          quantidade_r2?: number
          quantidade_r3?: number
          total_geral?: number
          total_qr?: number
          total_qs?: number
          ug: string
          ug_qs: string
          updated_at?: string | null
          valor_qr: number
          valor_qs: number
        }
        Update: {
          categoria?: string
          codug_om?: string
          complemento_qr?: number
          complemento_qs?: number
          created_at?: string | null
          dias_operacao?: number
          efetivo?: number
          etapa_qr?: number
          etapa_qs?: number
          fase_atividade?: string | null
          id?: string
          memoria_calculo_op_customizada?: string | null
          memoria_calculo_qr_customizada?: string | null
          memoria_calculo_qs_customizada?: string | null
          nr_ref_int?: number
          om_qs?: string
          organizacao?: string
          p_trab_id?: string
          quantidade_r2?: number
          quantidade_r3?: number
          total_geral?: number
          total_qr?: number
          total_qs?: number
          ug?: string
          ug_qs?: string
          updated_at?: string | null
          valor_qr?: number
          valor_qs?: number
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
          created_at: string | null
          detalhamento: string | null
          detalhamento_customizado: string | null
          dias_operacao: number
          efetivo: number
          fase_atividade: string | null
          id: string
          itens_equipamentos: Json
          om_detentora: string | null
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora: string | null
          updated_at: string | null
          valor_nd_30: number
          valor_nd_39: number
          valor_total: number
        }
        Insert: {
          categoria: string
          created_at?: string | null
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao: number
          efetivo?: number
          fase_atividade?: string | null
          id?: string
          itens_equipamentos: Json
          om_detentora?: string | null
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora?: string | null
          updated_at?: string | null
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total: number
        }
        Update: {
          categoria?: string
          created_at?: string | null
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          efetivo?: number
          fase_atividade?: string | null
          id?: string
          itens_equipamentos?: Json
          om_detentora?: string | null
          organizacao?: string
          p_trab_id?: string
          ug?: string
          ug_detentora?: string | null
          updated_at?: string | null
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
          categoria: string | null
          consumo_hora: number | null
          consumo_km_litro: number | null
          consumo_lubrificante_litro: number | null
          created_at: string | null
          detalhamento: string | null
          detalhamento_customizado: string | null
          dias_operacao: number
          fase_atividade: string | null
          horas_dia: number | null
          id: string
          itens_equipamentos: Json | null
          km_dia: number | null
          om_detentora: string | null
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
          ug_detentora: string | null
          updated_at: string | null
          valor_nd_30: number
          valor_nd_39: number
          valor_total: number
        }
        Insert: {
          categoria?: string | null
          consumo_hora?: number | null
          consumo_km_litro?: number | null
          consumo_lubrificante_litro?: number | null
          created_at?: string | null
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao: number
          fase_atividade?: string | null
          horas_dia?: number | null
          id?: string
          itens_equipamentos?: Json | null
          km_dia?: number | null
          om_detentora?: string | null
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
          ug_detentora?: string | null
          updated_at?: string | null
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total: number
        }
        Update: {
          categoria?: string | null
          consumo_hora?: number | null
          consumo_km_litro?: number | null
          consumo_lubrificante_litro?: number | null
          created_at?: string | null
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          fase_atividade?: string | null
          horas_dia?: number | null
          id?: string
          itens_equipamentos?: Json | null
          km_dia?: number | null
          om_detentora?: string | null
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
          ug_detentora?: string | null
          updated_at?: string | null
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
          created_at: string | null
          detalhamento: string | null
          detalhamento_customizado: string | null
          dias_operacao: number
          efetivo: number
          fase_atividade: string | null
          id: string
          itens_equipamentos: Json
          om_detentora: string | null
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora: string | null
          updated_at: string | null
          valor_nd_30: number
          valor_nd_39: number
          valor_total: number
        }
        Insert: {
          categoria: string
          created_at?: string | null
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao: number
          efetivo?: number
          fase_atividade?: string | null
          id?: string
          itens_equipamentos: Json
          om_detentora?: string | null
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora?: string | null
          updated_at?: string | null
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total: number
        }
        Update: {
          categoria?: string
          created_at?: string | null
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          efetivo?: number
          fase_atividade?: string | null
          id?: string
          itens_equipamentos?: Json
          om_detentora?: string | null
          organizacao?: string
          p_trab_id?: string
          ug?: string
          ug_detentora?: string | null
          updated_at?: string | null
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
          created_at: string | null
          detalhamento: string | null
          detalhamento_customizado: string | null
          dias_operacao: number
          efetivo: number | null
          fase_atividade: string | null
          id: string
          itens_equipamentos: Json
          om_detentora: string
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora: string
          updated_at: string | null
          valor_nd_30: number
          valor_nd_39: number
          valor_total: number
        }
        Insert: {
          categoria: string
          created_at?: string | null
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao: number
          efetivo?: number | null
          fase_atividade?: string | null
          id?: string
          itens_equipamentos: Json
          om_detentora: string
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora: string
          updated_at?: string | null
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total: number
        }
        Update: {
          categoria?: string
          created_at?: string | null
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          efetivo?: number | null
          fase_atividade?: string | null
          id?: string
          itens_equipamentos?: Json
          om_detentora?: string
          organizacao?: string
          p_trab_id?: string
          ug?: string
          ug_detentora?: string
          updated_at?: string | null
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
          created_at: string | null
          detalhamento: string | null
          detalhamento_customizado: string | null
          dias_operacao: number
          efetivo: number | null
          fase_atividade: string | null
          id: string
          itens_equipamentos: Json
          om_detentora: string | null
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora: string | null
          updated_at: string | null
          valor_nd_30: number
          valor_nd_39: number
          valor_total: number
        }
        Insert: {
          categoria: string
          created_at?: string | null
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao: number
          efetivo?: number | null
          fase_atividade?: string | null
          id?: string
          itens_equipamentos: Json
          om_detentora?: string | null
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora?: string | null
          updated_at?: string | null
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total: number
        }
        Update: {
          categoria?: string
          created_at?: string | null
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          efetivo?: number | null
          fase_atividade?: string | null
          id?: string
          itens_equipamentos?: Json
          om_detentora?: string | null
          organizacao?: string
          p_trab_id?: string
          ug?: string
          ug_detentora?: string | null
          updated_at?: string | null
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
          created_at: string | null
          detalhamento: string | null
          detalhamento_customizado: string | null
          dias_operacao: number
          efetivo: number | null
          fase_atividade: string | null
          id: string
          itens_remonta: Json
          om_detentora: string | null
          organizacao: string
          p_trab_id: string
          quantidade_animais: number
          ug: string
          ug_detentora: string | null
          updated_at: string | null
          valor_nd_30: number
          valor_nd_39: number
          valor_total: number
        }
        Insert: {
          animal_tipo: string
          created_at?: string | null
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao: number
          efetivo?: number | null
          fase_atividade?: string | null
          id?: string
          itens_remonta: Json
          om_detentora?: string | null
          organizacao: string
          p_trab_id: string
          quantidade_animais: number
          ug: string
          ug_detentora?: string | null
          updated_at?: string | null
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total: number
        }
        Update: {
          animal_tipo?: string
          created_at?: string | null
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          efetivo?: number | null
          fase_atividade?: string | null
          id?: string
          itens_remonta?: Json
          om_detentora?: string | null
          organizacao?: string
          p_trab_id?: string
          quantidade_animais?: number
          ug?: string
          ug_detentora?: string | null
          updated_at?: string | null
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
          created_at: string | null
          detalhamento: string | null
          detalhamento_customizado: string | null
          dias_operacao: number
          efetivo: number | null
          fase_atividade: string | null
          id: string
          itens_saude: Json
          om_detentora: string | null
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora: string | null
          updated_at: string | null
          valor_nd_30: number
          valor_nd_39: number
          valor_total: number
        }
        Insert: {
          categoria?: string
          created_at?: string | null
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao: number
          efetivo?: number | null
          fase_atividade?: string | null
          id?: string
          itens_saude: Json
          om_detentora?: string | null
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora?: string | null
          updated_at?: string | null
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total: number
        }
        Update: {
          categoria?: string
          created_at?: string | null
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          efetivo?: number | null
          fase_atividade?: string | null
          id?: string
          itens_saude?: Json
          om_detentora?: string | null
          organizacao?: string
          p_trab_id?: string
          ug?: string
          ug_detentora?: string | null
          updated_at?: string | null
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
          created_at: string | null
          detalhamento: string | null
          detalhamento_customizado: string | null
          dias_operacao: number
          efetivo: number | null
          fase_atividade: string | null
          id: string
          itens_motomecanizacao: Json
          om_detentora: string | null
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora: string | null
          updated_at: string | null
          valor_nd_30: number
          valor_nd_39: number
          valor_total: number
        }
        Insert: {
          categoria: string
          created_at?: string | null
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao: number
          efetivo?: number | null
          fase_atividade?: string | null
          id?: string
          itens_motomecanizacao: Json
          om_detentora?: string | null
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora?: string | null
          updated_at?: string | null
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total: number
        }
        Update: {
          categoria?: string
          created_at?: string | null
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          efetivo?: number | null
          fase_atividade?: string | null
          id?: string
          itens_motomecanizacao?: Json
          om_detentora?: string | null
          organizacao?: string
          p_trab_id?: string
          ug?: string
          ug_detentora?: string | null
          updated_at?: string | null
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
      diaria_registros: {
        Row: {
          created_at: string | null
          detalhamento: string | null
          detalhamento_customizado: string | null
          dias_operacao: number
          destino: string
          fase_atividade: string | null
          id: string
          is_aereo: boolean | null
          local_atividade: string | null
          nr_viagens: number
          om_detentora: string | null
          organizacao: string
          p_trab_id: string
          posto_graduacao: string | null
          quantidade: number
          quantidades_por_posto: Json | null
          ug: string
          ug_detentora: string | null
          updated_at: string | null
          valor_diaria_unitario: number | null
          valor_nd_15: number
          valor_nd_30: number
          valor_taxa_embarque: number | null
          valor_total: number
        }
        Insert: {
          created_at?: string | null
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao: number
          destino: string
          fase_atividade?: string | null
          id?: string
          is_aereo?: boolean | null
          local_atividade?: string | null
          nr_viagens?: number
          om_detentora?: string | null
          organizacao: string
          p_trab_id: string
          posto_graduacao?: string | null
          quantidade: number
          quantidades_por_posto?: Json | null
          ug: string
          ug_detentora?: string | null
          updated_at?: string | null
          valor_diaria_unitario?: number | null
          valor_nd_15?: number
          valor_nd_30?: number
          valor_taxa_embarque?: number | null
          valor_total?: number
        }
        Update: {
          created_at?: string | null
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          destino?: string
          fase_atividade?: string | null
          id?: string
          is_aereo?: boolean | null
          local_atividade?: string | null
          nr_viagens?: number
          om_detentora?: string | null
          organizacao?: string
          p_trab_id?: string
          posto_graduacao?: string | null
          quantidade?: number
          quantidades_por_posto?: Json | null
          ug?: string
          ug_detentora?: string | null
          updated_at?: string | null
          valor_diaria_unitario?: number | null
          valor_nd_15?: number
          valor_nd_30?: number
          valor_taxa_embarque?: number | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "diaria_registros_p_trab_id_fkey"
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
          created_at: string | null
          id: string
          item: string
          updated_at: string | null
          user_id: string
          valor_mnt_dia: number
        }
        Insert: {
          ano_referencia: number
          ativo?: boolean | null
          categoria: string
          created_at?: string | null
          id?: string
          item: string
          updated_at?: string | null
          user_id: string
          valor_mnt_dia?: number
        }
        Update: {
          ano_referencia?: number
          ativo?: boolean | null
          categoria?: string
          created_at?: string | null
          id?: string
          item?: string
          updated_at?: string | null
          user_id?: string
          valor_mnt_dia?: number
        }
        Relationships: [
          {
            foreignKeyName: "diretrizes_classe_ii_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      diretrizes_classe_ix: {
        Row: {
          ano_referencia: number
          ativo: boolean | null
          categoria: string
          created_at: string | null
          id: string
          item: string
          updated_at: string | null
          user_id: string
          valor_mnt_dia: number
          valor_acionamento_mensal: number
        }
        Insert: {
          ano_referencia: number
          ativo?: boolean | null
          categoria: string
          created_at?: string | null
          id?: string
          item: string
          updated_at?: string | null
          user_id: string
          valor_mnt_dia?: number
          valor_acionamento_mensal?: number
        }
        Update: {
          ano_referencia?: number
          ativo?: boolean | null
          categoria?: string
          created_at?: string | null
          id?: string
          item?: string
          updated_at?: string | null
          user_id?: string
          valor_mnt_dia?: number
          valor_acionamento_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "diretrizes_classe_ix_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      diretrizes_concessionaria: {
        Row: {
          ano_referencia: number
          categoria: string
          consumo_pessoa_dia: number
          created_at: string | null
          custo_unitario: number
          fonte_consumo: string | null
          fonte_custo: string | null
          id: string
          nome_concessionaria: string
          unidade_custo: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ano_referencia: number
          categoria: string
          consumo_pessoa_dia: number
          created_at?: string | null
          custo_unitario: number
          fonte_consumo?: string | null
          fonte_custo?: string | null
          id?: string
          nome_concessionaria: string
          unidade_custo: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ano_referencia?: number
          categoria?: string
          consumo_pessoa_dia?: number
          created_at?: string | null
          custo_unitario?: number
          fonte_consumo?: string | null
          fonte_custo?: string | null
          id?: string
          nome_concessionaria?: string
          unidade_custo?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diretrizes_concessionaria_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      diretrizes_custeio: {
        Row: {
          ano_referencia: number
          classe_i_valor_qr: number
          classe_i_valor_qs: number
          classe_iii_fator_embarcacao: number
          classe_iii_fator_equip_engenharia: number
          classe_iii_fator_gerador: number
          created_at: string | null
          id: string
          observacoes: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ano_referencia: number
          classe_i_valor_qr?: number
          classe_i_valor_qs?: number
          classe_iii_fator_embarcacao?: number
          classe_iii_fator_equip_engenharia?: number
          classe_iii_fator_gerador?: number
          created_at?: string | null
          id?: string
          observacoes?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ano_referencia?: number
          classe_i_valor_qr?: number
          classe_i_valor_qs?: number
          classe_iii_fator_embarcacao?: number
          classe_iii_fator_equip_engenharia?: number
          classe_iii_fator_gerador?: number
          created_at?: string | null
          id?: string
          observacoes?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diretrizes_custeio_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      diretrizes_equipamentos_classe_iii: {
        Row: {
          ano_referencia: number
          ativo: boolean | null
          categoria: string
          consumo: number
          created_at: string | null
          id: string
          nome_equipamento: string
          tipo_combustivel: string
          unidade: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ano_referencia: number
          ativo?: boolean | null
          categoria: string
          consumo: number
          created_at?: string | null
          id?: string
          nome_equipamento: string
          tipo_combustivel: string
          unidade: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ano_referencia?: number
          ativo?: boolean | null
          categoria?: string
          consumo?: number
          created_at?: string | null
          id?: string
          nome_equipamento?: string
          tipo_combustivel?: string
          unidade?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diretrizes_equipamentos_classe_iii_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      diretrizes_operacionais: {
        Row: {
          ano_referencia: number
          created_at: string | null
          diaria_demais_pracas_bsb: number | null
          diaria_demais_pracas_capitais: number | null
          diaria_demais_pracas_demais: number | null
          diaria_of_gen_bsb: number | null
          diaria_of_gen_capitais: number | null
          diaria_of_gen_demais: number | null
          diaria_of_int_sgt_bsb: number | null
          diaria_of_int_sgt_capitais: number | null
          diaria_of_int_sgt_demais: number | null
          diaria_of_sup_bsb: number | null
          diaria_of_sup_capitais: number | null
          diaria_of_sup_demais: number | null
          diaria_referencia_legal: string | null
          fator_concessionaria: number
          fator_material_consumo: number
          fator_passagens_aereas: number
          fator_servicos_terceiros: number
          id: string
          observacoes: string | null
          taxa_embarque: number | null
          updated_at: string | null
          user_id: string
          valor_complemento_alimentacao: number
          valor_fretamento_aereo_hora: number
          valor_locacao_estrutura_dia: number
          valor_locacao_viaturas_dia: number
          valor_suprimentos_fundo_dia: number
          valor_verba_operacional_dia: number
        }
        Insert: {
          ano_referencia: number
          created_at?: string | null
          diaria_demais_pracas_bsb?: number | null
          diaria_demais_pracas_capitais?: number | null
          diaria_demais_pracas_demais?: number | null
          diaria_of_gen_bsb?: number | null
          diaria_of_gen_capitais?: number | null
          diaria_of_gen_demais?: number | null
          diaria_of_int_sgt_bsb?: number | null
          diaria_of_int_sgt_capitais?: number | null
          diaria_of_int_sgt_demais?: number | null
          diaria_of_sup_bsb?: number | null
          diaria_of_sup_capitais?: number | null
          diaria_of_sup_demais?: number | null
          diaria_referencia_legal?: string | null
          fator_concessionaria?: number
          fator_material_consumo?: number
          fator_passagens_aereas?: number
          fator_servicos_terceiros?: number
          id?: string
          observacoes?: string | null
          taxa_embarque?: number | null
          updated_at?: string | null
          user_id: string
          valor_complemento_alimentacao?: number
          valor_fretamento_aereo_hora?: number
          valor_locacao_estrutura_dia?: number
          valor_locacao_viaturas_dia?: number
          valor_suprimentos_fundo_dia?: number
          valor_verba_operacional_dia?: number
        }
        Update: {
          ano_referencia?: number
          created_at?: string | null
          diaria_demais_pracas_bsb?: number | null
          diaria_demais_pracas_capitais?: number | null
          diaria_demais_pracas_demais?: number | null
          diaria_of_gen_bsb?: number | null
          diaria_of_gen_capitais?: number | null
          diaria_of_gen_demais?: number | null
          diaria_of_int_sgt_bsb?: number | null
          diaria_of_int_sgt_capitais?: number | null
          diaria_of_int_sgt_demais?: number | null
          diaria_of_sup_bsb?: number | null
          diaria_of_sup_capitais?: number | null
          diaria_of_sup_demais?: number | null
          diaria_referencia_legal?: string | null
          fator_concessionaria?: number
          fator_material_consumo?: number
          fator_passagens_aereas?: number
          fator_servicos_terceiros?: number
          id?: string
          observacoes?: string | null
          taxa_embarque?: number | null
          updated_at?: string | null
          user_id?: string
          valor_complemento_alimentacao?: number
          valor_fretamento_aereo_hora?: number
          valor_locacao_estrutura_dia?: number
          valor_locacao_viaturas_dia?: number
          valor_suprimentos_fundo_dia?: number
          valor_verba_operacional_dia?: number
        }
        Relationships: [
          {
            foreignKeyName: "diretrizes_operacionais_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      diretrizes_passagens: {
        Row: {
          ano_referencia: number
          ativo: boolean | null
          created_at: string | null
          data_fim_vigencia: string | null
          data_inicio_vigencia: string | null
          id: string
          numero_pregao: string | null
          om_referencia: string
          trechos: Json
          ug_referencia: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ano_referencia: number
          ativo?: boolean | null
          created_at?: string | null
          data_fim_vigencia?: string | null
          data_inicio_vigencia?: string | null
          id?: string
          numero_pregao?: string | null
          om_referencia: string
          trechos: Json
          ug_referencia: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ano_referencia?: number
          ativo?: boolean | null
          created_at?: string | null
          data_fim_vigencia?: string | null
          data_inicio_vigencia?: string | null
          id?: string
          numero_pregao?: string | null
          om_referencia?: string
          trechos?: Json
          ug_referencia?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diretrizes_passagens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizacoes_militares: {
        Row: {
          ativo: boolean | null
          cidade: string | null
          codug_om: string
          codug_rm_vinculacao: string
          created_at: string | null
          id: string
          nome_om: string
          rm_vinculacao: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          cidade?: string | null
          codug_om: string
          codug_rm_vinculacao: string
          created_at?: string | null
          id?: string
          nome_om: string
          rm_vinculacao: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          cidade?: string | null
          codug_om?: string
          codug_rm_vinculacao?: string
          created_at?: string | null
          id?: string
          nome_om?: string
          rm_vinculacao?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizacoes_militares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      p_trab: {
        Row: {
          acoes: string | null
          comando_militar_area: string
          codug_om: string | null
          codug_rm_vinculacao: string | null
          comentario: string | null
          created_at: string | null
          efetivo_empregado: string
          id: string
          local_om: string | null
          nome_cmt_om: string | null
          nome_om: string
          nome_om_extenso: string | null
          nome_operacao: string
          numero_ptrab: string | null
          origem: string
          periodo_fim: string
          periodo_inicio: string
          rm_vinculacao: string | null
          rotulo_versao: string | null
          share_token: string
          shared_with: string[] | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          acoes?: string | null
          comando_militar_area: string
          codug_om?: string | null
          codug_rm_vinculacao?: string | null
          comentario?: string | null
          created_at?: string | null
          efetivo_empregado: string
          id?: string
          local_om?: string | null
          nome_cmt_om?: string | null
          nome_om: string
          nome_om_extenso?: string | null
          nome_operacao: string
          numero_ptrab?: string | null
          origem?: string
          periodo_fim: string
          periodo_inicio: string
          rm_vinculacao?: string | null
          rotulo_versao?: string | null
          share_token?: string
          shared_with?: string[] | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          acoes?: string | null
          comando_militar_area?: string
          codug_om?: string | null
          codug_rm_vinculacao?: string | null
          comentario?: string | null
          created_at?: string | null
          efetivo_empregado?: string
          id?: string
          local_om?: string | null
          nome_cmt_om?: string | null
          nome_om?: string
          nome_om_extenso?: string | null
          nome_operacao?: string
          numero_ptrab?: string | null
          origem?: string
          periodo_fim?: string
          periodo_inicio?: string
          rm_vinculacao?: string | null
          rotulo_versao?: string | null
          share_token?: string
          shared_with?: string[] | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "p_trab_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      p_trab_ref_lpc: {
        Row: {
          ambito: string
          created_at: string | null
          data_fim_consulta: string
          data_inicio_consulta: string
          id: string
          nome_local: string | null
          p_trab_id: string
          preco_diesel: number
          preco_gasolina: number
          source: string
          updated_at: string | null
        }
        Insert: {
          ambito: string
          created_at?: string | null
          data_fim_consulta: string
          data_inicio_consulta: string
          id?: string
          nome_local?: string | null
          p_trab_id: string
          preco_diesel: number
          preco_gasolina: number
          source?: string
          updated_at?: string | null
        }
        Update: {
          ambito?: string
          created_at?: string | null
          data_fim_consulta?: string
          data_inicio_consulta?: string
          id?: string
          nome_local?: string | null
          p_trab_id?: string
          preco_diesel?: number
          preco_gasolina?: number
          source?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "p_trab_ref_lpc_p_trab_id_fkey"
            columns: ["p_trab_id"]
            isOneToOne: false
            referencedRelation: "p_trab"
            referencedColumns: ["id"]
          },
        ]
      }
      passagem_registros: {
        Row: {
          created_at: string | null
          detalhamento: string | null
          detalhamento_customizado: string | null
          dias_operacao: number
          destino: string
          efetivo: number | null
          fase_atividade: string | null
          id: string
          is_ida_volta: boolean
          om_detentora: string
          organizacao: string
          p_trab_id: string
          quantidade_passagens: number
          tipo_transporte: string
          trecho_id: string
          ug: string
          ug_detentora: string
          updated_at: string | null
          valor_nd_33: number
          valor_total: number
          valor_unitario: number
          diretriz_id: string
        }
        Insert: {
          created_at?: string | null
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          destino: string
          efetivo?: number | null
          fase_atividade?: string | null
          id?: string
          is_ida_volta?: boolean
          om_detentora: string
          organizacao: string
          p_trab_id: string
          quantidade_passagens?: number
          tipo_transporte: string
          trecho_id: string
          ug: string
          ug_detentora: string
          updated_at?: string | null
          valor_nd_33?: number
          valor_total?: number
          valor_unitario?: number
          diretriz_id: string
        }
        Update: {
          created_at?: string | null
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          destino?: string
          efetivo?: number | null
          fase_atividade?: string | null
          id?: string
          is_ida_volta?: boolean
          om_detentora?: string
          organizacao?: string
          p_trab_id?: string
          quantidade_passagens?: number
          tipo_transporte?: string
          trecho_id?: string
          ug?: string
          ug_detentora?: string
          updated_at?: string | null
          valor_nd_33?: number
          valor_total?: number
          valor_unitario?: number
          diretriz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "passagem_registros_diretriz_id_fkey"
            columns: ["diretriz_id"]
            isOneToOne: false
            referencedRelation: "diretrizes_passagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passagem_registros_p_trab_id_fkey"
            columns: ["p_trab_id"]
            isOneToOne: false
            referencedRelation: "p_trab"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          credit_gnd3: number
          credit_gnd4: number
          default_logistica_year: number | null
          default_operacional_year: number | null
          first_name: string | null
          id: string
          last_name: string | null
          raw_user_meta_data: Json | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          credit_gnd3?: number
          credit_gnd4?: number
          default_logistica_year?: number | null
          default_operacional_year?: number | null
          first_name?: string | null
          id: string
          last_name?: string | null
          raw_user_meta_data?: Json | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          credit_gnd3?: number
          credit_gnd4?: number
          default_logistica_year?: number | null
          default_operacional_year?: number | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          raw_user_meta_data?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ptrab_share_requests: {
        Row: {
          created_at: string | null
          id: string
          ptrab_id: string
          requester_id: string
          share_token: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ptrab_id: string
          requester_id: string
          share_token: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ptrab_id?: string
          requester_id?: string
          share_token?: string
          status?: string
          updated_at?: string | null
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
      verba_operacional_registros: {
        Row: {
          created_at: string | null
          detalhamento: string | null
          detalhamento_customizado: string | null
          dias_operacao: number
          efetivo: number | null
          fase_atividade: string | null
          finalidade: string | null
          id: string
          local: string | null
          objeto_aquisicao: string | null
          objeto_contratacao: string | null
          om_detentora: string | null
          organizacao: string
          p_trab_id: string
          proposito: string | null
          quantidade_equipes: number
          tarefa: string | null
          ug: string
          ug_detentora: string | null
          updated_at: string | null
          valor_nd_30: number
          valor_nd_39: number
          valor_total_solicitado: number
        }
        Insert: {
          created_at?: string | null
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          efetivo?: number | null
          fase_atividade?: string | null
          finalidade?: string | null
          id?: string
          local?: string | null
          objeto_aquisicao?: string | null
          objeto_contratacao?: string | null
          om_detentora?: string | null
          organizacao: string
          p_trab_id: string
          proposito?: string | null
          quantidade_equipes?: number
          tarefa?: string | null
          ug: string
          ug_detentora?: string | null
          updated_at?: string | null
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total_solicitado?: number
        }
        Update: {
          created_at?: string | null
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          efetivo?: number | null
          fase_atividade?: string | null
          finalidade?: string | null
          id?: string
          local?: string | null
          objeto_aquisicao?: string | null
          objeto_contratacao?: string | null
          om_detentora?: string | null
          organizacao?: string
          p_trab_id?: string
          proposito?: string | null
          quantidade_equipes?: number
          tarefa?: string | null
          ug?: string
          ug_detentora?: string | null
          updated_at?: string | null
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total_solicitado?: number
        }
        Relationships: [
          {
            foreignKeyName: "verba_operacional_registros_p_trab_id_fkey"
            columns: ["p_trab_id"]
            isOneToOne: false
            referencedRelation: "p_trab"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_user_to_shared_with: {
        Args: {
          p_ptrab_id: string
          p_share_token: string
          p_user_id: string
        }
        Returns: boolean
      }
      approve_ptrab_share: {
        Args: {
          p_request_id: string
        }
        Returns: boolean
      }
      clone_ptrab_with_records: {
        Args: {
          old_ptrab_id: string
          new_user_id: string
          new_numero_ptrab: string
          new_rotulo_versao: string
        }
        Returns: string
      }
      handle_new_user: {
        Args: Record<PropertyKey, never>
        Returns: Record<string, unknown>
      }
      is_ptrab_owner_or_shared: {
        Args: {
          ptrab_id_in: string
        }
        Returns: boolean
      }
      reject_ptrab_share: {
        Args: {
          p_request_id: string
        }
        Returns: boolean
      }
      remove_user_from_shared_with: {
        Args: {
          p_ptrab_id: string
          p_user_to_remove_id: string
        }
        Returns: boolean
      }
      request_ptrab_share: {
        Args: {
          p_ptrab_id: string
          p_share_token: string
          p_user_id: string
        }
        Returns: boolean
      }
      set_updated_at: {
        Args: Record<PropertyKey, never>
        Returns: Record<string, unknown>
      }
      update_ptrab_timestamp: {
        Args: Record<PropertyKey, never>
        Returns: Record<string, unknown>
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[Extract<
      keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"]),
      string
    >]
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions]
    : never

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[Extract<
      keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"]),
      string
    >]
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions]
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends keyof PublicSchema["Tables"] | { schema: keyof Database },
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][Extract<
      keyof Database[PublicTableNameOrOptions["schema"]]["Tables"],
      string
    >]["Insert"]
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions]["Insert"]
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof PublicSchema["Tables"] | { schema: keyof Database },
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][Extract<
      keyof Database[PublicTableNameOrOptions["schema"]]["Tables"],
      string
    >]["Update"]
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions]["Update"]
    : never

export type Enums<
  PublicEnumNameOrOptions extends keyof PublicSchema["Enums"] | { schema: keyof Database },
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][Extract<
      keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"],
      string
    >]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never