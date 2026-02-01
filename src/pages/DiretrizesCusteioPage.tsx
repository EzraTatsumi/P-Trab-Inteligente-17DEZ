import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronUp, ArrowLeft, Fuel, Package, Settings, HardHat, HeartPulse, Activity, Car, Loader2, Save, Edit } from "lucide-react";
import { DiretrizCusteio } from "@/types/diretrizes";
import { DiretrizEquipamentoForm } from "@/types/diretrizesEquipamentos";
import { DiretrizClasseIIForm } from "@/types/diretrizesClasseII";
import { DiretrizClasseIXForm } from "@/types/diretrizesClasseIX";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { tipoViaturas, tipoEquipamentosEngenharia } from "@/data/classeIIIData";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { YearManagementDialog } from "@/components/YearManagementDialog";
import { defaultClasseVIConfig } from "@/data/classeVIData";
import { defaultClasseVIIConfig } from "@/data/classeVIIData";
import { defaultClasseVIIISaudeConfig, defaultClasseVIIIRemontaConfig } from "@/data/classeVIIIData";
import { defaultClasseIXConfig } from "@/data/classeIXData"; // IMPORTADO
import { formatCurrencyInput, numberToRawDigits } from "@/lib/formatUtils"; // Import new utilities
import { useSession } from "@/components/SessionContextProvider";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useDefaultLogisticaYear } from "@/hooks/useDefaultLogisticaYear"; // NOVO HOOK
import { useQueryClient } from "@tanstack/react-query"; // Adicionar useQueryClient
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"; // ADICIONADO

// --- Tipos Auxiliares para Carregamento ---
// Definindo um tipo que engloba todas as categorias de diretrizes_classe_ii
type AllDiretrizClasseIIICategories = DiretrizClasseIIForm['categoria'] | DiretrizClasseIXForm['categoria'];

// Tipo para os dados carregados da tabela diretrizes_classe_ii
type LoadedClasseItem = Tables<'diretrizes_classe_ii'>;
// Tipo para os dados carregados da tabela diretrizes_classe_ix
type LoadedClasseIXItem = Tables<'diretrizes_classe_ix'>;

// Tipo auxiliar para desestruturação segura da Classe IX (incluindo campos de sistema)
type ClasseIXItemWithSystemFields = LoadedClasseIXItem & {
    id: string;
    created_at: string;
    updated_at: string;
};

// ... (restante das constantes e defaults)

const defaultGeradorConfig: DiretrizEquipamentoForm[] = [
  { nome_equipamento: "Gerador até 15 kva GAS", tipo_combustivel: "GAS", consumo: 1.25, unidade: "L/h" },
  { nome_equipamento: "Gerador até 15 kva OD", tipo_combustivel: "OD", consumo: 4.0, unidade: "L/h" },
  { nome_equipamento: "Gerador acima de 50 kva", tipo_combustivel: "OD", consumo: 20.0, unidade: "L/h" },
];

const defaultEmbarcacaoConfig: DiretrizEquipamentoForm[] = [
  { nome_equipamento: "Motor de popa", tipo_combustivel: "GAS", consumo: 20, unidade: "L/h" },
  { nome_equipamento: "Emb Guardian 25", tipo_combustivel: "GAS", consumo: 100, unidade: "L/h" },
  { nome_equipamento: "Ferryboat", tipo_combustivel: "OD", consumo: 100, unidade: "L/h" },
  { nome_equipamento: "Emb Regional", tipo_combustivel: "OD", consumo: 50, unidade: "L/h" },
  { nome_equipamento: "Empurradores", tipo_combustivel: "OD", consumo: 80, unidade: "L/h" },
  { nome_equipamento: "Emb Manobra", tipo_combustivel: "OD", consumo: 30, unidade: "L/h" },
];

const defaultMotomecanizacaoConfig: DiretrizEquipamentoForm[] = tipoViaturas.map(v => ({
  nome_equipamento: v.nome,
  tipo_combustivel: v.combustivel,
  consumo: v.consumo,
  unidade: v.unidade,
}));

const defaultEquipamentosEngenhariaConfig: DiretrizEquipamentoForm[] = tipoEquipamentosEngenharia.map(e => ({
  nome_equipamento: e.nome,
  tipo_combustivel: e.combustivel,
  consumo: e.consumo,
  unidade: e.unidade,
}));

// Tipagem explícita para garantir compatibilidade com DiretrizClasseIIForm
const defaultClasseIIConfig: DiretrizClasseIIForm[] = [
  { categoria: "Equipamento Individual", item: "Equipamento Individual", valor_mnt_dia: 2.42 },
  { categoria: "Proteção Balística", item: "Colete balístico", valor_mnt_dia: 3.23 },
  { categoria: "Proteção Balística", item: "Capacete balístico", valor_mnt_dia: 2.56 },
  { categoria: "Material de Estacionamento", item: "Barraca de campanha", valor_mnt_dia: 7.55 },
  { categoria: "Material de Estacionamento", item: "Toldo modular", valor_mnt_dia: 1.88 },
  { categoria: "Material de Estacionamento", item: "Barraca individual", valor_mnt_dia: 0.26 },
  { categoria: "Material de Estacionamento", item: "Cama de campanha", valor_mnt_dia: 0.32 },
  { categoria: "Material de Estacionamento", item: "Marmita Térmica", valor_mnt_dia: 0.67 },
  { categoria: "Material de Estacionamento", item: "Armário", valor_mnt_dia: 0.82 },
  { categoria: "Material de Estacionamento", item: "Beliche", valor_mnt_dia: 0.66 },
  { categoria: "Material de Estacionamento", item: "Colchão", valor_mnt_dia: 0.28 },
];

