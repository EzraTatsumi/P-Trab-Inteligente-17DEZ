import { Tables } from "@/integrations/supabase/types";
import { generateRacaoQuenteMemoriaCalculo, generateRacaoOperacionalMemoriaCalculo, calculateClasseICalculations } from "./classeIUtils";
import { generateClasseIIMemoriaCalculo as generateClasseIIUtility } from "./classeIIUtils";
import { generateCategoryMemoriaCalculo as generateClasseVUtility } from "./classeVUtils";
import { generateCategoryMemoriaCalculo as generateClasseVIUtility } from "./classeVIUtils";
import { generateCategoryMemoriaCalculo as generateClasseVIIUtility } from "./classeVIIUtils";
import { generateCategoryMemoriaCalculo as generateClasseVIIIUtility } from "./classeVIIIUtils";
import { generateCategoryMemoriaCalculo as generateClasseIXUtility } from "./classeIXUtils";

export const CLASSE_V_CATEGORIES = ["Armt L", "Armt P", "IODCT", "DQBRN"];
export const CLASSE_VI_CATEGORIES = ["Gerador", "Embarcação", "Equipamento de Engenharia"];
export const CLASSE_VII_CATEGORIES = ["Comunicações", "Informática"];
export const CLASSE_VIII_CATEGORIES = ["Saúde", "Remonta/Veterinária"];
export const CLASSE_IX_CATEGORIES = ["Vtr Administrativa", "Vtr Operacional", "Motocicleta", "Vtr Blindada"];

export const normalizarNome = (valor?: string) =>
  (valor || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const getOMPriority = (nomeOM: string, nomeRM: string): 1 | 2 | 3 => {
  const om = normalizarNome(nomeOM);
  const rm = normalizarNome(nomeRM);
  if (om === rm || /^\d+ª?\s*RM$/.test(om) || om.includes('REGIAO MILITAR') || rm.includes(om) || om.includes('RM')) return 1;
  if (om.includes('BDA') || om.includes('BRIGADA')) return 2;
  return 3;
};

export const isRegiaoMilitar = (nomeOM: string, nomeRM: string) => {
  const om = normalizarNome(nomeOM);
  const rm = normalizarNome(nomeRM);
  if (om === rm) return true;
  if (/^\d+ª?\s*RM$/.test(om) || om.includes('REGIAO MILITAR')) return true;
  if (rm.includes(om)) return true;
  return false;
};

export const generateClasseIMemoriaCalculoUnificada = (registro: any, tipo: 'QS' | 'QR' | 'OP'): string => {
    if (registro.categoria === 'RACAO_OPERACIONAL') {
        if (tipo === 'OP') {
            if (registro.memoria_calculo_op_customizada) return registro.memoria_calculo_op_customizada;
            return generateRacaoOperacionalMemoriaCalculo(registro);
        }
        return "N/A";
    }
    const { qs, qr } = generateRacaoQuenteMemoriaCalculo(registro);
    if (tipo === 'QS') return registro.memoria_calculo_qs_customizada || qs;
    return registro.memoria_calculo_qr_customizada || qr;
};

export const generateClasseIIMemoriaCalculo = (registro: any, isClasseII: boolean): string => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) return generateClasseIXUtility(registro);
    if (isClasseII) return generateClasseIIUtility(registro.categoria, registro.itens_equipamentos, registro.dias_operacao, registro.om_detentora || registro.organizacao, registro.ug_detentora || registro.ug, registro.fase_atividade, registro.efetivo || 0, registro.valor_nd_30, registro.valor_nd_39);
    if (CLASSE_V_CATEGORIES.includes(registro.categoria)) return generateClasseVUtility(registro.categoria, registro.itens_equipamentos, registro.dias_operacao, registro.om_detentora || registro.organizacao, registro.ug_detentora || registro.ug, registro.fase_atividade, registro.efetivo || 0, registro.valor_nd_30, registro.valor_nd_39);
    // ... outras classes seguem o mesmo padrão
    return registro.detalhamento || "Memória não disponível.";
};

export const generateClasseIIIGranularUtility = (item: any, refLPC: any, omFornecedora: string, ugFornecedora: string) => {
    // Implementação simplificada para o exemplo, deve seguir a lógica do classeIIIUtils
    return `Memória de cálculo para ${item.categoria}`;
};