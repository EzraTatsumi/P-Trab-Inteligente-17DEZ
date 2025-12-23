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
  
  const uniqueMap = new Map<string, CleanOMData>();
  const duplicates = new Map<string, number>();
  const multipleCodugsMap = new Map<string, CleanOMData[]>(); // Key: nome_om

  // 1. Identificação de duplicatas exatas (nome, codug, rm, codug_rm, cidade)
  standardized.forEach(om => {
    const key = `${om.nome_om}|${om.codug_om}|${om.rm_vinculacao}|${om.codug_rm_vinculacao}|${om.cidade}`;
    if (uniqueMap.has(key)) {
      duplicates.set(key, (duplicates.get(key) || 1) + 1);
    } else {
      uniqueMap.set(key, om);
    }
  });
  
  const uniqueRecords = Array.from(uniqueMap.values());
  const totalAposDeduplicacao = uniqueRecords.length;
  const duplicatasRemovidas = total - totalAposDeduplicacao;

  // 2. Identificação de OMs com múltiplos CODUGs (OMs com o mesmo nome, mas CODUGs diferentes)
  const omGroupMap = new Map<string, CleanOMData[]>();
  uniqueRecords.forEach(om => {
    const name = om.nome_om;
    if (!omGroupMap.has(name)) {
      omGroupMap.set(name, []);
    }
    omGroupMap.get(name)!.push(om);
  });

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

  return {
    total,
    totalAposDeduplicacao,
    duplicatasRemovidas,
    unique: uniqueRecords,
    multipleCodugs,
  };
};

/**
 * Limpa e deduplica os dados de OM para a inserção final.
 * @param rawData Dados brutos lidos do arquivo.
 * @returns Array de objetos CleanOMData prontos para inserção.
 */
export const cleanAndDeduplicateOMs = (rawData: RawOMData[]): CleanOMData[] => {
  const standardized = standardizeOM(rawData);
  const uniqueMap = new Map<string, CleanOMData>();

  // Usa a chave composta (nome, codug, rm, codug_rm, cidade) para garantir a unicidade
  standardized.forEach(om => {
    const key = `${om.nome_om}|${om.codug_om}|${om.rm_vinculacao}|${om.codug_rm_vinculacao}|${om.cidade}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, om);
    }
  });

  return Array.from(uniqueMap.values());
};