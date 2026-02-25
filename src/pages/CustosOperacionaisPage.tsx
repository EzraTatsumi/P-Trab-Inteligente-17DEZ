"use client";

/**
 * Página de Configuração de Custos Operacionais - v1.2.0
 * Layout original restaurado conforme solicitação do usuário.
 * Integração mínima para funcionamento das Missões do Centro de Instrução.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Activity, Loader2, Save, Settings, ChevronDown, ChevronUp, Plus, Trash2, Pencil, Plane, Package, Search, FileSpreadsheet, HardDrive } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { YearManagementDialog } from "@/components/YearManagementDialog";
import { formatCurrencyInput, numberToRawDigits, formatCurrency, formatCodug } from "@/lib/formatUtils";
import { useSession } from "@/components/SessionContextProvider";
import { Tables, TablesInsert, TablesUpdate, Json } from "@/integrations/supabase/types";
import { diretrizOperacionalSchema } from "@/lib/validationSchemas";
import * as z from "zod";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDefaultDiretrizYear } from "@/hooks/useDefaultDiretrizYear";
import { useQueryClient } from "@tanstack/react-query";
import { DiretrizPassagem, TrechoPassagem } from "@/types/diretrizesPassagens";
import CurrencyInput from "@/components/CurrencyInput";
import PassagemDiretrizFormDialog from "@/components/PassagemDiretrizFormDialog";
import PassagemDiretrizRow from "@/components/PassagemDiretrizRow"; 
import ConcessionariaDiretrizFormDialog from "@/components/ConcessionariaDiretrizFormDialog";
import ConcessionariaDiretrizRow from "@/components/ConcessionariaDiretrizRow";
import { 
    DiretrizConcessionaria, 
    CATEGORIAS_CONCESSIONARIA, 
    CategoriaConcessionaria,
    DiretrizConcessionariaForm
} from "@/types/diretrizesConcessionaria";
import { 
    DiretrizMaterialConsumo, 
    ItemAquisicao 
} from "@/types/diretrizesMaterialConsumo";
import MaterialConsumoDiretrizFormDialog from "@/components/MaterialConsumoDiretrizFormDialog";
import MaterialConsumoDiretrizRow from "@/components/MaterialConsumoDiretrizRow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMaterialConsumoDiretrizes } from "@/hooks/useMaterialConsumoDiretrizes";
import PageMetadata from "@/components/PageMetadata";
import MaterialConsumoExportImportDialog from "@/components/MaterialConsumoExportImportDialog";

import { DiretrizServicosTerceiros, ItemAquisicaoServico } from "@/types/diretrizesServicosTerceiros";
import { useServicosTerceirosDiretrizes } from "@/hooks/useServicosTerceirosDiretrizes";
import ServicosTerceirosDiretrizRow from "@/components/ServicosTerceirosDiretrizRow";
import ServicosTerceirosDiretrizFormDialog from "@/components/ServicosTerceirosDiretrizFormDialog";
import ServicosTerceirosExportImportDialog from "@/components/ServicosTerceirosExportImportDialog";

import { DiretrizMaterialPermanente } from "@/types/diretrizesMaterialPermanente";
import { useMaterialPermanenteDiretrizes } from "@/hooks/useMaterialPermanenteDiretrizes";
import MaterialPermanenteDiretrizRow from "@/components/MaterialPermanenteDiretrizRow";
import MaterialPermanenteDiretrizFormDialog from "@/components/MaterialPermanenteDiretrizFormDialog";
import MaterialPermanenteExportImportDialog from "@/components/MaterialPermanenteExportImportDialog";

// IMPORTS PARA MISSÕES
import { runMission02 } from "@/tours/missionTours";
import { isGhostMode } from "@/lib/ghostStore";
import { markMissionCompleted } from "@/lib/missionUtils";

type DiretrizOperacional = Tables<'diretrizes_operacionais'>;

const DIARIA_RANKS_CONFIG = [
  { key: 'of_gen', label: 'Of Gen', fieldPrefix: 'diaria_of_gen' },
  { key: 'of_sup', label: 'Of Sup', fieldPrefix: 'diaria_of_sup' },
  { key: 'of_int_sgt', label: 'Of Int/Sub/Asp Of/ST/Sgt', fieldPrefix: 'diaria_of_int_sgt' },
  { key: 'demais_pracas', label: 'Demais Praças', fieldPrefix: 'diaria_demais_pracas' },
];

const OPERATIONAL_FIELDS = [
  { key: 'fator_servicos_terceiros', label: 'Serviços de Terceiros (Fator)', type: 'factor' as const, placeholder: 'Ex: 0.10 (para 10%)' },
  { key: 'fator_material_consumo', label: 'Material de Consumo (Fator)', type: 'factor' as const, placeholder: 'Ex: 0.02 (para 2%)' },
];

const defaultDiretrizes = (year: number): Partial<DiretrizOperacional> => ({
  ano_referencia: year,
  fator_passagens_aereas: 0,
  fator_servicos_terceiros: 0,
  valor_complemento_alimentacao: 0,
  valor_fretamento_aereo_hora: 0,
  valor_locacao_estrutura_dia: 0,
  valor_locacao_viaturas_dia: 0,
  fator_material_consumo: 0,
  fator_concessionaria: 0,
  observacoes: "",
  
  diaria_referencia_legal: 'Decreto Nº 12.324 de 19DEZ24',
  diaria_of_gen_bsb: 600.00,
  diaria_of_gen_capitais: 515.00,
  diaria_of_gen_demais: 455.00,
  diaria_of_sup_bsb: 510.00,
  diaria_of_sup_capitais: 450.00,
  diaria_of_sup_demais: 395.00,
  diaria_of_int_sgt_bsb: 425.00,
  diaria_of_int_sgt_capitais: 380.00,
  diaria_of_int_sgt_demais: 335.00,
  diaria_demais_pracas_bsb: 355.00,
  diaria_demais_pracas_capitais: 315.00,
  diaria_demais_pracas_demais: 280.00,
  
  taxa_embarque: 95.00,
});

const SCROLL_ZONE_HEIGHT = 50;
const SCROLL_SPEED = 10;
let scrollAnimationFrame: number | null = null;
let scrollDirection: 'up' | 'down' | null = null;

const autoScroll = () => {
    if (scrollDirection === 'up') {
        window.scrollBy(0, -SCROLL_SPEED);
    } else if (scrollDirection === 'down') {
        window.scrollBy(0, SCROLL_SPEED);
    }

    if (scrollDirection) {
        scrollAnimationFrame = requestAnimationFrame(autoScroll);
    } else {
        scrollAnimationFrame = null;
    }
};

const handleGlobalDragOver = (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes("application/json")) {
        return;
    }
    
    e.preventDefault();

    const viewportHeight = window.innerHeight;
    const cursorY = e.clientY;

    if (cursorY < SCROLL_ZONE_HEIGHT) {
        if (scrollDirection !== 'up') {
            scrollDirection = 'up';
            if (!scrollAnimationFrame) {
                scrollAnimationFrame = requestAnimationFrame(autoScroll);
            }
        }
    } 
    else if (cursorY > viewportHeight - SCROLL_ZONE_HEIGHT) {
        if (scrollDirection !== 'down') {
            scrollDirection = 'down';
            if (!scrollAnimationFrame) {
                scrollAnimationFrame = requestAnimationFrame(autoScroll);
            }
        }
    } 
    else {
        if (scrollDirection) {
            scrollDirection = null;
            if (scrollAnimationFrame) {
                cancelAnimationFrame(scrollAnimationFrame);
                scrollAnimationFrame = null;
            }
        }
    }
};

const handleGlobalDragEnd = () => {
    scrollDirection = null;
    if (scrollAnimationFrame) {
        cancelAnimationFrame(scrollAnimationFrame);
        scrollAnimationFrame = null;
    }
};

type IndexedItemAquisicao = ItemAquisicao & {
    diretrizId: string;
    subitemNr: string;
    subitemNome: string;
};

type IndexedItemServico = ItemAquisicaoServico & {
    diretrizId: string;
    subitemNr: string;
    subitemNome: string;
};

type IndexedItemPermanente = ItemAquisicao & {
    diretrizId: string;
    subitemNr: string;
    subitemNome: string;
};


const CustosOperacionaisPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const hasStartedTour = useRef(false);
  
  const currentYear = new Date().getFullYear();
  const [diretrizes, setDiretrizes] = useState<Partial<DiretrizOperacional>>(defaultDiretrizes(currentYear));
  
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [isYearManagementDialogOpen, setIsYearManagementDialogOpen] = useState(false);
  
  const { data: defaultYearData, isLoading: isLoadingDefaultYear } = useDefaultDiretrizYear();
  const defaultYear = defaultYearData?.defaultYear || null;
  
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  
  const [fieldCollapseState, setFieldCollapseState] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    OPERATIONAL_FIELDS.forEach(field => {
      initialState[field.key as string] = false;
    });
    
    const shouldOpenPassagens = location.state && (location.state as { openPassagens?: boolean }).openPassagens;
    const shouldOpenConcessionaria = location.state && (location.state as { openConcessionaria?: boolean }).openConcessionaria;
    const shouldOpenMaterialConsumo = location.state && (location.state as { openMaterialConsumo?: boolean }).openMaterialConsumo;
    const shouldOpenServicosTerceiros = location.state && (location.state as { openServicosTerceiros?: boolean }).openServicosTerceiros;
    const shouldOpenMaterialPermanente = location.state && (location.state as { openMaterialPermanente?: boolean }).openMaterialPermanente;
    
    initialState['diarias_detalhe'] = false; 
    initialState['passagens_detalhe'] = shouldOpenPassagens || false; 
    initialState['concessionaria_detalhe'] = shouldOpenConcessionaria || false;
    initialState['material_consumo_detalhe'] = shouldOpenMaterialConsumo || false;
    initialState['servicos_terceiros_detalhe'] = shouldOpenServicosTerceiros || false;
    initialState['material_permanente_detalhe'] = shouldOpenMaterialPermanente || false;
    return initialState;
  });
  
  const { handleEnterToNextField } = useFormNavigation();
  
  const [diretrizesPassagens, setDiretrizesPassagens] = useState<DiretrizPassagem[]>([]);
  const [isPassagemFormOpen, setIsPassagemFormOpen] = useState(false);
  const [diretrizToEdit, setDiretrizToEdit] = useState<DiretrizPassagem | null>(null);
  
  const [diretrizesConcessionaria, setDiretrizesConcessionaria] = useState<DiretrizConcessionaria[]>([]);
  const [isConcessionariaFormOpen, setIsConcessionariaFormOpen] = useState(false);
  const [diretrizConcessionariaToEdit, setDiretrizConcessionariaToEdit] = useState<DiretrizConcessionaria | null>(null);
  const [selectedConcessionariaTab, setSelectedConcessionariaTab] = useState<CategoriaConcessionaria>(CATEGORIAS_CONCESSIONARIA[0]);
  
  const { 
      diretrizes: diretrizesMaterialConsumo, 
      isLoading: isLoadingMaterialConsumo, 
      handleMoveItem,
      isMoving: isMovingMaterialConsumo,
  } = useMaterialConsumoDiretrizes(selectedYear);

  const {
      diretrizes: diretrizesServicosTerceiros,
      isLoading: isLoadingServicosTerceiros,
      handleMoveItem: handleMoveItemServico,
      isMoving: isMovingServicosTerceiros,
  } = useServicosTerceirosDiretrizes(selectedYear);

  const {
      diretrizes: diretrizesMaterialPermanente,
      isLoading: isLoadingMaterialPermanente,
      handleMoveItem: handleMoveItemPermanente,
      isMoving: isMovingMaterialPermanente,
  } = useMaterialPermanenteDiretrizes(selectedYear);
  
  const [isMaterialConsumoFormOpen, setIsMaterialConsumoFormOpen] = useState(false);
  const [diretrizMaterialConsumoToEdit, setDiretrizMaterialConsumoToEdit] = useState<DiretrizMaterialConsumo | null>(null);
  
  const [isServicosTerceirosFormOpen, setIsServicosTerceirosFormOpen] = useState(false);
  const [diretrizServicosTerceirosToEdit, setDiretrizServicosTerceirosToEdit] = useState<DiretrizServicosTerceiros | null>(null);
  const [searchTermServicos, setSearchTermServicos] = useState("");
  const [subitemServicoToOpenId, setSubitemServicoToOpenId] = useState<string | null>(null);
  const [isExportImportServicosDialogOpen, setIsExportImportServicosDialogOpen] = useState(false);

  const [isMaterialPermanenteFormOpen, setIsMaterialPermanenteFormOpen] = useState(false);
  const [diretrizMaterialPermanenteToEdit, setDiretrizMaterialPermanenteToEdit] = useState<DiretrizMaterialPermanente | null>(null);
  const [searchTermPermanente, setSearchTermPermanente] = useState("");
  const [subitemPermanenteToOpenId, setSubitemPermanenteToOpenId] = useState<string | null>(null);
  const [isExportImportPermanenteDialogOpen, setIsExportImportPermanenteDialogOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [subitemToOpenId, setSubitemToOpenId] = useState<string | null>(null);
  const [isExportImportDialogOpen, setIsExportImportDialogOpen] = useState(false);
  
  const collapsibleRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handleCollapseChange = (key: string, open: boolean) => {
      setFieldCollapseState(prev => ({ ...prev, [key]: open }));

      if (open) {
          setTimeout(() => {
              const element = collapsibleRefs.current[key];
              if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
          }, 100);
      }
  };
  
  useEffect(() => {
    (window as any).expandMaterialConsumo = () => {
        setFieldCollapseState(prev => ({ ...prev, material_consumo_detalhe: true }));
        setTimeout(() => {
            const el = document.querySelector('.aba-material-consumo');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
    };

    return () => {
        delete (window as any).expandMaterialConsumo;
    };
  }, []);

  useEffect(() => {
    if (loading || isLoadingDefaultYear || hasStartedTour.current) return;

    const startTour = searchParams.get('startTour') === 'true';
    const activeMissionId = localStorage.getItem('active_mission_id');
    const ghost = isGhostMode();

    if (startTour && ghost && activeMissionId === '2' && user?.id) {
      hasStartedTour.current = true;
      const timer = setTimeout(() => {
        runMission02(user.id, () => {
          markMissionCompleted(2, user.id);
          navigate('/ptrab?showHub=true');
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, isLoadingDefaultYear, searchParams, navigate, user?.id]);
  
  useEffect(() => {
    window.addEventListener('dragover', handleGlobalDragOver);
    window.addEventListener('dragend', handleGlobalDragEnd);
    window.addEventListener('drop', handleGlobalDragEnd);

    return () => {
      window.removeEventListener('dragover', handleGlobalDragOver);
      window.removeEventListener('dragend', handleGlobalDragEnd);
      window.removeEventListener('drop', handleGlobalDragEnd);
      handleGlobalDragEnd();
    };
  }, []);

  useEffect(() => {
    if (!isLoadingDefaultYear && defaultYearData) {
        const checkAuthAndLoadYears = async () => {
            const { data: { session } = { session: null } } = await supabase.auth.getSession();
            if (!session) {
                toast.error("Você precisa estar autenticado");
                navigate("/login");
                return;
            }
            
            await loadAvailableYears(defaultYearData.defaultYear);
            setSelectedYear(defaultYearData.year);
        };
        checkAuthAndLoadYears();
    }
  }, [isLoadingDefaultYear, defaultYearData]);

  useEffect(() => {
    if (selectedYear) {
      loadDiretrizesForYear(selectedYear);
      loadDiretrizesPassagens(selectedYear); 
      loadDiretrizesConcessionaria(selectedYear);
    }
  }, [selectedYear]);

  const loadAvailableYears = async (defaultYearId: number | null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [
          { data: opData, error: opError },
          { data: passagensData, error: passagensError },
          { data: concessionariaData, error: concessionariaError },
          { data: materialConsumoData, error: materialConsumoError },
          { data: servicosData, error: servicosError },
          { data: permanenteData, error: permanenteError }
      ] = await Promise.all([
          supabase.from("diretrizes_operacionais").select("ano_referencia").eq("user_id", user.id),
          supabase.from("diretrizes_passagens").select("ano_referencia").eq("user_id", user.id),
          supabase.from("diretrizes_concessionaria").select("ano_referencia").eq("user_id", user.id),
          supabase.from("diretrizes_material_consumo").select("ano_referencia").eq("user_id", user.id),
          supabase.from("diretrizes_servicos_terceiros" as any).select("ano_referencia").eq("user_id", user.id),
          supabase.from("diretrizes_material_permanente" as any).select("ano_referencia").eq("user_id", user.id),
      ]);

      if (opError || passagensError || concessionariaError || materialConsumoError || servicosError || permanenteError) throw opError || passagensError || concessionariaError || materialConsumoError || servicosError || permanenteError;

      const opYears = opData ? opData.map(d => d.ano_referencia) : [];
      const passagensYears = passagensData ? passagensData.map(d => d.ano_referencia) : [];
      const concessionariaYears = concessionariaData ? concessionariaData.map(d => d.ano_referencia) : [];
      const materialConsumoYears = materialConsumoData ? materialConsumoData.map(d => d.ano_referencia) : [];
      const servicosYears = servicosData ? (servicosData as any[]).map(d => d.ano_referencia) : [];
      const permanenteYears = permanenteData ? (permanenteData as any[]).map(d => d.ano_referencia) : [];

      const yearsToInclude = new Set([...opYears, ...passagensYears, ...concessionariaYears, ...materialConsumoYears, ...servicosYears, ...permanenteYears]);
      
      if (defaultYearId && !yearsToInclude.has(defaultYearId)) {
          yearsToInclude.add(defaultYearId);
      }
      
      if (yearsToInclude.size === 0) {
          yearsToInclude.add(currentYear);
      }
      
      const uniqueYears = Array.from(yearsToInclude).filter(y => y > 0).sort((a, b) => b - a);
      setAvailableYears(uniqueYears);

    } catch (error: any) {
      console.error("Erro ao carregar anos disponíveis:", error);
      toast.error("Erro ao carregar anos disponíveis");
    }
  };
  
  const loadDiretrizesForYear = async (year: number) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("diretrizes_operacionais")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", year)
        .maybeSingle();

      if (error) throw error;

      const loadedData = data || defaultDiretrizes(year);
      
      const numericData: Partial<DiretrizOperacional> = {
        ...loadedData,
        fator_passagens_aereas: Number(loadedData.fator_passagens_aereas || 0),
        fator_servicos_terceiros: Number(loadedData.fator_servicos_terceiros || 0),
        fator_material_consumo: Number(loadedData.fator_material_consumo || 0),
        fator_concessionaria: Number(loadedData.fator_concessionaria || 0),
        
        valor_complemento_alimentacao: Number(loadedData.valor_complemento_alimentacao || 0),
        valor_fretamento_aereo_hora: Number(loadedData.valor_fretamento_aereo_hora || 0),
        valor_locacao_estrutura_dia: Number(loadedData.valor_locacao_estrutura_dia || 0),
        valor_locacao_viaturas_dia: Number(loadedData.valor_locacao_viaturas_dia || 0),
        
        diaria_referencia_legal: loadedData.diaria_referencia_legal || defaultDiretrizes(year).diaria_referencia_legal,
        diaria_of_gen_bsb: Number(loadedData.diaria_of_gen_bsb || 0),
        diaria_of_gen_capitais: Number(loadedData.diaria_of_gen_capitais || 0),
        diaria_of_gen_demais: Number(loadedData.diaria_of_gen_demais || 0),
        diaria_of_sup_bsb: Number(loadedData.diaria_of_sup_bsb || 0),
        diaria_of_sup_capitais: Number(loadedData.diaria_of_sup_capitais || 0),
        diaria_of_sup_demais: Number(loadedData.diaria_of_sup_demais || 0),
        diaria_of_int_sgt_bsb: Number(loadedData.diaria_of_int_sgt_bsb || 0),
        diaria_of_int_sgt_capitais: Number(loadedData.diaria_of_int_sgt_capitais || 0),
        diaria_of_int_sgt_demais: Number(loadedData.diaria_of_int_sgt_demais || 0),
        diaria_demais_pracas_bsb: Number(loadedData.diaria_demais_pracas_bsb || 0),
        diaria_demais_pracas_capitais: Number(loadedData.diaria_demais_pracas_capitais || 0),
        diaria_demais_pracas_demais: Number(loadedData.diaria_demais_pracas_demais || 0),
        
        taxa_embarque: Number(loadedData.taxa_embarque || defaultDiretrizes(year).taxa_embarque),
        
        observacoes: loadedData.observacoes || "",
      };
      
      setDiretrizes(numericData);
      
      const initialRawInputs: Record<string, string> = {};
      
      OPERATIONAL_FIELDS.filter(f => (f.type as string) === 'currency').forEach(f => {
        initialRawInputs[f.key as string] = numberToRawDigits(numericData[f.key as keyof DiretrizOperacional] as number);
      });
      
      DIARIA_RANKS_CONFIG.forEach(rank => {
        initialRawInputs[`diaria_${rank.key}_bsb`] = numberToRawDigits(numericData[`diaria_${rank.key}_bsb` as keyof DiretrizOperacional] as number);
        initialRawInputs[`diaria_${rank.key}_capitais`] = numberToRawDigits(numericData[`diaria_${rank.key}_capitais` as keyof DiretrizOperacional] as number);
        initialRawInputs[`diaria_${rank.key}_demais`] = numberToRawDigits(numericData[`diaria_${rank.key}_demais` as keyof DiretrizOperacional] as number);
      });
      
      initialRawInputs['taxa_embarque'] = numberToRawDigits(numericData.taxa_embarque as number);
      
      setRawInputs(initialRawInputs);
      
    } catch (error: any) {
      console.error("Erro ao carregar diretrizes operacionais:", error);
      toast.error("Erro ao carregar diretrizes para o ano selecionado");
    } finally {
      setLoading(false);
    }
  };
  
  const loadDiretrizesPassagens = async (year: number) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data, error } = await supabase
            .from('diretrizes_passagens')
            .select('*')
            .eq('user_id', user.id)
            .eq('ano_referencia', year)
            .order('om_referencia', { ascending: true });
            
        if (error) throw error;
        
        const typedData: DiretrizPassagem[] = (data || []).map(d => ({
            ...d,
            trechos: (d.trechos as unknown as TrechoPassagem[]) || [],
            data_inicio_vigencia: d.data_inicio_vigencia || null,
            data_fim_vigencia: d.data_fim_vigencia || null,
        }));
        
        setDiretrizesPassagens(typedData);
        
    } catch (error) {
        console.error("Erro ao carregar diretrizes de passagens:", error);
        toast.error("Erro ao carregar contratos de passagens.");
    }
  };
  
  const loadDiretrizesConcessionaria = async (year: number) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data, error } = await supabase
            .from('diretrizes_concessionaria')
            .select('*')
            .eq('user_id', user.id)
            .eq('ano_referencia', year)
            .order('categoria', { ascending: true })
            .order('nome_concessionaria', { ascending: true });
            
        if (error) throw error;
        
        const typedData: DiretrizConcessionaria[] = (data || []).map((d: Tables<'diretrizes_concessionaria'>) => ({
            ...d,
            consumo_pessoa_dia: Number(d.consumo_pessoa_dia),
            custo_unitario: Number(d.custo_unitario),
        }));
        
        setDiretrizesConcessionaria(typedData);
        
    } catch (error) {
        console.error("Erro ao carregar diretrizes de concessionária:", error);
        toast.error("Erro ao carregar diretrizes de concessionária.");
    }
  };
  
  const handleMaterialConsumoImportSuccess = () => {
      if (user?.id && selectedYear > 0) {
          queryClient.invalidateQueries({ queryKey: ['diretrizesMaterialConsumo', selectedYear, user.id] });
      }
  };

  const handleServicosTerceirosImportSuccess = () => {
      if (user?.id && selectedYear > 0) {
          queryClient.invalidateQueries({ queryKey: ['diretrizesServicosTerceiros', selectedYear, user.id] });
      }
  };

  const handleMaterialPermanenteImportSuccess = () => {
      if (user?.id && selectedYear > 0) {
          queryClient.invalidateQueries({ queryKey: ['diretrizesMaterialPermanente', selectedYear, user.id] });
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
      
      const dataToValidate = {
        ...diretrizes,
        fator_passagens_aereas: diretrizes.fator_passagens_aereas || 0,
        fator_servicos_terceiros: diretrizes.fator_servicos_terceiros || 0,
        valor_complemento_alimentacao: diretrizes.valor_complemento_alimentacao || 0,
        valor_fretamento_aereo_hora: diretrizes.valor_fretamento_aereo_hora || 0,
        valor_locacao_estrutura_dia: diretrizes.valor_locacao_estrutura_dia || 0,
        valor_locacao_viaturas_dia: diretrizes.valor_locacao_viaturas_dia || 0,
        fator_material_consumo: diretrizes.fator_material_consumo || 0,
        fator_concessionaria: diretrizes.fator_concessionaria || 0,
        diaria_of_gen_bsb: diretrizes.diaria_of_gen_bsb || 0,
        diaria_of_gen_capitais: diretrizes.diaria_of_gen_capitais || 0,
        diaria_of_gen_demais: diretrizes.diaria_of_gen_demais || 0,
        diaria_of_sup_bsb: diretrizes.diaria_of_sup_bsb || 0,
        diaria_of_sup_capitais: diretrizes.diaria_of_sup_capitais || 0,
        diaria_of_sup_demais: diretrizes.diaria_of_sup_demais || 0,
        diaria_of_int_sgt_bsb: diretrizes.diaria_of_int_sgt_bsb || 0,
        diaria_of_int_sgt_capitais: diretrizes.diaria_of_int_sgt_capitais || 0,
        diaria_of_int_sgt_demais: diretrizes.diaria_of_int_sgt_demais || 0,
        diaria_demais_pracas_bsb: diretrizes.diaria_demais_pracas_bsb || 0,
        diaria_demais_pracas_capitais: diretrizes.diaria_demais_pracas_capitais || 0,
        diaria_demais_pracas_demais: diretrizes.diaria_demais_pracas_demais || 0,
        taxa_embarque: diretrizes.taxa_embarque || 0,
      };
      
      diretrizOperacionalSchema.parse(dataToValidate);

      const diretrizData: TablesInsert<'diretrizes_operacionais'> = {
        user_id: user.id,
        ano_referencia: diretrizes.ano_referencia,
        fator_passagens_aereas: dataToValidate.fator_passagens_aereas,
        fator_servicos_terceiros: dataToValidate.fator_servicos_terceiros,
        valor_complemento_alimentacao: dataToValidate.valor_complemento_alimentacao,
        valor_fretamento_aereo_hora: dataToValidate.valor_fretamento_aereo_hora,
        valor_locacao_estrutura_dia: dataToValidate.valor_locacao_estrutura_dia,
        valor_locacao_viaturas_dia: dataToValidate.valor_locacao_viaturas_dia,
        fator_material_consumo: dataToValidate.fator_material_consumo,
        fator_concessionaria: dataToValidate.fator_concessionaria,
        observacoes: diretrizes.observacoes,
        
        diaria_referencia_legal: diretrizes.diaria_referencia_legal,
        diaria_of_gen_bsb: diretrizes.diaria_of_gen_bsb,
        diaria_of_gen_capitais: diretrizes.diaria_of_gen_capitais,
        diaria_of_gen_demais: diretrizes.diaria_of_gen_demais,
        diaria_of_sup_bsb: diretrizes.diaria_of_sup_bsb,
        diaria_of_sup_capitais: diretrizes.diaria_of_sup_capitais,
        diaria_of_sup_demais: diretrizes.diaria_of_sup_demais,
        diaria_of_int_sgt_bsb: diretrizes.diaria_of_int_sgt_bsb,
        diaria_of_int_sgt_capitais: diretrizes.diaria_of_int_sgt_capitais,
        diaria_of_int_sgt_demais: diretrizes.diaria_of_int_sgt_demais,
        diaria_demais_pracas_bsb: diretrizes.diaria_demais_pracas_bsb,
        diaria_demais_pracas_capitais: diretrizes.diaria_demais_pracas_capitais,
        diaria_demais_pracas_demais: diretrizes.diaria_demais_pracas_demais,
        
        taxa_embarque: diretrizes.taxa_embarque,
      };

      if (diretrizes.id) {
        const { error } = await supabase
          .from("diretrizes_operacionais")
          .update(diretrizData as TablesUpdate<'diretrizes_operacionais'>)
          .eq("id", diretrizes.id);
        if (error) throw error;
        toast.success("Diretrizes Operacionais atualizadas!");
      } else {
        const { error } = await supabase
          .from("diretrizes_operacionais")
          .insert([diretrizData as TablesInsert<'diretrizes_operacionais'>]);
        if (error) throw error;
        toast.success("Diretrizes Operacionais criadas!");
      }
      
      queryClient.invalidateQueries({ queryKey: ["diretrizesOperacionais", diretrizes.ano_referencia] });
      await loadAvailableYears(defaultYear);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (error.code === '23505') {
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
        .update({ default_operacional_year: diretrizes.ano_referencia })
        .eq('id', user.id);
        
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["defaultOperacionalYear", user.id] });
      
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
      
      const { data: sourceOperacional, error: operacionalError } = await supabase
        .from("diretrizes_operacionais")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", sourceYear)
        .maybeSingle();
        
      if (operacionalError) throw operacionalError;
      
      if (sourceOperacional) {
          const { id: oldId, created_at, updated_at, ...restOperacional } = sourceOperacional;
          const newOperacional = { ...restOperacional, ano_referencia: targetYear, user_id: user.id };
          
          const { error: insertOperacionalError } = await supabase
            .from("diretrizes_operacionais")
            .insert([newOperacional as TablesInsert<'diretrizes_operacionais'>]);
          if (insertOperacionalError) throw insertOperacionalError;
      }
      
      const { data: sourcePassagens, error: passagensError } = await supabase
        .from("diretrizes_passagens")
        .select("om_referencia, ug_referencia, numero_pregao, trechos, ativo, data_inicio_vigencia, data_fim_vigencia")
        .eq("user_id", user.id)
        .eq("ano_referencia", sourceYear);
        
      if (passagensError) throw passagensError;
      
      if (sourcePassagens && sourcePassagens.length > 0) {
          const newPassagens = sourcePassagens.map(p => ({
              ...p,
              ano_referencia: targetYear,
              user_id: user.id,
              trechos: p.trechos, 
          }));
          
          const { error: insertPassagensError } = await supabase
            .from("diretrizes_passagens")
            .insert(newPassagens as TablesInsert<'diretrizes_passagens'>[]);
          if (insertPassagensError) throw insertPassagensError;
      }
      
      const { data: sourceConcessionaria, error: concessionariaError } = await supabase
        .from("diretrizes_concessionaria")
        .select("categoria, nome_concessionaria, consumo_pessoa_dia, fonte_consumo, custo_unitario, fonte_custo, unidade_custo")
        .eq("user_id", user.id)
        .eq("ano_referencia", sourceYear);
        
      if (concessionariaError) throw concessionariaError;
      
      if (sourceConcessionaria && sourceConcessionaria.length > 0) {
          const newConcessionaria = (sourceConcessionaria as Tables<'diretrizes_concessionaria'>[]).map(c => {
              const { id, created_at, updated_at, ...restOfConcessionaria } = c as any;
              return {
                  ...restOfConcessionaria,
                  ano_referencia: targetYear,
                  user_id: user.id,
              };
          });
          
          const { error: insertConcessionariaError } = await supabase
            .from("diretrizes_concessionaria")
            .insert(newConcessionaria as TablesInsert<'diretrizes_concessionaria'>[]);
          if (insertConcessionariaError) throw insertConcessionariaError;
      }
      
      const { data: sourceMaterialConsumo, error: materialConsumoError } = await supabase
        .from("diretrizes_material_consumo")
        .select("nr_subitem, nome_subitem, descricao_subitem, itens_aquisicao, ativo")
        .eq("user_id", user.id)
        .eq("ano_referencia", sourceYear);
        
      if (materialConsumoError) throw materialConsumoError;
      
      if (sourceMaterialConsumo && sourceMaterialConsumo.length > 0) {
          const newMaterialConsumo = (sourceMaterialConsumo as Tables<'diretrizes_material_consumo'>[]).map(m => {
              const { id, created_at, updated_at, ...restOfMaterialConsumo } = m as any;
              return {
                  ...restOfMaterialConsumo,
                  ano_referencia: targetYear,
                  user_id: user.id,
                  itens_aquisicao: m.itens_aquisicao,
              };
          });
          
          const { error: insertMaterialConsumoError } = await supabase
            .from("diretrizes_material_consumo")
            .insert(newMaterialConsumo as TablesInsert<'diretrizes_material_consumo'>[]);
          if (insertMaterialConsumoError) throw insertMaterialConsumoError;
      }

      const { data: sourceServicos, error: servicosError } = await supabase
        .from("diretrizes_servicos_terceiros" as any)
        .select("nr_subitem, nome_subitem, descricao_subitem, itens_aquisicao, ativo")
        .eq("user_id", user.id)
        .eq("ano_referencia", sourceYear);
        
      if (servicosError) throw servicosError;
      
      if (sourceServicos && (sourceServicos as any[]).length > 0) {
          const newServicos = (sourceServicos as any[]).map(s => {
              const { id, created_at, updated_at, ...restOfServicos } = s;
              return {
                  ...restOfServicos,
                  ano_referencia: targetYear,
                  user_id: user.id,
                  itens_aquisicao: s.itens_aquisicao,
              };
          });
          
          const { error: insertServicosError } = await supabase
            .from("diretrizes_servicos_terceiros" as any)
            .insert(newServicos);
          if (insertServicosError) throw insertServicosError;
      }

      const { data: sourcePermanente, error: permanenteError } = await supabase
        .from("diretrizes_material_permanente" as any)
        .select("nr_subitem, nome_subitem, descricao_subitem, itens_aquisicao, ativo")
        .eq("user_id", user.id)
        .eq("ano_referencia", sourceYear);
        
      if (permanenteError) throw permanenteError;
      
      if (sourcePermanente && (sourcePermanente as any[]).length > 0) {
          const newPermanente = (sourcePermanente as any[]).map(p => {
              const { id, created_at, updated_at, ...restOfPermanente } = p;
              return {
                  ...restOfPermanente,
                  ano_referencia: targetYear,
                  user_id: user.id,
                  itens_aquisicao: p.itens_aquisicao,
              };
          });
          
          const { error: insertPermanenteError } = await supabase
            .from("diretrizes_material_permanente" as any)
            .insert(newPermanente);
          if (insertPermanenteError) throw insertPermanenteError;
      }
      
      toast.success(`Diretrizes operacionais, de passagens, concessionária, material de consumo, serviços de terceiros e material permanente do ano ${sourceYear} copiadas com sucesso para o ano ${targetYear}!`);
      setIsYearManagementDialogOpen(false);
      setSelectedYear(targetYear);
      
      queryClient.invalidateQueries({ queryKey: ["defaultOperacionalYear", user.id] });
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
    
    if (!confirm(`Tem certeza que deseja EXCLUIR TODAS as diretrizes operacionais, de passagens, concessionária, material de consumo, serviços de terceiros e material permanente para o ano ${year}? Esta ação é irreversível.`)) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      setLoading(true);
      
      await supabase
        .from("diretrizes_operacionais")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", year);
        
      await supabase
        .from("diretrizes_passagens")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", year);
        
      await supabase
        .from("diretrizes_concessionaria")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", year);
        
      await supabase
        .from("diretrizes_material_consumo")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", year);

      await supabase
        .from("diretrizes_servicos_terceiros" as any)
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", year);

      await supabase
        .from("diretrizes_material_permanente" as any)
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", year);

      toast.success(`Diretrizes operacionais, de passagens, concessionária, material de consumo, serviços de terceiros e material permanente do ano ${year} excluídas com sucesso!`);
      setIsYearManagementDialogOpen(false);
      
      queryClient.invalidateQueries({ queryKey: ["defaultOperacionalYear", user.id] });
      await loadAvailableYears(defaultYear);
      
    } catch (error: any) {
      console.error("Erro ao excluir diretrizes:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const handleCurrencyChange = (field: keyof DiretrizOperacional, rawValue: string) => {
    const { numericValue, digits } = formatCurrencyInput(rawValue);
    
    setRawInputs(prev => ({ ...prev, [field]: digits }));
    setDiretrizes(prev => ({ ...prev, [field]: numericValue }));
  };
  
  const handleFactorChange = (field: keyof DiretrizOperacional, value: string) => {
    const numericValue = parseFloat(value) || 0;
    setDiretrizes(prev => ({ ...prev, [field]: numericValue }));
  };

  const renderDiretrizField = (field: { key: string, label: string, type: 'currency' | 'factor', placeholder: string }) => {
    const value = diretrizes[field.key as keyof DiretrizOperacional] as number;
    
    if (field.type === 'currency') {
      const rawDigits = rawInputs[field.key] || numberToRawDigits(value);
      const { formatted: displayValue } = formatCurrencyInput(rawDigits);
      
      return (
        <div className="space-y-2">
          <Label htmlFor={field.key}>{field.label}</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
            <Input
              id={field.key}
              type="text"
              inputMode="numeric"
              className="pl-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={value === 0 && rawDigits.length === 0 ? "" : displayValue}
              onChange={(e) => handleCurrencyChange(field.key as keyof DiretrizOperacional, e.target.value)}
              onKeyDown={handleEnterToNextField}
              placeholder={field.placeholder}
            />
          </div>
        </div>
      );
    } else {
      return (
        <div className="space-y-2">
          <Label htmlFor={field.key}>{field.label}</Label>
          <Input
            id={field.key}
            type="number"
            step="0.01"
            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            value={value === 0 ? "" : value}
            onChange={(e) => handleFactorChange(field.key as keyof DiretrizOperacional, e.target.value)}
            placeholder={field.placeholder}
            onKeyDown={handleEnterToNextField}
          />
        </div>
      );
    }
  };
  
  const renderDiariaTable = () => {
    const handleDiariaChange = (rankKey: string, destination: 'bsb' | 'capitais' | 'demais', rawValue: string) => {
      const fieldKey = `diaria_${rankKey}_${destination}` as keyof DiretrizOperacional;
      handleDiariaChange(rankKey, destination, rawValue);
    };
    
    const getDiariaProps = (rankKey: string, destination: 'bsb' | 'capitais' | 'demais') => {
      const fieldKey = `${DIARIA_RANKS_CONFIG.find(r => r.key === rankKey)?.fieldPrefix}_${destination}` as keyof DiretrizOperacional;
      const value = diretrizes[fieldKey] as number;
      const rawDigits = rawInputs[fieldKey as string] || numberToRawDigits(value);
      
      return {
        value: value,
        rawDigits: rawDigits,
        onChange: (val: number) => handleDiariaChange(rankKey, destination, numberToRawDigits(val)),
        onKeyDown: handleEnterToNextField,
        placeholder: "0,00",
        className: "text-center",
      };
    };
    
    const taxaEmbarqueProps = renderDiretrizField({
        key: 'taxa_embarque', 
        label: 'Taxa de Embarque (R$)', 
        type: 'currency', 
        placeholder: 'Ex: 95,00'
    });
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="diaria_referencia_legal">Referência Legal (Lei/Portaria)</Label>
            <Input
              id="diaria_referencia_legal"
              value={diretrizes.diaria_referencia_legal || ""}
              onChange={(e) => setDiretrizes({ ...diretrizes, diaria_referencia_legal: e.target.value })}
              placeholder="Decreto Nº 12.324 de 19DEZ24"
              onKeyDown={handleEnterToNextField}
            />
          </div>
          {taxaEmbarqueProps}
        </div>
        
        <Table className="rounded-lg overflow-hidden border">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[35%] rounded-tl-lg">Posto/Graduação</TableHead>
              <TableHead className="text-center">Dslc BSB/MAO/RJ/SP</TableHead>
              <TableHead className="text-center">Dslc demais capitais</TableHead>
              <TableHead className="text-center rounded-tr-lg">Demais Dslc</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {DIARIA_RANKS_CONFIG.map((rank, index) => (
              <TableRow key={rank.key}>
                <TableCell className="font-medium whitespace-nowrap">
                    {index === DIARIA_RANKS_CONFIG.length - 1 ? (
                        <span className="rounded-bl-lg block">{rank.label}</span>
                    ) : (
                        rank.label
                    )}
                </TableCell>
                <TableCell>
                  <CurrencyInput
                    {...getDiariaProps(rank.key, 'bsb')}
                  />
                </TableCell>
                <TableCell>
                  <CurrencyInput
                    {...getDiariaProps(rank.key, 'capitais')}
                  />
                </TableCell>
                <TableCell>
                    {index === DIARIA_RANKS_CONFIG.length - 1 ? (
                        <span className="rounded-br-lg block">
                            <CurrencyInput
                                {...getDiariaProps(rank.key, 'demais')}
                            />
                        </span>
                    ) : (
                        <CurrencyInput
                            {...getDiariaProps(rank.key, 'demais')}
                        />
                    )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };
  
  const handleSavePassagem = async (data: any) => {
      try {
          setLoading(true);
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Usuário não autenticado");
          
          const dbData: TablesInsert<'diretrizes_passagens'> = {
              user_id: user.id,
              ano_referencia: data.ano_referencia,
              om_referencia: data.om_referencia,
              ug_referencia: data.ug_referencia,
              numero_pregao: data.numero_pregao || null,
              trechos: data.trechos as unknown as Json,
              ativo: data.ativo ?? true,
              data_inicio_vigencia: data.data_inicio_vigencia || null,
              data_fim_vigencia: data.data_fim_vigencia || null,
          };
          
          if (data.id) {
              const { error } = await supabase
                  .from('diretrizes_passagens')
                  .update(dbData as TablesUpdate<'diretrizes_passagens'>)
                  .eq('id', data.id);
              if (error) throw error;
              toast.success("Contrato de Passagens atualizado!");
          } else {
              const { error } = await supabase
                  .from('diretrizes_passagens')
                  .insert([dbData]);
              if (error) throw error;
              toast.success("Novo Contrato de Passagens cadastrado!");
          }
          
          await loadDiretrizesPassagens(selectedYear);
          setDiretrizToEdit(null);
          setIsPassagemFormOpen(false);
          
      } catch (error: any) {
          toast.error(sanitizeError(error));
      } finally {
          setLoading(false);
      }
  };
  
  const handleStartEditPassagem = (diretriz: DiretrizPassagem) => {
      setDiretrizToEdit(diretriz);
      setIsPassagemFormOpen(true);
  };
  
  const handleOpenNewPassagem = () => {
      setDiretrizToEdit(null);
      setIsPassagemFormOpen(true);
  };
  
  const handleDeletePassagem = async (id: string, omName: string) => {
      if (!confirm(`Tem certeza que deseja excluir o contrato de passagens da OM ${omName}?`)) return;
      
      try {
          setLoading(true);
          await supabase.from('diretrizes_passagens').delete().eq('id', id);
          toast.success("Contrato de Passagens excluído!");
          await loadDiretrizesPassagens(selectedYear);
      } catch (error) {
          toast.error(sanitizeError(error));
      } finally {
          setLoading(false);
      }
  };
  
  const renderPassagensSection = () => {
      return (
          <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                  <span className="text-sm font-medium text-muted-foreground">Contratos de Passagens Cadastrados</span>
                  <Button size="sm" onClick={handleOpenNewPassagem} className="bg-[#0f172a] hover:bg-[#0f172a]/90 text-white rounded-full px-4">
                      <Plus className="h-4 w-4 mr-1" /> Novo Contrato
                  </Button>
              </div>
              
              <div className="space-y-2">
                  {diretrizesPassagens.length === 0 ? (
                      <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground">
                          Nenhum contrato de passagens cadastrado para {selectedYear}.
                      </div>
                  ) : (
                      diretrizesPassagens.map(diretriz => (
                          <PassagemDiretrizRow 
                              key={diretriz.id} 
                              diretriz={diretriz} 
                              onEdit={handleStartEditPassagem}
                              onDelete={handleDeletePassagem}
                              loading={loading}
                          />
                      ))
                  )}
              </div>
          </div>
      );
  };
  
  const handleSaveConcessionaria = async (data: DiretrizConcessionariaForm & { id?: string }) => {
      try {
          setLoading(true);
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Usuário não autenticado");
          
          const consumoValue = typeof data.consumo_pessoa_dia === 'string'
            ? parseFloat(data.consumo_pessoa_dia.replace(',', '.')) || 0
            : data.consumo_pessoa_dia;

          const dbData: TablesInsert<'diretrizes_concessionaria'> = {
              user_id: user.id,
              ano_referencia: selectedYear,
              categoria: data.categoria,
              nome_concessionaria: data.nome_concessionaria,
              consumo_pessoa_dia: consumoValue,
              fonte_consumo: data.fonte_consumo || null,
              custo_unitario: data.custo_unitario,
              fonte_custo: data.fonte_custo || null,
              unidade_custo: data.unidade_custo,
          };

          if (data.id) {
              const { error } = await supabase
                  .from('diretrizes_concessionaria')
                  .update(dbData as TablesUpdate<'diretrizes_concessionaria'>)
                  .eq('id', data.id);
              if (error) throw error;
              toast.success("Diretriz de Concessionária atualizada!");
          } else {
              const { error } = await supabase
                  .from('diretrizes_concessionaria')
                  .insert([dbData]);
              if (error) throw error;
              toast.success("Nova Diretriz de Concessionária cadastrada!");
          }
          
          await loadDiretrizesConcessionaria(selectedYear);
          setDiretrizConcessionariaToEdit(null);
          setIsConcessionariaFormOpen(false);
          
      } catch (error: any) {
          toast.error(sanitizeError(error));
      } finally {
          setLoading(false);
      }
  };
  
  const handleStartEditConcessionaria = (diretriz: DiretrizConcessionaria) => {
      setDiretrizConcessionariaToEdit(diretriz);
      setIsConcessionariaFormOpen(true);
  };
  
  const handleOpenNewConcessionaria = (category: CategoriaConcessionaria) => {
      setDiretrizConcessionariaToEdit(null);
      setSelectedConcessionariaTab(category);
      setIsConcessionariaFormOpen(true);
  };
  
  const handleDeleteConcessionaria = async (id: string, nome: string) => {
      if (!confirm(`Tem certeza que deseja excluir la diretriz da concessionária ${nome}?`)) return;
      
      try {
          setLoading(true);
          await supabase.from('diretrizes_concessionaria').delete().eq('id', id);
          toast.success("Diretriz de Concessionária excluída!");
          await loadDiretrizesConcessionaria(selectedYear);
      } catch (error) {
          toast.error(sanitizeError(error));
      } finally {
          setLoading(false);
      }
  };
  
  const renderConcessionariaList = (category: CategoriaConcessionaria) => {
      const filteredDiretrizes = diretrizesConcessionaria.filter(d => d.categoria === category);
      
      return (
          <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                  <span className="text-sm font-medium text-muted-foreground">Parâmetros de {category} Cadastrados</span>
                  <Button size="sm" onClick={() => handleOpenNewConcessionaria(category)} className="bg-[#0f172a] hover:bg-[#0f172a]/90 text-white rounded-full px-4">
                      <Plus className="h-4 w-4 mr-1" /> Novo Parâmetro
                  </Button>
              </div>
              
              <div className="space-y-2">
                  {filteredDiretrizes.length === 0 ? (
                      <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground">
                          Nenhum parâmetro de {category} cadastrado para {selectedYear}.
                      </div>
                  ) : (
                      filteredDiretrizes.map(diretriz => (
                          <ConcessionariaDiretrizRow 
                              key={diretriz.id} 
                              diretriz={diretriz} 
                              onEdit={handleStartEditConcessionaria}
                              onDelete={handleDeleteConcessionaria}
                              loading={loading}
                          />
                      ))
                  )}
              </div>
          </div>
      );
  };
  
  const renderConcessionariaSection = () => {
      return (
          <div className="space-y-4">
              <Tabs value={selectedConcessionariaTab} onValueChange={(value) => setSelectedConcessionariaTab(value as CategoriaConcessionaria)}>
                  <TabsList className="grid w-full grid-cols-2">
                      {CATEGORIAS_CONCESSIONARIA.map(cat => (
                          <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
                      ))}
                  </TabsList>
                  
                  {CATEGORIAS_CONCESSIONARIA.map(cat => (
                      <TabsContent key={cat} value={cat}>
                          {renderConcessionariaList(cat)}
                      </TabsContent>
                  ))}
              </Tabs>
          </div>
      );
  };
  
  const handleSaveMaterialConsumo = async (data: Partial<DiretrizMaterialConsumo> & { ano_referencia: number }) => {
      try {
          setLoading(true);
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Usuário não autenticado");
          
          const dbData: TablesInsert<'diretrizes_material_consumo'> = {
              user_id: user.id,
              ano_referencia: data.ano_referencia,
              nr_subitem: data.nr_subitem!,
              nome_subitem: data.nome_subitem!,
              descricao_subitem: data.descricao_subitem || null,
              itens_aquisicao: data.itens_aquisicao as unknown as Json,
              ativo: data.ativo ?? true,
          };

          if (data.id) {
              const { error } = await supabase
                  .from('diretrizes_material_consumo')
                  .update(dbData as TablesUpdate<'diretrizes_material_consumo'>)
                  .eq('id', data.id);
              if (error) throw error;
              toast.success("Subitem da ND atualizado!");
          } else {
              const { error } = await supabase
                  .from('diretrizes_material_consumo')
                  .insert([dbData]);
              if (error) throw error;
              toast.success("Novo Subitem da ND cadastrado!");
          }
          
          queryClient.invalidateQueries({ queryKey: ['diretrizesMaterialConsumo', selectedYear, user.id] });
          setDiretrizMaterialConsumoToEdit(null);
          setIsMaterialConsumoFormOpen(false);
          
      } catch (error: any) {
          toast.error(sanitizeError(error));
      } finally {
          setLoading(false);
      }
  };

  const handleSaveServicosTerceiros = async (data: Partial<DiretrizServicosTerceiros> & { ano_referencia: number }) => {
      try {
          setLoading(true);
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Usuário não autenticado");
          
          const dbData: any = {
              user_id: user.id,
              ano_referencia: data.ano_referencia,
              nr_subitem: data.nr_subitem!,
              nome_subitem: data.nome_subitem!,
              descricao_subitem: data.descricao_subitem || null,
              itens_aquisicao: data.itens_aquisicao as unknown as Json,
              ativo: data.ativo ?? true,
          };

          if (data.id) {
              const { error } = await supabase
                  .from('diretrizes_servicos_terceiros' as any)
                  .update(dbData)
                  .eq('id', data.id);
              if (error) throw error;
              toast.success("Subitem da ND atualizado!");
          } else {
              const { error } = await supabase
                  .from('diretrizes_servicos_terceiros' as any)
                  .insert([dbData]);
              if (error) throw error;
              toast.success("Novo Subitem da ND cadastrado!");
          }
          
          queryClient.invalidateQueries({ queryKey: ['diretrizesServicosTerceiros', selectedYear, user.id] });
          setDiretrizServicosTerceirosToEdit(null);
          setIsServicosTerceirosFormOpen(false);
          
      } catch (error: any) {
          toast.error(sanitizeError(error));
      } finally {
          setLoading(false);
      }
  };

  const handleSaveMaterialPermanente = async (data: Partial<DiretrizMaterialPermanente> & { ano_referencia: number }) => {
      try {
          setLoading(true);
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Usuário não autenticado");
          
          const dbData: any = {
              user_id: user.id,
              ano_referencia: data.ano_referencia,
              nr_subitem: data.nr_subitem!,
              nome_subitem: data.nome_subitem!,
              descricao_subitem: data.descricao_subitem || null,
              itens_aquisicao: data.itens_aquisicao as unknown as Json,
              ativo: data.ativo ?? true,
          };

          if (data.id) {
              const { error } = await supabase
                  .from('diretrizes_material_permanente' as any)
                  .update(dbData)
                  .eq('id', data.id);
              if (error) throw error;
              toast.success("Subitem da ND atualizado!");
          } else {
              const { error } = await supabase
                  .from('diretrizes_material_permanente' as any)
                  .insert([dbData]);
              if (error) throw error;
              toast.success("Novo Subitem da ND cadastrado!");
          }
          
          queryClient.invalidateQueries({ queryKey: ['diretrizesMaterialPermanente', selectedYear, user.id] });
          setDiretrizMaterialPermanenteToEdit(null);
          setIsMaterialPermanenteFormOpen(false);
          
      } catch (error: any) {
          toast.error(sanitizeError(error));
      } finally {
          setLoading(false);
      }
  };
  
  const handleStartEditMaterialConsumo = (diretriz: DiretrizMaterialConsumo) => {
      setDiretrizMaterialConsumoToEdit(diretriz);
      setIsMaterialConsumoFormOpen(true);
  };

  const handleStartEditServicosTerceiros = (diretriz: DiretrizServicosTerceiros) => {
      setDiretrizServicosTerceirosToEdit(diretriz);
      setIsServicosTerceirosFormOpen(true);
  };

  const handleStartEditMaterialPermanente = (diretriz: DiretrizMaterialPermanente) => {
      setDiretrizMaterialPermanenteToEdit(diretriz);
      setIsMaterialPermanenteFormOpen(true);
  };
  
  const handleOpenNewMaterialConsumo = () => {
      setDiretrizMaterialConsumoToEdit(null);
      setIsMaterialConsumoFormOpen(true);
  };

  const handleOpenNewServicosTerceiros = () => {
      setDiretrizServicosTerceirosToEdit(null);
      setIsServicosTerceirosFormOpen(true);
  };

  const handleOpenNewMaterialPermanente = () => {
      setDiretrizMaterialPermanenteToEdit(null);
      setIsMaterialPermanenteFormOpen(true);
  };
  
  const handleDeleteMaterialConsumo = async (id: string, nome: string) => {
      if (!confirm(`Tem certeza que deseja excluir o Subitem da ND "${nome}"?`)) return;
      
      try {
          setLoading(true);
          await supabase.from('diretrizes_material_consumo').delete().eq('id', id);
          toast.success("Subitem da ND excluído!");
          queryClient.invalidateQueries({ queryKey: ['diretrizesMaterialConsumo', selectedYear, user?.id] });
      } catch (error) {
          toast.error(sanitizeError(error));
      } finally {
          setLoading(false);
      }
  };

  const handleDeleteServicosTerceiros = async (id: string, nome: string) => {
      if (!confirm(`Tem certeza que deseja excluir o Subitem da ND "${nome}"?`)) return;
      
      try {
          setLoading(true);
          await supabase.from('diretrizes_servicos_terceiros' as any).delete().eq('id', id);
          toast.success("Subitem da ND excluído!");
          queryClient.invalidateQueries({ queryKey: ['diretrizesServicosTerceiros', selectedYear, user?.id] });
      } catch (error) {
          toast.error(sanitizeError(error));
      } finally {
          setLoading(false);
      }
  };

  const handleDeleteMaterialPermanente = async (id: string, nome: string) => {
      if (!confirm(`Tem certeza que deseja excluir o Subitem da ND "${nome}"?`)) return;
      
      try {
          setLoading(true);
          await supabase.from('diretrizes_material_permanente' as any).delete().eq('id', id);
          toast.success("Subitem da ND excluído!");
          queryClient.invalidateQueries({ queryKey: ['diretrizesMaterialPermanente', selectedYear, user?.id] });
      } catch (error) {
          toast.error(sanitizeError(error));
      } finally {
          setLoading(false);
      }
  };
  
  const indexedItems = useMemo<IndexedItemAquisicao[]>(() => {
    if (!diretrizesMaterialConsumo) return [];
    
    return diretrizesMaterialConsumo.flatMap(diretriz => {
        const itens = (diretriz.itens_aquisicao || []) as ItemAquisicao[];
        
        return itens.map(item => ({
            ...item,
            diretrizId: diretriz.id,
            subitemNr: diretriz.nr_subitem,
            subitemNome: diretriz.nome_subitem,
        }));
    });
  }, [diretrizesMaterialConsumo]);

  const indexedItemsServicos = useMemo<IndexedItemServico[]>(() => {
    if (!diretrizesServicosTerceiros) return [];
    
    return diretrizesServicosTerceiros.flatMap(diretriz => {
        const itens = (diretriz.itens_aquisicao || []) as ItemAquisicaoServico[];
        
        return itens.map(item => ({
            ...item,
            diretrizId: diretriz.id,
            subitemNr: diretriz.nr_subitem,
            subitemNome: diretriz.nome_subitem,
        }));
    });
  }, [diretrizesServicosTerceiros]);

  const indexedItemsPermanente = useMemo<IndexedItemPermanente[]>(() => {
    if (!diretrizesMaterialPermanente) return [];
    
    return diretrizesMaterialPermanente.flatMap(diretriz => {
        const itens = (diretriz.itens_aquisicao || []) as ItemAquisicao[];
        
        return itens.map(item => ({
            ...item,
            diretrizId: diretriz.id,
            subitemNr: diretriz.nr_subitem,
            subitemNome: diretriz.nome_subitem,
        }));
    });
  }, [diretrizesMaterialPermanente]);

  const filteredItems = useMemo(() => {
    if (!searchTerm) return [];
    const lowerCaseSearch = searchTerm.toLowerCase().trim();
    
    if (lowerCaseSearch.length < 3) return [];
    
    return indexedItems.filter(item => {
        const searchString = [
            item.descricao_item,
            item.codigo_catmat,
            item.numero_pregao,
            item.uasg,
            item.subitemNr,
            item.subitemNome,
        ].join(' ').toLowerCase();
        
        return searchString.includes(lowerCaseSearch);
    });
  }, [searchTerm, indexedItems]);

  const filteredItemsServicos = useMemo(() => {
    if (!searchTermServicos) return [];
    const lowerCaseSearch = searchTermServicos.toLowerCase().trim();
    
    if (lowerCaseSearch.length < 3) return [];
    
    return indexedItemsServicos.filter(item => {
        const searchString = [
            item.descricao_item,
            item.codigo_catmat,
            item.numero_pregao,
            item.uasg,
            item.subitemNr,
            item.subitemNome,
        ].join(' ').toLowerCase();
        
        return searchString.includes(lowerCaseSearch);
    });
  }, [searchTermServicos, indexedItemsServicos]);

  const filteredItemsPermanente = useMemo(() => {
    if (!searchTermPermanente) return [];
    const lowerCaseSearch = searchTermPermanente.toLowerCase().trim();
    
    if (lowerCaseSearch.length < 3) return [];
    
    return indexedItemsPermanente.filter(item => {
        const searchString = [
            item.descricao_item,
            item.codigo_catmat,
            item.numero_pregao,
            item.uasg,
            item.subitemNr,
            item.subitemNome,
        ].join(' ').toLowerCase();
        
        return searchString.includes(lowerCaseSearch);
    });
  }, [searchTermPermanente, indexedItemsPermanente]);

  const handleGoToSubitem = (diretrizId: string) => {
      handleCollapseChange('material_consumo_detalhe', true);
      setSubitemToOpenId(diretrizId);
      
      setTimeout(() => {
          const element = document.getElementById(`diretriz-material-consumo-${diretrizId}`);
          if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
              toast.warning("Subitem encontrado, mas não visível na tela.");
          }
      }, 100);
      
      setSearchTerm("");
  };

  const handleGoToSubitemServico = (diretrizId: string) => {
      handleCollapseChange('servicos_terceiros_detalhe', true);
      setSubitemServicoToOpenId(diretrizId);
      
      setTimeout(() => {
          const element = document.getElementById(`diretriz-servicos-terceiros-${diretrizId}`);
          if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
              toast.warning("Subitem encontrado, mas não visível na tela.");
          }
      }, 100);
      
      setSearchTermServicos("");
  };

  const handleGoToSubitemPermanente = (diretrizId: string) => {
      handleCollapseChange('material_permanente_detalhe', true);
      setSubitemPermanenteToOpenId(diretrizId);
      
      setTimeout(() => {
          const element = document.getElementById(`diretriz-material-permanente-${diretrizId}`);
          if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
              toast.warning("Subitem encontrado, mas não visível na tela.");
          }
      }, 100);
      
      setSearchTermPermanente("");
  };
  
  useEffect(() => {
      if (subitemToOpenId) {
          const timer = setTimeout(() => setSubitemToOpenId(null), 500);
          return () => clearTimeout(timer);
      }
  }, [subitemToOpenId]);

  useEffect(() => {
      if (subitemServicoToOpenId) {
          const timer = setTimeout(() => setSubitemServicoToOpenId(null), 500);
          return () => clearTimeout(timer);
      }
  }, [subitemServicoToOpenId]);

  useEffect(() => {
      if (subitemPermanenteToOpenId) {
          const timer = setTimeout(() => setSubitemPermanenteToOpenId(null), 500);
          return () => clearTimeout(timer);
      }
  }, [subitemPermanenteToOpenId]);

  const renderSearchResults = () => {
      if (searchTerm.length < 3) {
          return (
              <Card className="p-4 text-center text-muted-foreground">
                  Digite pelo menos 3 caracteres para iniciar a busca.
              </Card>
          );
      }
      
      if (filteredItems.length === 0) {
          return (
              <Card className="p-4 text-center text-muted-foreground">
                  Nenhum item de aquisição encontrado com este termo.
              </Card>
          );
      }
      
      return (
          <Card className="p-4">
              <CardTitle className="text-base font-semibold mb-3">
                   Resultados da Busca ({filteredItems.length})
              </CardTitle>
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead className="w-[40%]">Item de Aquisição</TableHead>
                          <TableHead className="w-[40%]">Subitem ND</TableHead>
                          <TableHead className="w-[20%] text-center">Ações</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {filteredItems.map((item, index) => (
                          <TableRow key={`${item.diretrizId}-${index}`}>
                              <TableCell className="font-medium">
                                  {item.descricao_item}
                                  <p className="text-xs text-muted-foreground">
                                      Cód. CATMAT: {item.codigo_catmat || 'N/A'}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                      Pregão: {item.numero_pregao} | UASG: {formatCodug(item.uasg) || 'N/A'}
                                  </p>
                              </TableCell>
                              <TableCell className="text-left">
                                  <span className="font-semibold mr-1 whitespace-nowrap">{item.subitemNr}</span>
                                  <span className="text-sm text-muted-foreground">{item.subitemNome}</span>
                              </TableCell>
                              <TableCell className="text-right">
                                  <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => handleGoToSubitem(item.diretrizId)}
                                      className="w-full justify-start"
                                  >
                                      <Package className="h-4 w-4 mr-1" />
                                      Ver Local
                                  </Button>
                              </TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
              </Table>
          </Card>
      );
  };

  const renderSearchResultsServicos = () => {
      if (searchTermServicos.length < 3) {
          return (
              <Card className="p-4 text-center text-muted-foreground">
                  Digite pelo menos 3 caracteres para iniciar a busca.
              </Card>
          );
      }
      
      if (filteredItemsServicos.length === 0) {
          return (
              <Card className="p-4 text-center text-muted-foreground">
                  Nenhum item de serviço encontrado com este termo.
              </Card>
          );
      }
      
      return (
          <Card className="p-4">
              <CardTitle className="text-base font-semibold mb-3">
                   Resultados da Busca ({filteredItemsServicos.length})
              </CardTitle>
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead className="w-[40%]">Item de Serviço</TableHead>
                          <TableHead className="w-[40%]">Subitem ND</TableHead>
                          <TableHead className="w-[20%] text-center">Ações</TableHead>
                      </TableHeader>
                  <TableBody>
                      {filteredItemsServicos.map((item, index) => (
                          <TableRow key={`${item.diretrizId}-${index}`}>
                              <TableCell className="font-medium">
                                  {item.descricao_item}
                                  <p className="text-xs text-muted-foreground">
                                      Cód. CATMAT: {item.codigo_catmat || 'N/A'}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                      Pregão: {item.numero_pregao} | UASG: {formatCodug(item.uasg) || 'N/A'}
                                  </p>
                              </TableCell>
                              <TableCell className="text-left">
                                  <span className="font-semibold mr-1 whitespace-nowrap">{item.subitemNr}</span>
                                  <span className="text-sm text-muted-foreground">{item.subitemNome}</span>
                              </TableCell>
                              <TableCell className="text-right">
                                  <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => handleGoToSubitemServico(item.diretrizId)}
                                      className="w-full justify-start"
                                  >
                                      <Package className="h-4 w-4 mr-1" />
                                      Ver Local
                                  </Button>
                              </TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
              </Table>
          </Card>
      );
  };

  const renderSearchResultsPermanente = () => {
      if (searchTermPermanente.length < 3) {
          return (
              <Card className="p-4 text-center text-muted-foreground">
                  Digite pelo menos 3 caracteres para iniciar a busca.
              </Card>
          );
      }
      
      if (filteredItemsPermanente.length === 0) {
          return (
              <Card className="p-4 text-center text-muted-foreground">
                  Nenhum item de material permanente encontrado com este termo.
              </Card>
          );
      }
      
      return (
          <Card className="p-4">
              <CardTitle className="text-base font-semibold mb-3">
                   Resultados da Busca ({filteredItemsPermanente.length})
              </CardTitle>
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead className="w-[40%]">Item Permanente</TableHead>
                          <TableHead className="w-[40%]">Subitem ND</TableHead>
                          <TableHead className="w-[20%] text-center">Ações</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {filteredItemsPermanente.map((item, index) => (
                          <TableRow key={`${item.diretrizId}-${index}`}>
                              <TableCell className="font-medium">
                                  {item.descricao_item}
                                  <p className="text-xs text-muted-foreground">
                                      Cód. CATMAT: {item.codigo_catmat || 'N/A'}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                      Pregão: {item.numero_pregao} | UASG: {formatCodug(item.uasg) || 'N/A'}
                                  </p>
                              </TableCell>
                              <TableCell className="text-left">
                                  <span className="font-semibold mr-1 whitespace-nowrap">{item.subitemNr}</span>
                                  <span className="text-sm text-muted-foreground">{item.subitemNome}</span>
                              </TableCell>
                              <TableCell className="text-right">
                                  <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => handleGoToSubitemPermanente(item.diretrizId)}
                                      className="w-full justify-start"
                                  >
                                      <Package className="h-4 w-4 mr-1" />
                                      Ver Local
                                  </Button>
                              </TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
              </Table>
          </Card>
      );
  };
  
  const renderMaterialConsumoSection = () => {
      const isDataLoading = isLoadingMaterialConsumo || isMovingMaterialConsumo;
      
      return (
          <div className="space-y-4">
              <Card className="p-4">
                  <div className="flex justify-between items-center mb-4">
                      <CardTitle className="text-base font-semibold">
                          Subitens da ND Cadastrados
                      </CardTitle>
                      <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setIsExportImportDialogOpen(true)}
                          disabled={loading || isDataLoading}
                      >
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          Exportar/Importar
                      </Button>
                  </div>
                  
                  <div className="mb-4 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                          placeholder="Buscar item de aquisição (nome, CATMAT, pregão, subitem...)"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          disabled={isDataLoading}
                          className="pl-10"
                      />
                  </div>
                  
                  {searchTerm ? (
                      renderSearchResults()
                  ) : (
                      (diretrizesMaterialConsumo?.length || 0) > 0 ? (
                          <Table>
                              <TableHeader>
                                  <TableRow>
                                      <TableHead className="w-[150px] text-center">Nr Subitem</TableHead>
                                      <TableHead>Nome do Subitem</TableHead>
                                      <TableHead className="w-[100px] text-center">Ações</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {diretrizesMaterialConsumo.map(d => (
                                      <MaterialConsumoDiretrizRow
                                          key={d.id}
                                          diretriz={d}
                                          onEdit={handleStartEditMaterialConsumo}
                                          onDelete={handleDeleteMaterialConsumo}
                                          loading={loading || isDataLoading}
                                          onMoveItem={handleMoveItem}
                                          id={`diretriz-material-consumo-${d.id}`} 
                                          forceOpen={subitemToOpenId === d.id}
                                      />
                                  ))}
                              </TableBody>
                          </Table>
                      ) : (
                          <Card className="p-4 text-center text-muted-foreground">
                              Nenhum subitem da ND cadastrado para o ano de referência.
                          </Card>
                      )
                  )}
              </Card>
              
              <div className="flex justify-end">
                  <Button 
                      type="button" 
                      onClick={handleOpenNewMaterialConsumo}
                      disabled={loading || isDataLoading || !!searchTerm}
                      variant="outline" 
                      size="sm" 
                      className="w-full btn-novo-subitem"
                  >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Novo Subitem da ND
                  </Button>
              </div>
          </div>
      );
  };

  const renderServicosTerceirosSection = () => {
      const isDataLoading = isLoadingServicosTerceiros || isMovingServicosTerceiros;
      
      return (
          <div className="space-y-4">
              <Card className="p-4">
                  <div className="flex justify-between items-center mb-4">
                      <CardTitle className="text-base font-semibold">
                          Subitens da ND Cadastrados
                      </CardTitle>
                      <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setIsExportImportServicosDialogOpen(true)}
                          disabled={loading || isDataLoading}
                      >
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          Exportar/Importar
                      </Button>
                  </div>
                  
                  <div className="mb-4 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                          placeholder="Buscar item de serviço (nome, CATMAT, pregão, subitem...)"
                          value={searchTermServicos}
                          onChange={(e) => setSearchTermServicos(e.target.value)}
                          disabled={isDataLoading}
                          className="pl-10"
                      />
                  </div>
                  
                  {searchTermServicos ? (
                      renderSearchResultsServicos()
                  ) : (
                      (diretrizesServicosTerceiros?.length || 0) > 0 ? (
                          <Table>
                              <TableHeader>
                                  <TableRow>
                                      <TableHead className="w-[150px] text-center">Nr Subitem</TableHead>
                                      <TableHead>Nome do Subitem</TableHead>
                                      <TableHead className="w-[100px] text-center">Ações</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {diretrizesServicosTerceiros.map(d => (
                                      <ServicosTerceirosDiretrizRow
                                          key={d.id}
                                          diretriz={d}
                                          onEdit={handleStartEditServicosTerceiros}
                                          onDelete={handleDeleteServicosTerceiros}
                                          loading={loading || isDataLoading}
                                          onMoveItem={handleMoveItemServico}
                                          id={`diretriz-servicos-terceiros-${d.id}`} 
                                          forceOpen={subitemServicoToOpenId === d.id}
                                      />
                                  ))}
                              </TableBody>
                          </Table>
                      ) : (
                          <Card className="p-4 text-center text-muted-foreground">
                              Nenhum subitem da ND cadastrado para o ano de referência.
                          </Card>
                      )
                  )}
              </Card>
              
              <div className="flex justify-end">
                  <Button 
                      type="button" 
                      onClick={handleOpenNewServicosTerceiros}
                      disabled={loading || isDataLoading || !!searchTermServicos}
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                  >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Novo Subitem da ND
                  </Button>
              </div>
          </div>
      );
  };

  const renderMaterialPermanenteSection = () => {
      const isDataLoading = isLoadingMaterialPermanente || isMovingMaterialPermanente;
      
      return (
          <div className="space-y-4">
              <Card className="p-4">
                  <div className="flex justify-between items-center mb-4">
                      <CardTitle className="text-base font-semibold">
                          Subitens da ND Cadastrados
                      </CardTitle>
                      <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setIsExportImportPermanenteDialogOpen(true)}
                          disabled={loading || isDataLoading}
                      >
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          Exportar/Importar
                      </Button>
                  </div>
                  
                  <div className="mb-4 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                          placeholder="Buscar item permanente (nome, CATMAT, pregão, subitem...)"
                          value={searchTermPermanente}
                          onChange={(e) => setSearchTermPermanente(e.target.value)}
                          disabled={isDataLoading}
                          className="pl-10"
                      />
                  </div>
                  
                  {searchTermPermanente ? (
                      renderSearchResultsPermanente()
                  ) : (
                      (diretrizesMaterialPermanente?.length || 0) > 0 ? (
                          <Table>
                              <TableHeader>
                                  <TableRow>
                                      <TableHead className="w-[150px] text-center">Nr Subitem</TableHead>
                                      <TableHead>Nome do Subitem</TableHead>
                                      <TableHead className="w-[100px] text-center">Ações</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {diretrizesMaterialPermanente.map(d => (
                                      <MaterialPermanenteDiretrizRow
                                          key={d.id}
                                          diretriz={d}
                                          onEdit={handleStartEditMaterialPermanente}
                                          onDelete={handleDeleteMaterialPermanente}
                                          loading={loading || isDataLoading}
                                          id={`diretriz-material-permanente-${d.id}`} 
                                          forceOpen={subitemPermanenteToOpenId === d.id}
                                          isExpanded={subitemPermanenteToOpenId === d.id}
                                          onToggleExpand={() => setSubitemPermanenteToOpenId(subitemPermanenteToOpenId === d.id ? null : d.id)}
                                      />
                                  ))}
                              </TableBody>
                          </Table>
                      ) : (
                          <Card className="p-4 text-center text-muted-foreground">
                              Nenhum subitem da ND cadastrado para o ano de referência.
                          </Card>
                      )
                  )}
              </Card>
              
              <div className="flex justify-end">
                  <Button 
                      type="button" 
                      onClick={handleOpenNewMaterialPermanente}
                      disabled={loading || isDataLoading || !!searchTermPermanente}
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                  >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Novo Subitem da ND
                  </Button>
              </div>
          </div>
      );
  };

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
      <PageMetadata 
        title="Configurações de Custos Operacionais" 
        description="Defina os valores de diárias, contratos de passagens, concessionárias e fatores de custeio operacional para o cálculo do P Trab."
        canonicalPath="/config/custos-operacionais"
      />
      
      <div className="max-w-3xl mx-auto space-y-6">
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

        <Card className="card-diretrizes-operacionais">
          <CardHeader>
            <h1 className="text-2xl font-bold">Configurações dos Custos Operacionais</h1>
            <CardDescription>
              Defina os valores e fatores de referência para o cálculo de despesas operacionais (GND 3 e GND 4).
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
                </p>
              </div>

              <div className="border-t pt-4 mt-6">
                <div className="space-y-4">
                  <div ref={el => collapsibleRefs.current['diarias_detalhe'] = el} className="border-b pb-4 last:border-b-0 last:pb-0">
                    <Collapsible 
                      open={fieldCollapseState['diarias_detalhe']} 
                      onOpenChange={(open) => handleCollapseChange('diarias_detalhe', open)}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between cursor-pointer py-2">
                          <h2 className="text-base font-medium">
                            Pagamento de Diárias
                          </h2>
                          {fieldCollapseState['diarias_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2">
                          {renderDiariaTable()}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                  
                  <div ref={el => collapsibleRefs.current['passagens_detalhe'] = el} className="border-b pb-4 last:border-b-0 last:pb-0">
                    <Collapsible 
                      open={fieldCollapseState['passagens_detalhe']} 
                      onOpenChange={(open) => handleCollapseChange('passagens_detalhe', open)}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between cursor-pointer py-2">
                          <h2 className="text-base font-medium flex items-center gap-2">
                            <Plane className="h-4 w-4 text-primary" />
                            Aquisição de Passagens
                          </h2>
                          {fieldCollapseState['passagens_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2">
                          {renderPassagensSection()}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                  
                  <div ref={el => collapsibleRefs.current['concessionaria_detalhe'] = el} className="border-b pb-4 last:border-b-0 last:pb-0">
                    <Collapsible 
                      open={fieldCollapseState['concessionaria_detalhe']} 
                      onOpenChange={(open) => handleCollapseChange('concessionaria_detalhe', open)}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between cursor-pointer py-2">
                          <h2 className="text-base font-medium flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" />
                            Pagamento de Concessionárias
                          </h2>
                          {fieldCollapseState['concessionaria_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2">
                          {renderConcessionariaSection()}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                  
                  <div ref={el => collapsibleRefs.current['material_consumo_detalhe'] = el} className="border-b pb-4 last:border-b-0 last:pb-0 aba-material-consumo">
                    <Collapsible 
                      open={fieldCollapseState['material_consumo_detalhe']} 
                      onOpenChange={(open) => handleCollapseChange('material_consumo_detalhe', open)}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between cursor-pointer py-2 gatilho-material-consumo">
                          <h2 className="text-base font-medium flex items-center gap-2">
                            <Package className="h-4 w-4 text-primary" />
                            Aquisição de Material de Consumo
                          </h2>
                          {fieldCollapseState['material_consumo_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2">
                          {renderMaterialConsumoSection()}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>

                  <div ref={el => collapsibleRefs.current['material_permanente_detalhe'] = el} className="border-b pb-4 last:border-b-0 last:pb-0">
                    <Collapsible 
                      open={fieldCollapseState['material_permanente_detalhe']} 
                      onOpenChange={(open) => handleCollapseChange('material_permanente_detalhe', open)}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between cursor-pointer py-2">
                          <h2 className="text-base font-medium flex items-center gap-2">
                            <HardDrive className="h-4 w-4 text-primary" />
                            Aquisição de Material Permanente
                          </h2>
                          {fieldCollapseState['material_permanente_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2">
                          {renderMaterialPermanenteSection()}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>

                  <div ref={el => collapsibleRefs.current['servicos_terceiros_detalhe'] = el} className="border-b pb-4 last:border-b-0 last:pb-0">
                    <Collapsible 
                      open={fieldCollapseState['servicos_terceiros_detalhe']} 
                      onOpenChange={(open) => handleCollapseChange('servicos_terceiros_detalhe', open)}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between cursor-pointer py-2">
                          <h2 className="text-base font-medium flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" />
                            Contratação de Serviços de Terceiros / Locações (Transporte)
                          </h2>
                          {fieldCollapseState['servicos_terceiros_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2">
                          {renderServicosTerceirosSection()}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                  
                  {OPERATIONAL_FIELDS.map(field => {
                    const fieldKey = field.key as string;
                    const isOpen = fieldCollapseState[fieldKey] ?? false;
                    
                    return (
                      <div key={fieldKey} ref={el => collapsibleRefs.current[fieldKey] = el} className="border-b pb-4 last:border-b-0 last:pb-0">
                        <Collapsible 
                          open={isOpen} 
                          onOpenChange={(open) => handleCollapseChange(fieldKey, open)}
                        >
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between cursor-pointer py-2">
                              <h2 className="text-base font-medium">
                                {field.label}
                              </h2>
                              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="mt-2">
                              {renderDiretrizField(field)}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 border-t pt-4 mt-6">
                <Label>Observações</Label>
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
                  className="rounded-full px-6"
                >
                  {diretrizes.ano_referencia === defaultYear ? "Padrão Atual" : "Adotar como Padrão"}
                </Button>
                
                <Button type="submit" disabled={loading} className="bg-[#0f172a] hover:bg-[#0f172a]/90 text-white rounded-full px-6">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar Diretrizes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      
      <YearManagementDialog
        open={isYearManagementDialogOpen}
        onOpenChange={setIsYearManagementDialogOpen}
        availableYears={availableYears}
        defaultYear={defaultYear}
        onCopy={handleCopyDiretrizes}
        onDelete={handleDeleteDiretrizes}
        loading={loading}
      />
      
      <PassagemDiretrizFormDialog
          open={isPassagemFormOpen}
          onOpenChange={setIsPassagemFormOpen}
          selectedYear={selectedYear}
          diretrizToEdit={diretrizToEdit} 
          onSave={handleSavePassagem} 
          loading={loading}
      />
      
      <ConcessionariaDiretrizFormDialog
          open={isConcessionariaFormOpen}
          onOpenChange={setIsConcessionariaFormOpen}
          selectedYear={selectedYear}
          diretrizToEdit={diretrizConcessionariaToEdit} 
          onSave={handleSaveConcessionaria}
          loading={loading}
          initialCategory={selectedConcessionariaTab}
      />
      
      <MaterialConsumoDiretrizFormDialog
          open={isMaterialConsumoFormOpen}
          onOpenChange={setIsMaterialConsumoFormOpen}
          selectedYear={selectedYear}
          diretrizToEdit={diretrizMaterialConsumoToEdit}
          onSave={handleSaveMaterialConsumo}
          loading={loading}
      />
      
      <MaterialConsumoExportImportDialog
          open={isExportImportDialogOpen}
          onOpenChange={setIsExportImportDialogOpen}
          selectedYear={selectedYear}
          diretrizes={diretrizesMaterialConsumo || []}
          onImportSuccess={handleMaterialConsumoImportSuccess}
      />

      <ServicosTerceirosDiretrizFormDialog
          open={isServicosTerceirosFormOpen}
          onOpenChange={setIsServicosTerceirosFormOpen}
          selectedYear={selectedYear}
          diretrizToEdit={diretrizServicosTerceirosToEdit}
          onSave={handleSaveServicosTerceiros}
          loading={loading}
      />
      
      <ServicosTerceirosExportImportDialog
          open={isExportImportServicosDialogOpen}
          onOpenChange={setIsExportImportServicosDialogOpen}
          selectedYear={selectedYear}
          diretrizes={diretrizesServicosTerceiros || []}
          onImportSuccess={handleServicosTerceirosImportSuccess}
      />

      <MaterialPermanenteDiretrizFormDialog
          open={isMaterialPermanenteFormOpen}
          onOpenChange={setIsMaterialPermanenteFormOpen}
          selectedYear={selectedYear}
          diretrizToEdit={diretrizMaterialPermanenteToEdit}
          onSave={handleSaveMaterialPermanente}
          loading={loading}
      />
      
      <MaterialPermanenteExportImportDialog
          open={isExportImportPermanenteDialogOpen}
          onOpenChange={setIsExportImportPermanenteDialogOpen}
          selectedYear={selectedYear}
          diretrizes={diretrizesMaterialPermanente || []}
          onImportSuccess={handleMaterialPermanenteImportSuccess}
      />
    </div>
  );
};

export default CustosOperacionaisPage;