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

  const { data: pageData, isLoading: isLoadingPageData, isFetching: isFetchingPageData } = useQuery({
    queryKey: ['diretrizesCustosOperacionais', selectedYear, user?.id],
    queryFn: async () => {
      if (!user?.id || !selectedYear) return null;
      const [opRes, passRes, concRes] = await Promise.all([
        supabase.from("diretrizes_operacionais").select("*").eq("user_id", user.id).eq("ano_referencia", selectedYear).maybeSingle(),
        supabase.from('diretrizes_passagens').select('*').eq('user_id', user.id).eq('ano_referencia', selectedYear).order('om_referencia', { ascending: true }),
        supabase.from('diretrizes_concessionaria').select('*').eq('user_id', user.id).eq('ano_referencia', selectedYear).order('categoria', { ascending: true }).order('nome_concessionaria', { ascending: true })
      ]);
      if (opRes.error) throw opRes.error;
      if (passRes.error) throw passRes.error;
      if (concRes.error) throw concRes.error;
      return { operacional: opRes.data || defaultDiretrizes(selectedYear), passagens: passRes.data || [], concessionaria: concRes.data || [] };
    },
    enabled: !!user?.id && !!selectedYear,
    staleTime: 1000 * 60 * 5, 
  });
  
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  const [fieldCollapseState, setFieldCollapseState] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    OPERATIONAL_FIELDS.forEach(field => { initialState[field.key as string] = false; });
    const shouldOpenPassagens = location.state && (location.state as any).openPassagens;
    const shouldOpenConcessionaria = location.state && (location.state as any).openConcessionaria;
    const shouldOpenMaterialConsumo = location.state && (location.state as any).openMaterialConsumo;
    initialState['diarias_detalhe'] = false; 
    initialState['passagens_detalhe'] = shouldOpenPassagens || false; 
    initialState['concessionaria_detalhe'] = shouldOpenConcessionaria || false;
    initialState['material_consumo_detalhe'] = shouldOpenMaterialConsumo || false;
    initialState['servicos_terceiros_detalhe'] = false;
    initialState['material_permanente_detalhe'] = false;
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
  
  const { diretrizes: diretrizesMaterialConsumoHook, isLoading: isLoadingMaterialConsumo, handleMoveItem, isMoving: isMovingMaterialConsumo } = useMaterialConsumoDiretrizes(selectedYear);
  const { diretrizes: diretrizesServicosTerceirosHook, isLoading: isLoadingServicosTerceiros } = useServicosTerceirosDiretrizes(selectedYear);
  const { diretrizes: diretrizesMaterialPermanenteHook, isLoading: isLoadingMaterialPermanente } = useMaterialPermanenteDiretrizes(selectedYear);

  const [diretrizesMaterialConsumo, setDiretrizesMaterialConsumo] = useState<DiretrizMaterialConsumo[]>([]);
  const [isMaterialConsumoFormOpen, setIsMaterialConsumoFormOpen] = useState(false);
  const [diretrizMaterialConsumoToEdit, setDiretrizMaterialConsumoToEdit] = useState<DiretrizMaterialConsumo | null>(null);
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

  const handleSaveMaterialConsumo = async (data: Partial<DiretrizMaterialConsumo> & { ano_referencia: number }) => {
      try {
          setIsSaving(true);
          const ghost = isGhostMode();
          
          if (ghost) {
              // Simula a adição do 3º item para o tour
              setDiretrizesMaterialConsumo(prev => [...prev, GHOST_DATA.missao_02.subitem_adicionado as any]);
              toast.success("Novo Subitem de Material de Consumo cadastrado!");
              setIsMaterialConsumoFormOpen(false);
              // Avança o tour para o Passo 10
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('tour:avancar'));
              }, 500);
              return;
          }

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
          
          if (data.id) {
              await supabase.from('diretrizes_material_consumo').update(dbData as TablesUpdate<'diretrizes_material_consumo'>).eq('id', data.id);
              toast.success("Subitem de Material de Consumo atualizado!");
          } else {
              await supabase.from('diretrizes_material_consumo').insert([dbData]);
              toast.success("Novo Subitem de Material de Consumo cadastrado!");
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

  useEffect(() => {
    if (isGhostMode()) {
      setDiretrizesMaterialConsumo(GHOST_DATA.missao_02.subitens_lista as any);
    } else if (diretrizesMaterialConsumoHook) {
      setDiretrizesMaterialConsumo(diretrizesMaterialConsumoHook);
    }
  }, [diretrizesMaterialConsumoHook]);

  // ... (restante dos handlers e useEffects mantidos conforme original)

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
            <form onSubmit={(e) => { e.preventDefault(); }}>
              <div className="space-y-2 mb-6"><Label>Ano de Referência</Label><Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}><SelectTrigger><SelectValue placeholder="Selecione o ano" /></SelectTrigger><SelectContent>{availableYears.map((year) => (<SelectItem key={year} value={year.toString()}>{year} {year === defaultYear && "(Padrão)"}</SelectItem>))}</SelectContent></Select></div>
              <div className="border-t pt-4 mt-6">
                <div className="space-y-4">
                  <div ref={el => collapsibleRefs.current['material_consumo_detalhe'] = el} className="border-b pb-4 last:border-b-0 last:pb-0 aba-material-consumo"><Collapsible open={fieldCollapseState['material_consumo_detalhe']} onOpenChange={(open) => handleCollapseChange('material_consumo_detalhe', open)}><CollapsibleTrigger asChild><div className="flex items-center justify-between cursor-pointer py-2 gatilho-material-consumo"><h2 className="text-base font-medium flex items-center gap-2">Aquisição de Material de Consumo</h2>{fieldCollapseState['material_consumo_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</div></CollapsibleTrigger><CollapsibleContent><div className="mt-2">
                    <div className="space-y-4 lista-subitens-nd">
                      <Card className="p-4">
                        <div className="flex justify-between items-center mb-4"><CardTitle className="text-base font-semibold">Subitens da ND Cadastrados</CardTitle></div>
                        <Table>
                          <TableHeader><TableRow><TableHead className="w-[150px] text-center">Nr Subitem</TableHead><TableHead>Nome do Subitem</TableHead><TableHead className="w-[100px] text-center">Ações</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {diretrizesMaterialConsumo.map(d => (
                              <MaterialConsumoDiretrizRow key={d.id} diretriz={d} onEdit={() => {}} onDelete={() => {}} loading={isSaving} onMoveItem={() => {}} id={`diretriz-material-consumo-${d.id}`} forceOpen={subitemToOpenId === d.id} />
                            ))}
                          </TableBody>
                        </Table>
                      </Card>
                      <div className="flex justify-end"><Button type="button" onClick={() => { setDiretrizMaterialConsumoToEdit(null); setIsMaterialConsumoFormOpen(true); if (isGhostMode()) window.dispatchEvent(new CustomEvent('tour:avancar')); }} disabled={isSaving} variant="outline" size="sm" className="w-full btn-novo-subitem"><Plus className="mr-2 h-4 w-4" />Adicionar Novo Subitem da ND</Button></div>
                    </div>
                  </div></CollapsibleContent></Collapsible></div>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      <MaterialConsumoDiretrizFormDialog open={isMaterialConsumoFormOpen} onOpenChange={setIsMaterialConsumoFormOpen} selectedYear={selectedYear} diretrizToEdit={diretrizMaterialConsumoToEdit} onSave={handleSaveMaterialConsumo} loading={isSaving} />
    </div>
  );
};

export default CustosOperacionaisPage;