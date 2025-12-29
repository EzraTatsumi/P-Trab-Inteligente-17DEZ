import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, XCircle, Check, ChevronsUpDown, Sparkles, AlertCircle, HeartPulse, Activity, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { formatCurrency, parseInputToNumber, formatNumberForInput, formatCurrencyInput, numberToRawDigits, formatCodug } from "@/lib/formatUtils";
import { DiretrizClasseII } from "@/types/diretrizesClasseII";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { TablesInsert } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getCategoryBadgeStyle, getCategoryLabel } from "@/lib/badgeUtils";
import { defaultClasseVIIISaudeConfig, defaultClasseVIIIRemontaConfig } from "@/data/classeVIIIData";
import { 
    calculateSaudeItemTotal, 
    calculateRemontaItemTotal, 
    calculateTotalForAnimalType,
    generateCategoryMemoriaCalculo,
    generateDetalhamento,
    formatFasesParaTexto,
} from "@/lib/classeVIIIUtils"; // Importando utilitários da Classe VIII

type Categoria = 'Saúde' | 'Remonta/Veterinária';

const CATEGORIAS: Categoria[] = [
  "Saúde",
  "Remonta/Veterinária",
];

// Opções fixas de fase de atividade
const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

// --- TIPOS TEMPORÁRIOS (UNSAVED CHANGES) ---
interface TempDestination {
    om: string;
    ug: string;
    id?: string;
}
const initialTempDestinations: Record<Categoria, TempDestination> = CATEGORIAS.reduce((acc, cat) => ({ ...acc, [cat]: { om: "", ug: "", id: undefined } }), {} as Record<Categoria, TempDestination>);
const initialTempND39Inputs: Record<Categoria, string> = CATEGORIAS.reduce((acc, cat) => ({ ...acc, [cat]: "" }), {} as Record<Categoria, string>);
// --- FIM TIPOS TEMPORÁRIOS ---

interface ItemSaude {
  item: string;
  quantidade: number; // Nr Kits
  valor_mnt_dia: number; // Valor do Kit
  categoria: 'Saúde';
}

interface ItemRemonta {
  item: string; // Ex: Equino, Canino
  quantidade_animais: number;
  dias_operacao_item: number; // Dias específicos de uso do animal
  valor_mnt_dia: number; // Valor base (Anual/Mensal/Diário)
  categoria: 'Remonta/Veterinária';
}

type ItemClasseVIII = ItemSaude | ItemRemonta;

interface FormDataClasseVIII {
  selectedOmId?: string;
  organizacao: string; // OM Detentora (Global)
  ug: string; // UG Detentora (Global)
  dias_operacao: number; // Global days of activity (Used for header only)
  itensSaude: ItemSaude[];
  itensRemonta: ItemRemonta[];
  fase_atividade?: string; // Global
}

interface ClasseVIIIRegistro {
  id: string;
  organizacao: string; // OM de Destino do Recurso (ND 30/39)
  ug: string; // UG de Destino do Recurso (ND 30/39)
  om_detentora: string; // NOVO CAMPO
  ug_detentora: string; // NOVO CAMPO
  dias_operacao: number;
  categoria: string;
  valor_total: number;
  detalhamento: string;
  detalhamento_customizado?: string | null;
  fase_atividade?: string;
  valor_nd_30: number;
  valor_nd_39: number;
  itens_saude?: ItemSaude[];
  animal_tipo?: 'Equino' | 'Canino';
  quantidade_animais?: number;
  itens_remonta?: ItemRemonta[];
}

interface CategoryAllocation {
  total_valor: number;
  nd_39_input: string; // User input string for ND 39 (Formatted string for persistence)
  nd_30_value: number; // Calculated ND 30 value
  nd_39_value: number; // Calculated ND 39 value
  om_destino_recurso: string;
  ug_destino_recurso: string;
  selectedOmDestinoId?: string;
}

const initialCategoryAllocations: Record<Categoria, CategoryAllocation> = {
    'Saúde': { total_valor: 0, nd_39_input: "", nd_30_value: 0, nd_39_value: 0, om_destino_recurso: "", ug_destino_recurso: "", selectedOmDestinoId: undefined },
    'Remonta/Veterinária': { total_valor: 0, nd_39_input: "", nd_30_value: 0, nd_39_value: 0, om_destino_recurso: "", ug_destino_recurso: "", selectedOmDestinoId: undefined },
};

const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
    return Math.abs(a - b) < tolerance;
};

// NOVO: Helper function to get the numeric ND 39 value from the temporary input digits
const getTempND39NumericValue = (category: Categoria, tempInputs: Record<Categoria, string>): number => {
    const digits = tempInputs[category] || "";
    return formatCurrencyInput(digits).numericValue;
};


const ClasseVIIIForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  
  const [registrosSaude, setRegistrosSaude] = useState<ClasseVIIIRegistro[]>([]);
  const [registrosRemonta, setRegistrosRemonta] = useState<ClasseVIIIRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [diretrizesSaude, setDiretrizesSaude] = useState<DiretrizClasseII[]>([]);
  const [diretrizesRemonta, setDiretrizesRemonta] = useState<DiretrizClasseII[]>([]);
  
  const [selectedTab, setSelectedTab] = useState<Categoria>(CATEGORIAS[0]);
  const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
  const [memoriaEdit, setMemoriaEdit] = useState<string>("");
  
  const [form, setForm] = useState<FormDataClasseVIII>({
    selectedOmId: undefined,
    organizacao: "",
    ug: "",
    dias_operacao: 0,
    itensSaude: [],
    itensRemonta: [],
  });
  
  const [categoryAllocations, setCategoryAllocations] = useState<Record<Categoria, CategoryAllocation>>(initialCategoryAllocations);
  
  // NOVOS ESTADOS: Rastreia o input ND 39 (dígitos) temporário por categoria
  const [tempND39Inputs, setTempND39Inputs] = useState<Record<Categoria, string>>(initialTempND39Inputs);
  // NOVOS ESTADOS: Rastreia a OM de destino temporária por categoria
  const [tempDestinations, setTempDestinations] = useState<Record<Categoria, TempDestination>>(initialTempDestinations);
  
  const [currentCategoryItems, setCurrentCategoryItems] = useState<ItemSaude[] | ItemRemonta[]>([]);
  const [remontaValidationWarning, setRemontaValidationWarning] = useState<string | null>(null); // Novo estado para aviso de validação
  
  const [fasesAtividade, setFasesAtividade] = useState<string[]>(["Execução"]);
  const [customFaseAtividade, setCustomFaseAtividade] = useState<string>("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  const { handleEnterToNextField } = useFormNavigation();
  
  // NOVO: Função para desativar setas e manter navegação por Enter
  const handleNumberInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
    }
    // Chama a função de navegação para a tecla Enter
    handleEnterToNextField(e);
  };

  // NOVO: Dirty Check Logic
  const isCategoryAllocationDirty = useCallback((
      category: Categoria, 
      currentTotalValue: number, 
      allocation: CategoryAllocation, 
      tempInputs: Record<Categoria, string>, 
      tempDestinations: Record<Categoria, TempDestination>
  ): boolean => {
      // 1. Check for quantity/item change (total value mismatch)
      if (!areNumbersEqual(allocation.total_valor, currentTotalValue)) {
          return true;
      }
      
      // 2. Check for ND 39 allocation change
      const tempND39Value = getTempND39NumericValue(category, tempInputs);
      if (!areNumbersEqual(tempND39Value, allocation.nd_39_value)) {
          return true;
      }
      
      // 3. Check for Destination OM change
      const tempDest = tempDestinations[category];
      if (allocation.om_destino_recurso !== tempDest.om || allocation.ug_destino_recurso !== tempDest.ug) {
          // Only consider it dirty if the category has items (i.e., total > 0)
          if (currentTotalValue > 0) {
              return true;
          }
      }
      
      return false;
  }, []);


  useEffect(() => {
    if (!ptrabId) {
      toast.error("ID do P Trab não encontrado");
      navigate("/ptrab");
      return;
    }
    
    // 1. Carregar diretrizes
    loadDiretrizes();
    
    // 2. Carregar registros salvos
    fetchRegistros().finally(() => {
        // 3. Garantir que o formulário comece limpo, a menos que o usuário clique em editar
        resetFormFields();
        setLoading(false);
    });
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [ptrabId, navigate]);
  
  // Efeito para sincronizar os estados temporários (ND 39 Input e OM Destino) ao mudar de aba ou carregar/resetar o formulário.
  useEffect(() => {
      const savedAllocation = categoryAllocations[selectedTab];
      
      // 1. Sincronizar ND 39 Input (dígitos)
      const numericValue = parseInputToNumber(savedAllocation.nd_39_input);
      const digits = String(Math.round(numericValue * 100));
      
      setTempND39Inputs(prev => ({
          ...prev,
          [selectedTab]: digits
      }));
      
      // 2. Sincronizar OM Destino
      if (savedAllocation.om_destino_recurso) {
          setTempDestinations(prev => ({
              ...prev,
              [selectedTab]: {
                  om: savedAllocation.om_destino_recurso,
                  ug: savedAllocation.ug_destino_recurso,
                  id: savedAllocation.selectedOmDestinoId,
              }
          }));
      } else if (form.organizacao) {
          // Se não houver alocação salva, mas houver OM Detentora, use a Detentora como padrão temporário
          setTempDestinations(prev => ({
              ...prev,
              [selectedTab]: {
                  om: form.organizacao,
                  ug: form.ug,
                  id: form.selectedOmId,
              }
          }));
      } else {
          // Se não houver OM Detentora, limpa o temporário
          setTempDestinations(prev => ({
              ...prev,
              [selectedTab]: { om: "", ug: "", id: undefined }
          }));
      }
      
  }, [selectedTab, categoryAllocations, form.organizacao, form.ug, form.selectedOmId]);

  // Efeito para gerenciar a lista de itens da categoria atual
  useEffect(() => {
    const isSaude = selectedTab === 'Saúde';
    const directives = isSaude ? diretrizesSaude : diretrizesRemonta;
    const formItems = isSaude ? form.itensSaude : form.itensRemonta;
    
    if (directives.length === 0) {
        setCurrentCategoryItems([]);
        return;
    }

    if (isSaude) {
        const existingItemsMap = new Map<string, ItemSaude>();
        (formItems as ItemSaude[]).forEach(item => {
            existingItemsMap.set(item.item, item);
        });

        const mergedItems = directives.map(directive => {
            const existing = existingItemsMap.get(directive.item);
            const defaultItem: ItemSaude = {
                item: directive.item,
                quantidade: 0,
                valor_mnt_dia: Number(directive.valor_mnt_dia),
                categoria: 'Saúde',
            };
            return existing || defaultItem;
        });
        setCurrentCategoryItems(mergedItems);
        
    } else {
        // Lógica específica para Remonta/Veterinária: Apenas 2 itens (Equino e Canino)
        const animalTypes = ['Equino', 'Canino'];
        const baseItems: ItemRemonta[] = [];
        
        animalTypes.forEach(animalType => {
            const relatedDirectives = directives.filter(d => d.item.includes(animalType));
            
            if (relatedDirectives.length > 0) {
                // Ao carregar, formItems contém a lista completa de itens de diretriz (Item B, C, D, etc.)
                // Precisamos extrair a quantidade e dias do primeiro item relacionado para preencher o input base.
                const existingRelatedItems = (formItems as ItemRemonta[]).filter(item => item.item.includes(animalType));
                
                // Se houver registros salvos, usamos a quantidade e dias do primeiro item relacionado
                const nrAnimaisSalvos = existingRelatedItems[0]?.quantidade_animais || 0;
                const diasOperacaoSalvos = existingRelatedItems[0]?.dias_operacao_item || 0;
                
                const baseItem: ItemRemonta = {
                    item: animalType,
                    quantidade_animais: nrAnimaisSalvos,
                    dias_operacao_item: diasOperacaoSalvos,
                    valor_mnt_dia: 0, // Não usamos este campo para o cálculo total do animal, apenas para diretrizes individuais
                    categoria: 'Remonta/Veterinária',
                };
                
                baseItems.push(baseItem);
            }
        });
        
        setCurrentCategoryItems(baseItems);
    }
  }, [selectedTab, diretrizesSaude, diretrizesRemonta, form.itensSaude, form.itensRemonta]);


  const loadDiretrizes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let anoReferencia: number | null = null;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("default_diretriz_year")
        .eq("id", user.id)
        .maybeSingle();
        
      if (profileData?.default_diretriz_year) {
          anoReferencia = profileData.default_diretriz_year;
      }

      if (!anoReferencia) {
          const { data: diretrizCusteio } = await supabase
            .from("diretrizes_custeio")
            .select("ano_referencia")
            .eq("user_id", user.id)
            .order("ano_referencia", { ascending: false })
            .limit(1)
            .maybeSingle();
            
          if (diretrizCusteio) {
            anoReferencia = diretrizCusteio.ano_referencia;
          }
      }
      
      const allCategories = [...CATEGORIAS];
      
      if (!anoReferencia) {
        setDiretrizesSaude(defaultClasseVIIISaudeConfig as DiretrizClasseII[]);
        setDiretrizesRemonta(defaultClasseVIIIRemontaConfig as DiretrizClasseII[]);
        return;
      }

      const { data: classeItemsData } = await supabase
        .from("diretrizes_classe_ii")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", anoReferencia)
        .eq("ativo", true)
        .in("categoria", allCategories);

      const loadedItems = classeItemsData || [];
      
      const loadedSaude = loadedItems.filter(d => d.categoria === 'Saúde');
      setDiretrizesSaude(loadedSaude.length > 0 ? loadedSaude as DiretrizClasseII[] : defaultClasseVIIISaudeConfig as DiretrizClasseII[]);
      
      const loadedRemonta = loadedItems.filter(d => d.categoria === 'Remonta/Veterinária');
      setDiretrizesRemonta(loadedRemonta.length > 0 ? loadedRemonta as DiretrizClasseII[] : defaultClasseVIIIRemontaConfig as DiretrizClasseII[]);
      
    } catch (error) {
      console.error("Erro ao carregar diretrizes:", error);
      setDiretrizesSaude(defaultClasseVIIISaudeConfig as DiretrizClasseII[]);
      setDiretrizesRemonta(defaultClasseVIIIRemontaConfig as DiretrizClasseII[]);
    }
  };

  const fetchRegistros = async (): Promise<{ saude: ClasseVIIIRegistro[], remonta: ClasseVIIIRegistro[] }> => {
    if (!ptrabId) return { saude: [], remonta: [] };
    
    try {
        const [
            { data: saudeData, error: saudeError },
            { data: remontaData, error: remontaError },
        ] = await Promise.all([
            supabase
                .from("classe_viii_saude_registros")
                .select("*, itens_saude, detalhamento_customizado, valor_nd_30, valor_nd_39, om_detentora, ug_detentora")
                .eq("p_trab_id", ptrabId),
            supabase
                .from("classe_viii_remonta_registros")
                .select("*, itens_remonta, detalhamento_customizado, valor_nd_30, valor_nd_39, animal_tipo, quantidade_animais, om_detentora, ug_detentora")
                .eq("p_trab_id", ptrabId),
        ]);

        if (saudeError) throw saudeError;
        if (remontaError) throw remontaError;

        const newSaudeRecords = (saudeData || []).map(r => ({
            ...r,
            categoria: 'Saúde', // Normaliza a categoria para exibição
            om_detentora: r.om_detentora || r.organizacao,
            ug_detentora: r.ug_detentora || r.ug,
        })) as ClasseVIIIRegistro[];
        const newRemontaRecords = (remontaData || []).map(r => ({
            ...r,
            categoria: 'Remonta/Veterinária', // Normaliza a categoria para exibição
            om_detentora: r.om_detentora || r.organizacao,
            ug_detentora: r.ug_detentora || r.ug,
        })) as ClasseVIIIRegistro[];

        setRegistrosSaude(newSaudeRecords);
        setRegistrosRemonta(newRemontaRecords);
        
        return { saude: newSaudeRecords, remonta: newRemontaRecords };
    } catch (error) {
        console.error("Erro ao carregar registros de Classe VIII:", error);
        toast.error("Erro ao carregar os registros de Saúde e Remonta.");
        return { saude: [], remonta: [] };
    }
  };
  
  const reconstructFormState = async (saudeRecords: ClasseVIIIRegistro[], remontaRecords: ClasseVIIIRegistro[]) => {
    setLoading(true);
    
    // 1. Consolidar todos os registros em um único array para facilitar a extração de dados globais
    const allRecords = [...saudeRecords, ...remontaRecords];
    if (allRecords.length === 0) {
        setLoading(false);
        return;
    }

    // Ao editar, usamos o primeiro registro para preencher os dados globais (OM Detentora, UG Detentora, Dias)
    const firstRecord = allRecords[0];
    
    // 2. Extract global data (OM Detentora)
    const omDetentora = firstRecord.om_detentora;
    const ugDetentora = firstRecord.ug_detentora;
    const diasOperacao = firstRecord.dias_operacao;
    const fasesSalvas = (firstRecord.fase_atividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
    const fasesPadrao = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];
    setFasesAtividade(fasesSalvas.filter(f => fasesPadrao.includes(f)));
    setCustomFaseAtividade(fasesSalvas.find(f => !fasesPadrao.includes(f)) || "");
    
    // 3. Consolidate items and allocations
    let consolidatedSaude: ItemSaude[] = [];
    let allRemontaItems: ItemRemonta[] = []; // Lista completa de itens de diretriz de Remonta
    let baseRemontaItems: ItemRemonta[] = []; // Lista base (Equino, Canino) para preencher a aba de edição
    let newAllocations = { ...initialCategoryAllocations };
    let selectedOmIdForEdit: string | undefined = undefined;
    
    const fetchOmId = async (nome: string, ug: string) => {
        if (!nome || !ug) return undefined;
        const { data } = await supabase
            .from('organizacoes_militares')
            .select('id')
            .eq('nome_om', nome)
            .eq('codug_om', ug)
            .maybeSingle();
        return data?.id;
    };
    
    // Fetch OM Detentora ID
    selectedOmIdForEdit = await fetchOmId(omDetentora, ugDetentora);
    
    // --- Process Saúde ---
    if (saudeRecords.length > 0) {
        const r = saudeRecords[0]; // Apenas um registro por OM Detentora/UG Detentora/Categoria é esperado
        const sanitizedItems = (r.itens_saude || []).map(item => ({
            ...item,
            quantidade: Number((item as ItemSaude).quantidade || 0),
            valor_mnt_dia: Number((item as ItemSaude).valor_mnt_dia || 0),
        })) as ItemSaude[];
        
        consolidatedSaude = sanitizedItems;
        
        const totalValor = sanitizedItems.reduce((sum, item) => calculateSaudeItemTotal(item) + sum, 0);
        newAllocations['Saúde'] = {
            total_valor: totalValor,
            nd_39_input: formatNumberForInput(Number(r.valor_nd_39), 2),
            nd_30_value: Number(r.valor_nd_30),
            nd_39_value: Number(r.valor_nd_39),
            om_destino_recurso: r.organizacao, // OM de Destino
            ug_destino_recurso: r.ug, // UG de Destino
            selectedOmDestinoId: undefined, // Será preenchido abaixo
        };
    }
    
    // --- Process Remonta ---
    if (remontaRecords.length > 0) {
        // 3.1. Consolidar TODOS os itens de diretriz de Remonta (Item B, C, D, E, G) de TODOS os registros (Equino e Canino)
        allRemontaItems = remontaRecords.flatMap(record => 
            (record.itens_remonta || []).map(item => ({
                ...item,
                quantidade_animais: Number(item.quantidade_animais || 0),
                dias_operacao_item: Number(item.dias_operacao_item || 0),
                valor_mnt_dia: Number(item.valor_mnt_dia || 0),
            }))
        );
        
        // 3.2. Extrair os dados de quantidade/dias para os itens base (Equino e Canino)
        const animalTypes = ['Equino', 'Canino'];
        
        animalTypes.forEach(animalType => {
            // Filtra os itens de diretriz que pertencem a este tipo de animal
            const relatedItems = allRemontaItems.filter(item => item.item.includes(animalType));
            if (relatedItems.length > 0) {
                // Pega o primeiro item para extrair a quantidade e dias (que devem ser consistentes)
                const firstItem = relatedItems[0];
                baseRemontaItems.push({
                    item: animalType,
                    quantidade_animais: firstItem.quantidade_animais,
                    dias_operacao_item: firstItem.dias_operacao_item,
                    valor_mnt_dia: 0, // Não usado para o item base
                    categoria: 'Remonta/Veterinária',
                });
            }
        });
        
        // 3.3. Consolidar Alocação ND 30/39 e Total Valor
        // Soma os valores de todos os registros de Remonta (Equino + Canino)
        const totalND30 = remontaRecords.reduce((sum, r) => sum + Number(r.valor_nd_30), 0);
        const totalND39 = remontaRecords.reduce((sum, r) => sum + Number(r.valor_nd_39), 0);
        const totalValor = remontaRecords.reduce((sum, r) => sum + Number(r.valor_total), 0);
        
        // O OM de destino deve ser o mesmo para todos os registros de Remonta
        const firstRemontaRecord = remontaRecords[0];
        
        newAllocations['Remonta/Veterinária'] = {
            total_valor: totalValor,
            nd_39_input: formatNumberForInput(totalND39, 2),
            nd_30_value: totalND30,
            nd_39_value: totalND39,
            om_destino_recurso: firstRemontaRecord.organizacao, // OM de Destino
            ug_destino_recurso: firstRemontaRecord.ug, // UG de Destino
            selectedOmDestinoId: undefined, // Será preenchido abaixo
        };
    }
    
    // 4. Preencher o formulário principal com a OM Detentora
    setForm({
      selectedOmId: selectedOmIdForEdit,
      organizacao: omDetentora,
      ug: ugDetentora,
      dias_operacao: diasOperacao,
      itensSaude: consolidatedSaude,
      itensRemonta: allRemontaItems, // CORRIGIDO: Usar a lista completa de itens de diretriz para o cálculo na seção 3
      fase_atividade: firstRecord.fase_atividade,
    });
    
    // 5. Preencher o estado de alocação e IDs de destino (e sincronizar temporários)
    for (const cat of CATEGORIAS) {
        const alloc = newAllocations[cat];
        
        if (alloc.om_destino_recurso) {
            alloc.selectedOmDestinoId = await fetchOmId(alloc.om_destino_recurso, alloc.ug_destino_recurso);
            
            // Sincronizar o estado temporário de destino com o ID
            setTempDestinations(prev => ({
                ...prev,
                [cat]: {
                    om: alloc.om_destino_recurso,
                    ug: alloc.ug_destino_recurso,
                    id: alloc.selectedOmDestinoId,
                }
            }));
            
            // Sincronizar o estado temporário de ND 39
            const savedND39Value = alloc.nd_39_value;
            const savedDigits = String(Math.round(savedND39Value * 100));
            setTempND39Inputs(prev => ({
                ...prev,
                [cat]: savedDigits
            }));
        }
    }
    
    setCategoryAllocations(newAllocations);
    
    // 6. Selecionar a aba do primeiro registro encontrado (se houver)
    if (saudeRecords.length > 0) {
        setSelectedTab('Saúde');
    } else if (remontaRecords.length > 0) {
        setSelectedTab('Remonta/Veterinária');
    }
    
    setLoading(false);
  };

  const resetFormFields = () => {
    setForm({
      selectedOmId: undefined,
      organizacao: "",
      ug: "",
      dias_operacao: 0,
      itensSaude: [],
      itensRemonta: [],
    });
    setCategoryAllocations(initialCategoryAllocations);
    setTempND39Inputs(initialTempND39Inputs); // Resetar ND 39 temporário
    setTempDestinations(initialTempDestinations); // Resetar destino temporário
    setCurrentCategoryItems([]);
    setFasesAtividade(["Execução"]);
    setCustomFaseAtividade("");
    setRemontaValidationWarning(null); // Resetar aviso
  };

  const handleOMChange = (omData: OMData | undefined) => {
    const omName = omData?.nome_om || "";
    const ug = omData?.codug_om || "";
    const omId = omData?.id;
    
    setForm(prev => ({
      ...prev,
      selectedOmId: omId,
      organizacao: omName,
      ug: ug,
    }));
    
    // Ao mudar a OM detentora, resetamos a OM de destino para a nova OM detentora (no estado temporário)
    const newTempDestinations = CATEGORIAS.reduce((acc, cat) => {
        acc[cat] = {
            om: omName,
            ug: ug,
            id: omId,
        };
        return acc;
    }, {} as Record<Categoria, TempDestination>);
    setTempDestinations(newTempDestinations);
    
    // Também atualiza o estado de alocação salva para refletir a nova OM detentora como padrão
    const newAllocations = CATEGORIAS.reduce((acc, cat) => {
        acc[cat] = {
            ...categoryAllocations[cat],
            om_destino_recurso: omName,
            ug_destino_recurso: ug,
            selectedOmDestinoId: omId,
        };
        return acc;
    }, {} as Record<Categoria, CategoryAllocation>);
    setCategoryAllocations(newAllocations);
  };
  
  const handleOMDestinoChange = (omData: OMData | undefined) => {
    setTempDestinations(prev => ({
        ...prev,
        [selectedTab]: {
            om: omData?.nome_om || "",
            ug: omData?.codug_om || "",
            id: omData?.id,
        }
    }));
  };

  const handleFaseChange = (fase: string, checked: boolean) => {
    if (checked) {
      setFasesAtividade(prev => Array.from(new Set([...prev, fase])));
    } else {
      setFasesAtividade(prev => prev.filter(f => f !== fase));
    }
  };

  // --- Item Quantity Handlers ---
  const handleQuantityChange = (itemIndex: number, rawQuantity: string) => {
    const newItems = [...currentCategoryItems];
    const quantity = parseInt(rawQuantity) || 0;
    
    if (selectedTab === 'Saúde') {
        (newItems as ItemSaude[])[itemIndex].quantidade = Math.max(0, quantity);
    } else {
        // Lógica de Remonta/Veterinária
        const item = (newItems as ItemRemonta[])[itemIndex];
        item.quantidade_animais = Math.max(0, quantity);
        
        // Validação imediata para Canino
        if (item.item === 'Canino' && quantity > 0 && quantity % 5 !== 0) {
            setRemontaValidationWarning("A quantidade de Caninos deve ser um múltiplo de 5.");
        } else {
            setRemontaValidationWarning(null);
        }
    }
    setCurrentCategoryItems(newItems);
  };
  
  const handleQuantityBlur = (itemIndex: number) => {
    if (selectedTab !== 'Remonta/Veterinária') return;
    
    const newItems = [...currentCategoryItems];
    const item = (newItems as ItemRemonta[])[itemIndex];
    let finalQuantity = item.quantidade_animais;
    
    // Regra Caninos: múltiplos de 5 (aplicada no blur)
    if (item.item === 'Canino') {
        // Se o valor não for múltiplo de 5, arredondamos para o múltiplo de 5 mais próximo
        if (finalQuantity > 0 && finalQuantity % 5 !== 0) {
            finalQuantity = Math.round(finalQuantity / 5) * 5;
            setRemontaValidationWarning(null); // Limpa o aviso após o arredondamento
        }
    }
    
    item.quantidade_animais = finalQuantity;
    setCurrentCategoryItems(newItems);
  };
  
  const handleDiasOperacaoChange = (itemIndex: number, days: number) => {
    if (selectedTab !== 'Remonta/Veterinária') return;
    
    const newItems = [...currentCategoryItems];
    const item = (newItems as ItemRemonta[])[itemIndex];
    item.dias_operacao_item = Math.max(0, days);
    
    setCurrentCategoryItems(newItems);
  };

  // --- ND Allocation Handlers ---
  const currentCategoryTotalValue = useMemo(() => {
    if (selectedTab === 'Saúde') {
        return (currentCategoryItems as ItemSaude[]).reduce((sum, item) => calculateSaudeItemTotal(item) + sum, 0);
    } else {
        const remontaItems = currentCategoryItems as ItemRemonta[];
        
        let totalRemonta = 0;
        
        remontaItems.forEach(animalItem => {
            // Usa a função auxiliar para calcular o total do tipo de animal
            totalRemonta += calculateTotalForAnimalType(animalItem, diretrizesRemonta);
        });
        
        return totalRemonta;
    }
  }, [currentCategoryItems, selectedTab, diretrizesRemonta]);
  
  // ND Calculation and Input Handlers (Temporary for current tab)
  const currentND39InputDigits = tempND39Inputs[selectedTab] || "";
  
  const nd39NumericValue = useMemo(() => {
      return formatCurrencyInput(currentND39InputDigits).numericValue;
  }, [currentND39InputDigits]);

  const nd39ValueTemp = Math.min(currentCategoryTotalValue, Math.max(0, nd39NumericValue));
  const nd30ValueTemp = currentCategoryTotalValue - nd39ValueTemp;
  
  const { formatted: formattedND39Value } = formatCurrencyInput(currentND39InputDigits);

  // ALTERADO: Usa formatCurrencyInput para processar o input e armazenar dígitos brutos
  const handleND39InputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const { digits } = formatCurrencyInput(rawValue);
      setTempND39Inputs(prev => ({
          ...prev,
          [selectedTab]: digits
      }));
  };

  // ALTERADO: Usa formatCurrencyInput para obter o valor numérico e armazena o valor final em dígitos brutos
  const handleND39InputBlur = () => {
      // Usa o valor calculado final (nd39ValueTemp) e converte de volta para dígitos para armazenamento
      const finalDigits = String(Math.round(nd39ValueTemp * 100));
      setTempND39Inputs(prev => ({
          ...prev,
          [selectedTab]: finalDigits
      }));
  };

  // --- Save Category Items to Form State ---
  const handleUpdateCategoryItems = () => {
    if (!form.organizacao || form.dias_operacao <= 0) {
        toast.error("Preencha a OM e os Dias de Atividade (Global) antes de salvar itens.");
        return;
    }
    
    const categoryTotalValue = currentCategoryTotalValue;

    // ALTERADO: Obtém o valor numérico dos dígitos brutos
    const numericInput = nd39NumericValue;
    const finalND39Value = Math.min(categoryTotalValue, Math.max(0, numericInput));
    const finalND30Value = categoryTotalValue - finalND39Value;
    
    if (categoryTotalValue > 0 && !areNumbersEqual(finalND30Value + finalND39Value, categoryTotalValue)) {
        toast.error("Erro de cálculo: A soma de ND 30 e ND 39 deve ser igual ao Total da Categoria.");
        return;
    }
    
    const currentTempDest = tempDestinations[selectedTab];
    if (categoryTotalValue > 0 && (!currentTempDest.om || !currentTempDest.ug)) {
        toast.error("Selecione a OM de destino do recurso antes de salvar a alocação.");
        return;
    }
    
    if (selectedTab === 'Remonta/Veterinária' && remontaValidationWarning) {
        toast.error(remontaValidationWarning);
        return;
    }

    let itemsToKeep: (ItemSaude | ItemRemonta)[] = [];
    
    if (selectedTab === 'Saúde') {
        itemsToKeep = (currentCategoryItems as ItemSaude[]).filter(item => item.quantidade > 0);
        setForm(prev => ({ ...prev, itensSaude: itemsToKeep as ItemSaude[] }));
    } else {
        const remontaItems = currentCategoryItems as ItemRemonta[];
        const directives = diretrizesRemonta;
        
        const activeRemontaItems: ItemRemonta[] = [];
        
        remontaItems.forEach(animalItem => {
            const animalType = animalItem.item;
            const nrAnimais = animalItem.quantidade_animais;
            const diasOperacao = animalItem.dias_operacao_item;
            
            if (nrAnimais > 0 && diasOperacao > 0) {
                const relatedDirectives = directives.filter(d => d.item.includes(animalType));
                
                relatedDirectives.forEach(d => {
                    activeRemontaItems.push({
                        item: d.item,
                        quantidade_animais: nrAnimais,
                        dias_operacao_item: diasOperacao,
                        valor_mnt_dia: Number(d.valor_mnt_dia),
                        categoria: 'Remonta/Veterinária',
                    });
                });
            }
        });
        
        itemsToKeep = activeRemontaItems;
        setForm(prev => ({ ...prev, itensRemonta: itemsToKeep as ItemRemonta[] }));
    }

    setCategoryAllocations(prev => ({
        ...prev,
        [selectedTab]: {
            ...prev[selectedTab],
            total_valor: categoryTotalValue,
            // Salva o valor formatado para persistência
            nd_39_input: formatNumberForInput(finalND39Value, 2), 
            nd_30_value: finalND30Value,
            nd_39_value: finalND39Value,
            om_destino_recurso: currentTempDest.om,
            ug_destino_recurso: currentTempDest.ug,
            selectedOmDestinoId: currentTempDest.id,
        }
    }));
    
    // 7. Ensure the temporary input state is synchronized with the saved value after saving
    const finalDigits = String(Math.round(finalND39Value * 100));
    setTempND39Inputs(prev => ({
        ...prev,
        [selectedTab]: finalDigits
    }));
    
    toast.success(`Itens e alocação de ND para ${selectedTab} atualizados!`);
  };
  
  // --- Global Totals and Validation ---
  const valorTotalSaude = form.itensSaude.reduce((sum, item) => calculateSaudeItemTotal(item) + sum, 0);
  const valorTotalRemonta = form.itensRemonta.reduce((sum, item) => calculateRemontaItemTotal(item) + sum, 0);
  const valorTotalForm = valorTotalSaude + valorTotalRemonta;

  const totalND30Final = Object.values(categoryAllocations).reduce((sum, alloc) => sum + alloc.nd_30_value, 0);
  const totalND39Final = Object.values(categoryAllocations).reduce((sum, alloc) => sum + alloc.nd_39_value, 0);
  const totalAlocado = totalND30Final + totalND39Final;
  
  const isTotalAlocadoCorrect = areNumbersEqual(valorTotalForm, totalAlocado);
  
  const itensAgrupadosPorCategoria = useMemo(() => {
    const groups: Record<Categoria, (ItemSaude | ItemRemonta)[]> = {};
    if (form.itensSaude.length > 0) groups['Saúde'] = form.itensSaude;
    if (form.itensRemonta.length > 0) groups['Remonta/Veterinária'] = form.itensRemonta;
    return groups;
  }, [form.itensSaude, form.itensRemonta]);


  // --- Save Records to Database ---
  const handleSalvarRegistros = async () => {
    if (!ptrabId) return;
    if (!form.organizacao || !form.ug) { toast.error("Selecione uma OM detentora"); return; }
    if (form.dias_operacao <= 0) { toast.error("Dias de Atividade (Global) deve ser maior que zero"); return; }
    if (form.itensSaude.length === 0 && form.itensRemonta.length === 0) { toast.error("Adicione pelo menos um item"); return; }
    
    let fasesFinais = [...fasesAtividade];
    if (customFaseAtividade.trim()) { fasesFinais = [...fasesFinais, customFaseAtividade.trim()]; }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');
    if (!faseFinalString) { toast.error("Selecione ou digite pelo menos uma Fase da Atividade."); return; }
    
    if (!isTotalAlocadoCorrect) {
        toast.error("O valor total dos itens não corresponde ao total alocado. Clique em 'Salvar Itens da Categoria' em todas as abas ativas.");
        return;
    }

    // Determine the target OM/UG for deletion/insertion (OM Detentora)
    const omDetentora = form.organizacao;
    const ugDetentora = form.ug;
    
    // REMOVIDA A VALIDAÇÃO DE CONSISTÊNCIA DA OM DE DESTINO ENTRE CATEGORIAS.
    
    setLoading(true);
    
    try {
      // 1. Deletar registros antigos APENAS para a OM DETENTORA/UG DETENTORA atual
      
      // Delete existing Saúde records if we are saving new Saúde items
      await supabase.from("classe_viii_saude_registros")
        .delete()
        .eq("p_trab_id", ptrabId)
        .eq("om_detentora", omDetentora)
        .eq("ug_detentora", ugDetentora);
      
      // Delete existing Remonta records if we are saving new Remonta items
      await supabase.from("classe_viii_remonta_registros")
        .delete()
        .eq("p_trab_id", ptrabId)
        .eq("om_detentora", omDetentora)
        .eq("ug_detentora", ugDetentora);
      
      // 2. Inserir Saúde
      if (form.itensSaude.length > 0) {
        const allocation = categoryAllocations['Saúde'];
        
        if (!allocation.om_destino_recurso || !allocation.ug_destino_recurso) {
            toast.error("Selecione a OM de destino do recurso para a categoria Saúde.");
            setLoading(false);
            return;
        }
        
        const valorTotal = valorTotalSaude;
        
        const detalhamento = generateDetalhamento(
            form.itensSaude, form.dias_operacao, omDetentora, ugDetentora, faseFinalString,
            allocation.om_destino_recurso, allocation.ug_destino_recurso, allocation.nd_30_value, allocation.nd_39_value,
            'Saúde'
        );
        
        const registroSaude: TablesInsert<'classe_viii_saude_registros'> = {
            p_trab_id: ptrabId,
            organizacao: allocation.om_destino_recurso, // OM de Destino
            ug: allocation.ug_destino_recurso, // UG de Destino
            om_detentora: omDetentora, // OM Detentora
            ug_detentora: ugDetentora, // UG Detentora
            dias_operacao: form.dias_operacao,
            categoria: 'Saúde - KPSI/KPT',
            itens_saude: form.itensSaude as any,
            valor_total: valorTotal,
            detalhamento: detalhamento,
            fase_atividade: faseFinalString,
            valor_nd_30: allocation.nd_30_value,
            valor_nd_39: allocation.nd_39_value,
        };
        await supabase.from("classe_viii_saude_registros").insert([registroSaude]);
      }
      
      // 3. Inserir Remonta/Veterinária
      if (form.itensRemonta.length > 0) {
        const allocation = categoryAllocations['Remonta/Veterinária'];
        
        if (!allocation.om_destino_recurso || !allocation.ug_destino_recurso) {
            toast.error("Selecione a OM de destino do recurso para a categoria Remonta/Veterinária.");
            setLoading(false);
            return;
        }
        
        const totalRemonta = valorTotalRemonta;
        
        // Agrupar itens por tipo de animal (Equino e Canino)
        const remontaItemsGrouped = form.itensRemonta.reduce((acc, item) => {
            const type = item.item.includes('Equino') ? 'Equino' : 'Canino';
            if (!acc[type]) acc[type] = [];
            acc[type].push(item);
            return acc;
        }, {} as Record<string, ItemRemonta[]>);
        
        const registrosParaInserir: TablesInsert<'classe_viii_remonta_registros'>[] = [];
        
        // Calcular totais individuais para Equino e Canino
        const valorEquino = (remontaItemsGrouped['Equino'] || []).reduce((sum, item) => sum + calculateRemontaItemTotal(item), 0);
        const valorCanino = (remontaItemsGrouped['Canino'] || []).reduce((sum, item) => sum + calculateRemontaItemTotal(item), 0);
        
        const totalGeralRemonta = valorEquino + valorCanino;
        
        // Calcular proporções para dividir ND 30/39
        const proporcaoEquino = totalGeralRemonta > 0 ? valorEquino / totalGeralRemonta : 0;
        const proporcaoCanino = totalGeralRemonta > 0 ? valorCanino / totalGeralRemonta : 0;
        
        const nd30Equino = allocation.nd_30_value * proporcaoEquino;
        const nd39Equino = allocation.nd_39_value * proporcaoEquino;
        
        const nd30Canino = allocation.nd_30_value * proporcaoCanino;
        const nd39Canino = allocation.nd_39_value * proporcaoCanino;
        
        // Processar Equino
        if (remontaItemsGrouped['Equino'] && remontaItemsGrouped['Equino'].length > 0) {
            const equinoItems = remontaItemsGrouped['Equino'];
            const nrAnimaisEquino = equinoItems[0].quantidade_animais;
            
            const detalhamentoEquino = generateDetalhamento(
                equinoItems, form.dias_operacao, omDetentora, ugDetentora, faseFinalString,
                allocation.om_destino_recurso, allocation.ug_destino_recurso, 
                nd30Equino, nd39Equino, 'Remonta/Veterinária', 'Equino'
            );
            
            registrosParaInserir.push({
                p_trab_id: ptrabId,
                organizacao: allocation.om_destino_recurso,
                ug: allocation.ug_destino_recurso,
                om_detentora: omDetentora, // OM Detentora
                ug_detentora: ugDetentora, // UG Detentora
                dias_operacao: form.dias_operacao,
                animal_tipo: 'Equino',
                quantidade_animais: nrAnimaisEquino,
                itens_remonta: equinoItems as any,
                valor_total: valorEquino,
                detalhamento: detalhamentoEquino,
                fase_atividade: faseFinalString,
                valor_nd_30: nd30Equino,
                valor_nd_39: nd39Equino,
            });
        }
        
        // Processar Canino
        if (remontaItemsGrouped['Canino'] && remontaItemsGrouped['Canino'].length > 0) {
            const caninoItems = remontaItemsGrouped['Canino'];
            const nrAnimaisCanino = caninoItems[0].quantidade_animais;
            
            const detalhamentoCanino = generateDetalhamento(
                caninoItems, form.dias_operacao, omDetentora, ugDetentora, faseFinalString,
                allocation.om_destino_recurso, allocation.ug_destino_recurso, 
                nd30Canino, nd39Canino, 'Remonta/Veterinária', 'Canino'
            );
            
            registrosParaInserir.push({
                p_trab_id: ptrabId,
                organizacao: allocation.om_destino_recurso,
                ug: allocation.ug_destino_recurso,
                om_detentora: omDetentora, // OM Detentora
                ug_detentora: ugDetentora, // UG Detentora
                dias_operacao: form.dias_operacao,
                animal_tipo: 'Canino',
                quantidade_animais: nrAnimaisCanino,
                itens_remonta: caninoItems as any,
                valor_total: valorCanino,
                detalhamento: detalhamentoCanino,
                fase_atividade: faseFinalString,
                valor_nd_30: nd30Canino,
                valor_nd_39: nd39Canino,
            });
        }
        
        // Ajuste final de arredondamento (garantir que a soma seja exata)
        if (registrosParaInserir.length === 2) {
            const totalND30 = allocation.nd_30_value;
            const totalND39 = allocation.nd_39_value;
            
            const somaND30 = registrosParaInserir.reduce((sum, r) => sum + r.valor_nd_30, 0);
            const somaND39 = registrosParaInserir.reduce((sum, r) => sum + r.valor_nd_39, 0);
            
            // Adiciona a diferença de arredondamento ao primeiro registro
            if (!areNumbersEqual(somaND30, totalND30)) {
                registrosParaInserir[0].valor_nd_30 += (totalND30 - somaND30);
            }
            if (!areNumbersEqual(somaND39, totalND39)) {
                registrosParaInserir[0].valor_nd_39 += (totalND39 - somaND39);
            }
        }
            
        if (registrosParaInserir.length > 0) {
            await supabase.from("classe_viii_remonta_registros").insert(registrosParaInserir);
        }
      }
      
      toast.success("Registros de Classe VIII salvos com sucesso!");
      await updatePTrabStatusIfAberto(ptrabId);
      resetFormFields(); // Limpa o formulário para permitir novo registro
      fetchRegistros(); // Recarregar a lista de registros salvos
    } catch (error) {
      console.error("Erro ao salvar registros de Classe VIII:", error);
      toast.error("Erro ao salvar registros de Classe VIII");
    } finally {
      setLoading(false);
    }
  };

  // ALTERADO: Agora recebe um registro de categoria individual
  const handleEditarRegistro = async (registro: ClasseVIIIRegistro) => {
    setLoading(true);
    resetFormFields();
    
    // Garante que os dados mais recentes estão no estado
    const { saude: saudeRecords, remonta: remontaRecords } = await fetchRegistros(); 
    
    // Reconstruir o estado do formulário com os dados carregados
    // Filtramos os registros que pertencem à mesma OM Detentora/UG Detentora do registro clicado
    const omDetentoraToEdit = registro.om_detentora;
    const ugDetentoraToEdit = registro.ug_detentora;
    
    const saudeToEdit = saudeRecords.filter(r => r.om_detentora === omDetentoraToEdit && r.ug_detentora === ugDetentoraToEdit);
    const remontaToEdit = remontaRecords.filter(r => r.om_detentora === omDetentoraToEdit && r.ug_detentora === ugDetentoraToEdit);
    
    reconstructFormState(saudeToEdit, remontaToEdit);
    
    // Define a aba correta para visualização
    setSelectedTab(registro.categoria === 'Saúde' ? 'Saúde' : 'Remonta/Veterinária');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setLoading(false);
  };
  
  // ALTERADO: Agora deleta apenas o registro da categoria específica
  const handleDeletarRegistro = async (registro: ClasseVIIIRegistro) => {
    const isSaude = registro.categoria === 'Saúde';
    const tableName = isSaude ? 'classe_viii_saude_registros' : 'classe_viii_remonta_registros';
    const categoriaLabel = isSaude ? 'Saúde' : `Remonta/Veterinária (${registro.animal_tipo})`;
    
    if (!confirm(`Deseja realmente deletar o registro de ${categoriaLabel} para a OM Detentora ${registro.om_detentora}?`)) return;
    
    setLoading(true);
    try {
        // Se for Saúde, deletamos o registro único de Saúde para aquela OM Detentora
        if (isSaude) {
            await supabase.from(tableName)
                .delete()
                .eq("id", registro.id);
        } else {
            // Se for Remonta, deletamos TODOS os registros de Remonta (Equino e Canino) que compartilham a mesma OM Detentora/UG Detentora
            // Isso é necessário porque Remonta é salva em múltiplos registros (um por animal_tipo) mas é editada como um bloco.
            await supabase.from(tableName)
                .delete()
                .eq("p_trab_id", ptrabId)
                .eq("om_detentora", registro.om_detentora)
                .eq("ug_detentora", registro.ug_detentora);
        }
        
        toast.success(`Registro de ${categoriaLabel} excluído!`);
        fetchRegistros();
        resetFormFields(); // Limpa o formulário após a exclusão
    } catch (error) {
        console.error("Erro ao deletar registro:", error);
        toast.error(sanitizeError(error));
    } finally {
        setLoading(false);
    }
  };

  const handleIniciarEdicaoMemoria = (registro: ClasseVIIIRegistro) => {
    setEditingMemoriaId(registro.id);
    
    // 1. Gerar a memória automática mais recente
    const isSaude = registro.categoria === 'Saúde';
    const itensParaMemoria = isSaude ? registro.itens_saude as ItemSaude[] : registro.itens_remonta as ItemRemonta[];
    
    const memoriaAutomatica = generateCategoryMemoriaCalculo(
        registro.categoria as Categoria, 
        itensParaMemoria as ItemClasseVIII[], 
        registro.dias_operacao, 
        registro.om_detentora, 
        registro.ug_detentora, 
        registro.fase_atividade || '', 
        0, 
        registro.valor_nd_30, 
        registro.valor_nd_39,
        registro.animal_tipo
    );
    
    // 2. Usar a customizada se existir, senão usar a automática recém-gerada
    setMemoriaEdit(registro.detalhamento_customizado || memoriaAutomatica || "");
  };

  const handleCancelarEdicaoMemoria = () => {
    setEditingMemoriaId(null);
    setMemoriaEdit("");
  };

  const handleSalvarMemoriaCustomizada = async (registro: ClasseVIIIRegistro) => {
    setLoading(true);
    try {
      const tableName = registro.categoria === 'Saúde' ? 'classe_viii_saude_registros' : 'classe_viii_remonta_registros';
      
      const { error } = await supabase
        .from(tableName)
        .update({
          detalhamento_customizado: memoriaEdit.trim() || null,
        })
        .eq("id", registro.id);

      if (error) throw error;

      toast.success("Memória de cálculo atualizada com sucesso!");
      handleCancelarEdicaoMemoria();
      await fetchRegistros();
    } catch (error) {
      console.error("Erro ao salvar memória:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRestaurarMemoriaAutomatica = async (registro: ClasseVIIIRegistro) => {
    if (!confirm("Deseja restaurar a memória de cálculo automática? O texto customizado será perdido.")) {
      return;
    }
    
    setLoading(true);
    try {
      const tableName = registro.categoria === 'Saúde' ? 'classe_viii_saude_registros' : 'classe_viii_remonta_registros';
      
      const { error } = await supabase
        .from(tableName)
        .update({
          detalhamento_customizado: null,
        })
        .eq("id", registro.id);

      if (error) throw error;

      toast.success("Memória de cálculo restaurada!");
      await fetchRegistros();
    } catch (error) {
      console.error("Erro ao restaurar memória:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const displayFases = useMemo(() => {
    return [...fasesAtividade, customFaseAtividade.trim()].filter(f => f).join(', ');
  }, [fasesAtividade, customFaseAtividade]);
  
  const allRegistros = [...registrosSaude, ...registrosRemonta];
  
  const registrosAgrupadosPorOM = useMemo(() => {
    // 1. Agrupa por OM Detentora
    const groups = allRegistros.reduce((acc, registro) => {
        const omDetentora = registro.om_detentora;
        const ugDetentora = registro.ug_detentora;
        const key = `${omDetentora} (${formatCodug(ugDetentora)})`;
        
        if (!acc[key]) {
            acc[key] = [];
        }
        
        // Adiciona o registro de Saúde ou o registro de Remonta (Equino ou Canino)
        // Nota: Para Remonta, como salvamos Equino e Canino separadamente, ambos aparecerão aqui.
        acc[key].push(registro);
        
        return acc;
    }, {} as Record<string, ClasseVIIIRegistro[]>);

    // 2. Ordena as chaves (nomes das OMs) alfabeticamente
    const sortedKeys = Object.keys(groups).sort((a, b) => {
        // Extrai apenas o nome da OM para comparação (ignora o CODUG entre parênteses)
        const nameA = a.split(' (')[0];
        const nameB = b.split(' (')[0];
        return nameA.localeCompare(nameB);
    });

    // 3. Retorna o objeto ordenado
    return sortedKeys.reduce((acc, key) => {
        acc[key] = groups[key];
        return acc;
    }, {} as Record<string, ClasseVIIIRegistro[]>);
  }, [allRegistros]);
  
  const getAnimalBadgeStyle = (animalType: 'Equino' | 'Canino') => {
      if (animalType === 'Equino') {
          return { label: 'Equino', className: 'bg-amber-700 text-white' };
      }
      if (animalType === 'Canino') {
          return { label: 'Canino', className: 'bg-indigo-700 text-white' };
      }
      return { label: 'Remonta/Vet', className: 'bg-yellow-700 text-white' };
  };


  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Classe VIII - Saúde e Remonta/Veterinária
            </CardTitle>
            <CardDescription>
              Solicitação de recursos para manutenção de material de Saúde e Remonta/Veterinária.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* 1. Dados da Organização e Dias */}
            <div className="space-y-3 border-b pb-4">
              <h3 className="text-lg font-semibold">1. Dados da Organização</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>OM Detentora do Equipamento *</Label>
                  <OmSelector
                    selectedOmId={form.selectedOmId}
                    onChange={handleOMChange}
                    placeholder="Selecione a OM..."
                    initialOmName={form.organizacao} 
                    initialOmUg={form.ug} 
                  />
                </div>

                <div className="space-y-2">
                  <Label>UG Detentora</Label>
                  <Input value={formatCodug(form.ug)} readOnly disabled onKeyDown={handleEnterToNextField} />
                </div>
                
                <div className="space-y-2">
                  <Label>Dias de Atividade (Global) *</Label>
                  <Input
                    type="number"
                    min="1"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none max-w-xs"
                    value={form.dias_operacao || ""}
                    onChange={(e) => setForm({ ...form, dias_operacao: parseInt(e.target.value) || 0 })}
                    placeholder="Ex: 7"
                    onKeyDown={handleNumberInputKeyDown}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fase da Atividade *</Label>
                  <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        type="button"
                        className="w-full justify-between"
                      >
                        <span className="truncate">
                          {displayFases || "Selecione a(s) fase(s)..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <CommandGroup>
                          {FASES_PADRAO.map((fase) => (
                            <CommandItem
                              key={fase}
                              value={fase}
                              onSelect={() => handleFaseChange(fase, !fasesAtividade.includes(fase))}
                              className="flex items-center justify-between cursor-pointer"
                            >
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  checked={fasesAtividade.includes(fase)}
                                  onCheckedChange={(checked) => handleFaseChange(fase, !!checked)}
                                />
                                <Label>{fase}</Label>
                              </div>
                              {fasesAtividade.includes(fase) && <Check className="ml-auto h-4 w-4" />}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        <div className="p-2 border-t">
                          <Label className="text-xs text-muted-foreground mb-1 block">Outra Atividade (Opcional)</Label>
                          <Input
                            value={customFaseAtividade}
                            onChange={(e) => setCustomFaseAtividade(e.target.value)}
                            placeholder="Ex: Patrulhamento"
                            onKeyDown={handleEnterToNextField}
                          />
                        </div>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                
                {/* Coluna vazia para manter o layout de 2 colunas */}
                <div className="space-y-2">
                    {/* Este espaço é intencionalmente vazio */}
                </div>
              </div>
            </div>

            {/* 2. Configurar Itens por Categoria (Aba) */}
            {form.organizacao && form.dias_operacao > 0 && (
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">2. Configurar Itens por Categoria</h3>
                
                <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as Categoria)}>
                  <TabsList className="grid w-full grid-cols-2">
                    {CATEGORIAS.map(cat => (
                      <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {CATEGORIAS.map(cat => (
                    <TabsContent key={cat} value={cat} className="mt-4">
                      <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                        
                        {/* Tabela de Itens */}
                        <div className="max-h-[400px] overflow-y-auto rounded-md border">
                            <Table className="w-full">
                                <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                                    <TableRow>
                                        <TableHead className="w-[40%]">Item</TableHead>
                                        {cat === 'Saúde' && (
                                            <TableHead className="w-[25%] text-right">Valor Kit</TableHead>
                                        )}
                                        <TableHead className="w-[15%] text-center">{cat === 'Saúde' ? 'Qtd Kits' : 'Qtd Animais'}</TableHead>
                                        {cat === 'Remonta/Veterinária' && (
                                            <TableHead className="w-[15%] text-center">Qtd Dias</TableHead>
                                        )}
                                        <TableHead className="w-[20%] text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {currentCategoryItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={cat === 'Saúde' ? 4 : 4} className="text-center text-muted-foreground">
                                                Nenhum item de diretriz encontrado para esta categoria.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        currentCategoryItems.map((item, index) => {
                                            const isSaude = cat === 'Saúde';
                                            const itemSaude = item as ItemSaude;
                                            const itemRemonta = item as ItemRemonta;
                                            
                                            const quantity = isSaude ? itemSaude.quantidade : itemRemonta.quantidade_animais;
                                            const valorMntDia = isSaude ? itemSaude.valor_mnt_dia : itemRemonta.valor_mnt_dia;
                                            
                                            const itemTotal = isSaude 
                                                ? calculateSaudeItemTotal(itemSaude)
                                                : calculateTotalForAnimalType(itemRemonta, diretrizesRemonta); 
                                            
                                            const itemLabel = isSaude ? itemSaude.item : itemRemonta.item;
                                            
                                            const unitLabel = isSaude ? 'kit' : (itemRemonta.item.includes('(Anual)') ? 'ano' : itemRemonta.item.includes('(Mensal)') ? 'mês' : 'dia');
                                            
                                            return (
                                                <TableRow key={itemLabel} className="h-12">
                                                    <TableCell className="font-medium text-sm py-1">
                                                        {itemLabel}
                                                        {!isSaude && itemLabel === 'Canino' && (
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                (Múltiplos de 5 cães)
                                                            </p>
                                                        )}
                                                    </TableCell>
                                                    
                                                    {/* Coluna Valor Base (Apenas para Saúde) */}
                                                    {isSaude && (
                                                        <TableCell className="text-right text-xs text-muted-foreground py-1">
                                                            {formatCurrency(valorMntDia)}
                                                            {!isSaude && <span className="ml-1">/ {unitLabel}</span>}
                                                        </TableCell>
                                                    )}
                                                    
                                                    {/* Coluna Qtd Kits / Qtd Animais */}
                                                    <TableCell className="py-1">
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none h-8 text-center"
                                                            value={typeof quantity === 'number' && quantity !== 0 ? quantity.toString() : ""}
                                                            onChange={(e) => handleQuantityChange(index, e.target.value)}
                                                            onBlur={() => handleQuantityBlur(index)}
                                                            placeholder="0"
                                                            onKeyDown={handleNumberInputKeyDown}
                                                        />
                                                        {itemLabel === 'Canino' && remontaValidationWarning && (
                                                            <p className="text-xs text-destructive mt-1">
                                                                <AlertCircle className="h-3 w-3 inline mr-1" />
                                                                {remontaValidationWarning}
                                                            </p>
                                                        )}
                                                    </TableCell>
                                                    
                                                    {/* Coluna Qtd Dias (Apenas para Remonta) */}
                                                    {!isSaude && (
                                                        <TableCell className="py-1">
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none h-8 text-center"
                                                                value={itemRemonta.dias_operacao_item || ""}
                                                                onChange={(e) => handleDiasOperacaoChange(index, parseInt(e.target.value) || 0)}
                                                                placeholder="0" 
                                                                onKeyDown={handleNumberInputKeyDown}
                                                            />
                                                        </TableCell>
                                                    )}
                                                    
                                                    {/* Coluna Total */}
                                                    <TableCell className="text-right font-semibold text-sm py-1">
                                                        {formatCurrency(itemTotal)}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        
                        <div className="flex justify-between items-center p-3 bg-background rounded-lg border">
                            <span className="font-bold text-sm">TOTAL DA CATEGORIA</span>
                            <span className="font-extrabold text-lg text-primary">
                                {formatCurrency(currentCategoryTotalValue)}
                            </span>
                        </div>
                        
                        {/* BLOCO DE ALOCAÇÃO ND 30/39 */}
                        {currentCategoryTotalValue > 0 && (
                            <div className="space-y-4 p-4 border rounded-lg bg-background">
                                <h4 className="font-semibold text-sm">Alocação de Recursos para {cat} (Valor Total: {formatCurrency(currentCategoryTotalValue)})</h4>
                                
                                {/* CAMPO: OM de Destino do Recurso */}
                                <div className="space-y-2">
                                    <Label>OM de Destino do Recurso *</Label>
                                    <OmSelector
                                        selectedOmId={tempDestinations[cat].id}
                                        onChange={handleOMDestinoChange}
                                        placeholder="Selecione a OM que receberá o recurso..."
                                        disabled={!form.organizacao} 
                                        initialOmName={tempDestinations[cat].om} 
                                        initialOmUg={tempDestinations[cat].ug} 
                                    />
                                    {tempDestinations[cat].ug && (
                                        <p className="text-xs text-muted-foreground">
                                            UG de Destino: {formatCodug(tempDestinations[cat].ug)}
                                        </p>
                                    )}
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    {/* ND 30 (Material) - ESQUERDA */}
                                    <div className="space-y-2">
                                        <Label>ND 33.90.30 (Material)</Label>
                                        <div className="relative">
                                            <Input
                                                value={formatNumberForInput(nd30ValueTemp, 2)}
                                                readOnly
                                                disabled
                                                className="pl-12 text-lg font-bold bg-green-500/10 text-green-600 disabled:opacity-100"
                                            />
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-lg text-foreground">R$</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Calculado por diferença (Total - ND 39).
                                        </p>
                                    </div>
                                    {/* ND 39 (Serviço) - DIREITA */}
                                    <div className="space-y-2">
                                        <Label htmlFor="nd39-input">ND 33.90.39 (Serviço)</Label>
                                        <div className="relative">
                                            <Input
                                                id="nd39-input"
                                                type="text"
                                                inputMode="decimal"
                                                value={formattedND39Value}
                                                onChange={handleND39InputChange}
                                                onBlur={handleND39InputBlur}
                                                placeholder="0,00"
                                                className="pl-12 text-lg"
                                                disabled={currentCategoryTotalValue === 0}
                                                onKeyDown={handleEnterToNextField}
                                            />
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-lg text-foreground">R$</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Valor alocado para contratação de serviço.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex justify-between text-sm font-bold border-t pt-2">
                                    <span>TOTAL ALOCADO:</span>
                                    <span className={cn(areNumbersEqual(currentCategoryTotalValue, (nd30ValueTemp + nd39ValueTemp)) ? "text-primary" : "text-destructive")}>
                                        {formatCurrency(nd30ValueTemp + nd39ValueTemp)}
                                    </span>
                                </div>
                            </div>
                        )}
                        {/* FIM BLOCO DE ALOCAÇÃO */}

                        <div className="flex justify-end">
                            <Button 
                                type="button" 
                                onClick={handleUpdateCategoryItems} 
                                className="w-full md:w-auto" 
                                disabled={!form.organizacao || form.dias_operacao <= 0 || !areNumbersEqual(currentCategoryTotalValue, (nd30ValueTemp + nd39ValueTemp)) || (currentCategoryTotalValue > 0 && !tempDestinations[cat].om) || !!remontaValidationWarning}
                            >
                                Salvar Itens da Categoria
                            </Button>
                        </div>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            )}

            {/* 3. Itens Adicionados e Consolidação */}
            {valorTotalForm > 0 && (
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">3. Itens Adicionados ({form.itensSaude.length + form.itensRemonta.length})</h3>
                
                {/* Alerta de Validação Final */}
                {!isTotalAlocadoCorrect && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="font-medium">
                            Atenção: O Custo Total dos Itens ({formatCurrency(valorTotalForm)}) não corresponde ao Total Alocado ({formatCurrency(totalAlocado)}). 
                            Clique em "Salvar Itens da Categoria" em todas as abas ativas.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="space-y-4">
                  {Object.entries(itensAgrupadosPorCategoria).map(([categoria, itens]) => {
                    const isSaude = categoria === 'Saúde';
                    const totalCategoria = isSaude ? valorTotalSaude : valorTotalRemonta;
                    const allocation = categoryAllocations[categoria as Categoria];
                    
                    // NOVO CÁLCULO: Obtém o total atual (SEM MARGEM) para a categoria.
                    const isCurrentTab = categoria === selectedTab;
                    
                    // Se for a aba atual, usamos os itens do estado temporário (currentCategoryItems).
                    // Se não for a aba atual, usamos os itens já salvos/carregados (itens).
                    const itemsToCalculateTotal = isCurrentTab 
                        ? currentCategoryItems.filter(i => (i as any).quantidade > 0 || (i as any).quantidade_animais > 0)
                        : itens;
                    
                    const currentTotalValueForCheck = isSaude 
                        ? (itemsToCalculateTotal as ItemSaude[]).reduce((sum, item) => calculateSaudeItemTotal(item) + sum, 0)
                        : (itemsToCalculateTotal as ItemRemonta[]).reduce((sum, item) => calculateTotalForAnimalType(item, diretrizesRemonta) + sum, 0);
                    
                    // NOVO: Verifica se a categoria está "suja" (itens ou alocação alterados)
                    const isDirty = isCategoryAllocationDirty(
                        categoria as Categoria, 
                        currentTotalValueForCheck, 
                        allocation, 
                        tempND39Inputs, 
                        tempDestinations
                    );
                    
                    // Verifica se a OM Detentora é diferente da OM de Destino
                    const isDifferentOm = form.organizacao !== allocation.om_destino_recurso;
                    
                    return (
                      <Card key={categoria} className="p-4 bg-secondary/10 border-secondary">
                        <div className="flex items-center justify-between mb-3 border-b pb-2">
                          <h4 className="font-bold text-base text-primary">{categoria}</h4>
                          <span className="font-extrabold text-lg text-primary">{formatCurrency(totalCategoria)}</span>
                        </div>
                        
                        <div className="space-y-2">
                          {itens.map((item, index) => {
                            const itemSaude = item as ItemSaude;
                            const itemRemonta = item as ItemRemonta;
                            
                            const itemTotal = isSaude 
                                ? calculateSaudeItemTotal(itemSaude)
                                : calculateRemontaItemTotal(itemRemonta);
                            
                            const quantity = isSaude ? itemSaude.quantidade : itemRemonta.quantidade_animais;
                            const unitValue = isSaude ? itemSaude.valor_mnt_dia : itemRemonta.valor_mnt_dia;
                            
                            const unitLabel = isSaude ? 'kit' : (itemRemonta.item.includes('(Anual)') ? 'ano' : itemRemonta.item.includes('(Mensal)') ? 'mês' : 'dia');
                            
                            let calculationDetail = `${quantity} un. x ${formatCurrency(unitValue)} / ${unitLabel}`;
                            if (!isSaude) {
                                if (itemRemonta.item.includes('(Mensal)')) {
                                    const diasPlural = itemRemonta.dias_operacao_item === 1 ? 'dia' : 'dias';
                                    calculationDetail = `${quantity} un. x (${formatCurrency(unitValue)} / 30 dias) x ${itemRemonta.dias_operacao_item} ${diasPlural}`;
                                } else if (itemRemonta.item.includes('(Diário)')) {
                                    const diasPlural = itemRemonta.dias_operacao_item === 1 ? 'dia' : 'dias';
                                    calculationDetail = `${quantity} un. x ${formatCurrency(unitValue)} x ${itemRemonta.dias_operacao_item} ${diasPlural}`;
                                } else {
                                    const multiplier = Math.ceil(itemRemonta.dias_operacao_item / 365);
                                    if (multiplier > 1) {
                                        calculationDetail = `${quantity} un. x ${formatCurrency(unitValue)} x ${multiplier} anos`;
                                    } else {
                                        calculationDetail = `${quantity} un. x ${formatCurrency(unitValue)}`;
                                    }
                                }
                            } else {
                                calculationDetail = `${quantity} un. x ${formatCurrency(unitValue)}`;
                            }
                            
                            return (
                              <div key={index} className="flex justify-between text-sm text-muted-foreground border-b border-dashed pb-1 last:border-b-0 last:pb-0">
                                <span className="font-medium">{isSaude ? itemSaude.item : itemRemonta.item}</span>
                                <span className="text-right">
                                  {calculationDetail} = {formatCurrency(itemTotal)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        
                        <div className="pt-2 border-t mt-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">OM Destino Recurso:</span>
                                <span className={cn("font-medium", isDifferentOm ? "text-red-600 font-bold" : "text-foreground")}>
                                    {allocation.om_destino_recurso} ({formatCodug(allocation.ug_destino_recurso)})
                                </span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">ND 33.90.30 (Material):</span>
                                <span className="font-medium text-green-600">{formatCurrency(allocation.nd_30_value)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">ND 33.90.39 (Serviço):</span>
                                <span className="font-medium text-blue-600">{formatCurrency(allocation.nd_39_value)}</span>
                            </div>
                            {isDirty && (
                                <Alert variant="destructive" className="mt-2 p-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle className="text-xs font-semibold">Valores Desatualizados</AlertTitle>
                                    <AlertDescription className="text-xs">
                                        A quantidade de itens, a alocação de ND ou a OM de destino foi alterada. Clique em "Salvar Itens da Categoria" na aba "{categoria}" para atualizar.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
                
                <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20 mt-4">
                  <span className="font-bold text-base text-primary">VALOR TOTAL DA OM</span>
                  <span className="font-extrabold text-xl text-primary">
                    {formatCurrency(valorTotalForm)}
                  </span>
                </div>
                
                <div className="flex gap-3 pt-4 justify-end">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={resetFormFields}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Limpar Formulário
                  </Button>
                  <Button 
                    type="button" 
                    onClick={handleSalvarRegistros} 
                    disabled={loading || !form.organizacao || valorTotalForm === 0 || !isTotalAlocadoCorrect}
                  >
                    {loading ? "Aguarde..." : "Salvar Registros"}
                  </Button>
                </div>
              </div>
            )}

            {/* 4. Registros Salvos (OMs Cadastradas) - SUMMARY SECTION */}
            {allRegistros.length > 0 && (
              <div className="space-y-4 mt-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-accent" />
                      OMs Cadastradas
                    </h2>
                </div>
                
                {/* Agrupamento por OM Detentora */}
                {Object.entries(registrosAgrupadosPorOM).map(([omKey, omRegistros]) => {
                    // Calcula o total para a OM Detentora (somando Saúde e Remonta)
                    const totalOM = omRegistros.reduce((sum, r) => sum + r.valor_total, 0);
                    const omName = omKey.split(' (')[0];
                    const ug = omKey.split(' (')[1].replace(')', '');
                    
                    return (
                        <Card key={omKey} className="p-4 bg-primary/5 border-primary/20">
                            <div className="flex items-center justify-between mb-3 border-b pb-2">
                                <h3 className="font-bold text-lg text-primary">
                                    OM Detentora: {omName} (UG: {formatCodug(ug)})
                                </h3>
                                <span className="font-extrabold text-xl text-primary">
                                    {formatCurrency(totalOM)}
                                </span>
                            </div>
                            
                            <div className="space-y-3">
                                {omRegistros.map((registro) => {
                                    const totalCategoria = registro.valor_total;
                                    const fases = formatFasesParaTexto(registro.fase_atividade);
                                    const isSaude = registro.categoria === 'Saúde';
                                    
                                    let badgeStyle;
                                    if (isSaude) {
                                        badgeStyle = { label: 'Saúde', className: 'bg-red-500 text-white' };
                                    } else {
                                        badgeStyle = getAnimalBadgeStyle(registro.animal_tipo || 'Equino');
                                    }
                                    
                                    // Verifica se a OM Detentora é diferente da OM de Destino
                                    const isDifferentOmRegistro = registro.om_detentora !== registro.organizacao;
                                    
                                    return (
                                        <Card key={registro.id} className="p-3 bg-background border">
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-semibold text-base text-foreground">
                                                            {isSaude ? 'Saúde' : 'Remonta/Veterinária'}
                                                        </h4>
                                                        <Badge variant="default" className={cn("w-fit shrink-0", badgeStyle.className)}>
                                                            {badgeStyle.label}
                                                        </Badge>
                                                        <Badge variant="outline" className="text-xs font-semibold">
                                                            {fases}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        Dias: {registro.dias_operacao}
                                                    </p>
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-lg text-primary/80">
                                                        {formatCurrency(totalCategoria)}
                                                    </span>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => handleEditarRegistro(registro)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDeletarRegistro(registro)}
                                                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Detalhes da Alocação */}
                                            <div className="pt-2 border-t mt-2">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-muted-foreground">OM Destino Recurso:</span>
                                                    <span className={cn("font-medium", isDifferentOmRegistro ? "text-red-600 font-bold" : "text-foreground")}>
                                                        {registro.organizacao} ({formatCodug(registro.ug)})
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-muted-foreground">ND 33.90.30 (Material):</span>
                                                    <span className="font-medium text-green-600">{formatCurrency(registro.valor_nd_30)}</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-muted-foreground">ND 33.90.39 (Serviço):</span>
                                                    <span className="font-medium text-blue-600">{formatCurrency(registro.valor_nd_39)}</span>
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        </Card>
                    );
                })}
              </div>
            )}

            {/* 5. Memórias de Cálculos Detalhadas */}
            {allRegistros.length > 0 && (
              <div className="space-y-4 mt-8">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  📋 Memórias de Cálculos Detalhadas
                </h3>
                
                {/* Iterar sobre os grupos ordenados */}
                {Object.entries(registrosAgrupadosPorOM).flatMap(([omKey, omRegistros]) => (
                    // Iterar sobre os registros dentro de cada grupo (OM Detentora)
                    omRegistros.map(registro => {
                        const omDetentora = registro.om_detentora;
                        const ugDetentora = registro.ug_detentora;
                        const isEditing = editingMemoriaId === registro.id;
                        const hasCustomMemoria = !!registro.detalhamento_customizado;
                        const isSaude = registro.categoria === 'Saúde';
                        
                        // Verifica se a OM Detentora é diferente da OM de Destino
                        const isDifferentOm = omDetentora !== registro.organizacao;
                        
                        const itensParaMemoria = isSaude ? registro.itens_saude as ItemSaude[] : registro.itens_remonta as ItemRemonta[];
                        
                        const memoriaAutomatica = generateCategoryMemoriaCalculo(
                            registro.categoria as Categoria, 
                            itensParaMemoria as ItemClasseVIII[], 
                            registro.dias_operacao, 
                            omDetentora, 
                            ugDetentora, 
                            registro.fase_atividade || '', 
                            0, 
                            registro.valor_nd_30, 
                            registro.valor_nd_39,
                            registro.animal_tipo
                        );
                        
                        const memoriaExibida = isEditing ? memoriaEdit : (registro.detalhamento_customizado || memoriaAutomatica);
                        
                        let badgeStyle;
                        if (isSaude) {
                            badgeStyle = { label: 'Saúde', className: 'bg-red-500 text-white' };
                        } else {
                            badgeStyle = getAnimalBadgeStyle(registro.animal_tipo || 'Equino');
                        }
                        
                        return (
                            <div key={`memoria-view-${registro.id}`} className="space-y-4 border p-4 rounded-lg bg-muted/30">
                                
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-base font-semibold text-foreground">
                                                OM Detentora: {omDetentora} (UG: {formatCodug(ugDetentora)})
                                            </h4>
                                            <Badge variant="default" className={cn("w-fit shrink-0", badgeStyle.className)}>
                                                {badgeStyle.label}
                                            </Badge>
                                            {hasCustomMemoria && !isEditing && (
                                                <Badge variant="outline" className="text-xs">
                                                    Editada manualmente
                                                </Badge>
                                            )}
                                        </div>
                                        {isDifferentOm ? (
                                            <div className="flex items-center gap-1 mt-1">
                                                <AlertCircle className="h-4 w-4 text-red-600" />
                                                <span className="text-sm font-medium text-red-600">
                                                    Recurso destinado à OM: {registro.organizacao} ({formatCodug(registro.ug)})
                                                </span>
                                            </div>
                                        ) : null}
                                    </div>
                                    
                                    <div className="flex items-center justify-end gap-2 shrink-0">
                                        
                                        {!isEditing ? (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleIniciarEdicaoMemoria(registro)}
                                                    disabled={loading}
                                                    className="gap-2"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                    Editar Memória
                                                </Button>
                                                
                                                {hasCustomMemoria && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleRestaurarMemoriaAutomatica(registro)}
                                                        disabled={loading}
                                                        className="gap-2 text-muted-foreground"
                                                    >
                                                        <XCircle className="h-4 w-4" />
                                                        Restaurar Automática
                                                    </Button>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="default"
                                                    onClick={() => handleSalvarMemoriaCustomizada(registro)}
                                                    disabled={loading}
                                                    className="gap-2"
                                                >
                                                    <Check className="h-4 w-4" />
                                                    Salvar
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={handleCancelarEdicaoMemoria}
                                                    disabled={loading}
                                                    className="gap-2"
                                                >
                                                    <XCircle className="h-4 w-4" />
                                                    Cancelar
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                
                                <Card className="p-4 bg-background rounded-lg border">
                                    {isEditing ? (
                                        <Textarea
                                            value={memoriaEdit}
                                            onChange={(e) => setMemoriaEdit(e.target.value)}
                                            className="min-h-[300px] font-mono text-sm"
                                            placeholder="Digite a memória de cálculo..."
                                        />
                                    ) : (
                                        <pre className="text-sm font-mono whitespace-pre-wrap text-foreground">
                                            {memoriaExibida}
                                        </pre>
                                    )}
                                </Card>
                            </div>
                        );
                    })
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ClasseVIIIForm;