import { DiretrizClasseII } from "@/types/diretrizesClasseII";

/**
 * Configuração padrão de itens de Classe V (Armamento) para uso quando não há diretrizes personalizadas.
 * Os valores são fictícios e devem ser substituídos por diretrizes reais do usuário.
 */
export const defaultClasseVConfig: DiretrizClasseII[] = [
  // Armamento Leve (Armt L)
  {
    id: "default-v-armt-l-1",
    user_id: "default",
    ano_referencia: 2024,
    categoria: "Armt L",
    item: "Fuzil 5,56mm (Manutenção)",
    valor_mnt_dia: 0.15,
    ativo: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "default-v-armt-l-2",
    user_id: "default",
    ano_referencia: 2024,
    categoria: "Armt L",
    item: "Metralhadora 7,62mm (Manutenção)",
    valor_mnt_dia: 0.30,
    ativo: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Armamento Pesado (Armt P)
  {
    id: "default-v-armt-p-1",
    user_id: "default",
    ano_referencia: 2024,
    categoria: "Armt P",
    item: "Morteiro 81mm (Manutenção)",
    valor_mnt_dia: 1.50,
    ativo: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // IODCT (Instrumentos Ópticos de Direção e Controle de Tiro)
  {
    id: "default-v-iodct-1",
    user_id: "default",
    ano_referencia: 2024,
    categoria: "IODCT",
    item: "Binóculo (Manutenção)",
    valor_mnt_dia: 0.05,
    ativo: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // DQBRN (Defesa Química, Biológica, Radiológica e Nuclear)
  {
    id: "default-v-dqbrn-1",
    user_id: "default",
    ano_referencia: 2024,
    categoria: "DQBRN",
    item: "Máscara contra gases (Manutenção)",
    valor_mnt_dia: 0.10,
    ativo: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];