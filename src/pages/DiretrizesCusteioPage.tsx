import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronUp, ArrowLeft, Fuel, Package, Settings, HardHat } from "lucide-react";
import { DiretrizCusteio } from "@/types/diretrizes";
import { DiretrizEquipamentoForm } from "@/types/diretrizesEquipamentos";
import { DiretrizClasseIIForm } from "@/types/diretrizesClasseII";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { tipoViaturas, tipoEquipamentosEngenharia } from "@/data/classeIIIData";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { YearManagementDialog } from "@/components/YearManagementDialog"; // Importar o novo diálogo
import { defaultClasseVIConfig } from "@/data/classeVIData"; // NOVO IMPORT

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

// NOVO: Lista de itens padrão da Classe V (Armamento)
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

// NOVO: Lista de categorias da Classe V
const CATEGORIAS_CLASSE_V = [
  "Armt L",
  "Armt P",
  "IODCT",
  "DQBRN",
];

// NOVO: Lista de categorias da Classe VI (CORRIGIDO)
const CATEGORIAS_CLASSE_VI = [
  "Embarcação",
  "Equipamento de Engenharia",
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
  const [loading, setLoading] = useState(true);
  const [showClasseIAlimentacaoConfig, setShowClasseIAlimentacaoConfig] = useState(false);
  const [showClasseIIConfig, setShowClasseIIConfig] = useState(false);
  const [showClasseVConfig, setShowClasseVConfig] = useState(false);
  const [showClasseVIConfig, setShowClasseVIConfig] = useState(false); 
  const [showClasseIIIConfig, setShowClasseIIIConfig] = useState(false);
  
  const [geradorConfig, setGeradorConfig] = useState<DiretrizEquipamentoForm[]>(defaultGeradorConfig);
  const [embarcacaoConfig, setEmbarcacaoConfig] = useState<DiretrizEquipamentoForm[]>(defaultEmbarcacaoConfig);
  const [motomecanizacaoConfig, setMotomecanizacaoConfig] = useState<DiretrizEquipamentoForm[]>(defaultMotomecanizacaoConfig);
  const [equipamentosEngenhariaConfig, setEquipamentosEngenhariaConfig] = useState<DiretrizEquipamentoForm[]>(defaultEquipamentosEngenhariaConfig);
  
  const [classeIIConfig, setClasseIIConfig] = useState<DiretrizClasseIIForm[]>(defaultClasseIIConfig);
  const [classeVConfig, setClasseVConfig] = useState<DiretrizClasseIIForm[]>(defaultClasseVConfig);
  const [classeVIConfig, setClasseVIConfig] = useState<DiretrizClasseIIForm[]>(defaultClasseVIConfig); 
  
  const [diretrizes, setDiretrizes] = useState<Partial<DiretrizCusteio>>(defaultDiretrizes(new Date().getFullYear()));
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedClasseIITab, setSelectedClasseIITab] = useState<string>(CATEGORIAS_CLASSE_II[0]);
  const [selectedClasseVTab, setSelectedClasseVTab] = useState<string>(CATEGORIAS_CLASSE_V[0]);
  const [selectedClasseVITab, setSelectedClasseVITab] = useState<string>(CATEGORIAS_CLASSE_VI[0]); 
  const [selectedClasseIIITab, setSelectedClasseIIITab] = useState<string>(CATEGORIAS_CLASSE_III[0].key);
  
  const [isYearManagementDialogOpen, setIsYearManagementDialogOpen] = useState(false);
  const [defaultYear, setDefaultYear] = useState<number | null>(null);
  
  const { handleEnterToNextField } = useFormNavigation();
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    checkAuthAndLoadYears();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (selectedYear) {
      loadDiretrizesForYear(selectedYear);
    }
  }, [selectedYear]);

  const checkAuthAndLoadYears = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Você precisa estar autenticado");
      navigate("/login");
      return;
    }
    await loadAvailableYears();
    await loadDefaultYear(session.user.id);
  };
  
  const loadDefaultYear = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('default_diretriz_year')
        .eq('id', userId)
        .single();
        
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data && data.default_diretriz_year) {
        setDefaultYear(data.default_diretriz_year);
      } else {
        setDefaultYear(null);
      }
    } catch (error) {
      console.error("Erro ao carregar ano padrão:", error);
    }
  };

  const loadAvailableYears = async () => {
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
      
      const uniqueYears = Array.from(new Set([...years, currentYear])).sort((a, b) => b - a);
      setAvailableYears(uniqueYears);

      if (!uniqueYears.includes(selectedYear)) {
        setSelectedYear(uniqueYears.length > 0 ? uniqueYears[0] : currentYear);
      }

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
      } else {
        setDiretrizes(defaultDiretrizes(year));
      }
      
      // --- Carregar Classe II, V e VI (usando a mesma tabela) ---
      const allClasseIIAndVAndVI = [...CATEGORIAS_CLASSE_II, ...CATEGORIAS_CLASSE_V, ...CATEGORIAS_CLASSE_VI];
      
      const { data: classeItemsData } = await supabase
        .from("diretrizes_classe_ii")
        .select("categoria, item, valor_mnt_dia")
        .eq("user_id", user.id)
        .eq("ano_referencia", year)
        .eq("ativo", true)
        .in("categoria", allClasseIIAndVAndVI);

      const loadedItems = classeItemsData || [];
      
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
      
      // Filtrar e setar Classe VI (NOVO)
      const loadedClasseVI = loadedItems.filter(d => CATEGORIAS_CLASSE_VI.includes(d.categoria));
      if (loadedClasseVI.length > 0) {
        setClasseVIConfig(loadedClasseVI.map(d => ({
          categoria: d.categoria as DiretrizClasseIIForm['categoria'],
          item: d.item,
          valor_mnt_dia: Number(d.valor_mnt_dia),
        })));
      } else {
        setClasseVIConfig(defaultClasseVIConfig);
      }


      // --- Carregar Classe III - Equipamentos ---
      const loadEquipamentos = async (categoria: string, setter: React.Dispatch<React.SetStateAction<DiretrizEquipamentoForm[]>>, defaultData: DiretrizEquipamentoForm[]) => {
        const { data: equipamentosData } = await supabase
          .from("diretrizes_equipamentos_classe_iii")
          .select("*")
          .eq("user_id", user.id)
          .eq("ano_referencia", year)
          .eq("categoria", categoria)
          .eq("ativo", true);

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
          .update(diretrizData)
          .eq("id", diretrizes.id);
        if (error) throw error;
        toast.success("Diretrizes atualizadas!");
      } else {
        const { error } = await supabase
          .from("diretrizes_custeio")
          .insert([diretrizData]);
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
          .filter(g => g.nome_equipamento && g.consumo > 0)
          .map(g => ({
            user_id: user.id,
            ano_referencia: diretrizes.ano_referencia,
            categoria: categoria,
            ...g,
          }));

        if (equipamentosParaSalvar.length > 0) {
          const { error: eqError } = await supabase
            .from("diretrizes_equipamentos_classe_iii")
            .insert(equipamentosParaSalvar);
          if (eqError) throw eqError;
        }
      }
      
      // 3. Salvar Configurações de Classe II, V e VI (usando a mesma tabela diretrizes_classe_ii)
      
      // Deletar registros antigos de Classe II, V e VI
      await supabase
        .from("diretrizes_classe_ii")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", diretrizes.ano_referencia!);
        
      const allClasseItems = [...classeIIConfig, ...classeVConfig, ...classeVIConfig];
        
      const classeItemsParaSalvar = allClasseItems
        .filter(item => item.item && item.valor_mnt_dia >= 0)
        .map(item => ({
          user_id: user.id,
          ano_referencia: diretrizes.ano_referencia,
          categoria: item.categoria,
          item: item.item,
          valor_mnt_dia: item.valor_mnt_dia,
          ativo: true,
        }));
        
      if (classeItemsParaSalvar.length > 0) {
        const { error: c2Error } = await supabase
          .from("diretrizes_classe_ii")
          .insert(classeItemsParaSalvar);
        if (c2Error) throw c2Error;
      }

      await loadAvailableYears();
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
      
      const { error } = await supabase
        .from('profiles')
        .update({ default_diretriz_year: diretrizes.ano_referencia })
        .eq('id', user.id);
        
      if (error) throw error;
      
      setDefaultYear(diretrizes.ano_referencia);
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
        .insert([newCusteio]);
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
          .insert(newEquipamentos);
        if (insertEqError) console.error("Erro ao inserir equipamentos copiados:", insertEqError);
      }
      
      // 3. Copiar Diretrizes de Classe II, V e VI
      const { data: sourceClasseItems, error: classeItemsError } = await supabase
        .from("diretrizes_classe_ii")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", sourceYear);
        
      if (classeItemsError) console.error("Erro ao buscar Classe II/V/VI para cópia:", classeItemsError);
      
      if (sourceClasseItems && sourceClasseItems.length > 0) {
        const newClasseItems = sourceClasseItems.map(c2 => {
          const { id: oldC2Id, created_at: oldC2Created, updated_at: oldC2Updated, ...restC2 } = c2;
          return { ...restC2, ano_referencia: targetYear, user_id: user.id };
        });
        const { error: insertC2Error } = await supabase
          .from("diretrizes_classe_ii")
          .insert(newClasseItems);
        if (insertC2Error) console.error("Erro ao inserir Classe II/V/VI copiada:", insertC2Error);
      }

      toast.success(`Diretrizes do ano ${sourceYear} copiadas com sucesso para o ano ${targetYear}!`);
      setIsYearManagementDialogOpen(false);
      setSelectedYear(targetYear);
      await loadAvailableYears();
      
    } catch (error: any) {
      console.error("Erro ao copiar diretrizes:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDiretrizes = async (year: number) => {
    if (year === currentYear) {
      toast.error("Não é possível excluir a diretriz do ano atual.");
      return;
    }
    
    if (!confirm(`Tem certeza que deseja EXCLUIR TODAS as diretrizes para o ano ${year}? Esta ação é irreversível.`)) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      setLoading(true);
      
      // 1. Excluir Diretrizes de Equipamentos (Classe III)
      await supabase
        .from("diretrizes_equipamentos_classe_iii")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", year);
        
      // 2. Excluir Diretrizes de Classe II, V e VI
      await supabase
        .from("diretrizes_classe_ii")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", year);
        
      // 3. Excluir Diretriz de Custeio (Valores e Fatores)
      const { error: custeioError } = await supabase
        .from("diretrizes_custeio")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", year);
        
      if (custeioError) throw custeioError;

      toast.success(`Diretrizes do ano ${year} excluídas com sucesso!`);
      setIsYearManagementDialogOpen(false);
      await loadAvailableYears();
      
    } catch (error: any) {
      console.error("Erro ao excluir diretrizes:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };


  // Função genérica para adicionar item (Classe III)
  const handleAddItem = (config: DiretrizEquipamentoForm[], setConfig: React.Dispatch<React.SetStateAction<DiretrizEquipamentoForm[]>>, unidade: 'L/h' | 'km/L') => {
    setConfig([
      ...config,
      { nome_equipamento: "", tipo_combustivel: "OD", consumo: 0, unidade: unidade }
    ]);
  };

  // Função genérica para remover item (Classe III)
  const handleRemoveItem = (config: DiretrizEquipamentoForm[], setConfig: React.Dispatch<React.SetStateAction<DiretrizEquipamentoForm[]>>, index: number) => {
    setConfig(config.filter((_, i) => i !== index));
  };

  // Função genérica para atualizar item (Classe III)
  const handleUpdateItem = (config: DiretrizEquipamentoForm[], setConfig: React.Dispatch<React.SetStateAction<DiretrizEquipamentoForm[]>>, index: number, field: keyof DiretrizEquipamentoForm, value: any) => {
    const novosItens = [...config];
    novosItens[index] = { ...novosItens[index], [field]: value };
    setConfig(novosItens);
  };
  
  // --- Funções de Gerenciamento da Classe II, V e VI ---
  const handleAddClasseItem = (config: DiretrizClasseIIForm[], setConfig: React.Dispatch<React.SetStateAction<DiretrizClasseIIForm[]>>, categoria: DiretrizClasseIIForm['categoria']) => {
    setConfig(prev => [
      ...prev,
      { categoria: categoria, item: "", valor_mnt_dia: 0 } as DiretrizClasseIIForm
    ]);
  };

  const handleRemoveClasseItem = (config: DiretrizClasseIIForm[], setConfig: React.Dispatch<React.SetStateAction<DiretrizClasseIIForm[]>>, index: number) => {
    setConfig(config.filter((_, i) => i !== index));
  };

  const handleUpdateClasseItem = (config: DiretrizClasseIIForm[], setConfig: React.Dispatch<React.SetStateAction<DiretrizClasseIIForm[]>>, index: number, field: keyof DiretrizClasseIIForm, value: any) => {
    const novosItens = [...config];
    novosItens[index] = { ...novosItens[index], [field]: value };
    setConfig(novosItens);
  };
  
  // Função para renderizar a lista de itens da Classe II/V/VI por categoria
  const renderClasseList = (
    config: DiretrizClasseIIForm[], 
    setConfig: React.Dispatch<React.SetStateAction<DiretrizClasseIIForm[]>>,
    categorias: string[],
    selectedTab: string
  ) => {
    const filteredItems = config.filter(item => item.categoria === selectedTab);
    
    return (
      <div className="space-y-4 pt-4">
        {filteredItems.map((item, index) => {
          // Encontrar o índice original no array completo para permitir a atualização/remoção
          const indexInMainArray = config.findIndex(c => c === item);
          
          const handleUpdateFilteredItem = (field: keyof DiretrizClasseIIForm, value: any) => {
            if (indexInMainArray !== -1) {
              handleUpdateClasseItem(config, setConfig, indexInMainArray, field, value);
            }
          };

          const handleRemoveFilteredItem = () => {
            if (indexInMainArray !== -1) {
              handleRemoveClasseItem(config, setConfig, indexInMainArray);
            }
          };
          
          return (
            <div key={index} className="grid grid-cols-12 gap-2 items-end border-b pb-3 last:border-0">
              <div className="col-span-8">
                <Label className="text-xs">Item</Label>
                <Input
                  value={item.item}
                  onChange={(e) => handleUpdateFilteredItem('item', e.target.value)}
                  placeholder="Ex: Colete balístico"
                  onKeyDown={handleEnterToNextField}
                />
              </div>
              <div className="col-span-3">
                <Label className="text-xs">Valor Mnt/Dia (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={item.valor_mnt_dia === 0 ? "" : item.valor_mnt_dia}
                  onChange={(e) => handleUpdateFilteredItem('valor_mnt_dia', parseFloat(e.target.value) || 0)}
                  onKeyDown={handleEnterToNextField}
                />
              </div>
              <div className="col-span-1 flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRemoveFilteredItem}
                  type="button"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => handleAddClasseItem(config, setConfig, selectedTab as DiretrizClasseIIForm['categoria'])} 
          className="w-full"
          type="button"
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Item
        </Button>
      </div>
    );
  };
  
  // Função para renderizar a lista de itens da Classe III por categoria
  const renderClasseIIIList = (categoria: string, config: DiretrizEquipamentoForm[], setConfig: React.Dispatch<React.SetStateAction<DiretrizEquipamentoForm[]>>) => {
    const unidade = categoria === 'MOTOMECANIZACAO' ? 'km/L' : 'L/h';
    
    return (
      <div className="space-y-4 pt-4">
        {config.map((item, index) => (
          <div key={index} className="grid grid-cols-12 gap-2 items-end border-b pb-3 last:border-0">
            <div className="col-span-5">
              <Label className="text-xs">Nome do Equipamento</Label>
              <Input
                value={item.nome_equipamento}
                onChange={(e) => handleUpdateItem(config, setConfig, index, 'nome_equipamento', e.target.value)}
                placeholder="Ex: Retroescavadeira"
                onKeyDown={handleEnterToNextField}
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Combustível</Label>
              <Select
                value={item.tipo_combustivel}
                onValueChange={(val: 'GAS' | 'OD') => handleUpdateItem(config, setConfig, index, 'tipo_combustivel', val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GAS">Gasolina</SelectItem>
                  <SelectItem value="OD">Diesel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Consumo</Label>
              <Input
                type="number"
                step="0.01"
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={item.consumo === 0 ? "" : item.consumo}
                onChange={(e) => handleUpdateItem(config, setConfig, index, 'consumo', parseFloat(e.target.value) || 0)}
                onKeyDown={handleEnterToNextField}
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Unidade</Label>
              <Input value={unidade} disabled className="bg-muted text-muted-foreground" onKeyDown={handleEnterToNextField} />
            </div>
            <div className="col-span-1 flex justify-end">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveItem(config, setConfig, index)}
                type="button"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => handleAddItem(config, setConfig, unidade as 'L/h' | 'km/L')} 
          className="w-full"
          type="button"
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Equipamento
        </Button>
      </div>
    );
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/ptrab")} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Planos de Trabalho
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setIsYearManagementDialogOpen(true)}
            disabled={loading}
          >
            <Settings className="mr-2 h-4 w-4" />
            Gerenciar Anos
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configurações da Diretriz de Custeio</CardTitle>
            <CardDescription>Diretrizes de Custeio (COLOG)</CardDescription>
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
                        {year} {year === currentYear && "(Atual)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <p className="text-sm text-muted-foreground pt-1">
                  Ano Padrão de Cálculo: 
                  <span className="font-semibold text-primary ml-1">
                    {defaultYear ? defaultYear : 'Não definido (usando o mais recente)'}
                  </span>
                </p>
              </div>

              {/* SEÇÃO CLASSE I - ALIMENTAÇÃO */}
              <div className="border-t pt-4 mt-6">
                <div 
                  className="flex items-center justify-between cursor-pointer py-2" 
                  onClick={() => setShowClasseIAlimentacaoConfig(!showClasseIAlimentacaoConfig)}
                >
                  <h3 className="text-lg font-semibold">Classe I - Alimentação</h3>
                  {showClasseIAlimentacaoConfig ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
                
                {showClasseIAlimentacaoConfig && (
                  <div className="space-y-4 mt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Valor QS</Label>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.01"
                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pr-16"
                            value={diretrizes.classe_i_valor_qs?.toFixed(2)}
                            onChange={(e) => setDiretrizes({ ...diretrizes, classe_i_valor_qs: parseFloat(e.target.value) || 0 })}
                            onKeyDown={handleEnterToNextField}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$/dia</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Valor QR</Label>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.01"
                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pr-16"
                            value={diretrizes.classe_i_valor_qr?.toFixed(2)}
                            onChange={(e) => setDiretrizes({ ...diretrizes, classe_i_valor_qr: parseFloat(e.target.value) || 0 })}
                            onKeyDown={handleEnterToNextField}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$/dia</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* SEÇÃO CLASSE II - MATERIAL DE INTENDÊNCIA */}
              <div className="border-t pt-4 mt-6">
                <div 
                  className="flex items-center justify-between cursor-pointer py-2" 
                  onClick={() => setShowClasseIIConfig(!showClasseIIConfig)}
                >
                  <h3 className="text-lg font-semibold">
                    Classe II - Material de Intendência
                  </h3>
                  {showClasseIIConfig ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
                
                {showClasseIIConfig && (
                  <Card>
                    <CardContent className="pt-4">
                      <Tabs value={selectedClasseIITab} onValueChange={setSelectedClasseIITab}>
                        <TabsList className="grid w-full grid-cols-3">
                          {CATEGORIAS_CLASSE_II.map(cat => (
                            <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
                          ))}
                        </TabsList>
                        
                        {CATEGORIAS_CLASSE_II.map(cat => (
                          <TabsContent key={cat} value={cat}>
                            {renderClasseList(classeIIConfig, setClasseIIConfig, CATEGORIAS_CLASSE_II, cat)}
                          </TabsContent>
                        ))}
                      </Tabs>
                    </CardContent>
                  </Card>
                )}
              </div>
              
              {/* SEÇÃO CLASSE VI - MATERIAL DE ENGENHARIA (NOVO) */}
              <div className="border-t pt-4 mt-6">
                <div 
                  className="flex items-center justify-between cursor-pointer py-2" 
                  onClick={() => setShowClasseVIConfig(!showClasseVIConfig)}
                >
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <HardHat className="h-5 w-5 text-secondary" />
                    Classe VI - Material de Engenharia
                  </h3>
                  {showClasseVIConfig ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
                
                {showClasseVIConfig && (
                  <Card>
                    <CardContent className="pt-4">
                      <Tabs value={selectedClasseVITab} onValueChange={setSelectedClasseVITab}>
                        <TabsList className="grid w-full grid-cols-2"> {/* CORRIGIDO PARA 2 COLUNAS */}
                          {CATEGORIAS_CLASSE_VI.map(cat => (
                            <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
                          ))}
                        </TabsList>
                        
                        {CATEGORIAS_CLASSE_VI.map(cat => (
                          <TabsContent key={cat} value={cat}>
                            {renderClasseList(classeVIConfig, setClasseVIConfig, CATEGORIAS_CLASSE_VI, cat)}
                          </TabsContent>
                        ))}
                      </Tabs>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* SEÇÃO CLASSE III - COMBUSTÍVEIS E LUBRIFICANTES */}
              <div className="border-t pt-4 mt-6">
                <div 
                  className="flex items-center justify-between cursor-pointer py-2" 
                  onClick={() => setShowClasseIIIConfig(!showClasseIIIConfig)}
                >
                  <h3 className="text-lg font-semibold">
                    Classe III - Combustíveis e Lubrificantes
                  </h3>
                  {showClasseIIIConfig ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
                
                {showClasseIIIConfig && (
                  <Card>
                    <CardContent className="pt-4">
                      <Tabs value={selectedClasseIIITab} onValueChange={setSelectedClasseIIITab}>
                        <TabsList className="grid w-full grid-cols-4">
                          {CATEGORIAS_CLASSE_III.map(cat => (
                            <TabsTrigger key={cat.key} value={cat.key}>{cat.label}</TabsTrigger>
                          ))}
                        </TabsList>
                        
                        <TabsContent value="GERADOR">
                          {renderClasseIIIList("GERADOR", geradorConfig, setGeradorConfig)}
                        </TabsContent>
                        <TabsContent value="EMBARCACAO">
                          {renderClasseIIIList("EMBARCACAO", embarcacaoConfig, setEmbarcacaoConfig)}
                        </TabsContent>
                        <TabsContent value="MOTOMECANIZACAO">
                          {renderClasseIIIList("MOTOMECANIZACAO", motomecanizacaoConfig, setMotomecanizacaoConfig)}
                        </TabsContent>
                        <TabsContent value="EQUIPAMENTO_ENGENHARIA">
                          {renderClasseIIIList("EQUIPAMENTO_ENGENHARIA", equipamentosEngenhariaConfig, setEquipamentosEngenhariaConfig)}
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                )}
              </div>
              
              {/* SEÇÃO CLASSE V - ARMAMENTO */}
              <div className="border-t pt-4 mt-6">
                <div 
                  className="flex items-center justify-between cursor-pointer py-2" 
                  onClick={() => setShowClasseVConfig(!showClasseVConfig)}
                >
                  <h3 className="text-lg font-semibold">
                    Classe V - Armamento
                  </h3>
                  {showClasseVConfig ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
                
                {showClasseVConfig && (
                  <Card>
                    <CardContent className="pt-4">
                      <Tabs value={selectedClasseVTab} onValueChange={setSelectedClasseVTab}>
                        <TabsList className="grid w-full grid-cols-4">
                          {CATEGORIAS_CLASSE_V.map(cat => (
                            <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
                          ))}
                        </TabsList>
                        
                        {CATEGORIAS_CLASSE_V.map(cat => (
                          <TabsContent key={cat} value={cat}>
                            {renderClasseList(classeVConfig, setClasseVConfig, CATEGORIAS_CLASSE_V, cat)}
                          </TabsContent>
                        ))}
                      </Tabs>
                    </CardContent>
                  </Card>
                )}
              </div>


              <div className="space-y-2 border-t pt-4 mt-6">
                <Label>Observações</Label>
                <Textarea
                  value={diretrizes.observacoes}
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
                  {loading ? "Salvando..." : "Salvar Diretrizes"}
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
        currentYear={currentYear}
        onCopy={handleCopyDiretrizes}
        onDelete={handleDeleteDiretrizes}
        loading={loading}
      />
    </div>
  );
};

export default DiretrizesCusteioPage;