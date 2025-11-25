export interface OMData {
  id: string;
  nome_om: string;
  codug_om: string;
  rm_vinculacao: string;
  codug_rm_vinculacao: string;
  ativo?: boolean;
  user_id?: string;
}

/**
 * Formata um CODUG para o padrão XXX.XXX
 */
export const formatCODUG = (value: string | undefined | null): string => {
  // Garante que o valor seja uma string, mesmo que seja undefined ou null
  const stringValue = value === undefined || value === null ? '' : String(value);
  const numbers = stringValue.replace(/\D/g, '');
  if (numbers.length <= 3) return numbers;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}`;
};

/**
 * Valida se um CODUG está no formato correto XXX.XXX
 */
export const validateCODUG = (value: string): boolean => {
  const codugRegex = /^\d{3}\.\d{3}$/;
  return codugRegex.test(value);
};

/**
 * Remove a formatação do CODUG (remove pontos)
 */
export const unformatCODUG = (value: string): string => {
  return value.replace(/\D/g, '');
};

/**
 * Busca OMs por termo (nome ou CODUG)
 */
export const searchOMs = (term: string, oms: OMData[]): OMData[] => {
  if (!term) return oms;
  
  const searchTerm = term.toLowerCase().trim();
  
  return oms.filter(om => 
    om.nome_om.toLowerCase().includes(searchTerm) ||
    om.codug_om.includes(searchTerm) ||
    om.rm_vinculacao.toLowerCase().includes(searchTerm)
  );
};

/**
 * Agrupa OMs por RM
 */
export const groupOMsByRM = (oms: OMData[]): Record<string, OMData[]> => {
  return oms.reduce((acc, om) => {
    const rm = om.rm_vinculacao;
    if (!acc[rm]) {
      acc[rm] = [];
    }
    acc[rm].push(om);
    return acc;
  }, {} as Record<string, OMData[]>);
};

/**
 * Obtém lista de RMs únicas
 */
export const getUniqueRMs = (oms: OMData[]): string[] => {
  const rms = new Set(oms.map(om => om.rm_vinculacao));
  return Array.from(rms).sort();
};

/**
 * Parsea dados CSV para um array de objetos OMData.
 * Espera que a primeira linha seja o cabeçalho.
 * Assume as colunas: "Nome da OM", "CODUG OM", "RM vinculacao", "CODUG RM".
 */
export const parseOmCsv = (csvString: string): Partial<OMData>[] => {
  const lines = csvString.trim().split('\n');
  if (lines.length === 0) return [];

  const headers = lines[0].split(';').map(h => h.trim());
  const dataLines = lines.slice(1);

  const nomeOmIndex = headers.indexOf('Nome da OM');
  const codugOmIndex = headers.indexOf('CODUG OM');
  const rmVinculacaoIndex = headers.indexOf('RM vinculacao');
  const codugRmVinculacaoIndex = headers.indexOf('CODUG RM');

  if (nomeOmIndex === -1 || codugOmIndex === -1 || rmVinculacaoIndex === -1 || codugRmVinculacaoIndex === -1) {
    throw new Error("Cabeçalhos CSV esperados não encontrados: 'Nome da OM', 'CODUG OM', 'RM vinculacao', 'CODUG RM'.");
  }

  return dataLines.map(line => {
    const values = line.split(';').map(v => v.trim());
    return {
      nome_om: values[nomeOmIndex],
      codug_om: formatCODUG(values[codugOmIndex]), // Formata o CODUG ao parsear
      rm_vinculacao: values[rmVinculacaoIndex],
      codug_rm_vinculacao: formatCODUG(values[codugRmVinculacaoIndex]), // Formata o CODUG ao parsear
      ativo: true, // Por padrão, novas OMs são ativas
    };
  }).filter(om => om.nome_om && om.codug_om && om.rm_vinculacao && om.codug_rm_vinculacao); // Filtra linhas incompletas
};