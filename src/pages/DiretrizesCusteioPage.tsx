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
import { defaultClasseIXConfig } from "@/data/classeIXData";
import { formatCurrencyInput, numberToRawDigits } from "@/lib/formatUtils";
import { useSession } from "@/components/SessionContextProvider";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useDefaultLogisticaYear } from "@/hooks/useDefaultLogisticaYear";
import { useQueryClient, useQuery } from "@tanstack/react-query";

// --- Tipos Auxiliares para Carregamento ---
type LoadedClasseItem = Tables<'diretrizes_classe_ii'>;
type LoadedClasseIXItem = Tables<'diretrizes_classe_ix'>;

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

const CATEGORIAS_CLASSE_II = ["Equipamento Individual", "Proteção Balística", "Material de Estacionamento"];
const CATEGORIAS_CLASSE_V = ["Armt L", "Armt P", "IODCT", "DQBRN"];
const CATEGORIAS_CLASSE_VI = ["Gerador", "Embarcação", "Equipamento de Engenharia"];
const CATEGORIAS_CLASSE_VII = ["Comunicações", "Informática"];
const CATEGORIAS_CLASSE_VIII = ["Saúde", "Remonta/Veterinária"];
const CATEGORIAS_CLASSE_IX = ["Vtr Administrativa", "Vtr Operacional", "Motocicleta", "Vtr Blindada"];
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
  const queryClient = useQueryClient();
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
  
  const [classeIIConfig, setClasseIIConfig] = useState<DiretrizClasseIIForm[]>(defaultClasseIIConfig);
  const [classeVConfig, setClasseVConfig] = useState<DiretrizClasseIIForm[]>(defaultClasseVConfig);
  const [classeVIConfig, setClasseVIConfig] = useState<DiretrizClasseIIForm[]>(defaultClasseVIConfig as DiretrizClasseIIForm[]); 
  const [classeVIIConfig, setClasseVIIConfig] = useState<DiretrizClasseIIForm[]>(defaultClasseVIIConfig as DiretrizClasseIIForm[]);
  const [classeVIIISaudeConfig, setClasseVIIISaudeConfig] = useState<DiretrizClasseIIForm[]>(defaultClasseVIIISaudeConfig as DiretrizClasseIIForm[]);
  const [classeVIIIRemontaConfig, setClasseVIIIRemontaConfig] = useState<DiretrizClasseIIForm[]>(defaultClasseVIIIRemontaConfig as DiretrizClasseIIForm[]);
  const [classeIXConfig, setClasseIXConfig] = useState<DiretrizClasseIXForm[]>(defaultClasseIXConfig);
  
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
  
  const { data: defaultYearData, isLoading: isLoadingDefaultYear } = useDefaultLogisticaYear();
  const defaultYear = defaultYearData?.defaultYear || null;
  
  const [rawQSInput, setRawQSInput] = useState<string>(numberToRawDigits(defaultDiretrizes(currentYear).classe_i_valor_qs));
  const [rawQRInput, setRawQRInput] = useState<string>(numberToRawDigits(defaultDiretrizes(currentYear).classe_i_valor_qr));
  const [focusedInput, setFocusedInput] = useState<{ index: number, field: string, rawDigits: string } | null>(null);
  
  const { handleEnterToNextField } = useFormNavigation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const { data: availableYearsData, isLoading: isLoadingYears } = useQuery({
    queryKey: ["availableYears_custeio", user?.id],
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return [];

      const { data, error } = await supabase
        .from("diretrizes_custeio")
        .select("ano_referencia")
        .eq("user_id", authUser.id)
        .order("ano_referencia", { ascending: false });

      if (error) throw error;
      return data ? data.map(d => d.ano_referencia) : [];
    },
    enabled: !!user?.id
  });

  useEffect(() => {
    if (!isLoadingDefaultYear && defaultYearData && availableYearsData !== undefined) {
      const yearsToInclude = new Set(availableYearsData);
      
      if (defaultYearData.defaultYear && !yearsToInclude.has(defaultYearData.defaultYear)) {
          yearsToInclude.add(defaultYearData.defaultYear);
      }
      
      if (availableYearsData.length === 0 && !yearsToInclude.has(currentYear)) {
          yearsToInclude.add(currentYear);
      }
      
      const uniqueYears = Array.from(yearsToInclude).filter(y => y > 0).sort((a, b) => b - a);
      setAvailableYears(uniqueYears);

      if (selectedYear === currentYear && !uniqueYears.includes(currentYear)) {
         setSelectedYear(defaultYearData.year);
      }
    }
  }, [isLoadingDefaultYear, defaultYearData, availableYearsData]);

  const { data: fetchedData, isLoading: isFetchingDiretrizes } = useQuery({
    queryKey: ["diretrizes_custeio_all", selectedYear, user?.id],
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Usuário não autenticado");

      const allClasseItemsCategories = [...CATEGORIAS_CLASSE_II, ...CATEGORIAS_CLASSE_V, ...CATEGORIAS_CLASSE_VI, ...CATEGORIAS_CLASSE_VII, ...CATEGORIAS_CLASSE_VIII];

      const [
        { data: custeioData, error: custeioError },
        { data: classeItemsData, error: classeItemsError },
        { data: classeIXData, error: classeIXError },
        { data: equipamentosData, error: equipamentosError }
      ] = await Promise.all([
        supabase.from("diretrizes_custeio").select("*").eq("user_id", authUser.id).eq("ano_referencia", selectedYear).maybeSingle(),
        supabase.from("diretrizes_classe_ii").select("categoria, item, valor_mnt_dia").eq("user_id", authUser.id).eq("ano_referencia", selectedYear).in("categoria", allClasseItemsCategories),
        supabase.from("diretrizes_classe_ix").select("categoria, item, valor_mnt_dia, valor_acionamento_mensal").eq("user_id", authUser.id).eq("ano_referencia", selectedYear),
        supabase.from("diretrizes_equipamentos_classe_iii").select("*").eq("user_id", authUser.id).eq("ano_referencia", selectedYear)
      ]);

      if (custeioError) throw custeioError;
      if (classeItemsError) throw classeItemsError;
      if (classeIXError) throw classeIXError;
      if (equipamentosError) throw equipamentosError;

      return {
          custeioData,
          classeItemsData: classeItemsData as LoadedClasseItem[],
          classeIXData: classeIXData as LoadedClasseIXItem[],
          equipamentosData
      };
    },
    enabled: !!selectedYear && !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (fetchedData) {
      setLoading(true);
      const { custeioData, classeItemsData, classeIXData, equipamentosData } = fetchedData;
      
      if (custeioData) {
        setDiretrizes({
          id: custeioData.id, user_id: custeioData.user_id, ano_referencia: custeioData.ano_referencia,
          classe_i_valor_qs: Number(custeioData.classe_i_valor_qs), classe_i_valor_qr: Number(custeioData.classe_i_valor_qr),
          classe_iii_fator_gerador: Number(custeioData.classe_iii_fator_gerador), classe_iii_fator_embarcacao: Number(custeioData.classe_iii_fator_embarcacao),
          classe_iii_fator_equip_engenharia: Number(custeioData.classe_iii_fator_equip_engenharia), observacoes: custeioData.observacoes || "",
        });
        setRawQSInput(numberToRawDigits(Number(custeioData.classe_i_valor_qs)));
        setRawQRInput(numberToRawDigits(Number(custeioData.classe_i_valor_qr)));
      } else {
        const defaultValues = defaultDiretrizes(selectedYear);
        setDiretrizes(defaultValues);
        setRawQSInput(numberToRawDigits(defaultValues.classe_i_valor_qs));
        setRawQRInput(numberToRawDigits(defaultValues.classe_i_valor_qr));
      }

      const loadedItems = classeItemsData || [];
      const loadedClasseII = loadedItems.filter(d => CATEGORIAS_CLASSE_II.includes(d.categoria));
      setClasseIIConfig(loadedClasseII.length > 0 ? loadedClasseII.map(d => ({ categoria: d.categoria as DiretrizClasseIIForm['categoria'], item: d.item, valor_mnt_dia: Number(d.valor_mnt_dia) })) : defaultClasseIIConfig);
      
      const loadedClasseV = loadedItems.filter(d => CATEGORIAS_CLASSE_V.includes(d.categoria));
      setClasseVConfig(loadedClasseV.length > 0 ? loadedClasseV.map(d => ({ categoria: d.categoria as DiretrizClasseIIForm['categoria'], item: d.item, valor_mnt_dia: Number(d.valor_mnt_dia) })) : defaultClasseVConfig);

      const loadedClasseVI = loadedItems.filter(d => CATEGORIAS_CLASSE_VI.includes(d.categoria));
      setClasseVIConfig(loadedClasseVI.length > 0 ? loadedClasseVI.map(d => ({ categoria: d.categoria as DiretrizClasseIIForm['categoria'], item: d.item, valor_mnt_dia: Number(d.valor_mnt_dia) })) : defaultClasseVIConfig as DiretrizClasseIIForm[]);

      const loadedClasseVII = loadedItems.filter(d => CATEGORIAS_CLASSE_VII.includes(d.categoria));
      setClasseVIIConfig(loadedClasseVII.length > 0 ? loadedClasseVII.map(d => ({ categoria: d.categoria as DiretrizClasseIIForm['categoria'], item: d.item, valor_mnt_dia: Number(d.valor_mnt_dia) })) : defaultClasseVIIConfig as DiretrizClasseIIForm[]);

      const loadedClasseVIIISaude = loadedItems.filter(d => d.categoria === 'Saúde');
      setClasseVIIISaudeConfig(loadedClasseVIIISaude.length > 0 ? loadedClasseVIIISaude.map(d => ({ categoria: d.categoria as DiretrizClasseIIForm['categoria'], item: d.item, valor_mnt_dia: Number(d.valor_mnt_dia) })) : defaultClasseVIIISaudeConfig as DiretrizClasseIIForm[]);

      const loadedClasseVIIIRemonta = loadedItems.filter(d => d.categoria === 'Remonta/Veterinária');
      setClasseVIIIRemontaConfig(loadedClasseVIIIRemonta.length > 0 ? loadedClasseVIIIRemonta.map(d => ({ categoria: d.categoria as DiretrizClasseIIForm['categoria'], item: d.item, valor_mnt_dia: Number(d.valor_mnt_dia) })) : defaultClasseVIIIRemontaConfig as DiretrizClasseIIForm[]);

      if ((classeIXData || []).length > 0) {
        const loadedItemsMap = new Map<string, DiretrizClasseIXForm>();
        classeIXData.forEach(d => {
            loadedItemsMap.set(d.item, { categoria: d.categoria as DiretrizClasseIXForm['categoria'], item: d.item, valor_mnt_dia: Number(d.valor_mnt_dia), valor_acionamento_mensal: Number(d.valor_acionamento_mensal) });
        });
        
        const mergedClasseIX: DiretrizClasseIXForm[] = Array.from(loadedItemsMap.values());
        defaultClasseIXConfig.forEach(defaultItem => { if (!loadedItemsMap.has(defaultItem.item)) mergedClasseIX.push(defaultItem); });
        
        mergedClasseIX.sort((a, b) => a.categoria !== b.categoria ? CATEGORIAS_CLASSE_IX.indexOf(a.categoria) - CATEGORIAS_CLASSE_IX.indexOf(b.categoria) : a.item.localeCompare(b.item));
        setClasseIXConfig(mergedClasseIX);
      } else {
        setClasseIXConfig(defaultClasseIXConfig);
      }

      const eqData = equipamentosData || [];
      const getEqs = (cat: string, def: DiretrizEquipamentoForm[]) => {
          const filtered = eqData.filter(e => e.categoria === cat);
          return filtered.length > 0 ? filtered.map(eq => ({ nome_equipamento: eq.nome_equipamento, tipo_combustivel: eq.tipo_combustivel as 'GAS' | 'OD', consumo: Number(eq.consumo), unidade: eq.unidade as 'L/h' | 'km/L' })) : def;
      };

      setGeradorConfig(getEqs("GERADOR", defaultGeradorConfig));
      setEmbarcacaoConfig(getEqs("EMBARCACAO", defaultEmbarcacaoConfig));
      setMotomecanizacaoConfig(getEqs("MOTOMECANIZACAO", defaultMotomecanizacaoConfig));
      setEquipamentosEngenhariaConfig(getEqs("EQUIPAMENTO_ENGENHARIA", defaultEquipamentosEngenhariaConfig));

      setLoading(false);
    }
  }, [fetchedData, selectedYear]);

  const handleSaveDiretrizes = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
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
        user_id: authUser.id,
        ano_referencia: diretrizes.ano_referencia,
        classe_i_valor_qs: diretrizes.classe_i_valor_qs,
        classe_i_valor_qr: diretrizes.classe_i_valor_qr,
        classe_iii_fator_gerador: diretrizes.classe_iii_fator_gerador,
        classe_iii_fator_embarcacao: diretrizes.classe_iii_fator_embarcacao,
        classe_iii_fator_equip_engenharia: diretrizes.classe_iii_fator_equip_engenharia,
        observacoes: diretrizes.observacoes,
      };

      if (diretrizes.id) {
        const { error } = await supabase.from("diretrizes_custeio").update(diretrizData as TablesUpdate<'diretrizes_custeio'>).eq("id", diretrizes.id);
        if (error) throw error;
        toast.success("Diretrizes atualizadas!");
      } else {
        const { error } = await supabase.from("diretrizes_custeio").insert([diretrizData as TablesInsert<'diretrizes_custeio'>]);
        if (error) throw error;
        toast.success("Diretrizes criadas!");
      }
      
      const categoriasClasseIII = ["GERADOR", "EMBARCACAO", "MOTOMECANIZACAO", "EQUIPAMENTO_ENGENHARIA"];
      const configsClasseIII = { "GERADOR": geradorConfig, "EMBARCACAO": embarcacaoConfig, "MOTOMECANIZACAO": motomecanizacaoConfig, "EQUIPAMENTO_ENGENHARIA": equipamentosEngenhariaConfig };

      for (const categoria of categoriasClasseIII) {
        await supabase.from("diretrizes_equipamentos_classe_iii").delete().eq("user_id", authUser.id).eq("ano_referencia", diretrizes.ano_referencia!).eq("categoria", categoria);
        const configList = configsClasseIII[categoria as keyof typeof configsClasseIII];
        const equipamentosParaSalvar = configList.filter(g => g.nome_equipamento.trim().length > 0 && g.consumo > 0).map(g => ({ user_id: authUser.id, ano_referencia: diretrizes.ano_referencia, categoria: categoria, nome_equipamento: g.nome_equipamento, tipo_combustivel: g.tipo_combustivel, consumo: Number(g.consumo).toFixed(2), unidade: g.unidade, ativo: true }));
        if (equipamentosParaSalvar.length > 0) {
          const { error: eqError } = await supabase.from("diretrizes_equipamentos_classe_iii").insert(equipamentosParaSalvar as any as TablesInsert<'diretrizes_equipamentos_classe_iii'>[]);
          if (eqError) throw eqError;
        }
      }
      
      await supabase.from("diretrizes_classe_ii").delete().eq("user_id", authUser.id).eq("ano_referencia", diretrizes.ano_referencia!);
      const allClasseItems = [...classeIIConfig, ...classeVConfig, ...classeVIConfig, ...classeVIIConfig, ...classeVIIISaudeConfig, ...classeVIIIRemontaConfig];
      const classeItemsParaSalvar = allClasseItems.filter(item => item.item.trim().length > 0 && (item.valor_mnt_dia || 0) >= 0).map(item => ({ user_id: authUser.id, ano_referencia: diretrizes.ano_referencia, categoria: item.categoria, item: item.item, valor_mnt_dia: Number(item.valor_mnt_dia || 0).toFixed(2), ativo: true }));
      if (classeItemsParaSalvar.length > 0) {
        const { error: c2Error } = await supabase.from("diretrizes_classe_ii").insert(classeItemsParaSalvar as any as TablesInsert<'diretrizes_classe_ii'>[]);
        if (c2Error) throw c2Error;
      }
      
      await supabase.from("diretrizes_classe_ix").delete().eq("user_id", authUser.id).eq("ano_referencia", diretrizes.ano_referencia!);
      const classeIXItemsParaSalvar = classeIXConfig.filter(item => item.item.trim().length > 0 && (item.valor_mnt_dia || 0) >= 0 && (item.valor_acionamento_mensal || 0) >= 0).map(item => ({ user_id: authUser.id, ano_referencia: diretrizes.ano_referencia, categoria: item.categoria, item: item.item, valor_mnt_dia: Number(item.valor_mnt_dia || 0).toFixed(2), valor_acionamento_mensal: Number(item.valor_acionamento_mensal || 0).toFixed(2), ativo: true }));
      for (const item of classeIXItemsParaSalvar) {
          const { error: c9Error } = await supabase.from("diretrizes_classe_ix").insert([item as any as TablesInsert<'diretrizes_classe_ix'>]);
          if (c9Error) throw c9Error;
      }

      // Invalida o status de onboarding para atualizar o Dashboard
      queryClient.invalidateQueries({ queryKey: ["onboardingStatus"] });
      
      queryClient.invalidateQueries({ queryKey: ["availableYears_custeio", authUser.id] });
      queryClient.invalidateQueries({ queryKey: ["diretrizes_custeio_all", diretrizes.ano_referencia, authUser.id] });
    } catch (error: any) {
      if (error.code === '23505') toast.error("Já existe uma diretriz para este ano");
      else toast.error(sanitizeError(error));
    }
  };
  
  const handleSetDefaultYear = async () => {
    if (!diretrizes.ano_referencia) {
      toast.error("Selecione um ano de referência válido.");
      return;
    }
    
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Usuário não autenticado");
      
      const { error } = await supabase.from('profiles').update({ default_logistica_year: diretrizes.ano_referencia }).eq('id', authUser.id);
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["defaultLogisticaYear", authUser.id] });
      // Invalida o status de onboarding para atualizar o Dashboard
      queryClient.invalidateQueries({ queryKey: ["onboardingStatus"] });
      
      toast.success(`Ano ${diretrizes.ano_referencia} definido como padrão para cálculos!`);
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDiretrizes = async (sourceYear: number, targetYear: number) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Usuário não autenticado");
      
      setLoading(true);
      const { data: sourceCusteio, error: custeioError } = await supabase.from("diretrizes_custeio").select("*").eq("user_id", authUser.id).eq("ano_referencia", sourceYear).single();
      if (custeioError || !sourceCusteio) throw new Error(`Diretriz de custeio para o ano ${sourceYear} não encontrada.`);
      
      const { id: oldId, created_at, updated_at, ...restCusteio } = sourceCusteio;
      const newCusteio = { ...restCusteio, ano_referencia: targetYear, user_id: authUser.id };
      const { error: insertCusteioError } = await supabase.from("diretrizes_custeio").insert([newCusteio as TablesInsert<'diretrizes_custeio'>]);
      if (insertCusteioError) throw insertCusteioError;
      
      const { data: sourceEquipamentos } = await supabase.from("diretrizes_equipamentos_classe_iii").select("*").eq("user_id", authUser.id).eq("ano_referencia", sourceYear);
      if (sourceEquipamentos && sourceEquipamentos.length > 0) {
        const newEquipamentos = sourceEquipamentos.map(eq => { const { id, created_at, updated_at, ...restEq } = eq; return { ...restEq, ano_referencia: targetYear, user_id: authUser.id }; });
        await supabase.from("diretrizes_equipamentos_classe_iii").insert(newEquipamentos as TablesInsert<'diretrizes_equipamentos_classe_iii'>[]);
      }
      
      const { data: sourceClasseItems } = await supabase.from("diretrizes_classe_ii").select("*").eq("user_id", authUser.id).eq("ano_referencia", sourceYear);
      if (sourceClasseItems && sourceClasseItems.length > 0) {
        const newClasseItems = sourceClasseItems.map(c2 => { const { id, created_at, updated_at, ...restC2 } = c2; return { ...restC2, ano_referencia: targetYear, user_id: authUser.id }; });
        await supabase.from("diretrizes_classe_ii").insert(newClasseItems as TablesInsert<'diretrizes_classe_ii'>[]);
      }
      
      const { data: sourceClasseIX } = await supabase.from("diretrizes_classe_ix").select("*").eq("user_id", authUser.id).eq("ano_referencia", sourceYear);
      if (sourceClasseIX && sourceClasseIX.length > 0) {
        const newClasseIX = sourceClasseIX.map(c9 => { const { id, created_at, updated_at, ...restC9 } = c9; return { ...restC9, ano_referencia: targetYear, user_id: authUser.id }; });
        await supabase.from("diretrizes_classe_ix").insert(newClasseIX as TablesInsert<'diretrizes_classe_ix'>[]);
      }

      toast.success(`Diretrizes do ano ${sourceYear} copiadas com sucesso para o ano ${targetYear}!`);
      setIsYearManagementDialogOpen(false);
      setSelectedYear(targetYear);
      queryClient.invalidateQueries({ queryKey: ["availableYears_custeio", authUser.id] });
      queryClient.invalidateQueries({ queryKey: ["diretrizes_custeio_all", targetYear, authUser.id] });
      // Invalida o status de onboarding para atualizar o Dashboard
      queryClient.invalidateQueries({ queryKey: ["onboardingStatus"] });
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
    if (!confirm(`Tem certeza que deseja EXCLUIR TODAS as diretrizes para o ano ${year}? Esta ação é irreversível.`)) return;

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Usuário não autenticado");
      setLoading(true);
      await supabase.from("diretrizes_equipamentos_classe_iii").delete().eq("user_id", authUser.id).eq("ano_referencia", year);
      await supabase.from("diretrizes_classe_ii").delete().eq("user_id", authUser.id).eq("ano_referencia", year);
      await supabase.from("diretrizes_classe_ix").delete().eq("user_id", authUser.id).eq("ano_referencia", year);
      const { error: custeioError } = await supabase.from("diretrizes_custeio").delete().eq("user_id", authUser.id).eq("ano_referencia", year);
      if (custeioError) throw custeioError;

      toast.success(`Diretrizes do ano ${year} excluídas com sucesso!`);
      setIsYearManagementDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["availableYears_custeio", authUser.id] });
      queryClient.invalidateQueries({ queryKey: ["diretrizes_custeio_all", year, authUser.id] });
      // Invalida o status de onboarding para atualizar o Dashboard
      queryClient.invalidateQueries({ queryKey: ["onboardingStatus"] });
    } catch (error: any) {
      console.error("Erro ao excluir diretrizes:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = (config: DiretrizEquipamentoForm[], setConfig: React.Dispatch<React.SetStateAction<DiretrizEquipamentoForm[]>>, unidade: 'L/h' | 'km/L') => {
    setConfig([...config, { nome_equipamento: "", tipo_combustivel: "OD", consumo: 0, unidade: unidade }]);
  };

  const handleRemoveItem = (config: DiretrizEquipamentoForm[], setConfig: React.Dispatch<React.SetStateAction<DiretrizEquipamentoForm[]>>, index: number) => {
    setConfig(config.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (config: DiretrizEquipamentoForm[], setConfig: React.Dispatch<React.SetStateAction<DiretrizEquipamentoForm[]>>, index: number, field: keyof DiretrizEquipamentoForm, value: any) => {
    const novosItens = [...config];
    novosItens[index] = { ...novosItens[index], [field]: value };
    setConfig(novosItens);
  };
  
  const handleAddClasseItem = (config: DiretrizClasseIIForm[], setConfig: React.Dispatch<React.SetStateAction<DiretrizClasseIIForm[]>>, categoria: DiretrizClasseIIForm['categoria']) => {
    setConfig(prev => [...prev, { categoria: categoria, item: "", valor_mnt_dia: 0 } as DiretrizClasseIIForm]);
  };

  const handleRemoveClasseItem = (config: DiretrizClasseIIForm[], setConfig: React.Dispatch<React.SetStateAction<DiretrizClasseIIForm[]>>, index: number) => {
    setConfig(config.filter((_, i) => i !== index));
  };

  const handleUpdateClasseItem = (config: DiretrizClasseIIForm[], setConfig: React.Dispatch<React.SetStateAction<DiretrizClasseIIForm[]>>, index: number, field: keyof DiretrizClasseIIForm, value: any) => {
    const novosItens = [...config];
    novosItens[index] = { ...novosItens[index], [field]: value };
    setConfig(novosItens);
  };
  
  const handleClasseIChange = (field: 'classe_i_valor_qs' | 'classe_i_valor_qr', rawValue: string) => {
    const { numericValue, digits } = formatCurrencyInput(rawValue);
    if (field === 'classe_i_valor_qs') {
        setRawQSInput(digits);
        setDiretrizes(prev => ({ ...prev, classe_i_valor_qs: numericValue }));
    } else {
        setRawQRInput(digits);
        setDiretrizes(prev => ({ ...prev, classe_i_valor_qr: numericValue }));
    }
  };
  
  const renderClasseList = (config: DiretrizClasseIIForm[], setConfig: React.Dispatch<React.SetStateAction<DiretrizClasseIIForm[]>>, categorias: string[], selectedTab: string) => {
    const filteredItems = config.filter(item => item.categoria === selectedTab);
    const fieldName = 'valor_mnt_dia';
    const getMaskingProps = (item: DiretrizClasseIIForm, indexInMainArray: number) => {
        const isFocused = focusedInput?.index === indexInMainArray && focusedInput.field === fieldName;
        let displayValue = isFocused ? formatCurrencyInput(focusedInput.rawDigits).formatted : formatCurrencyInput(numberToRawDigits(item.valor_mnt_dia)).formatted;
        if (item.valor_mnt_dia === 0 && !isFocused) displayValue = "";
        const handleFocus = () => setFocusedInput({ index: indexInMainArray, field: fieldName, rawDigits: numberToRawDigits(item.valor_mnt_dia) });
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const { numericValue, digits } = formatCurrencyInput(e.target.value);
            setFocusedInput(prev => prev ? { ...prev, rawDigits: digits } : null);
            handleUpdateClasseItem(config, setConfig, indexInMainArray, fieldName, numericValue);
        };
        const handleBlur = () => setFocusedInput(null);
        return { value: displayValue, onChange: handleChange, onFocus: handleFocus, onBlur: handleBlur, type: "text" as const, inputMode: "numeric" as const };
    };
    
    return (
      <div className="space-y-4 pt-4">
        {filteredItems.map((item, index) => {
          const indexInMainArray = config.findIndex(c => c === item);
          const handleRemoveFilteredItem = () => { if (indexInMainArray !== -1) handleRemoveClasseItem(config, setConfig, indexInMainArray); };
          const mntDiaProps = getMaskingProps(item, indexInMainArray);
          return (
            <div key={index} className="grid grid-cols-12 gap-2 items-end border-b pb-3 last:border-0">
              <div className="col-span-8"><Label className="text-xs">Item</Label><Input value={item.item} onChange={(e) => handleUpdateClasseItem(config, setConfig, indexInMainArray, 'item', e.target.value)} placeholder="Ex: Colete balístico" onKeyDown={handleEnterToNextField} /></div>
              <div className="col-span-3"><Label className="text-xs">Valor (R$)</Label><Input {...mntDiaProps} onKeyDown={handleEnterToNextField} /></div>
              <div className="col-span-1 flex justify-end"><Button variant="ghost" size="icon" onClick={handleRemoveFilteredItem} type="button"><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
            </div>
          );
        })}
        <Button variant="outline" size="sm" onClick={() => handleAddClasseItem(config, setConfig, selectedTab as DiretrizClasseIIForm['categoria'])} className="w-full" type="button"><Plus className="mr-2 h-4 w-4" />Adicionar Item</Button>
      </div>
    );
  };
  
  const handleAddClasseIXItem = (config: DiretrizClasseIXForm[], setConfig: React.Dispatch<React.SetStateAction<DiretrizClasseIXForm[]>>, categoria: DiretrizClasseIXForm['categoria']) => {
    setConfig(prev => [...prev, { categoria: categoria, item: "", valor_mnt_dia: 0, valor_acionamento_mensal: 0 } as DiretrizClasseIXForm]);
  };

  const handleRemoveClasseIXItem = (config: DiretrizClasseIXForm[], setConfig: React.Dispatch<React.SetStateAction<DiretrizClasseIXForm[]>>, index: number) => {
    setConfig(config.filter((_, i) => i !== index));
  };

  const handleUpdateClasseIXItem = (config: DiretrizClasseIXForm[], setConfig: React.Dispatch<React.SetStateAction<DiretrizClasseIXForm[]>>, index: number, field: keyof DiretrizClasseIXForm, value: any) => {
    const novosItens = [...config];
    novosItens[index] = { ...novosItens[index], [field]: value };
    setConfig(novosItens);
  };
  
  const renderClasseIXList = (config: DiretrizClasseIXForm[], setConfig: React.Dispatch<React.SetStateAction<DiretrizClasseIXForm[]>>, categorias: string[], selectedTab: string) => {
    const filteredItems = config.filter(item => item.categoria === selectedTab);
    const getMaskingProps = (item: DiretrizClasseIXForm, indexInMainArray: number, fieldName: keyof DiretrizClasseIXForm) => {
        const isFocused = focusedInput?.index === indexInMainArray && focusedInput.field === fieldName;
        let displayValue = isFocused ? formatCurrencyInput(focusedInput.rawDigits).formatted : formatCurrencyInput(numberToRawDigits(item[fieldName] as number)).formatted;
        if ((item[fieldName] as number) === 0 && !isFocused) displayValue = "";
        const handleFocus = () => setFocusedInput({ index: indexInMainArray, field: fieldName, rawDigits: numberToRawDigits(item[fieldName] as number) });
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const { numericValue, digits } = formatCurrencyInput(e.target.value);
            setFocusedInput(prev => prev ? { ...prev, rawDigits: digits } : null);
            handleUpdateClasseIXItem(config, setConfig, indexInMainArray, fieldName, numericValue);
        };
        const handleBlur = () => setFocusedInput(null);
        return { value: displayValue, onChange: handleChange, onFocus: handleFocus, onBlur: handleBlur, type: "text" as const, inputMode: "numeric" as const };
    };
    
    return (
      <div className="space-y-4 pt-4">
        {filteredItems.map((item, index) => {
          const indexInMainArray = config.findIndex(c => c === item);
          const handleRemoveFilteredItem = () => { if (indexInMainArray !== -1) handleRemoveClasseIXItem(config, setConfig, indexInMainArray); };
          const mntDiaProps = getMaskingProps(item, indexInMainArray, 'valor_mnt_dia');
          const acionamentoMensalProps = getMaskingProps(item, indexInMainArray, 'valor_acionamento_mensal');
          return (
            <div key={index} className="grid grid-cols-12 gap-2 items-end border-b pb-3 last:border-0">
              <div className="col-span-6"><Label className="text-xs">Tipo Vtr</Label><Input value={item.item} onChange={(e) => handleUpdateClasseIXItem(config, setConfig, indexInMainArray, 'item', e.target.value)} placeholder="Ex: VTP Sedan Médio" onKeyDown={handleEnterToNextField} /></div>
              <div className="col-span-3"><Label className="text-xs">Mnt/Dia Op Mil (R$)</Label><Input {...mntDiaProps} onKeyDown={handleEnterToNextField} /></div>
              <div className="col-span-2"><Label className="text-xs">Acionamento Mensal (R$)</Label><Input {...acionamentoMensalProps} onKeyDown={handleEnterToNextField} /></div>
              <div className="col-span-1 flex justify-end"><Button variant="ghost" size="icon" onClick={handleRemoveFilteredItem} type="button"><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
            </div>
          );
        })}
        <Button variant="outline" size="sm" onClick={() => handleAddClasseIXItem(config, setConfig, selectedTab as DiretrizClasseIXForm['categoria'])} className="w-full" type="button"><Plus className="mr-2 h-4 w-4" />Adicionar Viatura</Button>
      </div>
    );
  };
  
  const renderClasseIIIList = (categoria: string, config: DiretrizEquipamentoForm[], setConfig: React.Dispatch<React.SetStateAction<DiretrizEquipamentoForm[]>>) => {
    const unidade = categoria === 'MOTOMECANIZACAO' ? 'km/L' : 'L/h';
    return (
      <div className="space-y-4 pt-4">
        {config.map((item, index) => (
          <div key={index} className="grid grid-cols-12 gap-2 items-end border-b pb-3 last:border-0">
            <div className="col-span-5"><Label className="text-xs">Nome do Equipamento</Label><Input value={item.nome_equipamento} onChange={(e) => handleUpdateItem(config, setConfig, index, 'nome_equipamento', e.target.value)} placeholder="Ex: Retroescavadeira" onKeyDown={handleEnterToNextField} /></div>
            <div className="col-span-2"><Label className="text-xs">Combustível</Label><Select value={item.tipo_combustivel} onValueChange={(val: 'GAS' | 'OD') => handleUpdateItem(config, setConfig, index, 'tipo_combustivel', val)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="GAS">Gasolina</SelectItem><SelectItem value="OD">Diesel</SelectItem></SelectContent></Select></div>
            <div className="col-span-2"><Label className="text-xs">Consumo</Label><Input type="number" step="0.01" className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={item.consumo === 0 ? "" : item.consumo} onChange={(e) => handleUpdateItem(config, setConfig, index, 'consumo', parseFloat(e.target.value) || 0)} onKeyDown={handleEnterToNextField} /></div>
            <div className="col-span-2"><Label className="text-xs">Unidade</Label><Input value={unidade} disabled className="bg-muted text-muted-foreground" onKeyDown={handleEnterToNextField} /></div>
            <div className="col-span-1 flex justify-end"><Button variant="ghost" size="icon" onClick={() => handleRemoveItem(config, setConfig, index)} type="button"><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => handleAddItem(config, setConfig, unidade as 'L/h' | 'km/L')} className="w-full" type="button"><Plus className="mr-2 h-4 w-4" />Adicionar Equipamento</Button>
      </div>
    );
  };

  if (loading || isLoadingDefaultYear || isFetchingDiretrizes || isLoadingYears) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-muted-foreground ml-2">Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/ptrab")} className="mb-2"><ArrowLeft className="mr-2 h-4 w-4" />Voltar para Planos de Trabalho</Button>
          <Button variant="outline" onClick={() => setIsYearManagementDialogOpen(true)} disabled={loading || isLoadingDefaultYear}><Settings className="mr-2 h-4 w-4" />Gerenciar Anos</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configurações da Diretriz de Custeio Logístico</CardTitle>
            <CardDescription>Diretrizes de Custeio (COLOG)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={(e) => { e.preventDefault(); handleSaveDiretrizes(); }}>
              <div className="space-y-2 mb-6">
                <Label>Ano de Referência</Label>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}><SelectTrigger><SelectValue placeholder="Selecione o ano" /></SelectTrigger><SelectContent>{availableYears.map((year) => (<SelectItem key={year} value={year.toString()}>{year} {year === defaultYear && "(Padrão)"}</SelectItem>))}</SelectContent></Select>
                <p className="text-sm text-muted-foreground pt-1">Ano Padrão de Cálculo: <span className="font-semibold text-primary ml-1">{defaultYear ? defaultYear : 'Não definido (usando o mais recente)'}</span>{defaultYear && defaultYear !== selectedYear && (<span className="text-xs text-gray-500 ml-2">(Selecione este ano para editar o padrão)</span>)}</p>
                {availableYears.length === 1 && availableYears[0] === currentYear && !diretrizes.id && (<div className="mt-3 p-3 border border-yellow-500 bg-yellow-50 text-sm rounded-md"><p className="font-semibold text-yellow-700">Aviso:</p><p className="text-yellow-700">Nenhum ano de referência cadastrado. Usando dados padrão iniciais para o ano {currentYear}. Salve para persistir.</p></div>)}
              </div>

              <div className="border-t pt-4 mt-6">
                <div className="flex items-center justify-between cursor-pointer py-2" onClick={() => setShowClasseIAlimentacaoConfig(!showClasseIAlimentacaoConfig)}><h3 className="text-lg font-semibold">Classe I - Alimentação</h3>{showClasseIAlimentacaoConfig ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</div>
                {showClasseIAlimentacaoConfig && (<div className="space-y-4 mt-2"><div className="grid grid-cols-2 gap-4"><div className="flex items-center justify-between"><Label className="text-sm font-medium whitespace-nowrap mr-4">Valor QS (R$/dia/militar)</Label><div className="relative w-full max-w-[150px]"><Input type="text" inputMode="numeric" className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={formatCurrencyInput(rawQSInput).formatted} onChange={(e) => handleClasseIChange('classe_i_valor_qs', e.target.value)} onKeyDown={handleEnterToNextField} /></div></div><div className="flex items-center justify-between"><Label className="text-sm font-medium whitespace-nowrap mr-4">Valor QR (R$/dia/militar)</Label><div className="relative w-full max-w-[150px]"><Input type="text" inputMode="numeric" className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={formatCurrencyInput(rawQRInput).formatted} onChange={(e) => handleClasseIChange('classe_i_valor_qr', e.target.value)} onKeyDown={handleEnterToNextField} /></div></div></div></div>)}
              </div>
              
              <div className="border-t pt-4 mt-6">
                <div className="flex items-center justify-between cursor-pointer py-2" onClick={() => setShowClasseIIConfig(!showClasseIIConfig)}><h3 className="text-lg font-semibold">Classe II - Material de Intendência</h3>{showClasseIIConfig ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</div>
                {showClasseIIConfig && (<Card><CardContent className="pt-4"><Tabs value={selectedClasseIITab} onValueChange={setSelectedClasseIITab}><TabsList className="grid w-full grid-cols-3">{CATEGORIAS_CLASSE_II.map(cat => (<TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>))}</TabsList>{CATEGORIAS_CLASSE_II.map(cat => (<TabsContent key={cat} value={cat}>{renderClasseList(classeIIConfig, setClasseIIConfig, CATEGORIAS_CLASSE_II, cat)}</TabsContent>))}</Tabs></CardContent></Card>)}
              </div>
              
              <div className="border-t pt-4 mt-6">
                <div className="flex items-center justify-between cursor-pointer py-2" onClick={() => setShowClasseIIIConfig(!showClasseIIIConfig)}><h3 className="text-lg font-semibold">Classe III - Combustíveis e Lubrificantes</h3>{showClasseIIIConfig ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</div>
                {showClasseIIIConfig && (<Card><CardContent className="pt-4"><Tabs value={selectedClasseIIITab} onValueChange={setSelectedClasseIIITab}><TabsList className="grid w-full grid-cols-4">{CATEGORIAS_CLASSE_III.map(cat => (<TabsTrigger key={cat.key} value={cat.key}>{cat.label}</TabsTrigger>))}</TabsList><TabsContent value="GERADOR">{renderClasseIIIList("GERADOR", geradorConfig, setGeradorConfig)}</TabsContent><TabsContent value="EMBARCACAO">{renderClasseIIIList("EMBARCACAO", embarcacaoConfig, setEmbarcacaoConfig)}</TabsContent><TabsContent value="MOTOMECANIZACAO">{renderClasseIIIList("MOTOMECANIZACAO", motomecanizacaoConfig, setMotomecanizacaoConfig)}</TabsContent><TabsContent value="EQUIPAMENTO_ENGENHARIA">{renderClasseIIIList("EQUIPAMENTO_ENGENHARIA", equipamentosEngenhariaConfig, setEquipamentosEngenhariaConfig)}</TabsContent></Tabs></CardContent></Card>)}
              </div>
              
              <div className="border-t pt-4 mt-6">
                <div className="flex items-center justify-between cursor-pointer py-2" onClick={() => setShowClasseVConfig(!showClasseVConfig)}><h3 className="text-lg font-semibold">Classe V - Armamento</h3>{showClasseVConfig ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</div>
                {showClasseVConfig && (<Card><CardContent className="pt-4"><Tabs value={selectedClasseVTab} onValueChange={setSelectedClasseVTab}><TabsList className="grid w-full grid-cols-4">{CATEGORIAS_CLASSE_V.map(cat => (<TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>))}</TabsList>{CATEGORIAS_CLASSE_V.map(cat => (<TabsContent key={cat} value={cat}>{renderClasseList(classeVConfig, setClasseVConfig, CATEGORIAS_CLASSE_V, cat)}</TabsContent>))}</Tabs></CardContent></Card>)}
              </div>
              
              <div className="border-t pt-4 mt-6">
                <div className="flex items-center justify-between cursor-pointer py-2" onClick={() => setShowClasseVIConfig(!showClasseVIConfig)}><h3 className="text-lg font-semibold flex items-center gap-2">Classe VI - Material de Engenharia</h3>{showClasseVIConfig ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</div>
                {showClasseVIConfig && (<Card><CardContent className="pt-4"><Tabs value={selectedClasseVITab} onValueChange={setSelectedClasseVITab}><TabsList className="grid w-full grid-cols-3">{CATEGORIAS_CLASSE_VI.map(cat => (<TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>))}</TabsList>{CATEGORIAS_CLASSE_VI.map(cat => (<TabsContent key={cat} value={cat}>{renderClasseList(classeVIConfig, setClasseVIConfig, CATEGORIAS_CLASSE_VI, cat)}</TabsContent>))}</Tabs></CardContent></Card>)}
              </div>
              
              <div className="border-t pt-4 mt-6">
                <div className="flex items-center justify-between cursor-pointer py-2" onClick={() => setShowClasseVIIConfig(!showClasseVIIConfig)}><h3 className="text-lg font-semibold flex items-center gap-2">Classe VII - Comunicações e Informática</h3>{showClasseVIIConfig ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</div>
                {showClasseVIIConfig && (<Card><CardContent className="pt-4"><Tabs value={selectedClasseVIITab} onValueChange={setSelectedClasseVIITab}><TabsList className="grid w-full grid-cols-2">{CATEGORIAS_CLASSE_VII.map(cat => (<TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>))}</TabsList>{CATEGORIAS_CLASSE_VII.map(cat => (<TabsContent key={cat} value={cat}>{renderClasseList(classeVIIConfig, setClasseVIIConfig, CATEGORIAS_CLASSE_VII, cat)}</TabsContent>))}</Tabs></CardContent></Card>)}
              </div>
              
              <div className="border-t pt-4 mt-6">
                <div className="flex items-center justify-between cursor-pointer py-2" onClick={() => setShowClasseVIIIConfig(!showClasseVIIIConfig)}><h3 className="text-lg font-semibold flex items-center gap-2">Classe VIII - Saúde e Remonta/Veterinária</h3>{showClasseVIIIConfig ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</div>
                {showClasseVIIIConfig && (<Card><CardContent className="pt-4"><Tabs value={selectedClasseVIIITab} onValueChange={setSelectedClasseVIIITab}><TabsList className="grid w-full grid-cols-2">{CATEGORIAS_CLASSE_VIII.map(cat => (<TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>))}</TabsList><TabsContent value="Saúde">{renderClasseList(classeVIIISaudeConfig, setClasseVIIISaudeConfig, CATEGORIAS_CLASSE_VIII, 'Saúde')}</TabsContent><TabsContent value="Remonta/Veterinária">{renderClasseList(classeVIIIRemontaConfig, setClasseVIIIRemontaConfig, CATEGORIAS_CLASSE_VIII, 'Remonta/Veterinária')}</TabsContent></Tabs></CardContent></Card>)}
              </div>
              
              <div className="border-t pt-4 mt-6">
                <div className="flex items-center justify-between cursor-pointer py-2" onClick={() => setShowClasseIXConfig(!showClasseIXConfig)}><h3 className="text-lg font-semibold flex items-center gap-2">Classe IX - Motomecanização</h3>{showClasseIXConfig ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</div>
                {showClasseIXConfig && (<Card><CardContent className="pt-4"><Tabs value={selectedClasseIXTab} onValueChange={setSelectedClasseIXTab}><TabsList className="grid w-full grid-cols-4">{CATEGORIAS_CLASSE_IX.map(cat => (<TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>))}</TabsList>{CATEGORIAS_CLASSE_IX.map(cat => (<TabsContent key={cat} value={cat}>{renderClasseIXList(classeIXConfig, setClasseIXConfig, CATEGORIAS_CLASSE_IX, cat)}</TabsContent>))}</Tabs></CardContent></Card>)}
              </div>

              <div className="space-y-2 border-t pt-4 mt-6"><Label>Observações</Label><Textarea value={diretrizes.observacoes || ""} onChange={(e) => setDiretrizes({ ...diretrizes, observacoes: e.target.value })} onKeyDown={handleEnterToNextField} /></div>
              <div className="flex justify-end gap-3 mt-6"><Button type="button" variant="secondary" onClick={handleSetDefaultYear} disabled={loading || diretrizes.ano_referencia === defaultYear || !diretrizes.ano_referencia}>{diretrizes.ano_referencia === defaultYear ? "Padrão Atual" : "Adotar como Padrão"}</Button><Button type="submit" disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar Diretrizes</Button></div>
            </form>
          </CardContent>
        </Card>
      </div>
      <YearManagementDialog open={isYearManagementDialogOpen} onOpenChange={setIsYearManagementDialogOpen} availableYears={availableYears} defaultYear={defaultYear} onCopy={handleCopyDiretrizes} onDelete={handleDeleteDiretrizes} loading={loading} />
    </div>
  );
};

export default DiretrizesCusteioPage;