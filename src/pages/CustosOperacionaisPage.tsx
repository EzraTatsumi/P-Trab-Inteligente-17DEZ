"use client";

/**
 * Página de Configuração de Custos Operacionais - Layout Restaurado v1.0.6
 * Correção: Removido loop infinito de sincronização de estados.
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
import { ArrowLeft, Loader2, Save, Settings, ChevronDown, ChevronUp, Plus, Search, FileSpreadsheet, Package } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { YearManagementDialog } from "@/components/YearManagementDialog";
import { formatCurrencyInput, numberToRawDigits, formatCodug } from "@/lib/formatUtils";
import { useSession } from "@/components/SessionContextProvider";
import { Tables, TablesInsert, TablesUpdate, Json } from "@/integrations/supabase/types";
import { diretrizOperacionalSchema } from "@/lib/validationSchemas";
import * as z from "zod";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDefaultDiretrizYear } from "@/hooks/useDefaultDiretrizYear";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { DiretrizPassagem } from "@/types/diretrizesPassagens";
import CurrencyInput from "@/components/CurrencyInput";
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
import { isGhostMode } from "@/lib/ghostStore";
import { cn } from "@/lib/utils";

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

  const { data: pageData, isLoading: isLoadingPageData } = useQuery({
    queryKey: ['diretrizesCustosOperacionais', selectedYear, user?.id, ghostActive],
    queryFn: async () => {
      if (!user?.id || !selectedYear) return null;
      if (ghostActive) {
          return { operacional: defaultDiretrizes(selectedYear), passagens: [], concessionaria: [] };
      }
      const [opRes, passRes, concRes] = await Promise.all([
        supabase.from("diretrizes_operacionais").select("*").eq("user_id", user.id).eq("ano_referencia", selectedYear).maybeSingle(),
        supabase.from('diretrizes_passagens').select('*').eq('user_id', user.id).eq('ano_referencia', selectedYear).order('om_referencia', { ascending: true }),
        supabase.from('diretrizes_concessionaria').select('*').eq('user_id', user.id).eq('ano_referencia', selectedYear).order('categoria', { ascending: true }).order('nome_concessionaria', { ascending: true })
      ]);
      if (opRes.error) throw opRes.error;
      if (passRes.error) throw passRes.error;
      if (concRes.error) throw concRes.error;
      return { operacional: opRes.data || defaultDiretrizes(selectedYear), passagens: (passRes.data as DiretrizPassagem[]) || [], concessionaria: (concRes.data as DiretrizConcessionaria[]) || [] };
    },
    enabled: !!user?.id && !!selectedYear,
  });
  
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  
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
  
  const { handleEnterToNextField } = useFormNavigation();
  
  const [isPassagemFormOpen, setIsPassagemFormOpen] = useState(false);
  const [diretrizToEdit, setDiretrizToEdit] = useState<DiretrizPassagem | null>(null);
  const [isConcessionariaFormOpen, setIsConcessionariaFormOpen] = useState(false);
  const [diretrizConcessionariaToEdit, setDiretrizConcessionariaToEdit] = useState<DiretrizConcessionaria | null>(null);
  const [selectedConcessionariaTab, setSelectedConcessionariaTab] = useState<CategoriaConcessionaria>(CATEGORIAS_CONCESSIONARIA[0]);
  
  const { diretrizes: diretrizesMaterialConsumo, isLoading: isLoadingMaterialConsumo, handleMoveItem, isMoving: isMovingMaterialConsumo } = useMaterialConsumoDiretrizes(selectedYear);
  const { diretrizes: diretrizesServicosTerceiros, isLoading: isLoadingServicosTerceiros, handleMoveItem: handleMoveItemServico, isMoving: isMovingServicosTerceiros } = useServicosTerceirosDiretrizes(selectedYear);
  const { diretrizes: diretrizesMaterialPermanente, isLoading: isLoadingMaterialPermanente, isMoving: isMovingMaterialPermanente } = useMaterialPermanenteDiretrizes(selectedYear);

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

  const handleCollapseChange = useCallback((key: string, open: boolean) => {
      setFieldCollapseState(prev => ({ ...prev, [key]: open }));
      if (open) {
          setTimeout(() => {
              const element = collapsibleRefs.current[key];
              if (element) {
                  const y = element.getBoundingClientRect().top + window.pageYOffset - 100;
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
    setDiretrizes(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  useEffect(() => {
    if (pageData?.operacional) {
      setDiretrizes(prev => {
        if (JSON.stringify(prev) === JSON.stringify(pageData.operacional)) return prev;
        return pageData.operacional!;
      });
    }
  }, [pageData?.operacional]);

  useEffect(() => {
    if (isLoadingDefaultYear || isLoadingPageData || hasStartedTour.current) return;
    const startTour = searchParams.get('startTour') === 'true';
    if (startTour && ghostActive && localStorage.getItem('active_mission_id') === '2' && user?.id) {
      hasStartedTour.current = true;
      setTimeout(() => runMission02(user.id, () => navigate('/ptrab?showHub=true')), 500);
    }
  }, [isLoadingDefaultYear, isLoadingPageData, searchParams, navigate, user?.id, ghostActive]);

  useEffect(() => {
    if (!isLoadingDefaultYear && defaultYearData) {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { navigate("/login"); return; }
            await loadAvailableYears(defaultYearData.defaultYear);
            if (selectedYear === currentYear && defaultYearData.year !== currentYear) setSelectedYear(defaultYearData.year);
        };
        checkAuth();
    }
  }, [isLoadingDefaultYear, defaultYearData]);

  const loadAvailableYears = async (defaultYearId: number | null) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const tables = ["diretrizes_operacionais", "diretrizes_passagens", "diretrizes_concessionaria", "diretrizes_material_consumo", "diretrizes_servicos_terceiros", "diretrizes_material_permanente"];
      const results = await Promise.all(tables.map(t => supabase.from(t as any).select("ano_referencia").eq("user_id", authUser.id)));
      const yearsSet = new Set<number>([currentYear]);
      results.forEach(r => r.data?.forEach((d: any) => yearsSet.add(d.ano_referencia)));
      if (defaultYearId) yearsSet.add(defaultYearId);
      setAvailableYears(Array.from(yearsSet).filter(y => y > 0).sort((a, b) => b - a));
    } catch (e) { console.error(e); }
  };

  const handleSaveDiretrizes = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser || !selectedYear) return;
      const dataToValidate = { ...diretrizes, ano_referencia: selectedYear };
      diretrizOperacionalSchema.parse(dataToValidate);
      setIsSaving(true);
      const { error } = await supabase.from("diretrizes_operacionais").upsert({ user_id: authUser.id, ...dataToValidate }, { onConflict: 'user_id,ano_referencia' });
      if (error) throw error;
      toast.success("Diretrizes Operacionais salvas!");
      queryClient.invalidateQueries({ queryKey: ['diretrizesCustosOperacionais', selectedYear, authUser.id] });
      await loadAvailableYears(defaultYear);
    } catch (error: any) { toast.error(sanitizeError(error)); } finally { setIsSaving(false); }
  };

  const handleSetDefaultYear = async () => {
    if (!selectedYear || !user?.id) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ default_operacional_year: selectedYear }).eq('id', user.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["defaultOperacionalYear", user.id] });
      toast.success(`Ano ${selectedYear} definido como padrão!`);
    } catch (e) { toast.error(sanitizeError(e)); } finally { setIsSaving(false); }
  };

  // --- Render Functions ---
  const renderDiretrizField = (field: { key: string, label: string, type: 'currency' | 'factor', placeholder: string }) => {
    const value = (diretrizes[field.key as keyof DiretrizOperacional] as number) || 0;
    if (field.type === 'currency') {
      const rawDigits = rawInputs[field.key] || numberToRawDigits(value);
      const { formatted: displayValue } = formatCurrencyInput(rawDigits);
      return (<div className="space-y-2"><Label htmlFor={field.key}>{field.label}</Label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span><Input id={field.key} type="text" inputMode="numeric" className="pl-8" value={displayValue === "0,00" && rawDigits === "" ? "" : displayValue} onChange={(e) => handleCurrencyChange(field.key as keyof DiretrizOperacional, e.target.value)} onKeyDown={handleEnterToNextField} placeholder={field.placeholder} /></div></div>);
    }
    return (<div className="space-y-2"><Label htmlFor={field.key}>{field.label}</Label><Input id={field.key} type="number" step="0.01" value={value === 0 ? "" : value} onChange={(e) => handleFactorChange(field.key as keyof DiretrizOperacional, e.target.value)} placeholder={field.placeholder} onKeyDown={handleEnterToNextField} /></div>);
  };

  const renderDiariaTable = () => {
    const getDiariaProps = (rankKey: string, dest: 'bsb' | 'capitais' | 'demais') => {
      const fieldKey = `${DIARIA_RANKS_CONFIG.find(r => r.key === rankKey)?.fieldPrefix}_${dest}` as keyof DiretrizOperacional;
      const val = (diretrizes[fieldKey] as number) || 0;
      return { value: val, rawDigits: rawInputs[fieldKey as string] || numberToRawDigits(val), onChange: (v: number) => handleCurrencyChange(fieldKey, numberToRawDigits(v)), className: "text-center" };
    };
    return (<div className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="space-y-2"><Label>Referência Legal</Label><Input value={diretrizes.diaria_referencia_legal || ""} onChange={(e) => setDiretrizes({ ...diretrizes, diaria_referencia_legal: e.target.value })} /></div>{renderDiretrizField({ key: 'taxa_embarque', label: 'Taxa de Embarque', type: 'currency', placeholder: '95,00' })}</div><Table className="border rounded-lg overflow-hidden"><TableHeader><TableRow><TableHead>Posto/Graduação</TableHead><TableHead className="text-center">BSB/MAO/RJ/SP</TableHead><TableHead className="text-center">Demais Capitais</TableHead><TableHead className="text-center">Demais Dslc</TableHead></TableRow></TableHeader><TableBody>{DIARIA_RANKS_CONFIG.map(r => (<TableRow key={r.key}><TableCell>{r.label}</TableCell><TableCell><CurrencyInput {...getDiariaProps(r.key, 'bsb')} /></TableCell><TableCell><CurrencyInput {...getDiariaProps(r.key, 'capitais')} /></TableCell><TableCell><CurrencyInput {...getDiariaProps(r.key, 'demais')} /></TableCell></TableRow>))}</TableBody></Table></div>);
  };

  const renderIndexedSearch = (searchTerm: string, indexedItems: any[], onGoTo: (id: string) => void, title: string) => {
    if (searchTerm.length < 3) return null;
    const filtered = indexedItems.filter(i => [i.descricao_item, i.codigo_catmat, i.subitemNr, i.subitemNome].join(' ').toLowerCase().includes(searchTerm.toLowerCase().trim()));
    return (<Card className="p-4"><CardTitle className="text-sm mb-3">{title} ({filtered.length})</CardTitle><Table><TableBody>{filtered.map((i, idx) => (<TableRow key={idx}><TableCell className="text-xs font-medium">{i.descricao_item}<p className="text-muted-foreground">Subitem: {i.subitemNr} - {i.subitemNome}</p></TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => onGoTo(i.diretrizId)}>Ver Local</Button></TableCell></TableRow>))}</TableBody></Table></Card>);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <PageMetadata title="Configurações de Custos Operacionais" description="Defina os valores de diárias, contratos de passagens, concessionárias e materiais." canonicalPath="/config/custos-operacionais" />
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between"><Button variant="ghost" onClick={() => navigate("/ptrab")}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button><Button variant="outline" onClick={() => setIsYearManagementDialogOpen(true)}><Settings className="mr-2 h-4 w-4" />Gerenciar Anos</Button></div>
        <Card className="card-diretrizes-operacionais">
          <CardHeader><h1 className="text-2xl font-bold">Configurações dos Custos Operacionais</h1><CardDescription>Defina os valores de referência para o ano {selectedYear}.</CardDescription></CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={(e) => { e.preventDefault(); handleSaveDiretrizes(); }}>
              <div className="space-y-2 mb-6"><Label>Ano de Referência</Label><Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{availableYears.map(y => (<SelectItem key={y} value={y.toString()}>{y} {y === defaultYear && "(Padrão)"}</SelectItem>))}</SelectContent></Select></div>
              <div className="space-y-4 border-t pt-4">
                {[
                  { id: 'diarias_detalhe', label: 'Pagamento de Diárias', render: renderDiariaTable },
                  { id: 'passagens_detalhe', label: 'Aquisição de Passagens', render: () => (
                    <div className="space-y-4">
                      {pageData?.passagens?.length ? (<Table className="border rounded-lg">{pageData.passagens.map(d => (<PassagemDiretrizRow key={d.id} diretriz={d} onEdit={setDiretrizToEdit} onDelete={(id) => supabase.from('diretrizes_passagens').delete().eq('id', id).then(() => queryClient.invalidateQueries())} loading={isSaving} />))}</Table>) : <p className="text-center text-muted-foreground text-sm">Nenhum contrato cadastrado.</p>}
                      <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => { setDiretrizToEdit(null); setIsPassagemFormOpen(true); }}><Plus className="h-4 w-4 mr-2" />Novo Contrato</Button>
                    </div>
                  )},
                  { id: 'concessionaria_detalhe', label: 'Pagamento de Concessionárias', render: () => (
                    <Tabs value={selectedConcessionariaTab} onValueChange={(v) => setSelectedConcessionariaTab(v as CategoriaConcessionaria)} className="w-full">
                      <TabsList className="grid grid-cols-2">{CATEGORIAS_CONCESSIONARIA.map(c => <TabsTrigger key={c} value={c}>{c}</TabsTrigger>)}</TabsList>
                      {CATEGORIAS_CONCESSIONARIA.map(cat => (<TabsContent key={cat} value={cat} className="space-y-4">
                        {pageData?.concessionaria?.filter(c => c.categoria === cat).length ? (<Table className="border">{pageData.concessionaria.filter(c => c.categoria === cat).map(d => (<ConcessionariaDiretrizRow key={d.id} diretriz={d} onEdit={setDiretrizConcessionariaToEdit} onDelete={(id) => supabase.from('diretrizes_concessionaria').delete().eq('id', id).then(() => queryClient.invalidateQueries())} loading={isSaving} />))}</Table>) : <p className="text-center text-muted-foreground text-sm">Nenhuma diretriz cadastrada.</p>}
                        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => { setDiretrizConcessionariaToEdit(null); setIsConcessionariaFormOpen(true); }}><Plus className="h-4 w-4 mr-2" />Nova Diretriz {cat}</Button>
                      </TabsContent>))}
                    </Tabs>
                  )},
                  { id: 'material_consumo_detalhe', label: 'Material de Consumo', render: () => (
                    <div className="space-y-4 aba-material-consumo">
                      <div className="flex justify-between items-center"><CardTitle className="text-sm">Subitens Cadastrados</CardTitle><Button type="button" variant="outline" size="sm" onClick={() => setIsExportImportDialogOpen(true)}><FileSpreadsheet className="h-4 w-4 mr-2" />Exp/Imp</Button></div>
                      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar item..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" /></div>
                      {searchTerm ? renderIndexedSearch(searchTerm, diretrizesMaterialConsumo?.flatMap(d => (d.itens_aquisicao as any[] || []).map(i => ({ ...i, diretrizId: d.id, subitemNr: d.nr_subitem, subitemNome: d.nome_subitem }))) || [], handleGoToSubitem, "Resultados") : 
                        diretrizesMaterialConsumo?.length ? (<Table className="border">{diretrizesMaterialConsumo.map(d => (<MaterialConsumoDiretrizRow key={d.id} id={`diretriz-material-consumo-${d.id}`} diretriz={d} onEdit={handleStartEditMaterialConsumo} onDelete={(id) => supabase.from('diretrizes_material_consumo').delete().eq('id', id).then(() => queryClient.invalidateQueries())} loading={isLoadingMaterialConsumo} onMoveItem={handleMoveItem} forceOpen={subitemToOpenId === d.id} />))}</Table>) : <p className="text-center text-muted-foreground text-sm">Nenhum subitem cadastrado.</p>
                      }
                      <Button type="button" variant="outline" size="sm" className="w-full btn-novo-subitem" onClick={handleOpenNewMaterialConsumo}><Plus className="h-4 w-4 mr-2" />Novo Subitem ND</Button>
                    </div>
                  )},
                  { id: 'material_permanente_detalhe', label: 'Material Permanente', render: () => (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center"><CardTitle className="text-sm">Subitens Cadastrados</CardTitle><Button type="button" variant="outline" size="sm" onClick={() => setIsExportImportPermanenteDialogOpen(true)}><FileSpreadsheet className="h-4 w-4 mr-2" />Exp/Imp</Button></div>
                      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar item..." value={searchTermPermanente} onChange={e => setSearchTermPermanente(e.target.value)} className="pl-10" /></div>
                      {searchTermPermanente ? renderIndexedSearch(searchTermPermanente, diretrizesMaterialPermanente?.flatMap(d => (d.itens_aquisicao as any[] || []).map(i => ({ ...i, diretrizId: d.id, subitemNr: d.nr_subitem, subitemNome: d.nome_subitem }))) || [], handleGoToSubitemPermanente, "Resultados") : 
                        diretrizesMaterialPermanente?.length ? (<Table className="border">{diretrizesMaterialPermanente.map(d => (<MaterialPermanenteDiretrizRow key={d.id} id={`diretriz-material-permanente-${d.id}`} diretriz={d} onEdit={handleStartEditMaterialPermanente} onDelete={(id) => supabase.from('diretrizes_material_permanente' as any).delete().eq('id', id).then(() => queryClient.invalidateQueries())} loading={isLoadingMaterialPermanente} forceOpen={subitemPermanenteToOpenId === d.id} isExpanded={subitemPermanenteToOpenId === d.id} onToggleExpand={() => setSubitemPermanenteToOpenId(subitemPermanenteToOpenId === d.id ? null : d.id)} />))}</Table>) : <p className="text-center text-muted-foreground text-sm">Nenhum subitem cadastrado.</p>
                      }
                      <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleOpenNewMaterialPermanente}><Plus className="h-4 w-4 mr-2" />Novo Subitem ND</Button>
                    </div>
                  )},
                  { id: 'servicos_terceiros_detalhe', label: 'Serviços de Terceiros / Locações', render: () => (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center"><CardTitle className="text-sm">Subitens Cadastrados</CardTitle><Button type="button" variant="outline" size="sm" onClick={() => setIsExportImportServicosDialogOpen(true)}><FileSpreadsheet className="h-4 w-4 mr-2" />Exp/Imp</Button></div>
                      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar item..." value={searchTermServicos} onChange={e => setSearchTermServicos(e.target.value)} className="pl-10" /></div>
                      {searchTermServicos ? renderIndexedSearch(searchTermServicos, diretrizesServicosTerceiros?.flatMap(d => (d.itens_aquisicao as any[] || []).map(i => ({ ...i, diretrizId: d.id, subitemNr: d.nr_subitem, subitemNome: d.nome_subitem }))) || [], handleGoToSubitemServico, "Resultados") : 
                        diretrizesServicosTerceiros?.length ? (<Table className="border">{diretrizesServicosTerceiros.map(d => (<ServicosTerceirosDiretrizRow key={d.id} id={`diretriz-servicos-terceiros-${d.id}`} diretriz={d} onEdit={handleStartEditServicosTerceiros} onDelete={(id) => supabase.from('diretrizes_servicos_terceiros' as any).delete().eq('id', id).then(() => queryClient.invalidateQueries())} loading={isLoadingServicosTerceiros} onMoveItem={handleMoveItemServico} forceOpen={subitemServicoToOpenId === d.id} />))}</Table>) : <p className="text-center text-muted-foreground text-sm">Nenhum subitem cadastrado.</p>
                      }
                      <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleOpenNewServicosTerceiros}><Plus className="h-4 w-4 mr-2" />Novo Subitem ND</Button>
                    </div>
                  )}
                ].map(sec => (
                  <div key={sec.id} ref={el => collapsibleRefs.current[sec.id] = el} className="border-b pb-2 last:border-b-0">
                    <Collapsible open={fieldCollapseState[sec.id]} onOpenChange={o => handleCollapseChange(sec.id, o)}>
                      <CollapsibleTrigger className="flex w-full items-center justify-between py-2 font-medium"><span>{sec.label}</span>{fieldCollapseState[sec.id] ? <ChevronUp /> : <ChevronDown />}</CollapsibleTrigger>
                      <CollapsibleContent className="pt-2">{sec.render()}</CollapsibleContent>
                    </Collapsible>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-end gap-3 border-t pt-4"><Button type="button" variant="secondary" onClick={handleSetDefaultYear} disabled={isSaving || selectedYear === defaultYear}>Adotar como Padrão</Button><Button type="submit" disabled={isSaving}>{isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}Salvar Diretrizes</Button></div>
            </form>
          </CardContent>
        </Card>
      </div>
      <YearManagementDialog open={isYearManagementDialogOpen} onOpenChange={setIsYearManagementDialogOpen} availableYears={availableYears} defaultYear={defaultYear} onCopy={() => {}} onDelete={() => {}} loading={isSaving} />
      <PassagemDiretrizFormDialog open={!!diretrizToEdit || isPassagemFormOpen} onOpenChange={o => { setIsPassagemFormOpen(o); if(!o) setDiretrizToEdit(null); }} selectedYear={selectedYear} diretrizToEdit={diretrizToEdit} onSave={handleSavePassagem} loading={isSaving} />
      <ConcessionariaDiretrizFormDialog open={!!diretrizConcessionariaToEdit || isConcessionariaFormOpen} onOpenChange={o => { setIsConcessionariaFormOpen(o); if(!o) setDiretrizConcessionariaToEdit(null); }} selectedYear={selectedYear} diretrizToEdit={diretrizConcessionariaToEdit} onSave={handleSaveConcessionaria} loading={isSaving} initialCategory={selectedConcessionariaTab} />
      <MaterialConsumoDiretrizFormDialog open={!!diretrizMaterialConsumoToEdit || isMaterialConsumoFormOpen} onOpenChange={o => { setIsMaterialConsumoFormOpen(o); if(!o) setDiretrizMaterialConsumoToEdit(null); }} selectedYear={selectedYear} diretrizToEdit={diretrizMaterialConsumoToEdit} onSave={handleSaveMaterialConsumo} loading={isSaving} />
      <MaterialConsumoExportImportDialog open={isExportImportDialogOpen} onOpenChange={setIsExportImportDialogOpen} selectedYear={selectedYear} diretrizes={diretrizesMaterialConsumo || []} onImportSuccess={() => queryClient.invalidateQueries()} />
      <ServicosTerceirosDiretrizFormDialog open={!!diretrizServicosTerceirosToEdit || isServicosTerceirosFormOpen} onOpenChange={o => { setIsServicosTerceirosFormOpen(o); if(!o) setDiretrizServicosTerceirosToEdit(null); }} selectedYear={selectedYear} diretrizToEdit={diretrizServicosTerceirosToEdit} onSave={handleSaveServicosTerceiros} loading={isSaving} />
      <ServicosTerceirosExportImportDialog open={isExportImportServicosDialogOpen} onOpenChange={setIsExportImportServicosDialogOpen} selectedYear={selectedYear} diretrizes={diretrizesServicosTerceiros || []} onImportSuccess={() => queryClient.invalidateQueries()} />
      <MaterialPermanenteDiretrizFormDialog open={!!diretrizMaterialPermanenteToEdit || isMaterialPermanenteFormOpen} onOpenChange={o => { setIsMaterialPermanenteFormOpen(o); if(!o) setDiretrizMaterialPermanenteToEdit(null); }} selectedYear={selectedYear} diretrizToEdit={diretrizMaterialPermanenteToEdit} onSave={handleSaveMaterialPermanente} loading={isSaving} />
      <MaterialPermanenteExportImportDialog open={isExportImportPermanenteDialogOpen} onOpenChange={setIsExportImportPermanenteDialogOpen} selectedYear={selectedYear} diretrizes={diretrizesMaterialPermanente || []} onImportSuccess={() => queryClient.invalidateQueries()} />
    </div>
  );
};

export default CustosOperacionaisPage;