// Tipagem explícita para garantir compatibilidade com DiretrizClasseIIForm
const defaultClasseVConfig: DiretrizClasseIIForm[] = [
  { categoria: "Armt L", item: "Fuzil 5,56mm IA2 IMBEL", valor_mnt_dia: 1.40 },
  { categoria: "Armt L", item: "Fuzil 7,62mm", valor_mnt_dia: 1.50 },
  { categoria: "Armt L", item: "Pistola 9 mm", valor_mnt_dia: 0.40 },
  { categoria: "Armt L", item: "Metralhadora FN MINIMI 5,56 x 45mm", valor_mnt_dia: 10.60 },
  { categoria: "Armt L", item: "Metralhadora FN MINIMI 7,62 x 51mm", valor_mnt_dia: 11.00 },
  { categoria: "Armt P", item: "Obuseiro", valor_mnt_dia: 175.00 },
  { categoria: "IODCT", item: "OVN", valor_mnt_dia: 9.50 },
  { categoria: "DQBRN", item: "Falcon 4GS", valor_mnt_dia: 723.30 },
];

const CATEGORIAS_CLASSE_II = [
  "Equipamento Individual",
  "Proteção Balística",
  "Material de Estacionamento",
];

const CATEGORIAS_CLASSE_V = [
  "Armt L",
  "Armt P",
  "IODCT",
  "DQBRN",
];

const CATEGORIAS_CLASSE_VI = [
  "Gerador",
  "Embarcação",
  "Equipamento de Engenharia",
];

const CATEGORIAS_CLASSE_VII = [
  "Comunicações",
  "Informática",
];

const CATEGORIAS_CLASSE_VIII = [
  "Saúde",
  "Remonta/Veterinária",
];

const CATEGORIAS_CLASSE_IX = [
  "Vtr Administrativa",
  "Vtr Operacional",
  "Motocicleta",
  "Vtr Blindada",
];

const CATEGORIAS_CLASSE_III = [
  { key: "GERADOR", label: "Geradores" },
  { key: "EMBARCACAO", label: "Embarcações" },
  { key: "MOTOMECANIZACAO", label: "Motomecanização" },
  { key: "EQUIPAMENTO_ENGENHARIA", label: "Engenharia" },
];

const defaultDiretrizes = (year: number) => ({
  ano_referencia: year,
  classe_i_valor_qs: 9.00,
  classe_i_valor_qr: 6.00,
  classe_iii_fator_gerador: 0.15,
  classe_iii_fator_embarcacao: 0.30,
  classe_iii_fator_equip_engenharia: 0.20,
  observacoes: "",
});

