export type DiariaRegistro = {
  id: string;
  p_trab_id: string;
  organizacao: string;
  ug: string;
  om_detentora?: string;
  ug_detentora?: string;
  dias_operacao: number;
  fase_atividade?: string;
  posto_graduacao?: string;
  destino: string;
  quantidade: number;
  valor_diaria_unitario?: number;
  valor_taxa_embarque: number;
  valor_total: number;
  valor_nd_15: number;
  valor_nd_30: number;
  detalhamento?: string;
  detalhamento_customizado?: string;
  nr_viagens: number;
  local_atividade?: string;
  quantidades_por_posto?: any; // Assuming jsonb structure
  is_aereo?: boolean;
  created_at: string;
  updated_at: string;
};

// Placeholder for PTrab structure (assuming it includes related records)
export interface PTrab {
  id: string;
  user_id: string;
  numero_ptrab?: string;
  nome_operacao: string;
  status: string;
  // ... other PTrab fields
  diaria_registros: DiariaRegistro[];
  // ... other record arrays
}

export interface PTrabTotals {
  // Existing Diarias totals (kept for compatibility/other uses)
  totalDiariasND15: number;
  totalDiariasND30: number;
  
  // New specific totals for Diarias breakdown (requested by user)
  totalDiariasTaxaEmbarque: number;
  totalDiariasValorDiaria: number; // Main daily allowance value (ND 15 portion)

  // Other class totals (placeholders)
  totalClasseI: number;
  totalClasseII: number;
  totalClasseIII: number;
  totalClasseV: number;
  totalClasseVI: number;
  totalClasseVII: number;
  totalClasseVIIISaude: number;
  totalClasseVIIIRemonta: number;
  totalClasseIX: number;
  
  totalGeral: number;
}