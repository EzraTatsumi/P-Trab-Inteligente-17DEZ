import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Activity, Loader2, Save, Settings, ChevronDown, ChevronUp, Plus, Trash2, Pencil, Plane } from "lucide-react";
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
    DiretrizMaterialConsumoCategoria, 
    DiretrizMaterialConsumoCategoriaForm,
    DiretrizMaterialConsumoItem,
    materialConsumoItemSchema
} from "@/types/diretrizesMaterialConsumo"; // NOVO: Importa tipos de Material de Consumo

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MaterialConsumoCategoriaFormDialog from "@/components/MaterialConsumoCategoriaFormDialog"; // NOVO
import MaterialConsumoCategoriaRow from "@/components/MaterialConsumoCategoriaRow"; // NOVO

// Tipo derivado da nova tabela
type DiretrizOperacional = Tables<'diretrizes_operacionais'>;

// Estrutura de dados para a tabela de diárias
const DIARIA_RANKS_CONFIG = [
  { key: 'of_gen', label: 'Of Gen', fieldPrefix: 'diaria_of_gen' },
  { key: 'of_sup', label: 'Of Sup', fieldPrefix: 'diaria_of_sup' },
  { key: 'of_int_sgt', label: 'Of Int/Sub/Asp Of/ST/Sgt', fieldPrefix: 'diaria_of_int_sgt' },
  { key: 'demais_pracas', label: 'Demais Praças', fieldPrefix: 'diaria_demais_pracas' },
];

// Mapeamento de campos para rótulos e tipo de input (R$ ou Fator)
const OPERATIONAL_FIELDS = [
  // { key: 'fator_passagens_aereas', label: 'Passagens Aéreas (Fator)', type: 'factor' as const, placeholder: 'Ex: 1.5 (para 150%)' }, // REMOVIDO
  { key: 'fator_servicos_terceiros', label: 'Serviços de Terceiros (Fator)', type: 'factor' as const, placeholder: 'Ex: 0.10 (para 10%)' },
  { key: 'valor_complemento_alimentacao', label: 'Complemento de Alimentação (R$)', type: 'currency' as const, placeholder: 'Ex: 15,00' },
  { key: 'valor_fretamento_aereo_hora', label: 'Fretamento Aéreo (R$/hora)', type: 'currency' as const, placeholder: 'Ex: 1.200,00' },
  { key: 'valor_locacao_estrutura_dia', label: 'Locação de Estrutura (R$/dia)', type: 'currency' as const, placeholder: 'Ex: 300,00' },
  { key: 'valor_locacao_viaturas_dia', label: 'Locação de Viaturas (R$/dia)', type: 'currency' as const, placeholder: 'Ex: 150,00' },
  // O fator_concessionaria foi removido daqui, pois a configuração agora é detalhada por contrato/consumo
];