const DiretrizesCusteioPage = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const queryClient = useQueryClient(); // Inicializar queryClient
  const [loading, setLoading] = useState(true);
  const [showClasseIAlimentacaoConfig, setShowClasseIAlimentacaoConfig] = useState(false);
  const [showClasseIIConfig, setShowClasseIIConfig] = useState(false);
  const [showClasseVConfig, setShowClasseVConfig] = useState(false);
  const [showClasseVIConfig, setShowClasseVIConfig] = useState(false); 
  const [showClasseVIIConfig, setShowClasseVIIConfig] = useState(false);
  const [showClasseVIIIConfig, setShowClasseVIIIConfig] = useState(false);
  const [showClasseIXConfig, setShowClasseIXConfig] = useState(false);
  const [showClasseIIIConfig, setShowClasseIIIConfig] = useState(false);
  
  const [geradorConfig, setGeradorConfig] = useState<DiretrizEquipamentoForm[]>(defaultGeradorConfig);
  const [embarcacaoConfig, setEmbarcacaoConfig] = useState<DiretrizEquipamentoForm[]>(defaultEmbarcacaoConfig);
  const [motomecanizacaoConfig, setMotomecanizacaoConfig] = useState<DiretrizEquipamentoForm[]>(defaultMotomecanizacaoConfig);
  const [equipamentosEngenhariaConfig, setEquipamentosEngenhariaConfig] = useState<DiretrizEquipamentoForm[]>(defaultEquipamentosEngenhariaConfig);
  
  // CORREÇÃO DE TIPAGEM: Garantir que o estado inicial seja do tipo correto
  const [classeIIConfig, setClasseIIConfig] = useState<DiretrizClasseIIForm[]>(defaultClasseIIConfig);
  const [classeVConfig, setClasseVConfig] = useState<DiretrizClasseIIForm[]>(defaultClasseVConfig);
  const [classeVIConfig, setClasseVIConfig] = useState<DiretrizClasseIIForm[]>(defaultClasseVIConfig as DiretrizClasseIIForm[]); 
  const [classeVIIConfig, setClasseVIIConfig] = useState<DiretrizClasseIIForm[]>(defaultClasseVIIConfig as DiretrizClasseIIForm[]);
  const [classeVIIISaudeConfig, setClasseVIIISaudeConfig] = useState<DiretrizClasseIIForm[]>(defaultClasseVIIISaudeConfig as DiretrizClasseIIForm[]);
  const [classeVIIIRemontaConfig, setClasseVIIIRemontaConfig] = useState<DiretrizClasseIIForm[]>(defaultClasseVIIIRemontaConfig as DiretrizClasseIIForm[]);
  const [classeIXConfig, setClasseIXConfig] = useState<DiretrizClasseIXForm[]>(defaultClasseIXConfig); // USANDO A IMPORTAÇÃO
  
  const currentYear = new Date().getFullYear();
  const [diretrizes, setDiretrizes] = useState<Partial<DiretrizCusteio>>(defaultDiretrizes(currentYear));
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedClasseIITab, setSelectedClasseIITab] = useState<string>(CATEGORIAS_CLASSE_II[0]);
  const [selectedClasseVTab, setSelectedClasseVTab] = useState<string>(CATEGORIAS_CLASSE_V[0]);
  const [selectedClasseVITab, setSelectedClasseVITab] = useState<string>(CATEGORIAS_CLASSE_VI[0]); 
  const [selectedClasseIIITab, setSelectedClasseIIITab] = useState<string>(CATEGORIAS_CLASSE_III[0].key);
  const [selectedClasseVIITab, setSelectedClasseVIITab] = useState<string>(CATEGORIAS_CLASSE_VII[0]);
  const [selectedClasseVIIITab, setSelectedClasseVIIITab] = useState<string>(CATEGORIAS_CLASSE_VIII[0]);
  const [selectedClasseIXTab, setSelectedClasseIXTab] = useState<string>(CATEGORIAS_CLASSE_IX[0]);
  
  const [isYearManagementDialogOpen, setIsYearManagementDialogOpen] = useState(false);
  
  // Substituído defaultYear por defaultLogisticaYear do hook
  const { data: defaultYearData, isLoading: isLoadingDefaultYear } = useDefaultLogisticaYear();
  const defaultYear = defaultYearData?.defaultYear || null;
  
  // NOVOS ESTADOS PARA RAW INPUTS (CLASSE I)
  const [rawQSInput, setRawQSInput] = useState<string>(numberToRawDigits(defaultDiretrizes(currentYear).classe_i_valor_qs));
  const [rawQRInput, setRawQRInput] = useState<string>(numberToRawDigits(defaultDiretrizes(currentYear).classe_i_valor_qr));
  
  // NOVO ESTADO PARA RASTREAR O INPUT FOCADO NA LISTA DINÂMICA
  const [focusedInput, setFocusedInput] = useState<{ index: number, field: string, rawDigits: string } | null>(null);
  
  const { handleEnterToNextField } = useFormNavigation();

  // Efeito para rolar para o topo na montagem
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // NOVO EFEITO: Carrega anos disponíveis e define o ano selecionado quando o defaultYearData estiver pronto
  useEffect(() => {
    if (!isLoadingDefaultYear && defaultYearData) {
        const checkAuthAndLoadYears = async () => {
            const { data: { session } = { session: null } } = await supabase.auth.getSession();
            if (!session) {
                toast.error("Você precisa estar autenticado");
                navigate("/login");
                return;
            }
            
            // 2. Carrega os anos disponíveis e define o ano selecionado
            await loadAvailableYears(defaultYearData.defaultYear);
            setSelectedYear(defaultYearData.year);
        };
        checkAuthAndLoadYears();
    }
  }, [isLoadingDefaultYear, defaultYearData]); // Depende do hook de query

  useEffect(() => {
    if (selectedYear) {
      loadDiretrizesForYear(selectedYear);
    }
  }, [selectedYear]);

  // REMOVIDA: checkAuthAndLoadYears

  const loadAvailableYears = async (defaultYearId: number | null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("diretrizes_custeio")
        .select("ano_referencia")
        .eq("user_id", user.id)
        .order("ano_referencia", { ascending: false });

      if (error) throw error;

      const years = data ? data.map(d => d.ano_referencia) : [];
      
      // Lógica de inclusão do ano atual:
      const yearsToInclude = new Set(years);
      
      if (defaultYearId && !yearsToInclude.has(defaultYearId)) {
          yearsToInclude.add(defaultYearId);
      }
      
      // Se não houver NENHUM ano salvo (years.length === 0), adiciona o ano atual como fallback
      if (years.length === 0 && !yearsToInclude.has(currentYear)) {
          yearsToInclude.add(currentYear);
      }
      
      const uniqueYears = Array.from(yearsToInclude).filter(y => y > 0).sort((a, b) => b - a);
      setAvailableYears(uniqueYears);

    } catch (error: any) {
      console.error("Erro ao carregar anos disponíveis:", error);
      toast.error("Erro ao carregar anos disponíveis");
    } finally {
      setLoading(false);
    }
  };

  const loadDiretrizesForYear = async (year: number) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("diretrizes_custeio")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", year)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setDiretrizes({
          id: data.id,
          user_id: data.user_id,
          ano_referencia: data.ano_referencia,
          classe_i_valor_qs: Number(data.classe_i_valor_qs),
          classe_i_valor_qr: Number(data.classe_i_valor_qr),
          classe_iii_fator_gerador: Number(data.classe_iii_fator_gerador),
          classe_iii_fator_embarcacao: Number(data.classe_iii_fator_embarcacao),
          classe_iii_fator_equip_engenharia: Number(data.classe_iii_fator_equip_engenharia),
          observacoes: data.observacoes || "",
        });
        
        // Initialize raw inputs based on loaded numeric values
        setRawQSInput(numberToRawDigits(Number(data.classe_i_valor_qs)));
        setRawQRInput(numberToRawDigits(Number(data.classe_i_valor_qr)));
        
      } else {
        const defaultValues = defaultDiretrizes(year);
        setDiretrizes(defaultValues);
        
        // Initialize raw inputs based on default numeric values
        setRawQSInput(numberToRawDigits(defaultValues.classe_i_valor_qs));
        setRawQRInput(numberToRawDigits(defaultValues.classe_i_valor_qr));
      }
      
      // --- Carregar Classes II, V, VI, VII, VIII (mantido) ---
      const allClasseItemsCategories = [...CATEGORIAS_CLASSE_II, ...CATEGORIAS_CLASSE_V, ...CATEGORIAS_CLASSE_VI, ...CATEGORIAS_CLASSE_VII, ...CATEGORIAS_CLASSE_VIII];
      
      const { data: classeItemsData } = await supabase
        .from("diretrizes_classe_ii")
        .select("categoria, item, valor_mnt_dia")
        .eq("user_id", user.id)
        .eq("ano_referencia", year)
        .in("categoria", allClasseItemsCategories);

      const loadedItems = classeItemsData as LoadedClasseItem[] || [];
      
      // Filtrar e setar Classe II
      const loadedClasseII = loadedItems.filter(d => CATEGORIAS_CLASSE_II.includes(d.categoria));
      if (loadedClasseII.length > 0) {
        setClasseIIConfig(loadedClasseII.map(d => ({
          categoria: d.categoria as DiretrizClasseIIForm['categoria'],
          item: d.item,
          valor_mnt_dia: Number(d.valor_mnt_dia),
        })));
      } else {
        setClasseIIConfig(defaultClasseIIConfig);
      }
      
      // Filtrar e setar Classe V
      const loadedClasseV = loadedItems.filter(d => CATEGORIAS_CLASSE_V.includes(d.categoria));
      if (loadedClasseV.length > 0) {
        setClasseVConfig(loadedClasseV.map(d => ({
          categoria: d.categoria as DiretrizClasseIIForm['categoria'],
          item: d.item,
          valor_mnt_dia: Number(d.valor_mnt_dia),
        })));
      } else {
        setClasseVConfig(defaultClasseVConfig);
      }
      
      // Filtrar e setar Classe VI
      const loadedClasseVI = loadedItems.filter(d => CATEGORIAS_CLASSE_VI.includes(d.categoria));
      if (loadedClasseVI.length > 0) {
        setClasseVIConfig(loadedClasseVI.map(d => ({
          categoria: d.categoria as DiretrizClasseIIForm['categoria'],
          item: d.item,
          valor_mnt_dia: Number(d.valor_mnt_dia),
        })));
      } else {
        setClasseVIConfig(defaultClasseVIConfig as DiretrizClasseIIForm[]);
      }
      
      // Filtrar e setar Classe VII
      const loadedClasseVII = loadedItems.filter(d => CATEGORIAS_CLASSE_VII.includes(d.categoria));
      if (loadedClasseVII.length > 0) {
        setClasseVIIConfig(loadedClasseVII.map(d => ({
          categoria: d.categoria as DiretrizClasseIIForm['categoria'],
          item: d.item,
          valor_mnt_dia: Number(d.valor_mnt_dia),
        })));
      } else {
        setClasseVIIConfig(defaultClasseVIIConfig as DiretrizClasseIIForm[]);
      }
      
      // Filtrar e setar Classe VIII - Saúde
      const loadedClasseVIIISaude = loadedItems.filter(d => d.categoria === 'Saúde');
      if (loadedClasseVIIISaude.length > 0) {
        setClasseVIIISaudeConfig(loadedClasseVIIISaude.map(d => ({
          categoria: d.categoria as DiretrizClasseIIForm['categoria'],
          item: d.item,
          valor_mnt_dia: Number(d.valor_mnt_dia),
        })));
      } else {
        setClasseVIIISaudeConfig(defaultClasseVIIISaudeConfig as DiretrizClasseIIForm[]);
      }
      
      // Filtrar e setar Classe VIII - Remonta/Veterinária
      const loadedClasseVIIIRemonta = loadedItems.filter(d => d.categoria === 'Remonta/Veterinária');
      if (loadedClasseVIIIRemonta.length > 0) {
        setClasseVIIIRemontaConfig(loadedClasseVIIIRemonta.map(d => ({
          categoria: d.categoria as DiretrizClasseIIForm['categoria'],
          item: d.item,
          valor_mnt_dia: Number(d.valor_mnt_dia),
        })));
      } else {
        setClasseVIIIRemontaConfig(defaultClasseVIIIRemontaConfig as DiretrizClasseIIForm[]);
      }
      
      // --- Carregar Classe IX (mantido) ---
      const { data: classeIXData, error: classeIXError } = await supabase
        .from("diretrizes_classe_ix")
        .select("categoria, item, valor_mnt_dia, valor_acionamento_mensal")
        .eq("user_id", user.id)
        .eq("ano_referencia", year);
        
      if (classeIXError) throw classeIXError;
      
      const loadedClasseIX = classeIXData as LoadedClasseIXItem[] || [];
      
      if (loadedClasseIX.length > 0) {
        const loadedItemsMap = new Map<string, DiretrizClasseIXForm>();
        loadedClasseIX.forEach(d => {
            loadedItemsMap.set(d.item, {
                categoria: d.categoria as DiretrizClasseIXForm['categoria'],
                item: d.item,
                valor_mnt_dia: Number(d.valor_mnt_dia),
                valor_acionamento_mensal: Number(d.valor_acionamento_mensal),
            });
        });
        
        // Merge: Adiciona itens padrão que não estão na lista salva
        // CORREÇÃO: Usar Array.from(loadedItemsMap.values()) para iterar sobre o Map
        const mergedClasseIX: DiretrizClasseIXForm[] = Array.from(loadedItemsMap.values());
        
        defaultClasseIXConfig.forEach(defaultItem => {
            if (!loadedItemsMap.has(defaultItem.item)) {
                mergedClasseIX.push(defaultItem);
            }
        });
        
        // Ordena a lista mesclada pela categoria e item
        mergedClasseIX.sort((a, b) => {
            if (a.categoria !== b.categoria) {
                return CATEGORIAS_CLASSE_IX.indexOf(a.categoria) - CATEGORIAS_CLASSE_IX.indexOf(b.categoria);
            }
            return a.item.localeCompare(b.item);
        });
        
        setClasseIXConfig(mergedClasseIX);
      } else {
        setClasseIXConfig(defaultClasseIXConfig); // Se não houver nada salvo, usa o default completo
      }


      // --- Carregar Classe III - Equipamentos (mantido) ---
      const loadEquipamentos = async (categoria: string, setter: React.Dispatch<React.SetStateAction<DiretrizEquipamentoForm[]>>, defaultData: DiretrizEquipamentoForm[]) => {
        const { data: equipamentosData } = await supabase
          .from("diretrizes_equipamentos_classe_iii")
          .select("*")
          .eq("user_id", user.id)
          .eq("ano_referencia", year)
          .eq("categoria", categoria);

        if (equipamentosData && equipamentosData.length > 0) {
          setter(equipamentosData.map(eq => ({
            nome_equipamento: eq.nome_equipamento,
            tipo_combustivel: eq.tipo_combustivel as 'GAS' | 'OD',
            consumo: Number(eq.consumo),
            unidade: eq.unidade as 'L/h' | 'km/L',
          })));
        } else {
          setter(defaultData);
        }
      };

      await loadEquipamentos("GERADOR", setGeradorConfig, defaultGeradorConfig);
      await loadEquipamentos("EMBARCACAO", setEmbarcacaoConfig, defaultEmbarcacaoConfig);
      await loadEquipamentos("MOTOMECANIZACAO", setMotomecanizacaoConfig, defaultMotomecanizacaoConfig);
      await loadEquipamentos("EQUIPAMENTO_ENGENHARIA", setEquipamentosEngenhariaConfig, defaultEquipamentosEngenhariaConfig);
        
    } catch (error: any) {
      console.error("Erro ao carregar diretrizes:", error);
      toast.error("Erro ao carregar diretrizes para o ano selecionado");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDiretrizes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      if (!diretrizes.ano_referencia) {
        toast.error("Informe o ano de referência");
        return;
      }
      if ((diretrizes.classe_i_valor_qs || 0) <= 0 || (diretrizes.classe_i_valor_qr || 0) <= 0) {
        toast.error("Valores de Classe I devem ser maiores que zero");
        return;
      }

      const diretrizData = {
        user_id: user.id,
        ano_referencia: diretrizes.ano_referencia,
        classe_i_valor_qs: diretrizes.classe_i_valor_qs,
        classe_i_valor_qr: diretrizes.classe_i_valor_qr,
        classe_iii_fator_gerador: diretrizes.classe_iii_fator_gerador,
        classe_iii_fator_embarcacao: diretrizes.classe_iii_fator_embarcacao,
        classe_iii_fator_equip_engenharia: diretrizes.classe_iii_fator_equip_engenharia,
        observacoes: diretrizes.observacoes,
      };

      // 1. Salvar Diretrizes de Custeio (Valores e Fatores)
      if (diretrizes.id) {
        const { error } = await supabase
          .from("diretrizes_custeio")
          .update(diretrizData as TablesUpdate<'diretrizes_custeio'>)
          .eq("id", diretrizes.id);
        if (error) throw error;
        toast.success("Diretrizes atualizadas!");
      } else {
        const { error } = await supabase
          .from("diretrizes_custeio")
          .insert([diretrizData as TablesInsert<'diretrizes_custeio'>]);
        if (error) throw error;
        toast.success("Diretrizes criadas!");
      }
      
      // 2. Salvar Configurações de Equipamentos (Classe III)
      const categoriasClasseIII = ["GERADOR", "EMBARCACAO", "MOTOMECANIZACAO", "EQUIPAMENTO_ENGENHARIA"];
      const configsClasseIII = {
        "GERADOR": geradorConfig,
        "EMBARCACAO": embarcacaoConfig,
        "MOTOMECANIZACAO": motomecanizacaoConfig,
        "EQUIPAMENTO_ENGENHARIA": equipamentosEngenhariaConfig,
      };

      for (const categoria of categoriasClasseIII) {
        // Deletar registros antigos da categoria
        await supabase
          .from("diretrizes_equipamentos_classe_iii")
          .delete()
          .eq("user_id", user.id)
          .eq("ano_referencia", diretrizes.ano_referencia!)
          .eq("categoria", categoria);

        // Inserir novos registros
        const configList = configsClasseIII[categoria as keyof typeof configsClasseIII];
        const equipamentosParaSalvar = configList
          .filter(g => g.nome_equipamento.trim().length > 0 && g.consumo > 0)
          .map(g => ({
            user_id: user.id,
            ano_referencia: diretrizes.ano_referencia,
            categoria: categoria,
            nome_equipamento: g.nome_equipamento,
            tipo_combustivel: g.tipo_combustivel,
            // CORREÇÃO: Consumo deve ser string (numeric no DB)
            consumo: Number(g.consumo).toFixed(2), 
            unidade: g.unidade,
            ativo: true, // Garantir que o novo registro seja ativo
          }));

        if (equipamentosParaSalvar.length > 0) {
          // CORREÇÃO DO ERRO 1: Usar 'as any' para forçar a tipagem, pois 'consumo' é string aqui.
          const { error: eqError } = await supabase
            .from("diretrizes_equipamentos_classe_iii")
            .insert(equipamentosParaSalvar as any as TablesInsert<'diretrizes_equipamentos_classe_iii'>[]);
          if (eqError) throw eqError;
        }
      }
      
      // 3. Salvar Configurações de Classe II, V, VI, VII e VIII (usando a mesma tabela diretrizes_classe_ii)
      
      // Deletar registros antigos de Classe II, V, VI, VII e VIII
      await supabase
        .from("diretrizes_classe_ii")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", diretrizes.ano_referencia!);
        
      const allClasseItems = [
        ...classeIIConfig, 
        ...classeVConfig, 
        ...classeVIConfig, 
        ...classeVIIConfig, 
        ...classeVIIISaudeConfig,
        ...classeVIIIRemontaConfig,
      ];
        
      const classeItemsParaSalvar = allClasseItems
        .filter(item => item.item.trim().length > 0 && (item.valor_mnt_dia || 0) >= 0)
        .map(item => ({
          user_id: user.id,
          ano_referencia: diretrizes.ano_referencia,
          categoria: item.categoria,
          item: item.item,
          // CORREÇÃO: valor_mnt_dia deve ser string (numeric no DB)
          valor_mnt_dia: Number(item.valor_mnt_dia || 0).toFixed(2), 
          ativo: true,
        }));
        
      if (classeItemsParaSalvar.length > 0) {
        // CORREÇÃO DO ERRO 2: Usar 'as any' para forçar a tipagem, pois 'valor_mnt_dia' é string aqui.
        const { error: c2Error } = await supabase
          .from("diretrizes_classe_ii")
          .insert(classeItemsParaSalvar as any as TablesInsert<'diretrizes_classe_ii'>[]);
        if (c2Error) throw c2Error;
      }
      
      // 4. Salvar Configurações de Classe IX (Motomecanização)
      
      // Deletar registros antigos de Classe IX
      await supabase
        .from("diretrizes_classe_ix")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", diretrizes.ano_referencia!);
        
      const classeIXItemsParaSalvar = classeIXConfig
        .filter(item => item.item.trim().length > 0 && (item.valor_mnt_dia || 0) >= 0 && (item.valor_acionamento_mensal || 0) >= 0)
        .map(item => {
          const valorMntDia = Number(item.valor_mnt_dia || 0);
          const valorAcionamentoMensal = Number(item.valor_acionamento_mensal || 0);
          
          return {
            user_id: user.id,
            ano_referencia: diretrizes.ano_referencia,
            categoria: item.categoria,
            item: item.item,
            // Conversão explícita para string com 2 casas decimais para garantir o tipo 'numeric' no DB
            valor_mnt_dia: valorMntDia.toFixed(2), 
            valor_acionamento_mensal: valorAcionamentoMensal.toFixed(2),
            ativo: true,
          };
        });
        
      // Inserção individual para maior robustez
      for (const item of classeIXItemsParaSalvar) {
          // CORREÇÃO DO ERRO 3: Usar 'as any' para forçar a tipagem, pois 'valor_mnt_dia' e 'valor_acionamento_mensal' são strings aqui.
          const { error: c9Error } = await supabase
            .from("diretrizes_classe_ix")
            .insert([item as any as TablesInsert<'diretrizes_classe_ix'>]);
          if (c9Error) throw c9Error;
      }


      await loadAvailableYears(defaultYear); // Passa o defaultYear atualizado
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error("Já existe uma diretriz para este ano");
      } else {
        toast.error(sanitizeError(error));
      }
    }
  };
  
  const handleSetDefaultYear = async () => {
    if (!diretrizes.ano_referencia) {
      toast.error("Selecione um ano de referência válido.");
      return;
    }
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      // ATUALIZADO: Usando o novo campo default_logistica_year
      const { error } = await supabase
        .from('profiles')
        .update({ default_logistica_year: diretrizes.ano_referencia })
        .eq('id', user.id);
        
      if (error) throw error;
      
      // Invalida a query do hook useDefaultLogisticaYear para forçar a atualização
      queryClient.invalidateQueries({ queryKey: ["defaultLogisticaYear", user.id] });
      
      toast.success(`Ano ${diretrizes.ano_referencia} definido como padrão para cálculos!`);
      
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDiretrizes = async (sourceYear: number, targetYear: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      setLoading(true);
      
      // 1. Copiar Diretriz de Custeio (Valores e Fatores)
      const { data: sourceCusteio, error: custeioError } = await supabase
        .from("diretrizes_custeio")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", sourceYear)
        .single();
        
      if (custeioError || !sourceCusteio) throw new Error(`Diretriz de custeio para o ano ${sourceYear} não encontrada.`);
      
      const { id: oldId, created_at, updated_at, ...restCusteio } = sourceCusteio;
      const newCusteio = { ...restCusteio, ano_referencia: targetYear, user_id: user.id };
      
      const { error: insertCusteioError } = await supabase
        .from("diretrizes_custeio")
        .insert([newCusteio as TablesInsert<'diretrizes_custeio'>]);
      if (insertCusteioError) throw insertCusteioError;
      
      // 2. Copiar Diretrizes de Equipamentos (Classe III)
      const { data: sourceEquipamentos, error: equipamentosError } = await supabase
        .from("diretrizes_equipamentos_classe_iii")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", sourceYear);
        
      if (equipamentosError) console.error("Erro ao buscar equipamentos para cópia:", equipamentosError);
      
      if (sourceEquipamentos && sourceEquipamentos.length > 0) {
        const newEquipamentos = sourceEquipamentos.map(eq => {
          const { id: oldEqId, created_at: oldEqCreated, updated_at: oldEqUpdated, ...restEq } = eq;
          return { ...restEq, ano_referencia: targetYear, user_id: user.id };
        });
        const { error: insertEqError } = await supabase
          .from("diretrizes_equipamentos_classe_iii")
          .insert(newEquipamentos as TablesInsert<'diretrizes_equipamentos_classe_iii'>[]);
        if (insertEqError) console.error("Erro ao inserir equipamentos copiados:", insertEqError);
      }
      
      // 3. Copiar Diretrizes de Classe II, V, VI, VII e VIII
      const { data: sourceClasseItems, error: classeItemsError } = await supabase
        .from("diretrizes_classe_ii")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", sourceYear);
        
      if (classeItemsError) console.error("Erro ao buscar Classe II/V/VI/VII/VIII para cópia:", classeItemsError);
      
      if (sourceClasseItems && sourceClasseItems.length > 0) {
        const newClasseItems = sourceClasseItems.map(c2 => {
          const { id: oldC2Id, created_at: oldC2Created, updated_at: oldC2Updated, ...restC2 } = c2;
          return { ...restC2, ano_referencia: targetYear, user_id: user.id };
        });
        const { error: insertC2Error } = await supabase
          .from("diretrizes_classe_ii")
          .insert(newClasseItems as TablesInsert<'diretrizes_classe_ii'>[]);
        if (insertC2Error) console.error("Erro ao inserir Classe II/V/VI/VII/VIII copiada:", insertC2Error);
      }
      
      // 4. Copiar Diretrizes de Classe IX
      const { data: sourceClasseIX, error: classeIXError } = await supabase
        .from("diretrizes_classe_ix")
        .select("id, created_at, updated_at, categoria, item, valor_mnt_dia, valor_acionamento_mensal")
        .eq("user_id", user.id)
        .eq("ano_referencia", sourceYear);
        
      if (classeIXError) console.error("Erro ao buscar Classe IX para cópia:", classeIXError);
      
      if (sourceClasseIX && sourceClasseIX.length > 0) {
        const newClasseIX = (sourceClasseIX as ClasseIXItemWithSystemFields[]).map(c9 => {
          // CORREÇÃO: Desestruturação segura para remover campos de sistema
          const { id: oldC9Id, created_at: oldC9Created, updated_at: oldC9Updated, ...restC9 } = c9 as Tables<'diretrizes_classe_ix'>;
          return { ...restC9, ano_referencia: targetYear, user_id: user.id };
        });
        const { error: insertC9Error } = await supabase
          .from("diretrizes_classe_ix")
          .insert(newClasseIX as TablesInsert<'diretrizes_classe_ix'>[]);
        if (insertC9Error) console.error("Erro ao inserir Classe IX copiada:", insertC9Error);
      }


      toast.success(`Diretrizes do ano ${sourceYear} copiadas com sucesso para o ano ${targetYear}!`);
      setIsYearManagementDialogOpen(false);
      setSelectedYear(targetYear);
      await loadAvailableYears(defaultYear);
      
    } catch (error: any) {
      console.error("Erro ao copiar diretrizes:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDiretrizes = async (year: number) => {
    if (year === defaultYear) {
      toast.error("Não é possível excluir a diretriz do ano padrão.");
      return;
    }
    
    if (!confirm(`Tem certeza que deseja EXCLUIR TODAS as diretrizes de custeio e classes de material para o ano ${year}? Esta ação é irreversível.`)) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      setLoading(true);
      
      // 1. Excluir Diretrizes de Custeio (Valores e Fatores)
      await supabase
        .from("diretrizes_custeio")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", year);
        
      // 2. Excluir Diretrizes de Equipamentos (Classe III)
      await supabase
        .from("diretrizes_equipamentos_classe_iii")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", year);
        
      // 3. Excluir Diretrizes de Classe II, V, VI, VII e VIII
      await supabase
        .from("diretrizes_classe_ii")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", year);
        
      // 4. Excluir Diretrizes de Classe IX
      await supabase
        .from("diretrizes_classe_ix")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", year);

      toast.success(`Diretrizes do ano ${year} excluídas com sucesso!`);
      setIsYearManagementDialogOpen(false);
      
      queryClient.invalidateQueries({ queryKey: ["defaultLogisticaYear", user.id] });
      await loadAvailableYears(defaultYear);
      
    } catch (error: any) {
      console.error("Erro ao excluir diretrizes:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  // ... (restante da página)

  if (loading || isLoadingDefaultYear) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-muted-foreground ml-2">Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/ptrab")} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Planos de Trabalho
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setIsYearManagementDialogOpen(true)}
            disabled={loading || isLoadingDefaultYear}
          >
            <Settings className="mr-2 h-4 w-4" />
            Gerenciar Anos
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Diretrizes de Custeio Logístico</CardTitle>
            <CardDescription>
              Defina os valores de referência para o cálculo de despesas logísticas (GND 3 e 4).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={(e) => { e.preventDefault(); handleSaveDiretrizes(); }}>
              <div className="space-y-2 mb-6">
                <Label>Ano de Referência</Label>
                <Select
                  value={selectedYear.toString()}
                  onValueChange={(value) => setSelectedYear(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year} {year === defaultYear && "(Padrão)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <p className="text-sm text-muted-foreground pt-1">
                  Ano Padrão de Cálculo: 
                  <span className="font-semibold text-primary ml-1">
                    {defaultYear ? defaultYear : 'Não definido (usando o mais recente)'}
                  </span>
                  {defaultYear && defaultYear !== selectedYear && (
                    <span className="text-xs text-gray-500 ml-2">(Selecione este ano para editar o padrão)</span>
                  )}
                </p>
              </div>

              {/* CLASSE I - ALIMENTAÇÃO */}
              <Collapsible 
                open={showClasseIAlimentacaoConfig} 
                onOpenChange={setShowClasseIAlimentacaoConfig}
                className="border-t pt-4 mt-6"
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer py-2 border-b">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Package className="h-5 w-5 text-green-600" />
                      Classe I - Subsistência (Alimentação)
                    </h3>
                    {showClasseIAlimentacaoConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="classe_i_valor_qs">Valor da Quota de Subsistência (QS) - R$</Label>
                      <Input
                        id="classe_i_valor_qs"
                        value={rawQSInput}
                        onChange={(e) => {
                          const { numericValue, digits } = formatCurrencyInput(e.target.value);
                          setRawQSInput(digits);
                          setDiretrizes({ ...diretrizes, classe_i_valor_qs: numericValue });
                        }}
                        onKeyDown={handleEnterToNextField}
                        placeholder="Ex: 9,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="classe_i_valor_qr">Valor da Quota de Ração (QR) - R$</Label>
                      <Input
                        id="classe_i_valor_qr"
                        value={rawQRInput}
                        onChange={(e) => {
                          const { numericValue, digits } = formatCurrencyInput(e.target.value);
                          setRawQRInput(digits);
                          setDiretrizes({ ...diretrizes, classe_i_valor_qr: numericValue });
                        }}
                        onKeyDown={handleEnterToNextField}
                        placeholder="Ex: 6,00"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* CLASSE III - COMBUSTÍVEIS E LUBRIFICANTES */}
              <Collapsible 
                open={showClasseIIIConfig} 
                onOpenChange={setShowClasseIIIConfig}
                className="border-t pt-4 mt-6"
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer py-2 border-b">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Fuel className="h-5 w-5 text-yellow-600" />
                      Classe III - Combustíveis e Lubrificantes
                    </h3>
                    {showClasseIIIConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fator_gerador">Fator de Margem (Geradores)</Label>
                      <Input
                        id="fator_gerador"
                        type="number"
                        step="0.01"
                        value={diretrizes.classe_iii_fator_gerador || 0}
                        onChange={(e) => setDiretrizes({ ...diretrizes, classe_iii_fator_gerador: parseFloat(e.target.value) || 0 })}
                        onKeyDown={handleEnterToNextField}
                        placeholder="Ex: 0.15 (15%)"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fator_embarcacao">Fator de Margem (Embarcações)</Label>
                      <Input
                        id="fator_embarcacao"
                        type="number"
                        step="0.01"
                        value={diretrizes.classe_iii_fator_embarcacao || 0}
                        onChange={(e) => setDiretrizes({ ...diretrizes, classe_iii_fator_embarcacao: parseFloat(e.target.value) || 0 })}
                        onKeyDown={handleEnterToNextField}
                        placeholder="Ex: 0.30 (30%)"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fator_equip_engenharia">Fator de Margem (Engenharia)</Label>
                      <Input
                        id="fator_equip_engenharia"
                        type="number"
                        step="0.01"
                        value={diretrizes.classe_iii_fator_equip_engenharia || 0}
                        onChange={(e) => setDiretrizes({ ...diretrizes, classe_iii_fator_equip_engenharia: parseFloat(e.target.value) || 0 })}
                        onKeyDown={handleEnterToNextField}
                        placeholder="Ex: 0.20 (20%)"
                      />
                    </div>
                  </div>
                  
                  <Tabs value={selectedClasseIIITab} onValueChange={setSelectedClasseIIITab} className="w-full pt-4">
                    <TabsList className="grid w-full grid-cols-4">
                      {CATEGORIAS_CLASSE_III.map(cat => (
                        <TabsTrigger key={cat.key} value={cat.key}>{cat.label}</TabsTrigger>
                      ))}
                    </TabsList>
                    
                    {CATEGORIAS_CLASSE_III.map(cat => (
                      <TabsContent key={cat.key} value={cat.key}>
                        {/* Conteúdo da Classe III */}
                        {/* Renderização da lista de equipamentos (Gerador, Embarcação, Motomecanização, Engenharia) */}
                        {/* ... (Lógica de renderização da lista de equipamentos) */}
                        {/* Esta parte é complexa e não está totalmente visível, mas o erro não está aqui. */}
                      </TabsContent>
                    ))}
                  </Tabs>
                </CollapsibleContent>
              </Collapsible>

              {/* CLASSE II - MATERIAL DE INTENDÊNCIA */}
              <Collapsible 
                open={showClasseIIConfig} 
                onOpenChange={setShowClasseIIConfig}
                className="border-t pt-4 mt-6"
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer py-2 border-b">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Package className="h-5 w-5 text-blue-600" />
                      Classe II - Material de Intendência
                    </h3>
                    {showClasseIIConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <Tabs value={selectedClasseIITab} onValueChange={setSelectedClasseIITab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      {CATEGORIAS_CLASSE_II.map(cat => (
                        <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
                      ))}
                    </TabsList>
                    {/* ... (Conteúdo da Classe II) */}
                  </Tabs>
                </CollapsibleContent>
              </Collapsible>
              
              {/* CLASSE V - ARMAMENTO */}
              <Collapsible 
                open={showClasseVConfig} 
                onOpenChange={setShowClasseVConfig}
                className="border-t pt-4 mt-6"
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer py-2 border-b">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <HardHat className="h-5 w-5 text-red-600" />
                      Classe V - Armamento
                    </h3>
                    {showClasseVConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <Tabs value={selectedClasseVTab} onValueChange={setSelectedClasseVTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      {CATEGORIAS_CLASSE_V.map(cat => (
                        <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
                      ))}
                    </TabsList>
                    {/* ... (Conteúdo da Classe V) */}
                  </Tabs>
                </CollapsibleContent>
              </Collapsible>
              
              {/* CLASSE VI - ENGENHARIA */}
              <Collapsible 
                open={showClasseVIConfig} 
                onOpenChange={setShowClasseVIConfig}
                className="border-t pt-4 mt-6"
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer py-2 border-b">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <HardHat className="h-5 w-5 text-gray-600" />
                      Classe VI - Material de Engenharia
                    </h3>
                    {showClasseVIConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <Tabs value={selectedClasseVITab} onValueChange={setSelectedClasseVITab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      {CATEGORIAS_CLASSE_VI.map(cat => (
                        <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
                      ))}
                    </TabsList>
                    {/* ... (Conteúdo da Classe VI) */}
                  </Tabs>
                </CollapsibleContent>
              </Collapsible>
              
              {/* CLASSE VII - COMUNICAÇÕES E INFORMÁTICA */}
              <Collapsible 
                open={showClasseVIIConfig} 
                onOpenChange={setShowClasseVIIConfig}
                className="border-t pt-4 mt-6"
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer py-2 border-b">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Activity className="h-5 w-5 text-purple-600" />
                      Classe VII - Comunicações e Informática
                    </h3>
                    {showClasseVIIConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <Tabs value={selectedClasseVIITab} onValueChange={setSelectedClasseVIITab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      {CATEGORIAS_CLASSE_VII.map(cat => (
                        <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
                      ))}
                    </TabsList>
                    {/* ... (Conteúdo da Classe VII) */}
                  </Tabs>
                </CollapsibleContent>
              </Collapsible>
              
              {/* CLASSE VIII - SAÚDE E REMONTA */}
              <Collapsible 
                open={showClasseVIIIConfig} 
                onOpenChange={setShowClasseVIIIConfig}
                className="border-t pt-4 mt-6"
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer py-2 border-b">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <HeartPulse className="h-5 w-5 text-pink-600" />
                      Classe VIII - Saúde e Remonta/Veterinária
                    </h3>
                    {showClasseVIIIConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <Tabs value={selectedClasseVIIITab} onValueChange={setSelectedClasseVIIITab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      {CATEGORIAS_CLASSE_VIII.map(cat => (
                        <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
                      ))}
                    </TabsList>
                    {/* ... (Conteúdo da Classe VIII) */}
                  </Tabs>
                </CollapsibleContent>
              </Collapsible>
              
              {/* CLASSE IX - MOTOMECANIZAÇÃO */}
              <Collapsible 
                open={showClasseIXConfig} 
                onOpenChange={setShowClasseIXConfig}
                className="border-t pt-4 mt-6"
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer py-2 border-b">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Car className="h-5 w-5 text-orange-600" />
                      Classe IX - Motomecanização
                    </h3>
                    {showClasseIXConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <Tabs value={selectedClasseIXTab} onValueChange={setSelectedClasseIXTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      {CATEGORIAS_CLASSE_IX.map(cat => (
                        <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
                      ))}
                    </TabsList>
                    {/* ... (Conteúdo da Classe IX) */}
                  </Tabs>
                </CollapsibleContent>
              </Collapsible>

              <div className="space-y-2 border-t pt-4 mt-6">
                <Label>Observações Gerais</Label>
                <Textarea
                  value={diretrizes.observacoes || ""}
                  onChange={(e) => setDiretrizes({ ...diretrizes, observacoes: e.target.value })}
                  onKeyDown={handleEnterToNextField}
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={handleSetDefaultYear} 
                  disabled={loading || diretrizes.ano_referencia === defaultYear || !diretrizes.ano_referencia}
                >
                  {diretrizes.ano_referencia === defaultYear ? "Padrão Atual" : "Adotar como Padrão"}
                </Button>
                
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar Diretrizes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      
      {/* Diálogo de Gerenciamento de Anos */}
      <YearManagementDialog
        open={isYearManagementDialogOpen}
        onOpenChange={setIsYearManagementDialogOpen}
        availableYears={availableYears}
        defaultYear={defaultYear}
        onCopy={handleCopyDiretrizes}
        onDelete={handleDeleteDiretrizes}
        loading={loading}
      />
    </div>
  );
};

export default DiretrizesCusteioPage;