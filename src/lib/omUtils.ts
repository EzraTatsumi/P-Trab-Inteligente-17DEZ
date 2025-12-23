import * as z from "zod";

// Define a interface para os dados da OM no banco de dados
export interface OMData {
  id: string;
  user_id: string;
  nome_om: string;
  codug_om: string;
  rm_vinculacao: string;
  codug_rm_vinculacao: string;
  cidade: string | null; // NOVO CAMPO
  ativo: boolean;
  created_at: string | null;
  updated_at: string | null;
}

// Define o esquema de validação para o formulário de OM
export const omSchema = z.object({
  nome_om: z.string().min(1, "A sigla da OM é obrigatória."),
  codug_om: z.string().min(1, "O CODUG da OM é obrigatório."),
  rm_vinculacao: z.string().min(1, "A RM de vinculação é obrigatória."),
  codug_rm_vinculacao: z.string().min(1, "O CODUG da RM é obrigatório."),
  cidade: z.string().min(1, "A cidade é obrigatória."), // NOVO CAMPO: Tornando obrigatório no formulário
  ativo: z.boolean().optional(),
});

// Define a interface para os dados brutos lidos do arquivo (deve ser consistente com OmBulkUploadPage.tsx)
interface RawOMData {
  'OM (Sigla)': string;
  'CODUG OM': string;
  'RM Vinculação': string;
  'CODUG RM': string;
  'Cidade': string; // NOVO CAMPO
}

// Define a interface para os dados de OM limpos e padronizados
export interface CleanOMData {
  nome_om: string;
  codug_om: string;
  rm_vinculacao: string;
  codug_rm_vinculacao: string;
  cidade: string; // NOVO CAMPO
}

/**
 * Limpa e padroniza os dados brutos de OM.
 * @param rawData Dados brutos lidos do arquivo.
 * @returns Array de objetos CleanOMData.
 */
const standardizeOM = (rawData: RawOMData[]): CleanOMData[] => {
  return rawData.map(row => ({
    nome_om: String(row['OM (Sigla)'] || '').trim().toUpperCase(),
    codug_om: String(row['CODUG OM'] || '').trim(),
    rm_vinculacao: String(row['RM Vinculação'] || '').trim().toUpperCase(),
    codug_rm_vinculacao: String(row['CODUG RM'] || '').trim(),
    cidade: String(row['Cidade'] || '').trim(), // NOVO CAMPO
  })).filter(om => om.nome_om && om.codug_om && om.rm_vinculacao && om.codug_rm_vinculacao && om.cidade);
};

/**
 * Analisa os dados de OM para identificar duplicatas e múltiplos CODUGs.
 * @param rawData Dados brutos lidos do arquivo.
 * @returns Um objeto com o resultado da análise.
 */
export const analyzeOMData = (rawData: RawOMData[]) => {
  const standardized = standardizeOM(rawData);
  const total = standardized.length;
  
  // Mapa para identificar duplicatas exatas (chave composta)
  const uniqueMap = new Map<string, CleanOMData>();
  const duplicates = new Map<string, number>();
  
  // Mapa para identificar OMs com múltiplos CODUGs (chave: nome_om)
  const omGroupMap = new Map<string, CleanOMData[]>();
  
  // Mapa para identificar CODUGs duplicados (chave: codug_om) - CRÍTICO PARA A RESTRIÇÃO DO DB
  const codugMap = new Map<string, CleanOMData[]>();

  // 1. Processamento inicial para identificar duplicatas exatas e agrupar por nome/codug
  standardized.forEach(om => {
    const key = `${om.nome_om}|${om.codug_om}|${om.rm_vinculacao}|${om.codug_rm_vinculacao}|${om.cidade}`;
    if (uniqueMap.has(key)) {
      duplicates.set(key, (duplicates.get(key) || 1) + 1);
    } else {
      uniqueMap.set(key, om);
    }
    
    // Agrupamento por nome da OM
    const name = om.nome_om;
    if (!omGroupMap.has(name)) {
      omGroupMap.set(name, []);
    }
    omGroupMap.get(name)!.push(om);
    
    // Agrupamento por CODUG
    const codug = om.codug_om;
    if (!codugMap.has(codug)) {
        codugMap.set(codug, []);
    }
    codugMap.get(codug)!.push(om);
  });
  
  const uniqueRecords = Array.from(uniqueMap.values());
  const totalAposDeduplicacao = uniqueRecords.length;
  const duplicatasRemovidas = total - totalAposDeduplicacao;

  // 2. Identificação de OMs com múltiplos CODUGs (OMs com o mesmo nome, mas CODUGs diferentes)
  const multipleCodugsMap = new Map<string, CleanOMData[]>();
  omGroupMap.forEach((oms, name) => {
    const uniqueCodugs = new Set(oms.map(o => o.codug_om));
    if (uniqueCodugs.size > 1) {
      multipleCodugsMap.set(name, oms);
    }
  });

  const multipleCodugs = Array.from(multipleCodugsMap.entries()).map(([nome, registros]) => ({
    nome,
    registros: registros.map(r => ({
        nome_om: r.nome_om,
        codug_om: r.codug_om,
        rm_vinculacao: r.rm_vinculacao,
        codug_rm_vinculacao: r.codug_rm_vinculacao,
        cidade: r.cidade, // Incluir cidade na análise
    })),
  }));
  
  // 3. Verificar se há CODUGs duplicados que violam a restrição do DB
  const codugViolations = Array.from(codugMap.entries())
    .filter(([, oms]) => oms.length > 1)
    .map(([codug, oms]) => ({
        codug,
        registros: oms.map(r => ({
            nome_om: r.nome_om,
            codug_om: r.codug_om,
            rm_vinculacao: r.rm_vinculacao,
            codug_rm_vinculacao: r.codug_rm_vinculacao,
            cidade: r.cidade,
        })),
    }));


  return {
    total,
    totalAposDeduplicacao,
    duplicatasRemovidas,
    unique: uniqueRecords,
    multipleCodugs,
    codugViolations, // Adicionado para debug/alerta futuro
  };
};

/**
 * Limpa e deduplica os dados de OM para a inserção final, garantindo que o CODUG seja único.
 * @param rawData Dados brutos lidos do arquivo.
 * @returns Array de objetos CleanOMData prontos para inserção.
 */
export const cleanAndDeduplicateOMs = (rawData: RawOMData[]): CleanOMData[] => {
  const standardized = standardizeOM(rawData);
  
  // Usamos um mapa onde a chave é o CODUG para garantir que ele seja único.
  // Se houver múltiplos registros com o mesmo CODUG, o último prevalece.
  const uniqueCodugMap = new Map<string, CleanOMData>();

  standardized.forEach(om => {
    // A chave de unicidade para a inserção final é o CODUG, conforme a restrição do DB.
    const key = om.codug_om; 
    
    // Se o CODUG já existe, ele é sobrescrito (mantendo o último registro encontrado para aquele CODUG).
    // Isso resolve o problema de duplicidade de CODUG no arquivo de entrada.
    uniqueCodugMap.set(key, om);
  });

  return Array.from(uniqueCodugMap.values());
};