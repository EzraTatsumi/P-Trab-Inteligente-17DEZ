import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// List of common Portuguese prepositions/articles to exclude from capitalization
const EXCLUDED_WORDS = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'ou', 'a', 'o', 'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com', 'sem', 'sob', 'sobre', 'entre', 'contra', 'até', 'após', 'desde']);

/**
 * Normaliza o texto para comparação: remove metadados/comentários, padroniza pontuação e converte para CAIXA ALTA.
 * Esta função é usada aqui para limpar metadados da descrição oficial e do PDM.
 */
function normalizeTextForComparison(text: string | null | undefined): string {
    if (!text) return '';
    
    let cleaned = text.trim();
    
    // 1. Remover padrões de comentários/metadados (Ex: " - Ver Inc 30334 E 30335", " (Ver Pdm 30341)")
    cleaned = cleaned.replace(/(\s*[-–]\s*Ver Inc\s*.*)|(\s*\(\s*Ver Pdm\s*.*\))/gi, '');
    
    // 2. Padronizar pontuação e espaçamento (Ex: "TIPO 1: CREPOM" -> "TIPO 1 CREPOM")
    cleaned = cleaned.replace(/[:;,.]/g, ' ');
    
    // 3. Reduzir múltiplos espaços para um único espaço
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // 4. Converter para CAIXA ALTA
    return cleaned.toUpperCase();
}

/**
 * Capitaliza a primeira letra de cada palavra, exceto preposições/artigos curtos.
 */
function capitalizeWords(str: string | null | undefined): string {
    if (!str) return '';
    
    return str.toLowerCase().split(' ').map((word, index) => {
        if (word.length === 0) return '';
        
        if (index > 0 && EXCLUDED_WORDS.has(word)) {
            return word;
        }
        
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}
// ------------------------------------------------------------------------------------

// Simulação da chamada à API externa do PNCP para obter detalhes do CATMAT
async function fetchExternalCatmatDetails(codigoItem: string) {
    // Simulating a response with known problematic data
    if (codigoItem === '30334') {
        return {
            codigoItem: '30334',
            // Descrição Oficial com metadados
            descricaoItem: "Algodão Uso Médico - Ver Inc 30334 E 30335, TIPO: HIDRÓFILO , APRESENTAÇÃO: EM ROLETE , MATERIAL: ALVEJADO, PURIFICADO, ISENTO DE IMPUREZAS , ESTERILIDADE: NÃO ESTÉRIL.",
            // Nome PDM com metadados
            nomePdm: "Algodão Uso Médico - Ver Inc 30334 E 30335",
        };
    }
    if (codigoItem === '30341') {
        return {
            codigoItem: '30341',
            descricaoItem: "ATADURA, TIPO 1 CREPOM, MATERIAL 1 100% ALGODÃO, DIMENSÕES 10 CM, GRAMATURA 1 CERCA DE 13 FIOS/ CM2, EMBALAGEM EMBALAGEM INDIVIDUAL.",
            nomePdm: "Atadura, TIPO 1: CREPOM (Ver Pdm 30341)",
        };
    }
    
    // Default fallback
    return {
        codigoItem: codigoItem,
        descricaoItem: `Descrição oficial para ${codigoItem}`,
        nomePdm: `Nome PDM para ${codigoItem}`,
    };
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { codigoItem } = await req.json();

    if (!codigoItem) {
      return new Response(JSON.stringify({ error: 'Missing required parameter: codigoItem.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`[fetch-catmat-details] Fetching details for CATMAT: ${codigoItem}`);

    // 1. Fetch raw data from external API (simulated)
    const rawDetails = await fetchExternalCatmatDetails(codigoItem);
    
    // 2. Apply normalization/cleaning to the description fields
    
    // Descrição Oficial (Limpeza de comentários)
    let cleanedDescription = rawDetails.descricaoItem;
    cleanedDescription = cleanedDescription.replace(/(\s*[-–]\s*Ver Inc\s*.*)|(\s*\(\s*Ver Pdm\s*.*\))/gi, '').trim();
    
    // Nome PDM (Limpeza de comentários e capitalização para sugestão)
    let cleanedPdm = rawDetails.nomePdm;
    cleanedPdm = cleanedPdm.replace(/(\s*[-–]\s*Ver Inc\s*.*)|(\s*\(\s*Ver Pdm\s*.*\))/gi, '').trim();
    
    // Aplica a capitalização no PDM para que ele chegue formatado como sugestão
    const formattedPdm = capitalizeWords(cleanedPdm);

    const responseData = {
        codigoItem: rawDetails.codigoItem,
        descricaoItem: cleanedDescription, // Descrição limpa de metadados
        nomePdm: formattedPdm, // Nome PDM limpo e capitalizado
    };

    console.log(`[fetch-catmat-details] Success for ${codigoItem}.`);

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[fetch-catmat-details] General error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});