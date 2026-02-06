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
          memoria_calculo_op_customizada: string | null
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
          memoria_calculo_op_customizada?: string | null
          nr_ref_int?: number
          om_qs: string
          organizacao: string
          p_trab_id: string
          total_geral: number
          total_qr?: number
          total_qs?: number
          ug: string
          ug_qs: string
          updated_at?: string
          valor_qr?: number
          valor_qs?: number
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
          memoria_calculo_op_customizada?: string | null
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
          efetivo: number
          fase_atividade: string | null
          id: string
          itens_equipamentos: Json
          om_detentora: string | null
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora: string | null
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
          efetivo?: number
          fase_atividade?: string | null
          id?: string
          itens_equipamentos: Json
          om_detentora?: string | null
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora?: string | null
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
          efetivo?: number
          fase_atividade?: string | null
          id?: string
          itens_equipamentos?: Json
          om_detentora?: string | null
          organizacao?: string
          p_trab_id?: string
          ug?: string
          ug_detentora?: string | null
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
          categoria: string | null
          consumo_hora: number | null
          consumo_km_litro: number | null
          consumo_lubrificante_litro: number | null
          created_at: string
          detalhamento: string | null
          detalhamento_customizado: string | null
          dias_operacao: number
          efetivo: number
          fase_atividade: string | null
          horas_dia: number | null
          id: string
          itens_equipamentos: Json | null // <-- Mantido como Json
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
          updated_at: string
          valor_nd_30: number
          valor_nd_39: number
          valor_total: number
        }
        Insert: {
          categoria?: string | null
          consumo_hora?: number | null
          consumo_km_litro?: number | null
          consumo_lubrificante_litro?: number | null
          created_at?: string
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao: number
          efetivo?: number
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
          updated_at?: string
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total: number
        }
        Update: {
          categoria?: string | null
          consumo_hora?: number | null
          consumo_km_litro?: number | null
          consumo_lubrificante_litro?: number | null
          created_at?: string
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          efetivo?: number
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
          efetivo: number
          fase_atividade: string | null
          id: string
          itens_equipamentos: Json
          om_detentora: string | null
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora: string | null
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
          efetivo?: number
          fase_atividade?: string | null
          id?: string
          itens_equipamentos: Json
          om_detentora?: string | null
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora?: string | null
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
          efetivo?: number
          fase_atividade?: string | null
          id?: string
          itens_equipamentos?: Json
          om_detentora?: string | null
          organizacao?: string
          p_trab_id?: string
          ug?: string
          ug_detentora?: string | null
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
          efetivo: number | null
          fase_atividade: string | null
          id: string
          itens_equipamentos: Json
          om_detentora: string | null
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora: string | null
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
          efetivo?: number | null
          fase_atividade?: string | null
          id?: string
          itens_equipamentos: Json
          om_detentora?: string | null
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora?: string | null
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
          efetivo?: number | null
          fase_atividade?: string | null
          id?: string
          itens_equipamentos?: Json
          om_detentora?: string | null
          organizacao?: string
          p_trab_id?: string
          ug?: string
          ug_detentora?: string | null
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
          efetivo: number
          fase_atividade: string | null
          id: string
          itens_equipamentos: Json
          om_detentora: string | null
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora: string | null
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
          efetivo?: number
          fase_atividade?: string | null
          id?: string
          itens_equipamentos: Json
          om_detentora?: string | null
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora?: string | null
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
          efetivo?: number
          fase_atividade?: string | null
          id?: string
          itens_equipamentos?: Json
          om_detentora?: string | null
          organizacao?: string
          p_trab_id?: string
          ug?: string
          ug_detentora?: string | null
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
          efetivo: number | null
          fase_atividade: string | null
          id: string
          itens_saude: Json
          om_detentora: string | null
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora: string | null
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
          efetivo?: number | null
          fase_atividade?: string | null
          id?: string
          itens_saude: Json
          om_detentora?: string | null
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora?: string | null
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
          efetivo?: number | null
          fase_atividade?: string | null
          id?: string
          itens_saude?: Json
          om_detentora?: string | null
          organizacao?: string
          p_trab_id?: string
          ug?: string
          ug_detentora?: string | null
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
          efetivo: number | null
          fase_atividade: string | null
          id: string
          itens_motomecanizacao: Json
          om_detentora: string | null
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora: string | null
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
          efetivo?: number | null
          fase_atividade?: string | null
          id?: string
          itens_motomecanizacao: Json
          om_detentora?: string | null
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora?: string | null
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
          efetivo?: number | null
          fase_atividade?: string | null
          id?: string
          itens_motomecanizacao?: Json
          om_detentora?: string | null
          organizacao?: string
          p_trab_id?: string
          ug?: string
          ug_detentora?: string | null
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
      concessionaria_registros: {
        Row: {
          categoria: string
          consumo_pessoa_dia: number
          created_at: string
          detalhamento: string | null
          detalhamento_customizado: string | null
          dias_operacao: number
          diretriz_id: string
          efetivo: number
          fase_atividade: string | null
          id: string
          om_detentora: string | null
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora: string | null
          updated_at: string
          valor_nd_39: number
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          categoria: string
          consumo_pessoa_dia: number
          created_at?: string
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          diretriz_id: string
          efetivo?: number
          fase_atividade?: string | null
          id?: string
          om_detentora?: string | null
          organizacao: string
          p_trab_id: string
          ug: string
          ug_detentora?: string | null
          updated_at?: string
          valor_nd_39?: number
          valor_total?: number
          valor_unitario: number
        }
        Update: {
          categoria?: string
          consumo_pessoa_dia?: number
          created_at?: string
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          diretriz_id?: string
          efetivo?: number
          fase_atividade?: string | null
          id?: string
          om_detentora?: string | null
          organizacao?: string
          p_trab_id?: string
          ug?: string
          ug_detentora?: string | null
          updated_at?: string
          valor_nd_39?: number
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "concessionaria_registros_diretriz_id_fkey"
            columns: ["diretriz_id"]
            isOneToOne: false
            referencedRelation: "diretrizes_concessionaria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concessionaria_registros_p_trab_id_fkey"
            columns: ["p_trab_id"]
            isOneToOne: false
            referencedRelation: "p_trab"
            referencedColumns: ["id"]
          },
        ]
      }
      diaria_registros: {
        Row: {
          created_at: string
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
          updated_at: string
          valor_diaria_unitario: number | null
          valor_nd_15: number
          valor_nd_30: number
          valor_taxa_embarque: number | null
          valor_total: number
        }
        Insert: {
          created_at?: string
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
          updated_at?: string
          valor_diaria_unitario?: number | null
          valor_nd_15?: number
          valor_nd_30?: number
          valor_taxa_embarque?: number | null
          valor_total?: number
        }
        Update: {
          created_at?: string
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
          updated_at?: string
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
      horas_voo_registros: {
        Row: {
          id: string
          p_trab_id: string
          organizacao: string
          ug: string
          om_detentora: string | null
          ug_detentora: string | null
          dias_operacao: number
          fase_atividade: string | null
          codug_destino: string
          municipio: string
          quantidade_hv: number
          tipo_anv: string
          amparo: string | null
          valor_nd_30: number
          valor_nd_39: number
          valor_total: number
          detalhamento: string | null
          detalhamento_customizado: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          p_trab_id: string
          organizacao: string
          ug: string
          om_detentora?: string | null
          ug_detentora?: string | null
          dias_operacao?: number
          fase_atividade?: string | null
          codug_destino: string
          municipio: string
          quantidade_hv: number
          tipo_anv: string
          amparo?: string | null
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total?: number
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          p_trab_id?: string
          organizacao?: string
          ug?: string
          om_detentora?: string | null
          ug_detentora?: string | null
          dias_operacao?: number
          fase_atividade?: string | null
          codug_destino?: string
          municipio?: string
          quantidade_hv?: number
          tipo_anv?: string
          amparo?: string | null
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total?: number
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horas_voo_registros_p_trab_id_fkey"
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
      diretrizes_classe_ix: {
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
          valor_acionamento_mensal: number
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
          valor_acionamento_mensal: number
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
          valor_acionamento_mensal?: number
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
      diretrizes_passagens: {
        Row: {
          id: string
          user_id: string
          ano_referencia: number
          om_referencia: string
          ug_referencia: string
          numero_pregao: string | null
          trechos: Json
          ativo: boolean
          created_at: string
          updated_at: string
          data_inicio_vigencia: string | null
          data_fim_vigencia: string | null
        }
        Insert: {
          id?: string
          user_id: string
          ano_referencia: number
          om_referencia: string
          ug_referencia: string
          numero_pregao?: string | null
          trechos?: Json
          ativo?: boolean
          created_at?: string
          updated_at?: string
          data_inicio_vigencia?: string | null
          data_fim_vigencia?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          ano_referencia?: number
          om_referencia?: string
          ug_referencia?: string
          numero_pregao?: string | null
          trechos?: Json
          ativo?: boolean
          created_at?: string
          updated_at?: string
          data_inicio_vigencia?: string | null
          data_fim_vigencia?: string | null
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
      diretrizes_operacionais: {
        Row: {
          ano_referencia: number
          created_at: string
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
          updated_at: string
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
          created_at?: string
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
          updated_at?: string
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
          created_at?: string
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
          updated_at?: string
          user_id?: string
          valor_complemento_alimentacao?: number
          valor_fretamento_aereo_hora?: number
          valor_locacao_estrutura_dia?: number
          valor_locacao_viaturas_dia?: number
          valor_suprimentos_fundo_dia?: number
          valor_verba_operacional_dia?: number
        }
        Relationships: []
      }
      diretrizes_concessionaria: {
        Row: {
          id: string
          user_id: string
          ano_referencia: number
          categoria: string
          nome_concessionaria: string
          consumo_pessoa_dia: number
          fonte_consumo: string | null
          custo_unitario: number
          fonte_custo: string | null
          unidade_custo: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          ano_referencia: number
          categoria: string
          nome_concessionaria: string
          consumo_pessoa_dia: number
          fonte_consumo?: string | null
          custo_unitario: number
          fonte_custo?: string | null
          unidade_custo: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          ano_referencia?: number
          categoria?: string
          nome_concessionaria?: string
          consumo_pessoa_dia?: number
          fonte_consumo?: string | null
          custo_unitario?: number
          fonte_custo?: string | null
          unidade_custo?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      diretrizes_material_consumo: {
        Row: {
          id: string
          user_id: string
          ano_referencia: number
          nr_subitem: string
          nome_subitem: string
          descricao_subitem: string | null
          itens_aquisicao: Json
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          ano_referencia: number
          nr_subitem: string
          nome_subitem: string
          descricao_subitem?: string | null
          itens_aquisicao?: Json
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          ano_referencia?: number
          nr_subitem?: string
          nome_subitem?: string
          descricao_subitem?: string | null
          itens_aquisicao?: Json
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diretrizes_material_consumo_user_id_fkey"
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
          user_id: string
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
          user_id: string
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
      passagem_registros: {
        Row: {
          created_at: string
          detalhamento: string | null
          detalhamento_customizado: string | null
          dias_operacao: number
          destino: string
          diretriz_id: string
          efetivo: number
          fase_atividade: string | null
          id: string
          is_ida_volta: boolean
          om_detentora: string
          organizacao: string
          origem: string
          p_trab_id: string
          quantidade_passagens: number
          tipo_transporte: string
          trecho_id: string
          ug: string
          ug_detentora: string
          updated_at: string
          valor_nd_33: number
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          created_at?: string
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          destino: string
          diretriz_id: string
          efetivo?: number
          fase_atividade?: string | null
          id?: string
          is_ida_volta?: boolean
          om_detentora: string
          organizacao: string
          origem: string
          p_trab_id: string
          quantidade_passagens?: number
          tipo_transporte: string
          trecho_id: string
          ug: string
          ug_detentora: string
          updated_at?: string
          valor_nd_33?: number
          valor_total?: number
          valor_unitario: number
        }
        Update: {
          created_at?: string
          detalhamento?: string | null
          detalhamento_customizado?: string | null
          dias_operacao?: number
          destino?: string
          diretriz_id?: string
          efetivo?: number
          fase_atividade?: string | null
          id?: string
          is_ida_volta?: boolean
          om_detentora?: string
          organizacao?: string
          origem?: string
          p_trab_id?: string
          quantidade_passagens?: number
          tipo_transporte?: string
          trecho_id?: string
          ug?: string
          ug_detentora?: string
          updated_at?: string
          valor_nd_33?: number
          valor_total?: number
          valor_unitario?: number
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
          credit_gnd3: number
          credit_gnd4: number
          default_logistica_year: number | null
          default_operacional_year: number | null
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
          default_logistica_year?: number | null
          default_operacional_year?: number | null
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
          default_logistica_year?: number | null
          default_operacional_year?: number | null
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
      verba_operacional_registros: {
        Row: {
          created_at: string
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
          updated_at: string
          valor_nd_30: number
          valor_nd_39: number
          valor_total_solicitado: number
        }
        Insert: {
          created_at?: string
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
          updated_at?: string
          valor_nd_30?: number
          valor_nd_39?: number
          valor_total_solicitado?: number
        }
        Update: {
          created_at?: string
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
          updated_at?: string
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
      catalogo_catmat: {
        Row: {
          id: string
          code: string
          description: string
          short_description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          description: string
          short_description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          description?: string
          short_description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalogo_subitens_nd: {
        Row: {
          id: string
          nr_subitem: string
          nome_subitem: string
          descricao_subitem: string | null
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nr_subitem: string
          nome_subitem: string
          descricao_subitem?: string | null
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nr_subitem?: string
          nome_subitem?: string
          descricao_subitem?: string | null
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_ptrab_share: {
        Args: {
          p_request_id: string
        }
        Returns: boolean
      }
      update_ptrab_timestamp: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      add_user_to_shared_with: {
        Args: {
          p_ptrab_id: string
          p_share_token: string
          p_user_id: string
        }
        Returns: boolean
      }
      is_ptrab_owner_or_shared: {
        Args: {
          ptrab_id_in: string
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
        Returns: unknown
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
      handle_new_user: {
        Args: Record<PropertyKey, never>
        Returns: unknown
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

// Define TableName como uma união de literais de string
export type TableName = keyof DefaultSchema["Tables"]; 

export type Tables<T extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])> = 
  (DefaultSchema["Tables"] & DefaultSchema["Views"])[T] extends {
    Row: infer R
  }
    ? R
    : never

export type TablesInsert<T extends keyof DefaultSchema["Tables"]> = 
  DefaultSchema["Tables"][T] extends {
    Insert: infer I
  }
    ? I
    : never

export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> = 
  DefaultSchema["Tables"][T] extends {
    Update: infer U
    }
    ? U
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
  ? (DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"])[EnumName]
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
  ? (DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"])[CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const