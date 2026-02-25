"use client";

/**
 * Página de Configuração de Custos Operacionais - v1.0.3
 * Layout restaurado conforme aprovação prévia.
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
import { numberToRawDigits } from "@/lib/formatUtils";
import { useSession } from "@/components/SessionContextProvider";
import { Tables, TablesInsert, Json } from "@/integrations/supabase/types";
import { diretrizOperacionalSchema } from "@/lib/validationSchemas";
import * as z from "zod";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDefaultDiretrizYear } from "@/hooks/useDefaultDiretrizYear";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { TrechoPassagem } from "@/types/diretrizesPassagens";
import CurrencyInput from "@/components/CurrencyInput";
import PassagemDiretrizFormDialog from "@/components/PassagemDiretrizFormDialog";
import PassagemDiretrizRow from "@/components/PassagemDiretrizRow"; 
import ConcessionariaDiretrizFormDialog from "@/components/ConcessionariaDiretrizFormDialog";
import ConcessionariaDiretrizRow from "@/components/ConcessionariaDiretrizRow";
import { 
    DiretrizConcessionaria, 
} from "@/types/diretrizesConcessionaria";
import { 
    DiretrizMaterialConsumo, 
} from "@/types/diretrizesMaterialConsumo";
import MaterialConsumoDiretrizFormDialog from "@/components/MaterialConsumoDiretrizFormDialog";
import MaterialConsumoDiretrizRow from "@/components/MaterialConsumoDiretrizRow";
import { useMaterialConsumoDiretrizes } from "@/hooks/useMaterialConsumoDiretrizes";
import PageMetadata from "@/components/PageMetadata";
import MaterialConsumoExportImportDialog from "@/components/MaterialConsumoExportImportDialog";

import { DiretrizServicosTerceiros } from "@/types/diretrizesServicosTerceiros";
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
import { isGhostMode } from "@/lib/ghostStore";
import { cn } from "@/lib/utils";
import { markMissionCompleted } from "@/lib/missionUtils";

type DiretrizOperacional = Tables<'diretrizes_operacionais'>;

const DIARIA_RANKS_CONFIG = [
  { key: 'of_gen', label: 'Of Gen', fieldPrefix: 'diaria_of_gen' },
  { key: 'of_sup', label: 'Of Sup', fieldPrefix: 'diaria_of_sup' },
  { key: 'of_int_sgt', label: 'Of Int/Sub/Asp Of/ST/Sgt', fieldPrefix: 'diaria_of_int_sgt' },
  { key: 'demais_pracas', label: 'Demais Praças', fieldPrefix: 'diaria_demais_pracas' },
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
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [isYearManagementDialogOpen, setIsYearManagementDialogOpen] = useState(false);
  
  const [diretrizes, setDiretrizes] = useState<Partial<DiretrizOperacional>>(defaultDiretrizes(currentYear));
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  
  const [diretrizesPassagens, setDiretrizesPassagens] = useState<any[]>([]);
  const [isPassagemDialogOpen, setIsPassagemDialogOpen] = useState(false);
  const [passagemToEdit, setPassagemToEdit] = useState<any | null>(null);

  const [diretrizesConcessionaria, setDiretrizesConcessionaria] = useState<DiretrizConcessionaria[]>([]);
  const [isConcessionariaDialogOpen, setIsConcessionariaDialogOpen] = useState(false);
  const [concessionariaToEdit, setConcessionariaToEdit] = useState<DiretrizConcessionaria | null>(null);

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
        supabase.from("diretrizes_operacionais").select("*").eq("user_id", user.id).eq("ano_referencia", selectedYear).maybeSingle(),
        supabase.from('diretrizes_passagens').select('*').eq('user_id', user.id).eq('ano_referencia', selectedYear).order('om_referencia', { ascending: true }),
        supabase.from('diretrizes_concessionaria').select('*').eq('user_id', user.id).eq('ano_referencia', selectedYear).order('categoria', { ascending: true }).order('nome_concessionaria', { ascending: true })
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

  const { 
    diretrizes: materialConsumoDiretrizes, 
    isLoading: isLoadingMatConsumo,
    saveDiretriz: saveMatConsumo,
    deleteDiretriz: deleteMatConsumo
  } = useMaterialConsumoDiretrizes(selectedYear);

  const [isMatConsumoDialogOpen, setIsMatConsumoDialogOpen] = useState(false);
  const [matConsumoToEdit, setMatConsumoToEdit] = useState<DiretrizMaterialConsumo | null>(null);
  const [isMatConsumoExportImportOpen, setIsMatConsumoExportImportOpen] = useState(false);

  const { 
    diretrizes: servicosTerceirosDiretrizes, 
    isLoading: isLoadingServicos,
    saveDiretriz: saveServico,
    deleteDiretriz: deleteServico
  } = useServicosTerceirosDiretrizes(selectedYear);

  const [isServicoDialogOpen, setIsServicoDialogOpen] = useState(false);
  const [servicoToEdit, setServicoToEdit] = useState<DiretrizServicosTerceiros | null>(null);
  const [isServicoExportImportOpen, setIsServicoExportImportOpen] = useState(false);

  const { 
    diretrizes: materialPermanenteDiretrizes, 
    isLoading: isLoadingMatPermanente,
    saveDiretriz: saveMatPermanente,
    deleteDiretriz: deleteMatPermanente
  } = useMaterialPermanenteDiretrizes(selectedYear);

  const [isMatPermanenteDialogOpen, setIsMatPermanenteDialogOpen] = useState(false);
  const [matPermanenteToEdit, setMatPermanenteToEdit] = useState<DiretrizMaterialPermanente | null>(null);
  const [isMatPermanenteExportImportOpen, setIsMatPermanenteExportImportOpen] = useState(false);

  const [fieldCollapseState, setFieldCollapseState] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    const s = location.state as any;
    initialState['diarias_detalhe'] = false; 
    initialState['passagens_detalhe'] = s?.openPassagens || false; 
    initialState['concessionaria_detalhe'] = s?.openConcessionaria || false;
    initialState['material_consumo_detalhe'] = s?.openMaterialConsumo || false;
    initialState['servicos_terceiros_detalhe'] = s?.openServicosTerceiros || false;
    initialState['material_permanente_detalhe'] = s?.openMaterialPermanente || false;
    return initialState;
  });

  const collapsibleRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
    if (isLoadingDefaultYear || isLoadingPageData || isFetchingPageData || hasStartedTour.current) return;

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
  }, [isLoadingDefaultYear, isLoadingPageData, isFetchingPageData, searchParams, navigate, user?.id]);

  useEffect(() => {
    const loadAvailableYears = async () => {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from("diretrizes_operacionais")
        .select("ano_referencia")
        .eq("user_id", user.id);

      if (error) {
        console.error("Erro ao buscar anos:", error);
        return;
      }

      const yearsFromOp = data.map((d) => d.ano_referencia);
      const allYears = Array.from(new Set([...yearsFromOp, currentYear])).sort((a, b) => b - a);
      setAvailableYears(allYears);

      if (allYears.length > 0 && !selectedYear) {
        setSelectedYear(allYears[0]);
      }
    };

    loadAvailableYears();
  }, [user?.id, currentYear, selectedYear]);

  useEffect(() => {
    if (pageData) {
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

      setDiretrizesPassagens((pageData.passagens || []).map((d: any) => ({
          ...d,
          trechos: (d.trechos as unknown as TrechoPassagem[]) || [],
      })));
      
      setDiretrizesConcessionaria((pageData.concessionaria || []).map((d: any) => ({
          ...d,
          consumo_pessoa_dia: Number(d.consumo_pessoa_dia),
          custo_unitario: Number(d.custo_unitario),
      })));
    }
  }, [pageData, selectedYear]);

  const handleCollapseChange = (key: string, open: boolean) => {
    setFieldCollapseState(prev => ({ ...prev, [key]: open }));
    if (open) {
      setTimeout(() => {
        collapsibleRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  };

  const handleCurrencyChange = (field: keyof DiretrizOperacional, numericValue: number, digits: string) => {
    setDiretrizes(prev => ({ ...prev, [field]: numericValue }));
    setRawInputs(prev => ({ ...prev, [field]: digits }));
  };

  const handleSaveDiretrizes = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const dataToValidate = {
        ...diretrizes,
        ano_referencia: selectedYear,
        user_id: user.id,
      };

      const validatedData = diretrizOperacionalSchema.parse(dataToValidate);

      const { error } = await supabase
        .from("diretrizes_operacionais")
        .upsert(validatedData, { onConflict: "user_id,ano_referencia" });

      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['diretrizesCustosOperacionais', selectedYear, user.id] });
      toast.success("Diretrizes operacionais salvas com sucesso!");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        error.errors.forEach(err => toast.error(`${err.path.join('.')}: ${err.message}`));
      } else {
        toast.error(sanitizeError(error));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefaultYear = async () => {
    if (!user?.id || !selectedYear) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ default_operacional_year: selectedYear })
        .eq('id', user.id);

      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['defaultDiretrizYear', user.id] });
      toast.success(`Ano ${selectedYear} definido como padrão para cálculos operacionais.`);
    } catch (error) {
      toast.error(sanitizeError(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePassagem = async (data: any) => {
      if (!user?.id) return;
      setIsSaving(true);
      try {
          const payload = {
              ...data,
              user_id: user.id,
              trechos: (data.trechos as unknown as Json) || [] as Json,
          };

          const { error } = await supabase
              .from('diretrizes_passagens')
              .upsert(payload as any);

          if (error) throw error;
          
          queryClient.invalidateQueries({ queryKey: ['diretrizesCustosOperacionais', selectedYear, user.id] });
          toast.success("Diretriz de passagem salva!");
          setIsPassagemDialogOpen(false);
          setPassagemToEdit(null);
      } catch (error) {
          toast.error(sanitizeError(error));
      } finally {
          setIsSaving(false);
      }
  };

  const handleDeletePassagem = async (id: string) => {
      if (!confirm("Tem certeza que deseja excluir esta diretriz de passagem?")) return;
      setIsSaving(true);
      try {
          const { error } = await supabase.from('diretrizes_passagens').delete().eq('id', id);
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ['diretrizesCustosOperacionais', selectedYear, user.id] });
          toast.success("Diretriz excluída.");
      } catch (error) {
          toast.error(sanitizeError(error));
      } finally {
          setIsSaving(false);
      }
  };

  const handleSaveConcessionaria = async (data: any) => {
      if (!user?.id) return;
      setIsSaving(true);
      try {
          const payload = {
              ...data,
              user_id: user.id,
          };

          const { error } = await supabase
              .from('diretrizes_concessionaria')
              .upsert(payload as any);

          if (error) throw error;
          
          queryClient.invalidateQueries({ queryKey: ['diretrizesCustosOperacionais', selectedYear, user.id] });
          toast.success("Diretriz de concessionária salva!");
          setIsConcessionariaDialogOpen(false);
          setConcessionariaToEdit(null);
      } catch (error) {
          toast.error(sanitizeError(error));
      } finally {
          setIsSaving(false);
      }
  };

  const handleDeleteConcessionaria = async (id: string) => {
      if (!confirm("Tem certeza que deseja excluir esta diretriz de concessionária?")) return;
      setIsSaving(true);
      try {
          const { error } = await supabase.from('diretrizes_concessionaria').delete().eq('id', id);
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ['diretrizesCustosOperacionais', selectedYear, user.id] });
          toast.success("Diretriz excluída.");
      } catch (error) {
          toast.error(sanitizeError(error));
      } finally {
          setIsSaving(false);
      }
  };

  const isDataLoading = isLoadingPageData || isFetchingPageData || isLoadingDefaultYear;

  const renderDiariaTable = () => (
    <div className="overflow-x-auto border rounded-md">
      <div className="p-3 border-b flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Tabela de Diárias (Referência Legal)</span>
        </div>
        <Input 
          className="max-w-xs h-8 text-xs" 
          placeholder="Ex: Decreto Nº 12.324 de 19DEZ24"
          value={diretrizes.diaria_referencia_legal || ""}
          onChange={(e) => setDiretrizes({...diretrizes, diaria_referencia_legal: e.target.value})}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[30%]">Posto / Graduação</TableHead>
            <TableHead className="text-center">Brasília/Manaus/Rio/SP</TableHead>
            <TableHead className="text-center">Demais Capitais</TableHead>
            <TableHead className="text-center">Demais Cidades</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {DIARIA_RANKS_CONFIG.map((rank) => (
            <TableRow key={rank.key}>
              <TableCell className="font-medium text-xs">{rank.label}</TableCell>
              <TableCell>
                <CurrencyInput 
                  className="h-8 text-xs text-center font-semibold"
                  rawDigits={rawInputs[`${rank.fieldPrefix}_bsb`] || ""}
                  onChange={(val, digits) => handleCurrencyChange(`${rank.fieldPrefix}_bsb` as keyof DiretrizOperacional, val, digits)}
                />
              </TableCell>
              <TableCell>
                <CurrencyInput 
                  className="h-8 text-xs text-center font-semibold"
                  rawDigits={rawInputs[`${rank.fieldPrefix}_capitais`] || ""}
                  onChange={(val, digits) => handleCurrencyChange(`${rank.fieldPrefix}_capitais` as keyof DiretrizOperacional, val, digits)}
                />
              </TableCell>
              <TableCell>
                <CurrencyInput 
                  className="h-8 text-xs text-center font-semibold"
                  rawDigits={rawInputs[`${rank.fieldPrefix}_demais`] || ""}
                  onChange={(val, digits) => handleCurrencyChange(`${rank.fieldPrefix}_demais` as keyof DiretrizOperacional, val, digits)}
                />
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/20">
            <TableCell className="font-medium text-xs flex items-center gap-2">
              Taxa de Embarque (Aéreo)
            </TableCell>
            <TableCell colSpan={3}>
              <div className="flex justify-center">
                <CurrencyInput 
                  className="h-8 text-xs text-center font-semibold max-w-[150px]"
                  rawDigits={rawInputs['taxa_embarque'] || ""}
                  onChange={(val, digits) => handleCurrencyChange('taxa_embarque', val, digits)}
                />
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );

  const renderPassagensSection = () => (
      <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
              <span className="text-sm font-medium text-muted-foreground">Contratos de Passagens Cadastrados</span>
              <Button size="sm" onClick={() => { setPassagemToEdit(null); setIsPassagemDialogOpen(true); }} className="bg-[#0f172a] hover:bg-[#0f172a]/90 text-white rounded-full px-4">
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
                          onEdit={(d) => { setPassagemToEdit(d); setIsPassagemDialogOpen(true); }}
                          onDelete={handleDeletePassagem}
                      />
                  ))
              )}
          </div>
      </div>
  );

  const renderConcessionariaSection = () => (
      <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
              <span className="text-sm font-medium text-muted-foreground">Parâmetros de Concessionárias</span>
              <Button size="sm" onClick={() => { setConcessionariaToEdit(null); setIsConcessionariaDialogOpen(true); }} className="bg-[#0f172a] hover:bg-[#0f172a]/90 text-white rounded-full px-4">
                  <Plus className="h-4 w-4 mr-1" /> Novo Parâmetro
              </Button>
          </div>
          
          <div className="space-y-2">
              {diretrizesConcessionaria.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground">
                      Nenhum parâmetro de concessionária cadastrado para {selectedYear}.
                  </div>
              ) : (
                  diretrizesConcessionaria.map(diretriz => (
                      <ConcessionariaDiretrizRow 
                          key={diretriz.id} 
                          diretriz={diretriz} 
                          onEdit={(d) => { setConcessionariaToEdit(d); setIsConcessionariaDialogOpen(true); }}
                          onDelete={handleDeleteConcessionaria}
                      />
                  ))
              )}
          </div>
      </div>
  );

  const renderMaterialConsumoSection = () => (
    <div className="space-y-4 aba-material-consumo-container">
        <div className="flex justify-between items-center px-1">
            <span className="text-sm font-medium text-muted-foreground">Subitens da Natureza de Despesa (ND 30)</span>
            <div className="flex gap-2">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsMatConsumoExportImportOpen(true)}
                    disabled={isLoadingMatConsumo}
                    className="rounded-full"
                >
                    <FileSpreadsheet className="h-4 w-4 mr-1" /> Exp/Imp Excel
                </Button>
                <Button size="sm" onClick={() => { setMatConsumoToEdit(null); setIsMatConsumoDialogOpen(true); }} className="btn-novo-subitem bg-[#0f172a] hover:bg-[#0f172a]/90 text-white rounded-full px-4">
                    <Plus className="h-4 w-4 mr-1" /> Novo Subitem
                </Button>
            </div>
        </div>
        
        <div className="space-y-3 listagem-material-consumo">
            {isLoadingMatConsumo ? (
                <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="text-sm text-muted-foreground mt-2">Carregando subitens...</p>
                </div>
            ) : materialConsumoDiretrizes.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                    Nenhum subitem de material de consumo cadastrado para {selectedYear}.
                </div>
            ) : (
                materialConsumoDiretrizes.map(diretriz => (
                    <MaterialConsumoDiretrizRow 
                        key={diretriz.id} 
                        diretriz={diretriz} 
                        onEdit={(d) => { setMatConsumoToEdit(d); setIsMatConsumoDialogOpen(true); }}
                        onDelete={deleteMatConsumo}
                    />
                ))
            )}
        </div>
    </div>
  );

  const renderServicosTerceirosSection = () => (
    <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
            <span className="text-sm font-medium text-muted-foreground">Subitens da Natureza de Despesa (ND 33 e 39)</span>
            <div className="flex gap-2">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsServicoExportImportOpen(true)}
                    disabled={isLoadingServicos}
                    className="rounded-full"
                >
                    <FileSpreadsheet className="h-4 w-4 mr-1" /> Exp/Imp Excel
                </Button>
                <Button size="sm" onClick={() => { setServicoToEdit(null); setIsServicoDialogOpen(true); }} className="bg-[#0f172a] hover:bg-[#0f172a]/90 text-white rounded-full px-4">
                    <Plus className="h-4 w-4 mr-1" /> Novo Subitem
                </Button>
            </div>
        </div>
        
        <div className="space-y-3">
            {isLoadingServicos ? (
                <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="text-sm text-muted-foreground mt-2">Carregando subitens...</p>
                </div>
            ) : servicosTerceirosDiretrizes.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                    Nenhum subitem de serviço cadastrado para {selectedYear}.
                </div>
            ) : (
                servicosTerceirosDiretrizes.map(diretriz => (
                    <ServicosTerceirosDiretrizRow 
                        key={diretriz.id} 
                        diretriz={diretriz} 
                        onEdit={(d) => { setServicoToEdit(d); setIsServicoDialogOpen(true); }}
                        onDelete={deleteServico}
                    />
                ))
            )}
        </div>
    </div>
  );

  const renderMaterialPermanenteSection = () => (
    <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
            <span className="text-sm font-medium text-muted-foreground">Subitens da Natureza de Despesa (ND 52)</span>
            <div className="flex gap-2">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsMatPermanenteExportImportOpen(true)}
                    disabled={isLoadingMatPermanente}
                    className="rounded-full"
                >
                    <FileSpreadsheet className="h-4 w-4 mr-1" /> Exp/Imp Excel
                </Button>
                <Button size="sm" onClick={() => { setMatPermanenteToEdit(null); setIsMatPermanenteDialogOpen(true); }} className="bg-[#0f172a] hover:bg-[#0f172a]/90 text-white rounded-full px-4">
                    <Plus className="h-4 w-4 mr-1" /> Novo Subitem
                </Button>
            </div>
        </div>
        
        <div className="space-y-3">
            {isLoadingMatPermanente ? (
                <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="text-sm text-muted-foreground mt-2">Carregando subitens...</p>
                </div>
            ) : materialPermanenteDiretrizes.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                    Nenhum subitem de material permanente cadastrado para {selectedYear}.
                </div>
            ) : (
                materialPermanenteDiretrizes.map(diretriz => (
                    <MaterialPermanenteDiretrizRow 
                        key={diretriz.id} 
                        diretriz={diretriz} 
                        onEdit={(d) => { setMatPermanenteToEdit(d); setIsMatPermanenteDialogOpen(true); }}
                        onDelete={deleteMatPermanente}
                    />
                ))
            )}
        </div>
    </div>
  );

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
            <Button variant="outline" onClick={() => setIsYearManagementDialogOpen(true)} disabled={isSaving || isLoadingDefaultYear}>
              <Settings className="mr-2 h-4 w-4" />
              Gerenciar Anos
            </Button>
          </div>

          <Card className="card-diretrizes-operacionais border-none shadow-none bg-transparent">
          <CardHeader className="px-0">
            <h1 className="text-2xl font-bold">Configurações dos Custos Operacionais</h1>
            <CardDescription>Defina os valores e fatores de referência para o cálculo de despesas operacionais (GND 3 e GND 4).</CardDescription>
          </CardHeader>
          <CardContent className={cn("space-y-6 p-0", "aba-material-consumo-container")}>
            {isDataLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Carregando parâmetros do ano {selectedYear}...</p>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); handleSaveDiretrizes(); }}>
                <div className="space-y-2 mb-6">
                  <Label>Ano de Referência</Label>
                  <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
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
                </div>

                <div className="space-y-4">
                    <div ref={el => collapsibleRefs.current['diarias_detalhe'] = el} className="border rounded-lg bg-white">
                      <Collapsible open={fieldCollapseState['diarias_detalhe']} onOpenChange={(open) => handleCollapseChange('diarias_detalhe', open)}>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between cursor-pointer p-4">
                            <h2 className="text-base font-semibold">Pagamento de Diárias</h2>
                            {fieldCollapseState['diarias_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="px-4 pb-4 border-t pt-4">
                          {renderDiariaTable()}
                        </CollapsibleContent>
                      </Collapsible>
                    </div>

                    <div ref={el => collapsibleRefs.current['passagens_detalhe'] = el} className="border rounded-lg bg-white">
                      <Collapsible open={fieldCollapseState['passagens_detalhe']} onOpenChange={(open) => handleCollapseChange('passagens_detalhe', open)}>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between cursor-pointer p-4">
                            <h2 className="text-base font-semibold flex items-center gap-2">
                              <Plane className="h-4 w-4" />
                              Aquisição de Passagens
                            </h2>
                            {fieldCollapseState['passagens_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="px-4 pb-4 border-t pt-4">
                          {renderPassagensSection()}
                        </CollapsibleContent>
                      </Collapsible>
                    </div>

                    <div ref={el => collapsibleRefs.current['concessionaria_detalhe'] = el} className="border rounded-lg bg-white">
                      <Collapsible open={fieldCollapseState['concessionaria_detalhe']} onOpenChange={(open) => handleCollapseChange('concessionaria_detalhe', open)}>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between cursor-pointer p-4">
                            <h2 className="text-base font-semibold flex items-center gap-2">
                              <Activity className="h-4 w-4" />
                              Pagamento de Concessionárias
                            </h2>
                            {fieldCollapseState['concessionaria_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="px-4 pb-4 border-t pt-4">
                          {renderConcessionariaSection()}
                        </CollapsibleContent>
                      </Collapsible>
                    </div>

                    <div ref={el => collapsibleRefs.current['material_consumo_detalhe'] = el} className="border rounded-lg bg-white aba-material-consumo">
                      <Collapsible open={fieldCollapseState['material_consumo_detalhe']} onOpenChange={(open) => handleCollapseChange('material_consumo_detalhe', open)}>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between cursor-pointer p-4 gatilho-material-consumo">
                            <h2 className="text-base font-semibold flex items-center gap-2">
                              <Package className="h-4 w-4" />
                              Aquisição de Material de Consumo
                            </h2>
                            {fieldCollapseState['material_consumo_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="px-4 pb-4 border-t pt-4">
                          {renderMaterialConsumoSection()}
                        </CollapsibleContent>
                      </Collapsible>
                    </div>

                    <div ref={el => collapsibleRefs.current['material_permanente_detalhe'] = el} className="border rounded-lg bg-white">
                      <Collapsible open={fieldCollapseState['material_permanente_detalhe']} onOpenChange={(open) => handleCollapseChange('material_permanente_detalhe', open)}>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between cursor-pointer p-4">
                            <h2 className="text-base font-semibold flex items-center gap-2">
                              <HardDrive className="h-4 w-4" />
                              Aquisição de Material Permanente
                            </h2>
                            {fieldCollapseState['material_permanente_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="px-4 pb-4 border-t pt-4">
                          {renderMaterialPermanenteSection()}
                        </CollapsibleContent>
                      </Collapsible>
                    </div>

                    <div ref={el => collapsibleRefs.current['servicos_terceiros_detalhe'] = el} className="border rounded-lg bg-white">
                      <Collapsible open={fieldCollapseState['servicos_terceiros_detalhe']} onOpenChange={(open) => handleCollapseChange('servicos_terceiros_detalhe', open)}>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between cursor-pointer p-4">
                            <h2 className="text-base font-semibold flex items-center gap-2">
                              <Activity className="h-4 w-4" />
                              Contratação de Serviços de Terceiros / Locações
                            </h2>
                            {fieldCollapseState['servicos_terceiros_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="px-4 pb-4 border-t pt-4">
                          {renderServicosTerceirosSection()}
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <Button type="button" variant="secondary" onClick={handleSetDefaultYear} disabled={isSaving || selectedYear === defaultYear || !selectedYear}>
                    {selectedYear === defaultYear ? "Padrão Atual" : "Adotar como Padrão"}
                  </Button>
                  <Button type="submit" disabled={isSaving} className="btn-adotar-padrao bg-[#0f172a] hover:bg-[#0f172a]/90 text-white rounded-full px-6">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar Diretrizes
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <YearManagementDialog 
        open={isYearManagementDialogOpen} 
        onOpenChange={setIsYearManagementDialogOpen} 
        tableName="diretrizes_operacionais" 
        currentYears={availableYears} 
        onYearAdded={(year) => {
          setAvailableYears(prev => Array.from(new Set([...prev, year])).sort((a, b) => b - a));
          setSelectedYear(year);
        }}
      />

      <PassagemDiretrizFormDialog 
          open={isPassagemDialogOpen} 
          onOpenChange={setIsPassagemDialogOpen} 
          selectedYear={selectedYear} 
          diretrizToEdit={passagemToEdit} 
          onSave={handleSavePassagem} 
          loading={isSaving} 
      />

      <ConcessionariaDiretrizFormDialog 
          open={isConcessionariaDialogOpen} 
          onOpenChange={setIsConcessionariaDialogOpen} 
          selectedYear={selectedYear} 
          diretrizToEdit={concessionariaToEdit} 
          onSave={handleSaveConcessionaria} 
          loading={isSaving} 
      />

      <MaterialConsumoDiretrizFormDialog 
          open={isMatConsumoDialogOpen} 
          onOpenChange={setIsMatConsumoDialogOpen} 
          selectedYear={selectedYear} 
          diretrizToEdit={matConsumoToEdit} 
          onSave={saveMatConsumo as any} 
          loading={isSaving} 
      />

      <MaterialConsumoExportImportDialog 
          open={isMatConsumoExportImportOpen}
          onOpenChange={setIsMatConsumoExportImportOpen}
          selectedYear={selectedYear}
          diretrizes={materialConsumoDiretrizes}
          onImportSuccess={() => queryClient.invalidateQueries({ queryKey: ['materialConsumoDiretrizes', selectedYear] })}
      />

      <ServicosTerceirosDiretrizFormDialog 
          open={isServicoDialogOpen} 
          onOpenChange={setIsServicoDialogOpen} 
          selectedYear={selectedYear} 
          diretrizToEdit={servicoToEdit} 
          onSave={saveServico as any} 
          loading={isSaving} 
      />

      <ServicosTerceirosExportImportDialog 
          open={isServicoExportImportOpen}
          onOpenChange={setIsServicoExportImportOpen}
          selectedYear={selectedYear}
          diretrizes={servicosTerceirosDiretrizes}
          onImportSuccess={() => queryClient.invalidateQueries({ queryKey: ['servicosTerceirosDiretrizes', selectedYear] })}
      />

      <MaterialPermanenteDiretrizFormDialog 
          open={isMatPermanenteDialogOpen} 
          onOpenChange={setIsMatPermanenteDialogOpen} 
          selectedYear={selectedYear} 
          diretrizToEdit={matPermanenteToEdit} 
          onSave={saveMatPermanente as any} 
          loading={isSaving} 
      />

      <MaterialPermanenteExportImportDialog 
          open={isMatPermanenteExportImportOpen}
          onOpenChange={setIsMatPermanenteExportImportOpen}
          selectedYear={selectedYear}
          diretrizes={materialPermanenteDiretrizes}
          onImportSuccess={() => queryClient.invalidateQueries({ queryKey: ['materialPermanenteDiretrizes', selectedYear] })}
      />
    </div>
  );
};

export default CustosOperacionaisPage;