// Valores padrão para inicialização (incluindo os novos campos de diária)
const defaultDiretrizes = (year: number): Partial<DiretrizOperacional> => ({
  ano_referencia: year,
  fator_passagens_aereas: 0,
  fator_servicos_terceiros: 0,
  valor_complemento_alimentacao: 0,
  valor_fretamento_aereo_hora: 0,
  valor_locacao_estrutura_dia: 0,
  valor_locacao_viaturas_dia: 0,
  fator_concessionaria: 0, // Mantido no default para compatibilidade com o schema DB
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
  const location = useLocation(); // Hook para acessar o estado de navegação
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  
  const currentYear = new Date().getFullYear();
  const [diretrizes, setDiretrizes] = useState<Partial<DiretrizOperacional>>(defaultDiretrizes(currentYear));
  
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [isYearManagementDialogOpen, setIsYearManagementDialogOpen] = useState(false);
  
  const { data: defaultYearData, isLoading: isLoadingDefaultYear } = useDefaultDiretrizYear();
  const defaultYear = defaultYearData?.defaultYear || null;
  
  // Estado para armazenar os inputs brutos (apenas dígitos) para campos monetários
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  
  // Estado para controlar a expansão individual de cada campo
  const [fieldCollapseState, setFieldCollapseState] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    OPERATIONAL_FIELDS.forEach(field => {
      initialState[field.key as string] = false;
    });
    
    // Verifica se o estado de navegação pede para abrir a seção de passagens
    const shouldOpenPassagens = location.state && (location.state as { openPassagens?: boolean }).openPassagens;
    // NOVO: Verifica se o estado de navegação pede para abrir a seção de concessionária
    const shouldOpenConcessionaria = location.state && (location.state as { openConcessionaria?: boolean }).openConcessionaria;
    
    initialState['diarias_detalhe'] = false; 
    initialState['passagens_detalhe'] = shouldOpenPassagens || false; 
    initialState['concessionaria_detalhe'] = shouldOpenConcessionaria || false; // ATUALIZADO
    initialState['material_consumo_detalhe'] = false; // NOVO: Material de Consumo
    return initialState;
  });
  
  const { handleEnterToNextField } = useFormNavigation();
  
  // --- ESTADOS DE DIRETRIZES DE PASSAGENS ---
  const [diretrizesPassagens, setDiretrizesPassagens] = useState<DiretrizPassagem[]>([]);
  const [isPassagemFormOpen, setIsPassagemFormOpen] = useState(false);
  const [diretrizToEdit, setDiretrizToEdit] = useState<DiretrizPassagem | null>(null);
  
  // --- ESTADOS DE DIRETRIZES DE CONCESSIONÁRIA ---
  const [diretrizesConcessionaria, setDiretrizesConcessionaria] = useState<DiretrizConcessionaria[]>([]);
  const [isConcessionariaFormOpen, setIsConcessionariaFormOpen] = useState(false);
  const [diretrizConcessionariaToEdit, setDiretrizConcessionariaToEdit] = useState<DiretrizConcessionaria | null>(null);
  const [selectedConcessionariaTab, setSelectedConcessionariaTab] = useState<CategoriaConcessionaria>(CATEGORIAS_CONCESSIONARIA[0]);
  // END CONCESSIONARIA STATES
  
  // --- ESTADOS DE DIRETRIZES DE MATERIAL DE CONSUMO ---
  const [diretrizesMaterialConsumoCategorias, setDiretrizesMaterialConsumoCategorias] = useState<DiretrizMaterialConsumoCategoria[]>([]);
  const [isMaterialConsumoCategoriaFormOpen, setIsMaterialConsumoCategoriaFormOpen] = useState(false);
  const [diretrizMaterialConsumoCategoriaToEdit, setDiretrizMaterialConsumoCategoriaToEdit] = useState<DiretrizMaterialConsumoCategoria | null>(null);
  // END MATERIAL CONSUMO STATES
  
  // Efeito para rolar para o topo na montagem
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Efeito para carregar anos disponíveis e definir o ano selecionado
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
      loadDiretrizesMaterialConsumoCategorias(selectedYear); // NOVO: Carrega categorias de Material de Consumo
    }
  }, [selectedYear]);

  const loadAvailableYears = async (defaultYearId: number | null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Busca anos disponíveis nas quatro tabelas
      const [
          { data: opData, error: opError },
          { data: passagensData, error: passagensError },
          { data: concessionariaData, error: concessionariaError },
          { data: materialConsumoData, error: materialConsumoError } // NOVO
      ] = await Promise.all([
          supabase.from("diretrizes_operacionais").select("ano_referencia").eq("user_id", user.id),
          supabase.from("diretrizes_passagens").select("ano_referencia").eq("user_id", user.id),
          supabase.from("diretrizes_concessionaria").select("ano_referencia").eq("user_id", user.id), 
          supabase.from("diretrizes_material_consumo_categorias").select("ano_referencia").eq("user_id", user.id), // NOVO
      ]);

      if (opError || passagensError || concessionariaError || materialConsumoError) throw opError || passagensError || concessionariaError || materialConsumoError;

      // CORREÇÃO: Acessar 'ano_referencia' de forma segura
      const opYears = opData ? opData.map(d => d.ano_referencia) : [];
      const passagensYears = passagensData ? passagensData.map(d => d.ano_referencia) : [];
      const concessionariaYears = concessionariaData ? concessionariaData.map(d => d.ano_referencia) : [];
      const materialConsumoYears = materialConsumoData ? materialConsumoData.map(d => d.ano_referencia) : []; // NOVO

      const yearsToInclude = new Set([...opYears, ...passagensYears, ...concessionariaYears, ...materialConsumoYears]); // ATUALIZADO
      
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
      
      OPERATIONAL_FIELDS.filter(f => f.type === 'currency').forEach(f => {
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
        
        // CORREÇÃO 1: Mapear os dados do Supabase para o tipo DiretrizPassagem, 
        // garantindo que 'trechos' seja tratado como TrechoPassagem[]
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
        
        // Ensure numeric types are correct
        // CORREÇÃO: Mapear o tipo de retorno para DiretrizConcessionaria
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
  
  // --- LÓGICA DE MATERIAL DE CONSUMO (NOVO) ---
  
  const loadDiretrizesMaterialConsumoCategorias = async (year: number) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data, error } = await supabase
            .from('diretrizes_material_consumo_categorias')
            .select('*')
            .eq('user_id', user.id)
            .eq('ano_referencia', year)
            .order('nome_categoria', { ascending: true });
            
        if (error) throw error;
        
        setDiretrizesMaterialConsumoCategorias(data || []);
        
    } catch (error) {
        console.error("Erro ao carregar categorias de material de consumo:", error);
        toast.error("Erro ao carregar categorias de material de consumo.");
    }
  };
  
  const handleSaveMaterialConsumoCategoria = async (data: DiretrizMaterialConsumoCategoriaForm & { id?: string }) => {
      try {
          setLoading(true);
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Usuário não autenticado");
          
          const dbData: TablesInsert<'diretrizes_material_consumo_categorias'> = {
              user_id: user.id,
              ano_referencia: selectedYear,
              nome_categoria: data.nome_categoria,
              observacoes: data.observacoes || null,
          };

          if (data.id) {
              const { error } = await supabase
                  .from('diretrizes_material_consumo_categorias')
                  .update(dbData as TablesUpdate<'diretrizes_material_consumo_categorias'>)
                  .eq('id', data.id);
              if (error) throw error;
              toast.success("Categoria de Material de Consumo atualizada!");
          } else {
              const { error } = await supabase
                  .from('diretrizes_material_consumo_categorias')
                  .insert([dbData]);
              if (error) throw error;
              toast.success("Nova Categoria de Material de Consumo cadastrada!");
          }
          
          await loadDiretrizesMaterialConsumoCategorias(selectedYear);
          setDiretrizMaterialConsumoCategoriaToEdit(null);
          setIsMaterialConsumoCategoriaFormOpen(false);
          
      } catch (error: any) {
          toast.error(sanitizeError(error));
      } finally {
          setLoading(false);
      }
  };
  
  const handleStartEditMaterialConsumoCategoria = (diretriz: DiretrizMaterialConsumoCategoria) => {
      setDiretrizMaterialConsumoCategoriaToEdit(diretriz);
      setIsMaterialConsumoCategoriaFormOpen(true);
  };
  
  const handleOpenNewMaterialConsumoCategoria = () => {
      setDiretrizMaterialConsumoCategoriaToEdit(null);
      setIsMaterialConsumoCategoriaFormOpen(true);
  };
  
  const handleDeleteMaterialConsumoCategoria = async (id: string, nome: string) => {
      if (!confirm(`Tem certeza que deseja excluir a categoria de material de consumo "${nome}" e TODOS os itens associados? Esta ação é irreversível.`)) return;
      
      try {
          setLoading(true);
          // A exclusão em cascata deve ser tratada pelo RLS e pela chave estrangeira no DB
          await supabase.from('diretrizes_material_consumo_categorias').delete().eq('id', id);
          toast.success("Categoria de Material de Consumo excluída!");
          await loadDiretrizesMaterialConsumoCategorias(selectedYear);
          // Invalida a query de itens para garantir que não haja dados órfãos no cache
          queryClient.invalidateQueries({ queryKey: ["materialConsumoItens", id] });
      } catch (error) {
          toast.error(sanitizeError(error));
      } finally {
          setLoading(false);
      }
  };
  
  // Lógica para salvar/deletar ITENS (Nível 4) - Usaremos mutações do TanStack Query dentro do MaterialConsumoCategoriaRow
  
  const renderMaterialConsumoSection = () => {
      return (
          <div className="space-y-4">
              {diretrizesMaterialConsumoCategorias.length > 0 ? (
                  <Card className="p-4">
                      <CardTitle className="text-base font-semibold mb-3">Subitens (Categorias) Cadastrados</CardTitle>
                      <div className="space-y-2">
                          {diretrizesMaterialConsumoCategorias.map(d => (
                              <MaterialConsumoCategoriaRow
                                  key={d.id}
                                  categoria={d}
                                  onEdit={handleStartEditMaterialConsumoCategoria}
                                  onDelete={handleDeleteMaterialConsumoCategoria}
                                  loading={loading}
                              />
                          ))}
                      </div>
                  </Card>
              ) : (
                  <Card className="p-4 text-center text-muted-foreground">
                      Nenhuma categoria de material de consumo cadastrada para o ano de referência.
                  </Card>
              )}
              
              <div className="flex justify-end">
                  <Button 
                      type="button" 
                      onClick={handleOpenNewMaterialConsumoCategoria}
                      disabled={loading}
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                  >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Novo Subitem (Categoria)
                  </Button>
              </div>
          </div>
      );
  };
  // END LÓGICA DE MATERIAL DE CONSUMO

  const handleSaveDiretrizes = async () => {
    try {
      const { data: { user } = { user: null } } = await supabase.auth.getUser();
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
      
      // NOTE: fator_material_consumo foi removido do schema e do objeto, mas o campo fator_concessionaria foi mantido
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
  
  // ... (handleSetDefaultYear)

  const handleCopyDiretrizes = async (sourceYear: number, targetYear: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      setLoading(true);
      
      // 1. Copiar Diretriz Operacional
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
      
      // 2. Copiar Diretrizes de Passagens
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
              // O Supabase aceita Json, então passamos o JSONB diretamente
              trechos: p.trechos, 
          }));
          
          const { error: insertPassagensError } = await supabase
            .from("diretrizes_passagens")
            .insert(newPassagens as TablesInsert<'diretrizes_passagens'>[]);
          if (insertPassagensError) throw insertPassagensError;
      }
      
      // 3. Copiar Diretrizes de Concessionária
      const { data: sourceConcessionaria, error: concessionariaError } = await supabase
        .from("diretrizes_concessionaria")
        .select("categoria, nome_concessionaria, consumo_pessoa_dia, fonte_consumo, custo_unitario, fonte_custo, unidade_custo")
        .eq("user_id", user.id)
        .eq("ano_referencia", sourceYear);
        
      if (concessionariaError) throw concessionariaError;
      
      if (sourceConcessionaria && sourceConcessionaria.length > 0) {
          // CORREÇÃO: Mapear o tipo de retorno para DiretrizConcessionaria
          const newConcessionaria = (sourceConcessionaria as Tables<'diretrizes_concessionaria'>[]).map(c => {
              // CORREÇÃO: Desestruturação segura para remover campos de sistema
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
      
      // 4. Copiar Categorias de Material de Consumo (NOVO)
      const { data: sourceCategorias, error: categoriasError } = await supabase
        .from("diretrizes_material_consumo_categorias")
        .select("id, nome_categoria, observacoes")
        .eq("user_id", user.id)
        .eq("ano_referencia", sourceYear);
        
      if (categoriasError) throw categoriasError;
      
      if (sourceCategorias && sourceCategorias.length > 0) {
          const oldToNewIdMap: Record<string, string> = {};
          const newCategorias: TablesInsert<'diretrizes_material_consumo_categorias'>[] = [];
          
          // 4a. Inserir novas categorias e mapear IDs
          for (const oldCategoria of sourceCategorias) {
              const newCategoria: TablesInsert<'diretrizes_material_consumo_categorias'> = {
                  user_id: user.id,
                  ano_referencia: targetYear,
                  nome_categoria: oldCategoria.nome_categoria,
                  observacoes: oldCategoria.observacoes,
              };
              
              const { data: insertedData, error: insertCatError } = await supabase
                  .from("diretrizes_material_consumo_categorias")
                  .insert([newCategoria])
                  .select('id')
                  .single();
                  
              if (insertCatError) throw insertCatError;
              
              oldToNewIdMap[oldCategoria.id] = insertedData.id;
          }
          
          // 4b. Copiar Itens associados às categorias
          const { data: sourceItens, error: itensError } = await supabase
              .from("diretrizes_material_consumo_itens")
              .select("categoria_id, descricao_item, preco_unitario, numero_pregao, uasg_referencia, ativo")
              .in("categoria_id", sourceCategorias.map(c => c.id));
              
          if (itensError) throw itensError;
          
          if (sourceItens && sourceItens.length > 0) {
              const newItens: TablesInsert<'diretrizes_material_consumo_itens'>[] = sourceItens.map(item => ({
                  user_id: user.id,
                  categoria_id: oldToNewIdMap[item.categoria_id], // Usa o novo ID mapeado
                  descricao_item: item.descricao_item,
                  preco_unitario: item.preco_unitario,
                  numero_pregao: item.numero_pregao,
                  uasg_referencia: item.uasg_referencia,
                  ativo: item.ativo,
              }));
              
              const { error: insertItensError } = await supabase
                  .from("diretrizes_material_consumo_itens")
                  .insert(newItens);
              if (insertItensError) throw insertItensError;
          }
      }
      
      toast.success(`Diretrizes operacionais, de passagens, concessionária e material de consumo do ano ${sourceYear} copiadas com sucesso para o ano ${targetYear}!`);
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
    
    if (!confirm(`Tem certeza que deseja EXCLUIR TODAS as diretrizes operacionais, de passagens, de concessionária e de material de consumo para o ano ${year}? Esta ação é irreversível.`)) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      setLoading(true);
      
      // 1. Excluir Diretriz Operacional
      await supabase
        .from("diretrizes_operacionais")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", year);
        
      // 2. Excluir Diretrizes de Passagens
      await supabase
        .from("diretrizes_passagens")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", year);
        
      // 3. Excluir Diretrizes de Concessionária
      await supabase
        .from("diretrizes_concessionaria")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", year);
        
      // 4. Excluir Diretrizes de Material de Consumo (A exclusão de categorias deve apagar os itens em cascata)
      await supabase
        .from("diretrizes_material_consumo_categorias")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", year);

      toast.success(`Diretrizes operacionais, de passagens, concessionária e material de consumo do ano ${year} excluídas com sucesso!`);
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
  
  // ... (renderDiariaTable, renderPassagensSection, renderConcessionariaSection)

  // Adicionando a verificação de carregamento
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

        <Card>
          <CardHeader>
            <CardTitle>Configurações de Custos Operacionais</CardTitle>
            <CardDescription>
              Defina os valores e fatores de referência para o cálculo de despesas operacionais (GND 3).
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

              {/* SEÇÃO PRINCIPAL DE CUSTOS OPERACIONAIS (ITENS INDIVIDUAIS COLAPSÁVEIS) */}
              <div className="border-t pt-4 mt-6">
                <div className="space-y-4">
                  
                  {/* Pagamento de Diárias */}
                  <Collapsible 
                    open={fieldCollapseState['diarias_detalhe']} 
                    onOpenChange={(open) => setFieldCollapseState(prev => ({ ...prev, ['diarias_detalhe']: open }))}
                    className="border-b pb-4 last:border-b-0 last:pb-0"
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between cursor-pointer py-2">
                        <h4 className="text-base font-medium">
                          Pagamento de Diárias
                        </h4>
                        {fieldCollapseState['diarias_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2">
                        {renderDiariaTable()}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  
                  {/* Diretrizes de Passagens (Contratos/Trechos) */}
                  <Collapsible 
                    open={fieldCollapseState['passagens_detalhe']} 
                    onOpenChange={(open) => setFieldCollapseState(prev => ({ ...prev, ['passagens_detalhe']: open }))}
                    className="border-b pb-4 last:border-b-0 last:pb-0"
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between cursor-pointer py-2">
                        <h4 className="text-base font-medium flex items-center gap-2">
                          Passagens (Contratos/Trechos)
                        </h4>
                        {fieldCollapseState['passagens_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2">
                        {renderPassagensSection()}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  
                  {/* Diretrizes de Concessionária */}
                  <Collapsible 
                    open={fieldCollapseState['concessionaria_detalhe']} 
                    onOpenChange={(open) => setFieldCollapseState(prev => ({ ...prev, ['concessionaria_detalhe']: open }))}
                    className="border-b pb-4 last:border-b-0 last:pb-0"
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between cursor-pointer py-2">
                        <h4 className="text-base font-medium flex items-center gap-2">
                          Concessionária (Água/Esgoto e Energia Elétrica)
                        </h4>
                        {fieldCollapseState['concessionaria_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2">
                        {renderConcessionariaSection()}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  
                  {/* Diretrizes de Material de Consumo (NOVA SEÇÃO) */}
                  <Collapsible 
                    open={fieldCollapseState['material_consumo_detalhe']} 
                    onOpenChange={(open) => setFieldCollapseState(prev => ({ ...prev, ['material_consumo_detalhe']: open }))}
                    className="border-b pb-4 last:border-b-0 last:pb-0"
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between cursor-pointer py-2">
                        <h4 className="text-base font-medium flex items-center gap-2">
                          Material de Consumo (Subitens ND 30)
                        </h4>
                        {fieldCollapseState['material_consumo_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2">
                        {renderMaterialConsumoSection()}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  
                  {/* OUTROS CAMPOS OPERACIONAIS */}
                  {OPERATIONAL_FIELDS.map(field => {
                    const fieldKey = field.key as string;
                    const isOpen = fieldCollapseState[fieldKey] ?? false;
                    
                    return (
                      <Collapsible 
                        key={fieldKey} 
                        open={isOpen} 
                        onOpenChange={(open) => setFieldCollapseState(prev => ({ ...prev, [fieldKey]: open }))}
                        className="border-b pb-4 last:border-b-0 last:pb-0"
                      >
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between cursor-pointer py-2">
                            <h4 className="text-base font-medium">
                              {field.label}
                            </h4>
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2">
                            {renderDiretrizField(field)}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
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
      
      {/* Diálogo de Formulário de Passagens */}
      <PassagemDiretrizFormDialog
          open={isPassagemFormOpen}
          onOpenChange={setIsPassagemFormOpen}
          selectedYear={selectedYear}
          diretrizToEdit={diretrizToEdit} 
          onSave={handleSavePassagem} 
          loading={loading}
      />
      
      {/* Diálogo de Formulário de Concessionária */}
      <ConcessionariaDiretrizFormDialog
          open={isConcessionariaFormOpen}
          onOpenChange={setIsConcessionariaFormOpen}
          selectedYear={selectedYear}
          diretrizToEdit={diretrizConcessionariaToEdit}
          onSave={handleSaveConcessionaria}
          loading={loading}
          initialCategory={selectedConcessionariaTab}
      />
      
      {/* Diálogo de Formulário de Categoria de Material de Consumo (NOVO) */}
      <MaterialConsumoCategoriaFormDialog
          open={isMaterialConsumoCategoriaFormOpen}
          onOpenChange={setIsMaterialConsumoCategoriaFormOpen}
          selectedYear={selectedYear}
          diretrizToEdit={diretrizMaterialConsumoCategoriaToEdit}
          onSave={handleSaveMaterialConsumoCategoria}
          loading={loading}
      />
    </div>
  );
};

export default CustosOperacionaisPage;