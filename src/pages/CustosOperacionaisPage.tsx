"use client";

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
import { Tables, TablesInsert, TablesUpdate, Json, TableName } from "@/integrations/supabase/types";
import { diretrizOperacionalSchema } from "@/lib/validationSchemas";
import * as z from "zod";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDefaultDiretrizYear } from "@/hooks/useDefaultDiretrizYear";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { DiretrizPassagem, TrechoPassagem, TipoTransporte, DiretrizPassagemForm } from "@/types/diretrizesPassagens";
import CurrencyInput from "@/components/CurrencyInput";
import { Switch } from "@/components/ui/switch";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import PassagemDiretrizFormDialog from "@/components/PassagemDiretrizFormDialog";
import PassagemDiretrizRow from "@/components/PassagemDiretrizRow"; 
import ConcessionariaDiretrizFormDialog from "@/components/ConcessionariaDiretrizFormDialog";
import ConcessionariaDiretrizRow from "@/components/ConcessionariaDiretrizRow";
import { 
    DiretrizConcessionaria, 
    DiretrizConcessionariaForm, 
    CATEGORIAS_CONCESSIONARIA, 
    CategoriaConcessionaria 
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
import { runMission02 } from "@/tours/missionTours";
import { GHOST_DATA, isGhostMode } from "@/lib/ghostStore";
import { cn } from "@/lib/utils";

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
  valor_verba_operacional_dia: 0,
  valor_suprimentos_fundo_dia: 0,
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

const CustosOperacionaisPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false); 
  
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
      diretrizes: diretrizesMaterialConsumoHook, 
      isLoading: isLoadingMaterialConsumo, 
      handleMoveItem,
      isMoving: isMovingMaterialConsumo,
  } = useMaterialConsumoDiretrizes(selectedYear);

  const {
      diretrizes: diretrizesServicosTerceirosHook,
      isLoading: isLoadingServicosTerceiros,
      handleMoveItem: handleMoveItemServico,
      isMoving: isMovingServicosTerceiros,
  } = useServicosTerceirosDiretrizes(selectedYear);

  const {
      diretrizes: diretrizesMaterialPermanenteHook,
      isLoading: isLoadingMaterialPermanente,
      handleMoveItem: handleMoveItemPermanente,
      isMoving: isMovingMaterialPermanente,
  } = useMaterialPermanenteDiretrizes(selectedYear);

  const [diretrizesMaterialConsumo, setDiretrizesMaterialConsumo] = useState<DiretrizMaterialConsumo[]>([]);
  const [diretrizesServicosTerceiros, setDiretrizesServicosTerceiros] = useState<DiretrizServicosTerceiros[]>([]);
  const [diretrizesMaterialPermanente, setDiretrizesMaterialPermanente] = useState<DiretrizMaterialPermanente[]>([]);

  useEffect(() => { 
    if (isGhostMode()) {
      setDiretrizesMaterialConsumo(GHOST_DATA.missao_02.subitens_lista as any);
      return;
    }

    if (diretrizesMaterialConsumoHook && !isMovingMaterialConsumo) {
      setDiretrizesMaterialConsumo(current => {
        if (JSON.stringify(current) === JSON.stringify(diretrizesMaterialConsumoHook)) return current;
        return diretrizesMaterialConsumoHook;
      });
    }
  }, [diretrizesMaterialConsumoHook, isMovingMaterialConsumo]);

  useEffect(() => { 
    if (diretrizesServicosTerceirosHook && !isMovingServicosTerceiros) {
      setDiretrizesServicosTerceiros(current => {
        if (JSON.stringify(current) === JSON.stringify(diretrizesServicosTerceirosHook)) return current;
        return diretrizesServicosTerceirosHook;
      });
    }
  }, [diretrizesServicosTerceirosHook, isMovingServicosTerceiros]);

  useEffect(() => { 
    if (diretrizesMaterialPermanenteHook && !isMovingMaterialPermanente) {
      setDiretrizesMaterialPermanente(current => {
        if (JSON.stringify(current) === JSON.stringify(diretrizesMaterialPermanenteHook)) return current;
        return diretrizesMaterialPermanenteHook;
      });
    }
  }, [diretrizesMaterialPermanenteHook, isMovingMaterialPermanente]);
  
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

  const handleCollapseChange = useCallback((key: string, open: boolean) => {
      setFieldCollapseState(prev => ({ ...prev, [key]: open }));

      if (open) {
          setTimeout(() => {
              const element = collapsibleRefs.current[key];
              if (element) {
                  const yOffset = -100; 
                  const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
                  window.scrollTo({ top: y, behavior: 'smooth' });
              }
          }, 150);
      }
  }, []);

  const handleOpenNewMaterialConsumo = useCallback(() => {
      setDiretrizMaterialConsumoToEdit(null);
      setIsMaterialConsumoFormOpen(true);
  }, []);

  useEffect(() => {
    (window as any).expandMaterialConsumo = () => {
      handleCollapseChange('material_consumo_detalhe', true);
    };
    (window as any).openMaterialConsumoForm = () => {
      handleOpenNewMaterialConsumo();
    };

    return () => {
      delete (window as any).expandMaterialConsumo;
      delete (window as any).openMaterialConsumoForm;
    };
  }, [handleCollapseChange, handleOpenNewMaterialConsumo]);
  
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  
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
    const startTour = searchParams.get('startTour') === 'true';
    const missionId = localStorage.getItem('active_mission_id');
    const ghost = isGhostMode();

    if (startTour && ghost && missionId === '2') {
      runMission02(() => {
        const completed = JSON.parse(localStorage.getItem('completed_missions') || '[]');
        if (!completed.includes(2)) {
          localStorage.setItem('completed_missions', JSON.stringify([...completed, 2]));
        }
        navigate('/ptrab');
      });
    }
  }, [searchParams]);

  const { data: pageData, isLoading: isLoadingPageData, isFetching: isFetchingPageData } = useQuery({
    queryKey: ['diretrizesCustosOperacionais', selectedYear, user?.id],
    queryFn: async () => {
      if (!user?.id || !selectedYear) return null;

      const [opRes, passRes, concRes] = await Promise.all([
        supabase
          .from("diretrizes_operacionais")
          .select("*")
          .eq("user_id", user.id)
          .eq("ano_referencia", selectedYear)
          .maybeSingle(),
        supabase
          .from('diretrizes_passagens')
          .select('*')
          .eq('user_id', user.id)
          .eq('ano_referencia', selectedYear)
          .order('om_referencia', { ascending: true }),
        supabase
          .from('diretrizes_concessionaria')
          .select('*')
          .eq('user_id', user.id)
          .eq('ano_referencia', selectedYear)
          .order('categoria', { ascending: true })
          .order('nome_concessionaria', { ascending: true })
      ]);

      if (opRes.error) throw opRes.error;
      if (passRes.error) throw passRes.error;
      if (concRes.error) throw concRes.error;

      return {
        operacional: opRes.data || defaultDiretrizes(selectedYear),
        passagens: passRes.data || [],
        concessionaria: concRes.data || []
      };
    },
    enabled: !!user?.id && !!selectedYear,
    staleTime: 1000 * 60 * 5, 
  });

  useEffect(() => {
    if (pageData) {
      setLoading(true);
      const loadedData = pageData.operacional;
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
        diaria_referencia_legal: loadedData.diaria_referencia_legal || defaultDiretrizes(selectedYear).diaria_referencia_legal,
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
        taxa_embarque: Number(loadedData.taxa_embarque || defaultDiretrizes(selectedYear).taxa_embarque),
        observacoes: loadedData.observacoes || "",
      };

      setDiretrizes(numericData);
      
      const initialRawInputs: Record<string, string> = {};
      DIARIA_RANKS_CONFIG.forEach(rank => {
        initialRawInputs[`diaria_${rank.key}_bsb`] = numberToRawDigits(numericData[`diaria_${rank.key}_bsb` as keyof DiretrizOperacional] as number);
        initialRawInputs[`diaria_${rank.key}_capitais`] = numberToRawDigits(numericData[`diaria_${rank.key}_capitais` as keyof DiretrizOperacional] as number);
        initialRawInputs[`diaria_${rank.key}_demais`] = numberToRawDigits(numericData[`diaria_${rank.key}_demais` as keyof DiretrizOperacional] as number);
      });
      initialRawInputs['taxa_embarque'] = numberToRawDigits(numericData.taxa_embarque as number);
      setRawInputs(initialRawInputs);

      setDiretrizesPassagens((pageData.passagens || []).map(d => ({
          ...d,
          trechos: (d.trechos as unknown as TrechoPassagem[]) || [],
          data_inicio_vigencia: d.data_inicio_vigencia || null,
          data_fim_vigencia: d.data_fim_vigencia || null,
      })));
      
      setDiretrizesConcessionaria((pageData.concessionaria || []).map((d: any) => ({
          ...d,
          consumo_pessoa_dia: Number(d.consumo_pessoa_dia),
          custo_unitario: Number(d.custo_unitario),
      })));
      
      setLoading(false);
    }
  }, [pageData, selectedYear]);

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
  }, [isLoadingDefaultYear, defaultYearData?.year, defaultYearData?.defaultYear]);

  const loadAvailableYears = async (defaultYearId: number | null) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const [
          { data: opData, error: opError },
          { data: passagensData, error: passagensError },
          { data: concessionariaData, error: concessionariaError },
          { data: materialConsumoData, error: materialConsumoError },
          { data: servicosData, error: servicosError },
          { data: permanenteData, error: permanenteError }
      ] = await Promise.all([
          supabase.from("diretrizes_operacionais").select("ano_referencia").eq("user_id", authUser.id),
          supabase.from("diretrizes_passagens").select("ano_referencia").eq("user_id", authUser.id),
          supabase.from("diretrizes_concessionaria").select("ano_referencia").eq("user_id", authUser.id),
          supabase.from("diretrizes_material_consumo").select("ano_referencia").eq("user_id", authUser.id),
          supabase.from("diretrizes_servicos_terceiros" as any).select("ano_referencia").eq("user_id", authUser.id),
          supabase.from("diretrizes_material_permanente" as any).select("ano_referencia").eq("user_id", authUser.id),
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
  
  const handleMaterialConsumoImportSuccess = () => {
      if (user?.id && selectedYear > 0) {
          queryClient.invalidateQueries({ queryKey: ['diretrizesMaterialConsumo', selectedYear, user.id] });
      }
  };

  const handleServicosTerceirosImportSuccess = (newItems?: DiretrizServicosTerceiros[]) => {
      if (newItems && newItems.length > 0) {
          setDiretrizesServicosTerceiros(prev => {
              const filtered = prev.filter(p => !newItems.find(n => n.id === p.id));
              return [...filtered, ...newItems].sort((a, b) => a.nr_subitem.localeCompare(b.nr_subitem));
          });
          toast.success(`${newItems.length} subitens de serviços atualizados!`);
      }
      if (user?.id && selectedYear > 0) {
          queryClient.invalidateQueries({ queryKey: ['diretrizesServicosTerceiros', selectedYear, user.id] });
      }
  };

  const handleMaterialPermanenteImportSuccess = (newItems?: DiretrizMaterialPermanente[]) => {
      if (newItems && newItems.length > 0) {
          setDiretrizesMaterialPermanente(prev => {
              const filtered = prev.filter(p => !newItems.find(n => n.id === p.id));
              return [...filtered, ...newItems].sort((a, b) => a.nr_subitem.localeCompare(b.nr_subitem));
          });
          toast.success(`${newItems.length} subitens permanentes atualizados!`);
      }
      if (user?.id && selectedYear > 0) {
          queryClient.invalidateQueries({ queryKey: ['diretrizesMaterialPermanente', selectedYear, user.id] });
      }
  };

  const handleSaveDiretrizes = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        toast.error("Usuário não autenticado");
        return;
      }

      if (!selectedYear) {
        toast.error("Informe o ano de referência");
        return;
      }
      
      const dataToValidate = {
        ano_referencia: selectedYear,
        fator_passagens_aereas: Number(diretrizes.fator_passagens_aereas ?? 0),
        fator_servicos_terceiros: Number(diretrizes.fator_servicos_terceiros ?? 0),
        valor_verba_operacional_dia: Number(diretrizes.valor_verba_operacional_dia ?? 0),
        valor_suprimentos_fundo_dia: Number(diretrizes.valor_suprimentos_fundo_dia ?? 0),
        valor_complemento_alimentacao: Number(diretrizes.valor_complemento_alimentacao ?? 0),
        valor_fretamento_aereo_hora: Number(diretrizes.valor_fretamento_aereo_hora ?? 0),
        valor_locacao_estrutura_dia: Number(diretrizes.valor_locacao_estrutura_dia ?? 0),
        valor_locacao_viaturas_dia: Number(diretrizes.valor_locacao_viaturas_dia ?? 0),
        fator_material_consumo: Number(diretrizes.fator_material_consumo ?? 0),
        fator_concessionaria: Number(diretrizes.fator_concessionaria ?? 0),
        diaria_of_gen_bsb: Number(diretrizes.diaria_of_gen_bsb ?? 0),
        diaria_of_gen_capitais: Number(diretrizes.diaria_of_gen_capitais ?? 0),
        diaria_of_gen_demais: Number(diretrizes.diaria_of_gen_demais ?? 0),
        diaria_of_sup_bsb: Number(diretrizes.diaria_of_sup_bsb ?? 0),
        diaria_of_sup_capitais: Number(diretrizes.diaria_of_sup_capitais ?? 0),
        diaria_of_sup_demais: Number(diretrizes.diaria_of_sup_demais ?? 0),
        diaria_of_int_sgt_bsb: Number(diretrizes.diaria_of_int_sgt_bsb ?? 0),
        diaria_of_int_sgt_capitais: Number(diretrizes.diaria_of_int_sgt_capitais ?? 0),
        diaria_of_int_sgt_demais: Number(diretrizes.diaria_of_int_sgt_demais ?? 0),
        diaria_demais_pracas_bsb: Number(diretrizes.diaria_demais_pracas_bsb ?? 0),
        diaria_demais_pracas_capitais: Number(diretrizes.diaria_demais_pracas_capitais ?? 0),
        diaria_demais_pracas_demais: Number(diretrizes.diaria_demais_pracas_demais ?? 0),
        taxa_embarque: Number(diretrizes.taxa_embarque ?? 0),
        diaria_referencia_legal: diretrizes.diaria_referencia_legal || "Decreto Nº 12.324 de 19DEZ24",
        observacoes: diretrizes.observacoes || "",
      };
      
      diretrizOperacionalSchema.parse(dataToValidate);

      const diretrizData: TablesInsert<'diretrizes_operacionais'> = {
        user_id: authUser.id,
        ...dataToValidate
      };

      setIsSaving(true);
      
      const { data: savedData, error } = await supabase
        .from("diretrizes_operacionais")
        .upsert(diretrizData, { onConflict: 'user_id,ano_referencia' })
        .select()
        .single();

      if (error) throw error;
      
      if (savedData) {
          setDiretrizes(savedData as Partial<DiretrizOperacional>);
      }
      
      toast.success("Diretrizes Operacionais salvas com sucesso!");
      
      queryClient.invalidateQueries({ queryKey: ['diretrizesCustosOperacionais', selectedYear, authUser.id] });
      await loadAvailableYears(defaultYear);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        const fieldName = firstError.path.join('.');
        toast.error(`Erro de validação no campo ${fieldName}: ${firstError.message}`);
      } else {
        toast.error(sanitizeError(error));
      }
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleSetDefaultYear = async () => {
    if (!selectedYear) {
      toast.error("Selecione um ano de referência válido.");
      return;
    }
    
    setIsSaving(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Usuário não autenticado");
      
      const { error } = await supabase
        .from('profiles')
        .update({ default_operacional_year: selectedYear })
        .eq('id', authUser.id);
        
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["defaultOperacionalYear", authUser.id] });
      
      toast.success(`Ano ${selectedYear} definido como padrão para cálculos!`);
      
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyDiretrizes = async (sourceYear: number, targetYear: number) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Usuário não autenticado");
      
      setIsSaving(true);
      
      const { data: sourceOperacional, error: operacionalError } = await supabase
        .from("diretrizes_operacionais")
        .select("*")
        .eq("user_id", authUser.id)
        .eq("ano_referencia", sourceYear)
        .maybeSingle();
        
      if (operacionalError) throw operacionalError;
      
      if (sourceOperacional) {
          const { id: oldId, created_at, updated_at, ...restOperacional } = sourceOperacional;
          const newOperacional = { ...restOperacional, ano_referencia: targetYear, user_id: authUser.id };
          
          const { error: insertOperacionalError } = await supabase
            .from("diretrizes_operacionais")
            .insert([newOperacional as TablesInsert<'diretrizes_operacionais'>]);
          if (insertOperacionalError) throw insertOperacionalError;
      }
      
      const { data: sourcePassagens, error: passagensError } = await supabase
        .from("diretrizes_passagens")
        .select("om_referencia, ug_referencia, numero_pregao, trechos, ativo, data_inicio_vigencia, data_fim_vigencia")
        .eq("user_id", authUser.id)
        .eq("ano_referencia", sourceYear);
        
      if (passagensError) throw passagensError;
      
      if (sourcePassagens && sourcePassagens.length > 0) {
          const newPassagens = sourcePassagens.map(p => ({
              ...p,
              ano_referencia: targetYear,
              user_id: authUser.id,
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
        .eq("user_id", authUser.id)
        .eq("ano_referencia", sourceYear);
        
      if (concessionariaError) throw concessionariaError;
      
      if (sourceConcessionaria && sourceConcessionaria.length > 0) {
          const newConcessionaria = (sourceConcessionaria as Tables<'diretrizes_concessionaria'>[]).map(c => {
              const { id, created_at, updated_at, ...restOfConcessionaria } = c as any;
              return {
                  ...restOfConcessionaria,
                  ano_referencia: targetYear,
                  user_id: authUser.id,
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
        .eq("user_id", authUser.id)
        .eq("ano_referencia", sourceYear);
        
      if (materialConsumoError) throw materialConsumoError;
      
      if (sourceMaterialConsumo && sourceMaterialConsumo.length > 0) {
          const newMaterialConsumo = (sourceMaterialConsumo as Tables<'diretrizes_material_consumo'>[]).map(m => {
              const { id, created_at, updated_at, ...restOfMaterialConsumo } = m as any;
              return {
                  ...restOfMaterialConsumo,
                  ano_referencia: targetYear,
                  user_id: authUser.id,
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
        .eq("user_id", authUser.id)
        .eq("ano_referencia", sourceYear);
        
      if (servicosError) throw servicosError;
      
      if (sourceServicos && (sourceServicos as any[]).length > 0) {
          const newServicos = (sourceServicos as any[]).map(s => {
              const { id, created_at, updated_at, ...restOfServicos } = s;
              return {
                  ...restOfServicos,
                  ano_referencia: targetYear,
                  user_id: authUser.id,
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
        .eq("user_id", authUser.id)
        .eq("ano_referencia", sourceYear);
        
      if (permanenteError) throw permanenteError;
      
      if (sourcePermanente && (sourcePermanente as any[]).length > 0) {
          const newPermanente = (sourcePermanente as any[]).map(p => {
              const { id, created_at, updated_at, ...restOfPermanente } = p;
              return {
                  ...restOfPermanente,
                  ano_referencia: targetYear,
                  user_id: authUser.id,
                  itens_aquisicao: p.itens_aquisicao,
              };
          });
          
          const { error: insertPermanenteError } = await supabase
            .from("diretrizes_material_permanente" as any)
            .insert(newPermanente);
          if (insertPermanenteError) throw insertPermanenteError;
      }
      
      toast.success(`Diretrizes copiadas com sucesso para o ano ${targetYear}!`);
      setIsYearManagementDialogOpen(false);
      setSelectedYear(targetYear);
      
      queryClient.invalidateQueries({ queryKey: ['diretrizesCustosOperacionais', targetYear, authUser.id] });
      await loadAvailableYears(defaultYear);
      
    } catch (error: any) {
      console.error("Erro ao copiar diretrizes:", error);
      toast.error(sanitizeError(error));
    } finally {
      setIsSaving(false);
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
      
      setIsSaving(true);
      
      await Promise.all([
        supabase.from("diretrizes_operacionais").delete().eq("user_id", authUser.id).eq("ano_referencia", year),
        supabase.from("diretrizes_passagens").delete().eq("user_id", authUser.id).eq("ano_referencia", year),
        supabase.from("diretrizes_concessionaria").delete().eq("user_id", authUser.id).eq("ano_referencia", year),
        supabase.from("diretrizes_material_consumo").delete().eq("user_id", authUser.id).eq("ano_referencia", year),
        supabase.from("diretrizes_servicos_terceiros" as any).delete().eq("user_id", authUser.id).eq("ano_referencia", year),
        supabase.from("diretrizes_material_permanente" as any).delete().eq("user_id", authUser.id).eq("ano_referencia", year)
      ]);

      toast.success(`Diretrizes do ano ${year} excluídas com sucesso!`);
      setIsYearManagementDialogOpen(false);
      
      queryClient.invalidateQueries({ queryKey: ['diretrizesCustosOperacionais', year, authUser.id] });
      await loadAvailableYears(defaultYear);
      
    } catch (error: any) {
      console.error("Erro ao excluir diretrizes:", error);
      toast.error(sanitizeError(error));
    } finally {
      setIsSaving(false);
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
      handleCurrencyChange(fieldKey, rawValue);
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
                <TableCell className="font-medium whitespace-nowrap">{rank.label}</TableCell>
                <TableCell><CurrencyInput {...getDiariaProps(rank.key, 'bsb')} /></TableCell>
                <TableCell><CurrencyInput {...getDiariaProps(rank.key, 'capitais')} /></TableCell>
                <TableCell><CurrencyInput {...getDiariaProps(rank.key, 'demais')} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };
  
  const handleSavePassagem = async (data: Partial<DiretrizPassagem> & { ano_referencia: number, om_referencia: string, ug_referencia: string }) => {
      try {
          setIsSaving(true);
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (!authUser) throw new Error("Usuário não autenticado");
          
          const dbData: TablesInsert<'diretrizes_passagens'> = {
              user_id: authUser.id,
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
              await supabase.from('diretrizes_passagens').update(dbData as TablesUpdate<'diretrizes_passagens'>).eq('id', data.id);
              toast.success("Contrato de Passagens atualizado!");
          } else {
              await supabase.from('diretrizes_passagens').insert([dbData]);
              toast.success("Novo Contrato de Passagens cadastrado!");
          }
          
          queryClient.invalidateQueries({ queryKey: ['diretrizesCustosOperacionais', selectedYear, authUser.id] });
          setDiretrizToEdit(null);
          setIsPassagemFormOpen(false);
      } catch (error: any) {
          toast.error(sanitizeError(error));
      } finally {
          setIsSaving(false);
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
          setIsSaving(true);
          await supabase.from('diretrizes_passagens').delete().eq('id', id);
          toast.success("Contrato de Passagens excluído!");
          queryClient.invalidateQueries({ queryKey: ['diretrizesCustosOperacionais', selectedYear, user?.id] });
      } catch (error) {
          toast.error(sanitizeError(error));
      } finally {
          setIsSaving(false);
      }
  };
  
  const renderPassagensSection = () => {
      return (
          <div className="space-y-4">
              {diretrizesPassagens.length > 0 ? (
                  <Card className="p-4">
                      <CardTitle className="text-base font-semibold mb-3">Contratos Cadastrados</CardTitle>
                      <Table>
                          <TableHeader><TableRow><TableHead>OM Referência</TableHead><TableHead>Pregão</TableHead><TableHead className="text-center">Vigência</TableHead><TableHead className="text-center">Trechos</TableHead><TableHead className="w-[100px] text-center">Ações</TableHead></TableRow></TableHeader>
                          <TableBody>{diretrizesPassagens.map(d => (<PassagemDiretrizRow key={d.id} diretriz={d} onEdit={handleStartEditPassagem} onDelete={handleDeletePassagem} loading={isSaving} />))}</TableBody>
                      </Table>
                  </Card>
              ) : (<Card className="p-4 text-center text-muted-foreground">Nenhum contrato de passagens cadastrado para o ano de referência.</Card>)}
              <div className="flex justify-end"><Button type="button" onClick={handleOpenNewPassagem} disabled={isSaving} variant="outline" size="sm" className="w-full"><Plus className="mr-2 h-4 w-4" />Adicionar Novo Contrato</Button></div>
          </div>
      );
  };
  
  const handleSaveConcessionaria = async (data: DiretrizConcessionariaForm & { id?: string }) => {
      try {
          setIsSaving(true);
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (!authUser) throw new Error("Usuário não autenticado");
          
          const consumoValue = typeof data.consumo_pessoa_dia === 'string' ? parseFloat(data.consumo_pessoa_dia.replace(',', '.')) || 0 : data.consumo_pessoa_dia;
          const dbData: TablesInsert<'diretrizes_concessionaria'> = { user_id: authUser.id, ano_referencia: selectedYear, categoria: data.categoria, nome_concessionaria: data.nome_concessionaria, consumo_pessoa_dia: consumoValue, fonte_consumo: data.fonte_consumo || null, custo_unitario: data.custo_unitario, fonte_custo: data.fonte_custo || null, unidade_custo: data.unidade_custo };

          if (data.id) {
              await supabase.from('diretrizes_concessionaria').update(dbData as TablesUpdate<'diretrizes_concessionaria'>).eq('id', data.id);
              toast.success("Diretriz de Concessionária atualizada!");
          } else {
              await supabase.from('diretrizes_concessionaria').insert([dbData]);
              toast.success("Nova Diretriz de Concessionária cadastrada!");
          }
          
          queryClient.invalidateQueries({ queryKey: ['diretrizesCustosOperacionais', selectedYear, authUser.id] });
          setDiretrizConcessionariaToEdit(null);
          setIsConcessionariaFormOpen(false);
      } catch (error: any) {
          toast.error(sanitizeError(error));
      } finally {
          setIsSaving(false);
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
      if (!confirm(`Tem certeza que deseja excluir a diretriz da concessionária ${nome}?`)) return;
      try {
          setIsSaving(true);
          await supabase.from('diretrizes_concessionaria').delete().eq('id', id);
          toast.success("Diretriz de Concessionária excluída!");
          queryClient.invalidateQueries({ queryKey: ['diretrizesCustosOperacionais', selectedYear, user?.id] });
      } catch (error) {
          toast.error(sanitizeError(error));
      } finally {
          setIsSaving(false);
      }
  };
  
  const renderConcessionariaList = (category: CategoriaConcessionaria) => {
      const filteredDiretrizes = diretrizesConcessionaria.filter(d => d.categoria === category);
      return (
          <div className="space-y-4">
              {filteredDiretrizes.length > 0 ? (
                  <Card className="p-4">
                      <CardTitle className="text-base font-semibold mb-3">Diretrizes Cadastradas</CardTitle>
                      <Table>
                          <TableHeader><TableRow><TableHead>Concessionária</TableHead><TableHead className="text-center">Consumo/Pessoa/Dia</TableHead><TableHead className="text-right">Custo Unitário</TableHead><TableHead className="w-[100px] text-center">Ações</TableHead></TableRow></TableHeader>
                          <TableBody>{filteredDiretrizes.map(d => (<ConcessionariaDiretrizRow key={d.id} diretriz={d} onEdit={handleStartEditConcessionaria} onDelete={handleDeleteConcessionaria} loading={isSaving} />))}</TableBody>
                      </Table>
                  </Card>
              ) : (<Card className="p-4 text-center text-muted-foreground">Nenhuma diretriz de {category} cadastrada para o ano de referência.</Card>)}
              <div className="flex justify-end"><Button type="button" onClick={() => handleOpenNewConcessionaria(category)} disabled={isSaving} variant="outline" size="sm" className="w-full"><Plus className="mr-2 h-4 w-4" />Adicionar Nova Diretriz de {category}</Button></div>
          </div>
      );
  };
  
  const renderConcessionariaSection = () => {
      return (
          <Card><CardContent className="pt-4"><Tabs value={selectedConcessionariaTab} onValueChange={(value) => setSelectedConcessionariaTab(value as CategoriaConcessionaria)}><TabsList className="grid w-full grid-cols-2">{CATEGORIAS_CONCESSIONARIA.map(cat => (<TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>))}</TabsList>{CATEGORIAS_CONCESSIONARIA.map(cat => (<TabsContent key={cat} value={cat}>{renderConcessionariaList(cat)}</TabsContent>))}</Tabs></CardContent></Card>
      );
  };
  
  const handleSaveMaterialConsumo = async (data: Partial<DiretrizMaterialConsumo> & { ano_referencia: number }) => {
      try {
          setIsSaving(true);
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (!authUser) throw new Error("Usuário não autenticado");
          
          const dbData: TablesInsert<'diretrizes_material_consumo'> = { user_id: authUser.id, ano_referencia: data.ano_referencia, nr_subitem: data.nr_subitem!, nome_subitem: data.nome_subitem!, descricao_subitem: data.descricao_subitem || null, itens_aquisicao: data.itens_aquisicao as unknown as Json, ativo: data.ativo ?? true };

          if (data.id) {
              await supabase.from('diretrizes_material_consumo').update(dbData as TablesUpdate<'diretrizes_material_consumo'>).eq('id', data.id);
              toast.success("Subitem da ND atualizado!");
          } else {
              await supabase.from('diretrizes_material_consumo').insert([dbData]);
              toast.success("Novo Subitem da ND cadastrado!");
          }
          
          queryClient.invalidateQueries({ queryKey: ['diretrizesMaterialConsumo', selectedYear, authUser.id] });
          setDiretrizMaterialConsumoToEdit(null);
          setIsMaterialConsumoFormOpen(false);
      } catch (error: any) {
          toast.error(sanitizeError(error));
      } finally {
          setIsSaving(false);
      }
  };

  const handleSaveServicosTerceiros = async (data: Partial<DiretrizServicosTerceiros> & { ano_referencia: number }) => {
      try {
          setIsSaving(true);
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (!authUser) throw new Error("Usuário não autenticado");
          
          const dbData: any = { user_id: authUser.id, ano_referencia: data.ano_referencia, nr_subitem: data.nr_subitem!, nome_subitem: data.nome_subitem!, descricao_subitem: data.descricao_subitem || null, itens_aquisicao: data.itens_aquisicao as unknown as Json, ativo: data.ativo ?? true };

          if (data.id) {
              await supabase.from('diretrizes_servicos_terceiros' as any).update(dbData).eq('id', data.id);
              toast.success("Subitem da ND atualizado!");
          } else {
              await supabase.from('diretrizes_servicos_terceiros' as any).insert([dbData]);
              toast.success("Novo Subitem da ND cadastrado!");
          }
          
          queryClient.invalidateQueries({ queryKey: ['diretrizesCustosOperacionais', selectedYear, authUser.id] });
          setDiretrizServicosTerceirosToEdit(null);
          setIsServicosTerceirosFormOpen(false);
      } catch (error: any) {
          toast.error(sanitizeError(error));
      } finally {
          setIsSaving(false);
      }
  };

  const handleSaveMaterialPermanente = async (data: Partial<DiretrizMaterialPermanente> & { ano_referencia: number }) => {
      try {
          setIsSaving(true);
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (!authUser) throw new Error("Usuário não autenticado");
          
          const dbData: any = { user_id: authUser.id, ano_referencia: data.ano_referencia, nr_subitem: data.nr_subitem!, nome_subitem: data.nome_subitem!, descricao_subitem: data.descricao_subitem || null, itens_aquisicao: data.itens_aquisicao as unknown as Json, ativo: data.ativo ?? true };

          if (data.id) {
              await supabase.from('diretrizes_material_permanente' as any).update(dbData).eq('id', data.id);
              toast.success("Subitem da ND atualizado!");
          } else {
              await supabase.from('diretrizes_material_permanente' as any).insert([dbData]);
              toast.success("Novo Subitem da ND cadastrado!");
          }
          
          queryClient.invalidateQueries({ queryKey: ['diretrizesMaterialPermanente', selectedYear, authUser.id] });
          setDiretrizMaterialPermanenteToEdit(null);
          setIsMaterialPermanenteFormOpen(false);
      } catch (error: any) {
          toast.error(sanitizeError(error));
      } finally {
          setIsSaving(false);
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
  
  const handleOpenNewServicosTerceiros = () => {
      setDiretrizMaterialConsumoToEdit(null);
      setIsServicosTerceirosFormOpen(true);
  };

  const handleOpenNewMaterialPermanente = () => {
      setDiretrizMaterialPermanenteToEdit(null);
      setIsMaterialPermanenteFormOpen(true);
  };
  
  const handleDeleteMaterialConsumo = async (id: string, nome: string) => {
      if (!confirm(`Tem certeza que deseja excluir o Subitem da ND "${nome}"?`)) return;
      setDiretrizesMaterialConsumo(current => current.filter(d => d.id !== id));
      try {
          const { error } = await supabase.from('diretrizes_material_consumo').delete().eq('id', id);
          if (error) throw error;
          toast.success("Subitem da ND excluído!");
      } catch (error) {
          toast.error(sanitizeError(error));
          queryClient.invalidateQueries({ queryKey: ['diretrizesMaterialConsumo', selectedYear, user?.id] });
      } finally {
          queryClient.invalidateQueries({ queryKey: ['diretrizesMaterialConsumo', selectedYear, user?.id] });
      }
  };

  const handleDeleteServicosTerceiros = async (id: string, nome: string) => {
      if (!confirm(`Tem certeza que deseja excluir o Subitem da ND "${nome}"?`)) return;
      setDiretrizesServicosTerceiros(current => current.filter(d => d.id !== id));
      try {
          const { error } = await supabase.from('diretrizes_servicos_terceiros' as any).delete().eq('id', id);
          if (error) throw error;
          toast.success("Subitem da ND excluído!");
      } catch (error) {
          toast.error(sanitizeError(error));
          queryClient.invalidateQueries({ queryKey: ['diretrizesServicosTerceiros', selectedYear, user?.id] });
      } finally {
          queryClient.invalidateQueries({ queryKey: ['diretrizesServicosTerceiros', selectedYear, user?.id] });
      }
  };

  const handleDeleteMaterialPermanente = async (id: string, nome: string) => {
      if (!confirm(`Tem certeza que deseja excluir o Subitem da ND "${nome}"?`)) return;
      setDiretrizesMaterialPermanente(current => current.filter(d => d.id !== id));
      try {
          const { error } = await supabase.from('diretrizes_material_permanente' as any).delete().eq('id', id);
          if (error) throw error;
          toast.success("Subitem da ND excluído!");
      } catch (error) {
          toast.error(sanitizeError(error));
          queryClient.invalidateQueries({ queryKey: ['diretrizesMaterialPermanente', selectedYear, user?.id] });
      } finally {
          queryClient.invalidateQueries({ queryKey: ['diretrizesMaterialPermanente', selectedYear, user?.id] });
      }
  };
  
  const indexedItems = useMemo<IndexedItemAquisicao[]>(() => {
    if (!diretrizesMaterialConsumo) return [];
    return diretrizesMaterialConsumo.flatMap(diretriz => {
        const itens = (diretriz.itens_aquisicao || []) as ItemAquisicao[];
        return itens.map(item => ({ ...item, diretrizId: diretriz.id, subitemNr: diretriz.nr_subitem, subitemNome: diretriz.nome_subitem }));
    });
  }, [diretrizesMaterialConsumo]);

  const indexedItemsServicos = useMemo<IndexedItemServico[]>(() => {
    if (!diretrizesServicosTerceiros) return [];
    return diretrizesServicosTerceiros.flatMap(diretriz => {
        const itens = (diretriz.itens_aquisicao || []) as ItemAquisicaoServico[];
        return itens.map(item => ({ ...item, diretrizId: diretriz.id, subitemNr: diretriz.nr_subitem, subitemNome: diretriz.nome_subitem }));
    });
  }, [diretrizesServicosTerceiros]);

  const indexedItemsPermanente = useMemo<IndexedItemPermanente[]>(() => {
    if (!diretrizesMaterialPermanente) return [];
    return diretrizesMaterialPermanente.flatMap(diretriz => {
        const itens = (diretriz.itens_aquisicao || []) as ItemAquisicao[];
        return itens.map(item => ({ ...item, diretrizId: diretriz.id, subitemNr: diretriz.nr_subitem, subitemNome: diretriz.nome_subitem }));
    });
  }, [diretrizesMaterialPermanente]);

  const filteredItems = useMemo(() => {
    if (!searchTerm) return [];
    const lowerCaseSearch = searchTerm.toLowerCase().trim();
    if (lowerCaseSearch.length < 3) return [];
    return indexedItems.filter(item => [item.descricao_item, item.codigo_catmat, item.numero_pregao, item.uasg, item.subitemNr, item.subitemNome].join(' ').toLowerCase().includes(lowerCaseSearch));
  }, [searchTerm, indexedItems]);

  const filteredItemsServicos = useMemo(() => {
    if (!searchTermServicos) return [];
    const lowerCaseSearch = searchTermServicos.toLowerCase().trim();
    if (lowerCaseSearch.length < 3) return [];
    return indexedItemsServicos.filter(item => [item.descricao_item, item.codigo_catmat, item.numero_pregao, item.uasg, item.subitemNr, item.subitemNome].join(' ').toLowerCase().includes(lowerCaseSearch));
  }, [searchTermServicos, indexedItemsServicos]);

  const filteredItemsPermanente = useMemo(() => {
    if (!searchTermPermanente) return [];
    const lowerCaseSearch = searchTermPermanente.toLowerCase().trim();
    if (lowerCaseSearch.length < 3) return [];
    return indexedItemsPermanente.filter(item => [item.descricao_item, item.codigo_catmat, item.numero_pregao, item.uasg, item.subitemNr, item.subitemNome].join(' ').toLowerCase().includes(lowerCaseSearch));
  }, [searchTermPermanente, indexedItemsPermanente]);

  const handleGoToSubitem = (diretrizId: string) => {
      handleCollapseChange('material_consumo_detalhe', true);
      setSubitemToOpenId(diretrizId);
      setTimeout(() => { const element = document.getElementById(`diretriz-material-consumo-${diretrizId}`); if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
      setSearchTerm("");
  };

  const handleGoToSubitemServico = (diretrizId: string) => {
      handleCollapseChange('servicos_terceiros_detalhe', true);
      setSubitemServicoToOpenId(diretrizId);
      setTimeout(() => { const element = document.getElementById(`diretriz-servicos-terceiros-${diretrizId}`); if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
      setSearchTermServicos("");
  };

  const handleGoToSubitemPermanente = (diretrizId: string) => {
      handleCollapseChange('material_permanente_detalhe', true);
      setSubitemPermanenteToOpenId(diretrizId);
      setTimeout(() => { const element = document.getElementById(`diretriz-material-permanente-${diretrizId}`); if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
      setSearchTermPermanente("");
  };
  
  useEffect(() => { if (subitemToOpenId) { const timer = setTimeout(() => setSubitemToOpenId(null), 500); return () => clearTimeout(timer); } }, [subitemToOpenId]);
  useEffect(() => { if (subitemServicoToOpenId) { const timer = setTimeout(() => setSubitemServicoToOpenId(null), 500); return () => clearTimeout(timer); } }, [subitemServicoToOpenId]);
  useEffect(() => { if (subitemPermanenteToOpenId) { const timer = setTimeout(() => setSubitemPermanenteToOpenId(null), 500); return () => clearTimeout(timer); } }, [subitemPermanenteToOpenId]);

  const renderSearchResults = () => {
      if (searchTerm.length < 3) return (<Card className="p-4 text-center text-muted-foreground">Digite pelo menos 3 caracteres para iniciar a busca.</Card>);
      if (filteredItems.length === 0) return (<Card className="p-4 text-center text-muted-foreground">Nenhum item de aquisição encontrado com este termo.</Card>);
      return (
          <Card className="p-4"><CardTitle className="text-base font-semibold mb-3">Resultados da Busca ({filteredItems.length})</CardTitle><Table><TableHeader><TableRow><TableHead className="w-[40%]">Item de Aquisição</TableHead><TableHead className="w-[40%]">Subitem ND</TableHead><TableHead className="w-[20%] text-center">Ações</TableHead></TableRow></TableHeader><TableBody>{filteredItems.map((item, index) => (<TableRow key={`${item.diretrizId}-${index}`}><TableCell className="font-medium">{item.descricao_item}<p className="text-xs text-muted-foreground">Cód. CATMAT: {item.codigo_catmat || 'N/A'}</p><p className="text-xs text-muted-foreground truncate">Pregão: {item.numero_pregao} | UASG: {formatCodug(item.uasg) || 'N/A'}</p></TableCell><TableCell className="text-left"><span className="font-semibold mr-1 whitespace-nowrap">{item.subitemNr}</span><span className="text-sm text-muted-foreground">{item.subitemNome}</span></TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => handleGoToSubitem(item.diretrizId)} className="w-full justify-start"><Package className="h-4 w-4 mr-1" />Ver Local</Button></TableCell></TableRow>))}</TableBody></Table></Card>
      );
  };

  const renderSearchResultsServicos = () => {
      if (searchTermServicos.length < 3) return (<Card className="p-4 text-center text-muted-foreground">Digite pelo menos 3 caracteres para iniciar a busca.</Card>);
      if (filteredItemsServicos.length === 0) return (<Card className="p-4 text-center text-muted-foreground">Nenhum item de serviço encontrado com este termo.</Card>);
      return (
          <Card className="p-4"><CardTitle className="text-base font-semibold mb-3">Resultados da Busca ({filteredItemsServicos.length})</CardTitle><Table><TableHeader><TableRow><TableHead className="w-[40%]">Item de Serviço</TableHead><TableHead className="w-[40%]">Subitem ND</TableHead><TableHead className="w-[20%] text-center">Ações</TableHead></TableRow></TableHeader><TableBody>{filteredItemsServicos.map((item, index) => (<TableRow key={`${item.diretrizId}-${index}`}><TableCell className="font-medium">{item.descricao_item}<p className="text-xs text-muted-foreground">Cód. CATMAT: {item.codigo_catmat || 'N/A'}</p><p className="text-xs text-muted-foreground truncate">Pregão: {item.numero_pregao} | UASG: {formatCodug(item.uasg) || 'N/A'}</p></TableCell><TableCell className="text-left"><span className="font-semibold mr-1 whitespace-nowrap">{item.subitemNr}</span><span className="text-sm text-muted-foreground">{item.subitemNome}</span></TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => handleGoToSubitemServico(item.diretrizId)} className="w-full justify-start"><Package className="h-4 w-4 mr-1" />Ver Local</Button></TableCell></TableRow>))}</TableBody></Table></Card>
      );
  };

  const renderSearchResultsPermanente = () => {
      if (searchTermPermanente.length < 3) return (<Card className="p-4 text-center text-muted-foreground">Digite pelo menos 3 caracteres para iniciar a busca.</Card>);
      if (filteredItemsPermanente.length === 0) return (<Card className="p-4 text-center text-muted-foreground">Nenhum item de material permanente encontrado com este termo.</Card>);
      return (
          <Card className="p-4"><CardTitle className="text-base font-semibold mb-3">Resultados da Busca ({filteredItemsPermanente.length})</CardTitle><Table><TableHeader><TableRow><TableHead className="w-[40%]">Item Permanente</TableHead><TableHead className="w-[40%]">Subitem ND</TableHead><TableHead className="w-[20%] text-center">Ações</TableHead></TableRow></TableHeader><TableBody>{filteredItemsPermanente.map((item, index) => (<TableRow key={`${item.diretrizId}-${index}`}><TableCell className="font-medium">{item.descricao_item}<p className="text-xs text-muted-foreground">Cód. CATMAT: {item.codigo_catmat || 'N/A'}</p><p className="text-xs text-muted-foreground truncate">Pregão: {item.numero_pregao} | UASG: {formatCodug(item.uasg) || 'N/A'}</p></TableCell><TableCell className="text-left"><span className="font-semibold mr-1 whitespace-nowrap">{item.subitemNr}</span><span className="text-sm text-muted-foreground">{item.subitemNome}</span></TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => handleGoToSubitemPermanente(item.diretrizId)} className="w-full justify-start"><Package className="h-4 w-4 mr-1" />Ver Local</Button></TableCell></TableRow>))}</TableBody></Table></Card>
      );
  };
  
  const renderMaterialConsumoSection = () => {
      const isDataLoading = (isLoadingMaterialConsumo || isMovingMaterialConsumo) && !isGhostMode();
      return (
          <div className="space-y-4 lista-subitens-nd"><Card className="p-4"><div className="flex justify-between items-center mb-4"><CardTitle className="text-base font-semibold">Subitens da ND Cadastrados</CardTitle><Button type="button" variant="outline" size="sm" onClick={() => setIsExportImportDialogOpen(true)} disabled={isSaving || isDataLoading}><FileSpreadsheet className="h-4 w-4 mr-2" />Exportar/Importar</Button></div><div className="mb-4 relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar item de aquisição (nome, CATMAT, pregão, subitem...)" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} disabled={isDataLoading} className="pl-10" /></div>{searchTerm ? renderSearchResults() : ((diretrizesMaterialConsumo?.length || 0) > 0 ? (<Table><TableHeader><TableRow><TableHead className="w-[150px] text-center">Nr Subitem</TableHead><TableHead>Nome do Subitem</TableHead><TableHead className="w-[100px] text-center">Ações</TableHead></TableRow></TableHeader><TableBody>{diretrizesMaterialConsumo.map(d => (<MaterialConsumoDiretrizRow key={d.id} diretriz={d} onEdit={handleStartEditMaterialConsumo} onDelete={handleDeleteMaterialConsumo} loading={isSaving || isDataLoading} onMoveItem={handleMoveItem} id={`diretriz-material-consumo-${d.id}`} forceOpen={subitemToOpenId === d.id} />))}</TableBody></Table>) : (<Card className="p-4 text-center text-muted-foreground">Nenhum subitem da ND cadastrado para o ano de referência.</Card>))}</Card><div className="flex justify-end"><Button type="button" onClick={handleOpenNewMaterialConsumo} disabled={isSaving || isDataLoading || !!searchTerm} variant="outline" size="sm" className="w-full btn-novo-subitem"><Plus className="mr-2 h-4 w-4" />Adicionar Novo Subitem da ND</Button></div>{(isLoadingMaterialConsumo || isMovingMaterialConsumo) && (<div className="text-center py-2"><Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" /><p className="text-xs text-muted-foreground mt-1">{isMovingMaterialConsumo ? "Movendo item..." : "Carregando subitens..."}</p></div>)}</div>
      );
  };

  const renderServicosTerceirosSection = () => {
      const isDataLoading = (isLoadingServicosTerceiros || isMovingServicosTerceiros) && !isGhostMode();
      return (
          <div className="space-y-4"><Card className="p-4"><div className="flex justify-between items-center mb-4"><CardTitle className="text-base font-semibold">Subitens da ND Cadastrados</CardTitle><Button type="button" variant="outline" size="sm" onClick={() => setIsExportImportServicosDialogOpen(true)} disabled={isSaving || isDataLoading}><FileSpreadsheet className="h-4 w-4 mr-2" />Exportar/Importar</Button></div><div className="mb-4 relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar item de serviço (nome, CATMAT, pregão, subitem...)" value={searchTermServicos} onChange={(e) => setSearchTermServicos(e.target.value)} disabled={isDataLoading} className="pl-10" /></div>{searchTermServicos ? renderSearchResultsServicos() : ((diretrizesServicosTerceiros?.length || 0) > 0 ? (<Table><TableHeader><TableRow><TableHead className="w-[150px] text-center">Nr Subitem</TableHead><TableHead>Nome do Subitem</TableHead><TableHead className="w-[100px] text-center">Ações</TableHead></TableRow></TableHeader><TableBody>{diretrizesServicosTerceiros.map(d => (<ServicosTerceirosDiretrizRow key={d.id} diretriz={d} onEdit={handleStartEditServicosTerceiros} onDelete={handleDeleteServicosTerceiros} loading={isSaving || isDataLoading} onMoveItem={handleMoveItemServico} id={`diretriz-servicos-terceiros-${d.id}`} forceOpen={subitemServicoToOpenId === d.id} />))}</TableBody></Table>) : (<Card className="p-4 text-center text-muted-foreground">Nenhum subitem da ND cadastrado para o ano de referência.</Card>))}</Card><div className="flex justify-end"><Button type="button" onClick={handleOpenNewServicosTerceiros} disabled={isSaving || isDataLoading || !!searchTermServicos} variant="outline" size="sm" className="w-full"><Plus className="mr-2 h-4 w-4" />Adicionar Novo Subitem da ND</Button></div>{(isLoadingServicosTerceiros || isMovingServicosTerceiros) && (<div className="text-center py-2"><Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" /><p className="text-xs text-muted-foreground mt-1">{isMovingMaterialConsumo ? "Movendo item..." : "Carregando subitens..."}</p></div>)}</div>
      );
  };

  const renderMaterialPermanenteSection = () => {
      const isDataLoading = (isLoadingMaterialPermanente || isMovingMaterialPermanente) && !isGhostMode();
      return (
          <div className="space-y-4"><Card className="p-4"><div className="flex justify-between items-center mb-4"><CardTitle className="text-base font-semibold">Subitens da ND Cadastrados</CardTitle><Button type="button" variant="outline" size="sm" onClick={() => setIsExportImportPermanenteDialogOpen(true)} disabled={isSaving || isDataLoading}><FileSpreadsheet className="h-4 w-4 mr-2" />Exportar/Importar</Button></div><div className="mb-4 relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar item permanente (nome, CATMAT, pregão, subitem...)" value={searchTermPermanente} onChange={(e) => setSearchTermPermanente(e.target.value)} disabled={isDataLoading} className="pl-10" /></div>{searchTermPermanente ? renderSearchResultsPermanente() : ((diretrizesMaterialPermanente?.length || 0) > 0 ? (<Table><TableHeader><TableRow><TableHead className="w-[150px] text-center">Nr Subitem</TableHead><TableHead>Nome do Subitem</TableHead><TableHead className="w-[100px] text-center">Ações</TableHead></TableRow></TableHeader><TableBody>{diretrizesMaterialPermanente.map(d => (<MaterialPermanenteDiretrizRow key={d.id} diretriz={d} onEdit={handleStartEditMaterialPermanente} onDelete={handleDeleteMaterialPermanente} loading={isSaving || isDataLoading} id={`diretriz-material-permanente-${d.id}`} forceOpen={subitemPermanenteToOpenId === d.id} isExpanded={subitemPermanenteToOpenId === d.id} onToggleExpand={() => setSubitemPermanenteToOpenId(subitemPermanenteToOpenId === d.id ? null : d.id)} />))}</TableBody></Table>) : (<Card className="p-4 text-center text-muted-foreground">Nenhum subitem da ND cadastrado para o ano de referência.</Card>))}</Card><div className="flex justify-end"><Button type="button" onClick={handleOpenNewMaterialPermanente} disabled={isSaving || isDataLoading || !!searchTermPermanente} variant="outline" size="sm" className="w-full"><Plus className="mr-2 h-4 w-4" />Adicionar Novo Subitem da ND</Button></div>{(isLoadingMaterialPermanente || isMovingMaterialPermanente) && (<div className="text-center py-2"><Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" /><p className="text-xs text-muted-foreground mt-1">{isMovingMaterialPermanente ? "Movendo item..." : "Carregando subitens..."}</p></div>)}</div>
      );
  };

  if (loading || isLoadingDefaultYear || isLoadingPageData || isFetchingPageData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-muted-foreground ml-2">Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <PageMetadata title="Configurações de Custos Operacionais" description="Defina os valores de diárias, contratos de passagens, concessionárias e fatores de custeio operacional para o cálculo do P Trab." canonicalPath="/config/custos-operacionais" />
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between"><Button variant="ghost" onClick={() => navigate("/ptrab")} className="mb-2"><ArrowLeft className="mr-2 h-4 w-4" />Voltar para Planos de Trabalho</Button><Button variant="outline" onClick={() => setIsYearManagementDialogOpen(true)} disabled={isSaving || isLoadingDefaultYear}><Settings className="mr-2 h-4 w-4" />Gerenciar Anos</Button></div>
        <Card className="card-diretrizes-operacionais">
          <CardHeader><h1 className="text-2xl font-bold">Configurações dos Custos Operacionais</h1><CardDescription>Defina os valores e fatores de referência para o cálculo de despesas operacionais (GND 3 e GND4).</CardDescription></CardHeader>
          <CardContent className={cn("space-y-6", "aba-material-consumo-container")}>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveDiretrizes(); }}>
              <div className="space-y-2 mb-6"><Label>Ano de Referência</Label><Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}><SelectTrigger><SelectValue placeholder="Selecione o ano" /></SelectTrigger><SelectContent>{availableYears.map((year) => (<SelectItem key={year} value={year.toString()}>{year} {year === defaultYear && "(Padrão)"}</SelectItem>))}</SelectContent></Select><p className="text-sm text-muted-foreground pt-1">Ano Padrão de Cálculo: <span className="font-semibold text-primary ml-1">{defaultYear ? defaultYear : 'Não definido (usando o mais recente)'}</span>{defaultYear && defaultYear !== selectedYear && (<span className="text-xs text-gray-500 ml-2">(Selecione este ano para editar o padrão)</span>)}</p></div>
              <div className="border-t pt-4 mt-6">
                <div className="space-y-4">
                  <div ref={el => collapsibleRefs.current['diarias_detalhe'] = el} className="border-b pb-4 last:border-b-0 last:pb-0"><Collapsible open={fieldCollapseState['diarias_detalhe']} onOpenChange={(open) => handleCollapseChange('diarias_detalhe', open)}><CollapsibleTrigger asChild><div className="flex items-center justify-between cursor-pointer py-2"><h2 className="text-base font-medium">Pagamento de Diárias</h2>{fieldCollapseState['diarias_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div></CollapsibleTrigger><CollapsibleContent><div className="mt-2">{renderDiariaTable()}</div></CollapsibleContent></Collapsible></div>
                  <div ref={el => collapsibleRefs.current['passagens_detalhe'] = el} className="border-b pb-4 last:border-b-0 last:pb-0"><Collapsible open={fieldCollapseState['passagens_detalhe']} onOpenChange={(open) => handleCollapseChange('passagens_detalhe', open)}><CollapsibleTrigger asChild><div className="flex items-center justify-between cursor-pointer py-2"><h2 className="text-base font-medium flex items-center gap-2">Aquisição de Passagens</h2>{fieldCollapseState['passagens_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div></CollapsibleTrigger><CollapsibleContent><div className="mt-2">{renderPassagensSection()}</div></CollapsibleContent></Collapsible></div>
                  <div ref={el => collapsibleRefs.current['concessionaria_detalhe'] = el} className="border-b pb-4 last:border-b-0 last:pb-0"><Collapsible open={fieldCollapseState['concessionaria_detalhe']} onOpenChange={(open) => handleCollapseChange('concessionaria_detalhe', open)}><CollapsibleTrigger asChild><div className="flex items-center justify-between cursor-pointer py-2"><h2 className="text-base font-medium flex items-center gap-2">Pagamento de Concessionárias</h2>{fieldCollapseState['concessionaria_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div></CollapsibleTrigger><CollapsibleContent><div className="mt-2">{renderConcessionariaSection()}</div></CollapsibleContent></Collapsible></div>
                  <div ref={el => collapsibleRefs.current['material_consumo_detalhe'] = el} className="border-b pb-4 last:border-b-0 last:pb-0 aba-material-consumo"><Collapsible open={fieldCollapseState['material_consumo_detalhe']} onOpenChange={(open) => handleCollapseChange('material_consumo_detalhe', open)}><CollapsibleTrigger asChild><div className="flex items-center justify-between cursor-pointer py-2 gatilho-material-consumo"><h2 className="text-base font-medium flex items-center gap-2">Aquisição de Material de Consumo</h2>{fieldCollapseState['material_consumo_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div></CollapsibleTrigger><CollapsibleContent><div className="mt-2">{renderMaterialConsumoSection()}</div></CollapsibleContent></Collapsible></div>
                  <div ref={el => collapsibleRefs.current['material_permanente_detalhe'] = el} className="border-b pb-4 last:border-b-0 last:pb-0"><Collapsible open={fieldCollapseState['material_permanente_detalhe']} onOpenChange={(open) => handleCollapseChange('material_permanente_detalhe', open)}><CollapsibleTrigger asChild><div className="flex items-center justify-between cursor-pointer py-2"><h2 className="text-base font-medium flex items-center gap-2">Aquisição de Material Permanente</h2>{fieldCollapseState['material_permanente_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div></CollapsibleTrigger><CollapsibleContent><div className="mt-2">{renderMaterialPermanenteSection()}</div></CollapsibleContent></Collapsible></div>
                  <div ref={el => collapsibleRefs.current['servicos_terceiros_detalhe'] = el} className="border-b pb-4 last:border-b-0 last:pb-0"><Collapsible open={fieldCollapseState['servicos_terceiros_detalhe']} onOpenChange={(open) => handleCollapseChange('servicos_terceiros_detalhe', open)}><CollapsibleTrigger asChild><div className="flex items-center justify-between cursor-pointer py-2"><h2 className="text-base font-medium flex items-center gap-2">Contratação de Serviços de Terceiros / Locações (Transporte)</h2>{fieldCollapseState['servicos_terceiros_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div></CollapsibleTrigger><CollapsibleContent><div className="mt-2">{renderServicosTerceirosSection()}</div></CollapsibleContent></Collapsible></div>
                  {OPERATIONAL_FIELDS.filter(f => f.key !== 'fator_material_consumo' && f.key !== 'fator_servicos_terceiros').map(field => { const fieldKey = field.key as string; const isOpen = fieldCollapseState[fieldKey] ?? false; return (<div key={fieldKey} ref={el => collapsibleRefs.current[fieldKey] = el} className="border-b pb-4 last:border-b-0 last:pb-0"><Collapsible open={isOpen} onOpenChange={(open) => handleCollapseChange(fieldKey, open)}><CollapsibleTrigger asChild><div className="flex items-center justify-between cursor-pointer py-2"><h2 className="text-base font-medium">{field.label}</h2>{isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div></CollapsibleTrigger><CollapsibleContent><div className="mt-2">{renderDiretrizField(field)}</div></CollapsibleContent></Collapsible></div>); })}
                </div>
              </div>
              <div className="space-y-2 border-t pt-4 mt-6"><Label>Observações</Label><Textarea value={diretrizes.observacoes || ""} onChange={(e) => setDiretrizes({ ...diretrizes, observacoes: e.target.value })} onKeyDown={handleEnterToNextField} /></div>
              <div className="flex justify-end gap-3 mt-6"><Button type="button" variant="secondary" onClick={handleSetDefaultYear} disabled={isSaving || selectedYear === defaultYear || !selectedYear}>{selectedYear === defaultYear ? "Padrão Atual" : "Adotar como Padrão"}</Button><Button type="submit" disabled={isSaving} className="btn-adotar-padrao">{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar Diretrizes</Button></div>
            </form>
          </CardContent>
        </Card>
      </div>
      <YearManagementDialog open={isYearManagementDialogOpen} onOpenChange={setIsYearManagementDialogOpen} availableYears={availableYears} defaultYear={defaultYear} onCopy={handleCopyDiretrizes} onDelete={handleDeleteDiretrizes} loading={isSaving} />
      <PassagemDiretrizFormDialog open={isPassagemFormOpen} onOpenChange={setIsPassagemFormOpen} selectedYear={selectedYear} diretrizToEdit={diretrizToEdit} onSave={handleSavePassagem} loading={isSaving} />
      <ConcessionariaDiretrizFormDialog open={isConcessionariaFormOpen} onOpenChange={setIsConcessionariaFormOpen} selectedYear={selectedYear} diretrizToEdit={diretrizConcessionariaToEdit} onSave={handleSaveConcessionaria} loading={isSaving} initialCategory={selectedConcessionariaTab} />
      <MaterialConsumoDiretrizFormDialog open={isMaterialConsumoFormOpen} onOpenChange={setIsMaterialConsumoFormOpen} selectedYear={selectedYear} diretrizToEdit={diretrizMaterialConsumoToEdit} onSave={handleSaveMaterialConsumo} loading={isSaving} />
      <MaterialConsumoExportImportDialog open={isExportImportDialogOpen} onOpenChange={setIsExportImportDialogOpen} selectedYear={selectedYear} diretrizes={diretrizesMaterialConsumo || []} onImportSuccess={handleMaterialConsumoImportSuccess} />
      <ServicosTerceirosDiretrizFormDialog open={isServicosTerceirosFormOpen} onOpenChange={setIsServicosTerceirosFormOpen} selectedYear={selectedYear} diretrizToEdit={diretrizServicosTerceirosToEdit} onSave={handleSaveServicosTerceiros} loading={isSaving} />
      <ServicosTerceirosExportImportDialog open={isExportImportServicosDialogOpen} onOpenChange={setIsExportImportServicosDialogOpen} selectedYear={selectedYear} diretrizes={diretrizesServicosTerceiros || []} onImportSuccess={handleServicosTerceirosImportSuccess} />
      <MaterialPermanenteDiretrizFormDialog open={isMaterialPermanenteFormOpen} onOpenChange={setIsMaterialPermanenteFormOpen} selectedYear={selectedYear} diretrizToEdit={diretrizMaterialPermanenteToEdit} onSave={handleSaveMaterialPermanente} loading={isSaving} />
      <MaterialPermanenteExportImportDialog open={isExportImportPermanenteDialogOpen} onOpenChange={setIsExportImportPermanenteDialogOpen} selectedYear={selectedYear} diretrizes={diretrizesMaterialPermanente || []} onImportSuccess={handleMaterialPermanenteImportSuccess} />
    </div>
  );
};

export default CustosOperacionaisPage;