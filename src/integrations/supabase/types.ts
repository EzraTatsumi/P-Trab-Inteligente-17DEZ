// ... (código anterior)
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
          data_inicio_vigencia: string | null // <-- Corrigido
          data_fim_vigencia: string | null // <-- Corrigido
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
          data_inicio_vigencia?: string | null // <-- Corrigido
          data_fim_vigencia?: string | null // <-- Corrigido
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
          data_inicio_vigencia?: string | null // <-- Corrigido
          data_fim_vigencia?: string | null // <-- Corrigido
        }
        Relationships: [
// ... (código anterior)
      }
      passagem_registros: {
        Row: {
// ... (colunas anteriores)
          valor_unitario: number
          efetivo: number | null // <-- Adicionado 'efetivo'
        }
        Insert: {
// ... (colunas anteriores)
          valor_unitario: number
          efetivo?: number | null // <-- Adicionado 'efetivo'
        }
        Update: {
// ... (colunas anteriores)
          valor_unitario?: number
          efetivo?: number | null // <-- Adicionado 'efetivo'
        }
        Relationships: [
// ... (código anterior)
      }
      profiles: {
        Row: {
          avatar_url: string | null
          credit_gnd3: number
          credit_gnd4: number
          default_logistica_year: number | null // <-- Corrigido nome da coluna
          default_operacional_year: number | null // <-- Corrigido nome da coluna
          first_name: string | null
// ... (código restante)