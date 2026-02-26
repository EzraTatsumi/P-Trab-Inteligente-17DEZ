"use client";

/**
 * Página de Configuração de Custos Operacionais - Layout Restaurado v1.0.4
 * Gerencia os parâmetros de diárias, passagens, concessionárias e materiais.
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
import { GHOST_DATA, isGhostMode, getActiveMission } from "@/lib/ghostStore";
import { cn } from "@/lib/utils";
import { markMissionCompleted } from "@/lib/missionUtils";

type DiretrizOperacional = Tables<'diretrizes_operacionais'>;

interface IndexedItemAquisicao extends ItemAquisicao {
    diretrizId: string;
    subitemNr: string;
    subitemNome: string;
}

interface IndexedItemServico extends ItemAquisicaoServico {
    diretrizId: string;
    subitemNr: string;
    subitemNome: string;
}

interface IndexedItemPermanente extends ItemAquisicao {
    diretrizId: string;
    subitemNr: string;
    subitemNome: string;
}

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

const CustosOperacionaisPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false); 
  const hasStartedTour = useRef(false);
  
  const currentYear = new Date().getFullYear();
  const [diretrizes, setDiretrizes] = useState<Partial<DiretrizOperacional>>(defaultDiretrizes(currentYear));
  
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [isYearManagementDialogOpen, setIsYearManagementDialogOpen] = useState(false);
  
  const { data: defaultYearData, isLoading: isLoadingDefaultYear } = useDefaultDiretrizYear();
  const defaultYear = defaultYearData?.defaultYear || null;

  const ghostActive = isGhostMode();

  const { data: pageData, isLoading: isLoadingPageData, isFetching: isFetchingPageData } = useQuery({
    queryKey: ['diretrizesCustosOperacionais', selectedYear, user?.id, ghostActive],
    queryFn: async () => {
      if (!user?.id || !selectedYear) return null;

      if (ghostActive) {
          return {
              operacional: defaultDiretrizes(selectedYear),
              passagens: [],
              concessionaria: []
          };
      }

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

  const [isMaterialConsumoFormOpen, setIsMaterialConsumoFormOpen] = useState(false);
  const [diretrizMaterialConsumoToEdit, setDiretrizMaterialConsumoToEdit] = useState<DiretrizMaterialConsumo | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [subitemToOpenId, setSubitemToOpenId] = useState<string | null>(null);
  const [isExportImportDialogOpen, setIsExportImportDialogOpen] = useState(false);

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

  const collapsibleRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // --- Handlers ---

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

  const handleCurrencyChange = (field: keyof DiretrizOperacional, rawValue: string) => {
    const { numericValue, digits } = formatCurrencyInput(rawValue);
    setRawInputs(prev => ({ ...prev, [field]: digits }));
    setDiretrizes(prev => ({ ...prev, [field]: numericValue }));
  };
  
  const handleFactorChange = (field: keyof DiretrizOperacional, value: string) => {
    const numericValue = parseFloat(value) || 0;
    setDiretrizes(prev => ({ ...prev, [field]: numericValue }));
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

  const handleOpenNewMaterialConsumo = useCallback(() => {
      setDiretrizMaterialConsumoToEdit(null);
      setIsMaterialConsumoFormOpen(true);
      
      if (isGhostMode()) {
        window.dispatchEvent(new CustomEvent('tour:avancar'));
      }
  }, []);

  const handleOpenNewServicosTerceiros = useCallback(() => {
      setDiretrizServicosTerceirosToEdit(null);
      setIsServicosTerceirosFormOpen(true);
  }, []);

  const handleOpenNewMaterialPermanente = useCallback(() => {
      setDiretrizMaterialPermanenteToEdit(null);
      setIsMaterialPermanenteFormOpen(true);
  }, []);

  const handleSaveMaterialConsumo = async (data: Partial<DiretrizMaterialConsumo> & { ano_referencia: number }) => {
      if (isGhostMode()) {
          setIsSaving(true);
          setTimeout(() => {
              const newItem = {
                  ...data,
                  id: data.id || `ghost-subitem-${data.nr_subitem}`, 
                  user_id: 'ghost-user',
                  ativo: data.ativo ?? true,
              } as DiretrizMaterialConsumo;
              
              setDiretrizesMaterialConsumo(prev => {
                  const filtered = prev.filter(p => p.id !== newItem.id);
                  return [...filtered, newItem].sort((a, b) => a.nr_subitem.localeCompare(b.nr_subitem));
              });
              
              setIsSaving(false);
              setDiretrizMaterialConsumoToEdit(null);
              setIsMaterialConsumoFormOpen(false);
              toast.success("Simulação: Subitem salvo localmente!");
              
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('tour:avancar'));
              }, 200);
          }, 500);
          return;
      }

      try {
          setIsSaving(true);
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (!authUser) throw new Error("Usuário não autenticado");
          
          const dbData: TablesInsert<'diretrizes_material_consumo'> = {
              user_id: authUser.id,
              ano_referencia: data.ano_referencia,
              nr_subitem: data.nr_subitem!,
              nome_subitem: data.nome_subitem!,
              descricao_subitem: data.descricao_subitem || null,
              itens_aquisicao: data.itens_aquisicao as unknown as Json,
              ativo: data.ativo ?? true,
          };
          
          const { error } = await supabase
              .from('diretrizes_material_consumo')
              .upsert(dbData as TablesUpdate<'diretrizes_material_consumo'>, { 
                  onConflict: 'user_id,ano_referencia,nr_subitem' 
              });

          if (error) throw error;
          toast.success(data.id ? "Subitem de Material de Consumo atualizado!" : "Novo Subitem de Material de Consumo cadastrado!");
          
          await queryClient.invalidateQueries({ queryKey: ['diretrizesMaterialConsumo', selectedYear, authUser.id] });
          // INVALIDAÇÃO DO STATUS DE ONBOARDING
          await queryClient.invalidateQueries({ queryKey: ["user-status"] });
          
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
          
          const dbData = {
              user_id: authUser.id,
              ano_referencia: data.ano_referencia,
              nr_subitem: data.nr_subitem!,
              nome_subitem: data.nome_subitem!,
              descricao_subitem: data.descricao_subitem || null,
              itens_aquisicao: data.itens_aquisicao as unknown as Json,
              ativo: data.ativo ?? true,
          };
          
          const { error } = await supabase
              .from('diretrizes_servicos_terceiros' as any)
              .upsert(dbData, { 
                  onConflict: 'user_id,ano_referencia,nr_subitem' 
              });

          if (error) throw error;
          toast.success(data.id ? "Subitem de Serviços de Terceiros atualizado!" : "Novo Subitem de Serviços de Terceiros cadastrado!");
          
          await queryClient.invalidateQueries({ queryKey: ['diretrizesServicosTerceiros', selectedYear, authUser.id] });
          // INVALIDAÇÃO DO STATUS DE ONBOARDING
          await queryClient.invalidateQueries({ queryKey: ["user-status"] });
          
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
          
          const dbData = {
              user_id: authUser.id,
              ano_referencia: data.ano_referencia,
              nr_subitem: data.nr_subitem!,
              nome_subitem: data.nome_subitem!,
              descricao_subitem: data.descricao_subitem || null,
              itens_aquisicao: data.itens_aquisicao as unknown as Json,
              ativo: data.ativo ?? true,
          };
          
          const { error } = await supabase
              .from('diretrizes_material_permanente' as any)
              .upsert(dbData, { 
                  onConflict: 'user_id,ano_referencia,nr_subitem' 
              });

          if (error) throw error;
          toast.success(data.id ? "Subitem de Material Permanente atualizado!" : "Novo Subitem de Material Permanente cadastrado!");
          
          await queryClient.invalidateQueries({ queryKey: ['diretrizesMaterialPermanente', selectedYear, authUser.id] });
          // INVALIDAÇÃO DO STATUS DE ONBOARDING
          await queryClient.invalidateQueries({ queryKey: ["user-status"] });
          
          setDiretrizMaterialPermanenteToEdit(null);
          setIsMaterialPermanenteFormOpen(false);
      } catch (error: any) {
          toast.error(sanitizeError(error));
      } finally {
          setIsSaving(false);
      }
  };

  // ... (delete handlers mantidos)

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
          
          const { error } = await supabase
              .from('diretrizes_passagens')
              .upsert(dbData as TablesUpdate<'diretrizes_passagens'>, { 
                  onConflict: 'user_id,ano_referencia,om_referencia' 
              });

          if (error) throw error;
          toast.success(data.id ? "Contrato de Passagens atualizado!" : "Novo Contrato de Passagens cadastrado!");
          
          await queryClient.invalidateQueries({ queryKey: ['diretrizesCustosOperacionais', selectedYear, authUser.id] });
          // INVALIDAÇÃO DO STATUS DE ONBOARDING
          await queryClient.invalidateQueries({ queryKey: ["user-status"] });
          
          setDiretrizToEdit(null);
          setIsPassagemFormOpen(false);
      } catch (error: any) {
          toast.error(sanitizeError(error));
      } finally {
          setIsSaving(false);
      }
  };
  
  // ... (start/open handlers mantidos)

  const handleSaveConcessionaria = async (data: DiretrizConcessionariaForm & { id?: string }) => {
      try {
          setIsSaving(true);
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (!authUser) throw new Error("Usuário não autenticado");
          
          const consumoValue = typeof data.consumo_pessoa_dia === 'string' ? parseFloat(data.consumo_pessoa_dia.replace(',', '.')) || 0 : data.consumo_pessoa_dia;
          const dbData: TablesInsert<'diretrizes_concessionaria'> = { user_id: authUser.id, ano_referencia: selectedYear, categoria: data.categoria, nome_concessionaria: data.nome_concessionaria, consumo_pessoa_dia: consumoValue, fonte_consumo: data.fonte_consumo || null, custo_unitario: data.custo_unitario, fonte_custo: data.fonte_custo || null, unidade_custo: data.unidade_custo };

          const { error } = await supabase
              .from('diretrizes_concessionaria')
              .upsert(dbData as TablesUpdate<'diretrizes_concessionaria'>, { 
                  onConflict: 'user_id,ano_referencia,categoria,nome_concessionaria' 
              });

          if (error) throw error;
          toast.success(data.id ? "Diretriz de Concessionária atualizada!" : "Nova Diretriz de Concessionária cadastrada!");
          
          await queryClient.invalidateQueries({ queryKey: ['diretrizesCustosOperacionais', selectedYear, authUser.id] });
          // INVALIDAÇÃO DO STATUS DE ONBOARDING
          await queryClient.invalidateQueries({ queryKey: ["user-status"] });
          
          setDiretrizConcessionariaToEdit(null);
          setIsConcessionariaFormOpen(false);
      } catch (error: any) {
          toast.error(sanitizeError(error));
      } finally {
          setIsSaving(false);
      }
  };
  
  // ... (restante da página mantido)

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      {/* ... */}
    </div>
  );
};

export default CustosOperacionaisPage;