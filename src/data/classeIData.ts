import { DiretrizClasseIForm } from "@/types/diretrizesClasseI";

// Valores de manutenção diária (R$/dia) para material de consumo (Classe I)
// Estes são valores de exemplo e devem ser ajustados conforme a Diretriz de Custeio.
export const defaultClasseIConfig: DiretrizClasseIForm[] = [
  // Categoria: Viaturas
  { categoria: "Viaturas", item: "Viatura 4x4 Leve", valor_mnt_dia: 15.00 },
  { categoria: "Viaturas", item: "Viatura 4x4 Média", valor_mnt_dia: 25.00 },
  { categoria: "Viaturas", item: "Viatura 6x6 Pesada", valor_mnt_dia: 40.00 },
  
  // Categoria: Aeronaves
  { categoria: "Aeronaves", item: "Helicóptero de Reconhecimento", valor_mnt_dia: 1500.00 },
  { categoria: "Aeronaves", item: "Aeronave de Transporte Leve", valor_mnt_dia: 800.00 },
  
  // Categoria: Embarcações
  { categoria: "Embarcações", item: "Embarcação de Patrulha", valor_mnt_dia: 50.00 },
  { categoria: "Embarcações", item: "Bote Inflável", valor_mnt_dia: 10.00 },
  
  // Categoria: Motomecanização (Equipamentos diversos)
  { categoria: "Motomecanização", item: "Motocicleta", valor_mnt_dia: 5.00 },
  { categoria: "Motomecanização", item: "Gerador Portátil", valor_mnt_dia: 8.00 },
  { categoria: "Motomecanização", item: "Compressor de Ar", valor_mnt_dia: 12.00 },
];