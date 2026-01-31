import { cn } from "@/lib/utils";

type CategoriaClasse = 
  'Equipamento Individual' | 'Proteção Balística' | 'Material de Estacionamento' |
  'Armt L' | 'Armt P' | 'IODCT' | 'DQBRN' |
  'Embarcação' | 'Equipamento de Engenharia' | 'Gerador' | // <-- Adicionado 'Gerador'
  'Comunicações' | 'Informática' |
  'Saúde' | 'Remonta/Veterinária' | // CLASSE VIII
  'Vtr Administrativa' | 'Vtr Operacional' | 'Motocicleta' | 'Vtr Blindada'; // CLASSE IX

interface BadgeStyle {
// ... (código restante)