import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Trash2, Pencil, XCircle, Sparkles, Check, ChevronsUpDown, Utensils, Package, AlertCircle } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeError } from "@/lib/errorUtils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { OmSelector } from "@/components/OmSelector";
import { RmSelector } from "@/components/RmSelector";
import { OMData } from "@/lib/omUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { 
  formatCurrency, 
  formatNumber, 
  formatCodug, // IMPORTADO
} from "@/lib/formatUtils";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TablesInsert } from "@/integrations/supabase/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  calculateClasseICalculations, 
  formatFasesParaTexto, 
  generateRacaoQuenteMemoriaCalculo, 
  generateRacaoOperacionalMemoriaCalculo,
  formatFormula,
  ClasseIRegistro as ClasseIRegistroType, // Renomeando para evitar conflito
} from "@/lib/classeIUtils";

// New types for Classe I categories
type CategoriaClasseI = 'RACAO_QUENTE' | 'RACAO_OPERACIONAL';
const CATEGORIAS_CLASSE_I: CategoriaClasseI[] = ['RACAO_QUENTE', 'RACAO_OPERACIONAL'];

// Opções fixas de fase de atividade
const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

// Interface para o registro pendente (configurado na Seção 2)
interface PendingRecord {
  id?: string; // Existing ID if updating
  categoria: CategoriaClasseI;
  organizacao: string;
  ug: string;
  dias_operacao: number;
  efetivo: number;
  fase_atividade: string;
  
  // Racao Quente fields
  om_qs?: string;
  ug_qs?: string;
  nr_ref_int?: number;
  valor_qs?: number;
  valor_qr?: number;
  complemento_qs?: number;
  etapa_qs?: number;
  total_qs?: number;
  complemento_qr?: number;
  etapa_qr?: number;
  total_qr?: number;
  total_geral: number; // Monetary total
  
  // Racao Operacional fields
  quantidade_r2?: number;
  quantidade_r3?: number;
  total_unidades: number; // Unit total (R2 + R3)
}

// Interface para o registro carregado do DB (Usando a interface do utilitário)
type ClasseIRegistro = ClasseIRegistroType;


export default function ClasseIForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get('ptrabId');
  const [loading, setLoading] = useState(false);
  const [ptrabNome, setPtrabNome] = useState<string>("");
  
  // --- Global OM/Activity State ---
  const [selectedOmId, setSelectedOmId] = useState<string | undefined>(undefined);
  const [organizacao, setOrganizacao] = useState<string>("");
  const [ug, setUg] = useState<string>("");
  const [diasOperacao, setDiasOperacao] = useState<number>(0);
  const [efetivo, setEfetivo] = useState<number>(0);
  const [fasesAtividade, setFasesAtividade] = useState<string[]>(["Execução"]);
  const [customFaseAtividade, setCustomFaseAtividade] = useState<string>("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  // NOVO ESTADO: Para exibir o nome da OM imediatamente durante a edição
  const [initialOmName, setInitialOmName] = useState<string | undefined>(undefined);
  const [initialOmUg, setInitialOmUg] = useState<string | undefined>(undefined);
  
  // --- RACAO_QUENTE State ---
  const [omQS, setOmQS] = useState<string>("");
  const [ugQS, setUgQS] = useState<string>("");
  const [nrRefInt, setNrRefInt] = useState<number>(1);
  const [valorQS, setValorQS] = useState<number>(9.0);
  const [valorQR, setValorQR] = useState<number>(6.0);
  
  // --- RACAO_OPERACIONAL State ---
  const [quantidadeR2, setQuantidadeR2] = useState<number>(0);
  const [quantidadeR3, setQuantidadeR3] = useState<number>(0);
  
  // --- General Control State ---
  const [registros, setRegistros] = useState<ClasseIRegistro[]>([]);
  const [diretrizAno, setDiretrizAno] = useState<number | null>(null);
  const [selectedTab, setSelectedTab] = useState<CategoriaClasseI>('RACAO_QUENTE');
  const [editingRegistroId, setEditingRegistroId] = useState<string | null>(null);
  
  // NOVO ESTADO: Consolidação dos dados do registro atual em edição/criação
  const [currentOMConsolidatedData, setCurrentOMConsolidatedData] = useState<{
    RACAO_QUENTE?: PendingRecord;
    RACAO_OPERACIONAL?: PendingRecord;
  } | null>(null);
  
  // Estados para controle de edição de memória de cálculo
  const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
  const [memoriaQSEdit, setMemoriaQSEdit] = useState<string>("");
  const [memoriaQREdit, setMemoriaQREdit] = useState<string>("");
  const [memoriaOpEdit, setMemoriaOpEdit] = useState<string>(""); // Adicionado para Ração Operacional

  const { handleEnterToNextField } = useFormNavigation();
  
  // NOVO: Função para desativar setas e manter navegação por Enter
  const handleNumberInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
    }
    // Chama a função de navegação para a tecla Enter
    handleEnterToNextField(e);
  };

  useEffect(() => {
    checkAuthAndLoadData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Helper to get the current phase string
  const getCurrentFaseFinalString = useMemo(() => {
    let fasesFinais = [...fasesAtividade];
    if (customFaseAtividade.trim()) { fasesFinais = [...fasesFinais, customFaseAtividade.trim()]; }
    return fasesFinais.filter(f => f).join('; ');
  }, [fasesAtividade, customFaseAtividade]);
  
  // NOVO MEMO: Agrupa os registros por OM de Destino
  const registrosAgrupadosPorOM = useMemo(() => {
    return registros.reduce((acc, registro) => {
        const key = `${registro.organizacao} (${formatCodug(registro.ug)})`; // USANDO formatCodug
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(registro);
        return acc;
    }, {} as Record<string, ClasseIRegistro[]>);
  }, [registros]);

  const loadDiretrizes = async (userId: string) => {
    try {
      let anoReferencia: number | null = null;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("default_logistica_year") // CORRIGIDO: Usando o nome correto da coluna
        .eq("id", userId)
        .maybeSingle();
        
      if (profileData?.default_logistica_year) { // CORRIGIDO: Usando o nome correto da propriedade
          anoReferencia = profileData.default_logistica_year; // CORRIGIDO: Usando o nome correto da propriedade
      }

      if (!anoReferencia) {
          const { data: diretrizCusteio } = await supabase
            .from("diretrizes_custeio")
            .select("ano_referencia")
            .eq("user_id", userId)
            .order("ano_referencia", { ascending: false })
            .limit(1)
            .maybeSingle();
            
          if (diretrizCusteio) {
            anoReferencia = diretrizCusteio.ano_referencia;
          }
      }
      
      if (!anoReferencia) {
        setValorQS(9.0);
        setValorQR(6.0);
        setDiretrizAno(null);
        return;
      }

      const { data, error } = await supabase
        .from("diretrizes_custeio")
        .select("*")
        .eq("user_id", userId)
        .eq("ano_referencia", anoReferencia)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const qs = Number(data.classe_i_valor_qs);
        const qr = Number(data.classe_i_valor_qr);
        setValorQS(qs);
        setValorQR(qr);
        setDiretrizAno(data.ano_referencia);
      }
    } catch (error: any) {
      console.error("Erro ao carregar diretrizes:", error);
    }
  };

  const checkAuthAndLoadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Você precisa estar autenticado");
      navigate("/login");
      return;
    }

    if (!ptrabId) {
      toast.error("Nenhum P Trab selecionado");
      navigate("/ptrab");
      return;
    }

    await loadPTrab(ptrabId);
    await loadDiretrizes(session.user.id);
    await loadRegistros(ptrabId);
  };

  const loadPTrab = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("p_trab")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setPtrabNome(`${data.numero_ptrab} - ${data.nome_operacao}`);
    } catch (error: any) {
      toast.error("Erro ao carregar P Trab");
      navigate("/ptrab");
    }
  };

  const loadRegistros = async (ptrabId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("classe_i_registros")
        // CORRIGIDO: Incluindo o campo dedicado memoria_calculo_op_customizada
        .select("*, memoria_calculo_qs_customizada, memoria_calculo_qr_customizada, memoria_calculo_op_customizada, fase_atividade, categoria, quantidade_r2, quantidade_r3")
        .eq("p_trab_id", ptrabId)
        .order("organizacao", { ascending: true })
        .order("categoria", { ascending: true });

      if (error) throw error;

      const registrosCarregados: ClasseIRegistro[] = (data || []).map((r) => {
        const categoria = (r.categoria || 'RACAO_QUENTE') as CategoriaClasseI;
        
        const currentValorQS = r.valor_qs ? Number(r.valor_qs) : 9.0;
        const currentValorQR = r.valor_qr ? Number(r.valor_qr) : 6.0;

        const isRacaoQuenteValid = categoria === 'RACAO_QUENTE' && r.efetivo && r.nr_ref_int;
        
        const derivedCalculations = isRacaoQuenteValid
          ? calculateClasseICalculations(
              r.efetivo,
              r.dias_operacao,
              r.nr_ref_int!,
              currentValorQS,
              currentValorQR
            )
          : {
              nrCiclos: 0, diasEtapaPaga: 0, diasEtapaSolicitada: 0, totalEtapas: 0,
              complementoQS: 0, etapaQS: 0, totalQS: 0, complementoQR: 0, etapaQR: 0, totalQR: 0,
            };

        return {
          id: r.id,
          categoria: categoria,
          organizacao: r.organizacao,
          ug: r.ug,
          diasOperacao: r.dias_operacao,
          faseAtividade: r.fase_atividade,
          
          omQS: r.om_qs,
          ugQS: r.ug_qs,
          efetivo: r.efetivo,
          nrRefInt: r.nr_ref_int,
          valorQS: currentValorQS,
          valorQR: currentValorQR,
          memoriaQSCustomizada: r.memoria_calculo_qs_customizada,
          memoriaQRCustomizada: r.memoria_calculo_qr_customizada,
          memoria_calculo_op_customizada: r.memoria_calculo_op_customizada, // NOVO: Carregar campo dedicado
          
          calculos: {
            totalQS: Number(r.total_qs || 0),
            totalQR: Number(r.total_qr || 0),
            nrCiclos: derivedCalculations.nrCiclos,
            diasEtapaPaga: derivedCalculations.diasEtapaPaga,
            diasEtapaSolicitada: derivedCalculations.diasEtapaSolicitada,
            totalEtapas: derivedCalculations.totalEtapas,
            complementoQS: Number(r.complemento_qs || 0),
            etapaQS: Number(r.etapa_qs || 0),
            complementoQR: Number(r.complemento_qr || 0),
            etapaQR: Number(r.etapa_qr || 0),
          },
          
          quantidadeR2: r.quantidade_r2 || 0,
          quantidadeR3: r.quantidade_r3 || 0,
        };
      });

      setRegistros(registrosCarregados);
    } catch (error: any) {
      toast.error("Erro ao carregar registros");
    } finally {
      setLoading(false);
    }
  };

  // Calculations for RACAO_QUENTE preview
  const calculosRacaoQuente = useMemo(() => {
    if (selectedTab !== 'RACAO_QUENTE') return null;
    return calculateClasseICalculations(efetivo, diasOperacao, nrRefInt, valorQS, valorQR);
  }, [efetivo, diasOperacao, nrRefInt, valorQS, valorQR, selectedTab]);
  
  // Calculations for RACAO_OPERACIONAL preview
  const totalRacoesOperacionais = quantidadeR2 + quantidadeR3;

  // NOVO MEMO: Verifica se a configuração consolidada está desatualizada
  const isConsolidationOutdated = useMemo(() => {
    // Esta verificação só é relevante se houver dados consolidados (ou seja, se o usuário salvou ou está editando)
    if (!currentOMConsolidatedData) return false;

    const currentFaseString = getCurrentFaseFinalString;
    
    const checkOutdated = (category: CategoriaClasseI): boolean => {
        const consolidatedRecord = currentOMConsolidatedData[category];
        if (!consolidatedRecord) return false; // Only check if a record exists in consolidation

        // 1. Check global fields
        if (consolidatedRecord.organizacao !== organizacao ||
            consolidatedRecord.ug !== ug ||
            consolidatedRecord.dias_operacao !== diasOperacao ||
            consolidatedRecord.efetivo !== efetivo ||
            consolidatedRecord.fase_atividade !== currentFaseString
        ) {
            return true;
        }

        if (category === 'RACAO_QUENTE') {
            // 2. Check Ração Quente specific inputs
            if (consolidatedRecord.om_qs !== omQS ||
                consolidatedRecord.ug_qs !== ugQS ||
                consolidatedRecord.nr_ref_int !== nrRefInt
            ) {
                return true;
            }
            
            // 3. Check if calculated totals match saved totals (covers changes in valorQS/valorQR)
            if (calculosRacaoQuente) {
                // Use a small tolerance for floating point comparison
                const tolerance = 0.01;
                if (Math.abs(calculosRacaoQuente.totalQS - (consolidatedRecord.total_qs || 0)) > tolerance ||
                    Math.abs(calculosRacaoQuente.totalQR - (consolidatedRecord.total_qr || 0)) > tolerance
                ) {
                    return true;
                }
            }
        } else if (category === 'RACAO_OPERACIONAL') {
            // 2. Check Ração Operacional specific inputs
            if (consolidatedRecord.quantidade_r2 !== quantidadeR2 ||
                consolidatedRecord.quantidade_r3 !== quantidadeR3
            ) {
                return true;
            }
        }
        
        return false;
    };

    // Check both categories if they are present in the consolidated data
    const isRacaoQuenteOutdated = checkOutdated('RACAO_QUENTE');
    const isRacaoOperacionalOutdated = checkOutdated('RACAO_OPERACIONAL');
    
    return isRacaoQuenteOutdated || isRacaoOperacionalOutdated;
  }, [
    currentOMConsolidatedData, organizacao, ug, diasOperacao, efetivo, getCurrentFaseFinalString,
    omQS, ugQS, nrRefInt, quantidadeR2, quantidadeR3, calculosRacaoQuente
  ]);

  const resetFormFields = () => {
    setSelectedOmId(undefined);
    setOrganizacao("");
    setUg("");
    setEfetivo(0);
    setDiasOperacao(0);
    setNrRefInt(1);
    setOmQS("");
    setUgQS("");
    setQuantidadeR2(0);
    setQuantidadeR3(0);
    setEditingRegistroId(null);
    setFasesAtividade(["Execução"]);
    setCustomFaseAtividade("");
    setSelectedTab('RACAO_QUENTE');
    setCurrentOMConsolidatedData(null); // Reset consolidated data
    setInitialOmName(undefined); // Reset initial OM name
    setInitialOmUg(undefined); // Reset initial OM UG
  };

  const handleOMChange = async (omData: OMData | undefined) => {
    // 1. Reset ALL input fields and consolidation state
    resetFormFields();
    
    if (omData) {
      // 2. Set OM/UG and RM defaults (Inputs da Seção 1/2)
      setSelectedOmId(omData.id);
      setOrganizacao(omData.nome_om);
      setUg(omData.codug_om);
      setOmQS(omData.rm_vinculacao);
      setUgQS(omData.codug_rm_vinculacao);
      
      // 3. NUNCA CARREGAR DADOS EXISTENTES PARA currentOMConsolidatedData AQUI.
      
      // 4. Ensure directive values are loaded if needed
      if (diretrizAno) {
          // Recarrega diretrizes para garantir que valorQS/QR estejam atualizados
          const { data: { user } } = await supabase.auth.getUser();
          if (user) await loadDiretrizes(user.id);
      }
      
    } else {
      // Se a OM for deselecionada, o resetFormFields já limpa tudo.
    }
  };

  const handleRMQSChange = (rmName: string, rmCodug: string) => {
    setOmQS(rmName);
    setUgQS(rmCodug);
  };

  const handleFaseChange = (fase: string, isChecked: boolean) => {
    if (isChecked) {
      setFasesAtividade(prev => Array.from(new Set([...prev, fase])));
    } else {
      setFasesAtividade(prev => prev.filter(f => f !== fase));
    }
  };
  
  const handleSaveCategoryConfig = () => {
    if (!ptrabId || !organizacao || !ug) {
      toast.error("Selecione uma OM e um P Trab válidos");
      return;
    }
    if (diasOperacao <= 0 || efetivo <= 0) {
      toast.error("Efetivo e Dias de Operação devem ser maiores que zero.");
      return;
    }

    let fasesFinais = [...fasesAtividade];
    if (customFaseAtividade.trim()) { fasesFinais = [...fasesFinais, customFaseAtividade.trim()]; }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');

    if (!faseFinalString) {
      toast.error("Selecione ou digite pelo menos uma Fase da Atividade.");
      return;
    }
    
    let newRecord: PendingRecord | null = null;
    
    if (selectedTab === 'RACAO_QUENTE') {
        if (!omQS || !ugQS) {
            toast.error("Selecione a RM que receberá o QS.");
            return;
        }
        if (valorQS <= 0 || valorQR <= 0) {
            toast.error("Os valores QS e QR da Diretriz de Custeio devem ser maiores que zero.");
            return;
        }
        
        const calculos = calculateClasseICalculations(efetivo, diasOperacao, nrRefInt, valorQS, valorQR);
        const totalGeral = calculos.totalQS + calculos.totalQR;
        
        if (totalGeral === 0) {
            toast.error("O cálculo da Ração Quente resultou em zero. Verifique Efetivo, Dias e Valores.");
            return;
        }
        
        // Se estiver editando, usa o ID do registro que está sendo editado. Caso contrário, ID é undefined (novo registro).
        const recordId = editingRegistroId; 
        
        newRecord = {
            id: recordId || undefined, // Se for edição, usa o ID. Se for novo, é undefined.
            categoria: 'RACAO_QUENTE',
            organizacao: organizacao,
            ug: ug,
            dias_operacao: diasOperacao,
            efetivo: efetivo,
            fase_atividade: faseFinalString,
            om_qs: omQS,
            ug_qs: ugQS,
            nr_ref_int: nrRefInt,
            valor_qs: valorQS,
            valor_qr: valorQR,
            complemento_qs: calculos.complementoQS,
            etapa_qs: calculos.etapaQS,
            total_qs: calculos.totalQS,
            complemento_qr: calculos.complementoQR,
            etapa_qr: calculos.etapa_qr,
            total_qr: calculos.totalQR,
            total_geral: totalGeral,
            total_unidades: 0,
        };
        
    } else if (selectedTab === 'RACAO_OPERACIONAL') {
        if (quantidadeR2 <= 0 && quantidadeR3 <= 0) {
            toast.error("Informe a quantidade de Ração Operacional (R2 ou R3).");
            return;
        }
        
        const totalUnidades = quantidadeR2 + quantidadeR3;
        
        // Se estiver editando, usa o ID do registro que está sendo editado. Caso contrário, ID é undefined (novo registro).
        const recordId = editingRegistroId;
        
        newRecord = {
            id: recordId || undefined,
            categoria: 'RACAO_OPERACIONAL',
            organizacao: organizacao,
            ug: ug,
            dias_operacao: diasOperacao,
            efetivo: efetivo,
            fase_atividade: faseFinalString,
            quantidade_r2: quantidadeR2,
            quantidade_r3: quantidadeR3,
            total_geral: 0,
            total_unidades: totalUnidades,
        };
    }
    
    if (newRecord) {
        // Ao salvar a configuração da categoria, atualizamos o estado de consolidação
        setCurrentOMConsolidatedData(prev => ({
            ...prev,
            [selectedTab]: newRecord,
        }));
        
        if (!editingRegistroId) {
            // Se for um novo lançamento, garantimos que o ID não seja setado aqui,
            // mas o currentOMConsolidatedData é preenchido.
        }
        
        toast.success(`Configuração de ${selectedTab === 'RACAO_QUENTE' ? 'Ração Quente' : 'Ração Operacional'} salva temporariamente.`);
    }
  };

  const handleFinalSave = async () => {
    if (!ptrabId) return;
    if (!currentOMConsolidatedData || (!currentOMConsolidatedData.RACAO_QUENTE && !currentOMConsolidatedData.RACAO_OPERACIONAL)) {
        toast.error("Nenhuma configuração de categoria foi salva para esta OM.");
        return;
    }
    
    if (isConsolidationOutdated) {
        toast.error("A configuração da OM foi alterada. Clique em 'Salvar Item da Categoria' na(s) aba(s) ativa(s) para atualizar os cálculos antes de salvar os registros.");
        return;
    }
    
    setLoading(true);
    
    const recordsToSave: TablesInsert<'classe_i_registros'>[] = [];
    
    // 1. Processar Ração Quente
    if (currentOMConsolidatedData.RACAO_QUENTE) {
        const r = currentOMConsolidatedData.RACAO_QUENTE;
        
        // Se estiver editando, buscamos a memória customizada do registro original
        let memoriaQSCustomizada = null;
        let memoriaQRCustomizada = null;
        let memoriaOpCustomizada = null; // Incluir o campo de Ração Op para não perdê-lo
        if (r.id) {
            const existingMemoria = registros.find(reg => reg.id === r.id);
            memoriaQSCustomizada = existingMemoria?.memoriaQSCustomizada || null;
            memoriaQRCustomizada = existingMemoria?.memoriaQRCustomizada || null;
            memoriaOpCustomizada = existingMemoria?.memoria_calculo_op_customizada || null;
        }
        
        recordsToSave.push({
            p_trab_id: ptrabId,
            organizacao: r.organizacao,
            ug: r.ug,
            dias_operacao: r.dias_operacao,
            efetivo: r.efetivo,
            fase_atividade: r.fase_atividade,
            categoria: r.categoria,
            om_qs: r.om_qs,
            ug_qs: r.ug_qs,
            nr_ref_int: r.nr_ref_int,
            valor_qs: r.valor_qs,
            valor_qr: r.valor_qr,
            complemento_qs: r.complemento_qs,
            etapa_qs: r.etapa_qs,
            total_qs: r.total_qs,
            complemento_qr: r.complemento_qr,
            etapa_qr: r.etapa_qr,
            total_qr: r.total_qr,
            total_geral: r.total_geral,
            quantidade_r2: 0,
            quantidade_r3: 0,
            memoria_calculo_qs_customizada: memoriaQSCustomizada,
            memoria_calculo_qr_customizada: memoriaQRCustomizada,
            memoria_calculo_op_customizada: memoriaOpCustomizada, // Manter o valor existente
            id: r.id, // ID será usado para UPDATE se existir, ou undefined para INSERT
        });
    }
    
    // 2. Processar Ração Operacional
    if (currentOMConsolidatedData.RACAO_OPERACIONAL) {
        const r = currentOMConsolidatedData.RACAO_OPERACIONAL;
        
        // Se estiver editando, buscamos a memória customizada do registro original
        let memoriaOpCustomizada = null;
        if (r.id) {
            const existingMemoria = registros.find(reg => reg.id === r.id);
            // CORRIGIDO: Usar o campo dedicado memoria_calculo_op_customizada
            memoriaOpCustomizada = existingMemoria?.memoria_calculo_op_customizada || null; 
        }
        
        recordsToSave.push({
            p_trab_id: ptrabId,
            organizacao: r.organizacao,
            ug: r.ug,
            dias_operacao: r.dias_operacao,
            efetivo: r.efetivo,
            fase_atividade: r.fase_atividade,
            categoria: r.categoria,
            quantidade_r2: r.quantidade_r2,
            quantidade_r3: r.quantidade_r3,
            // Campos de Ração Quente zerados/placeholders (necessário pois são NOT NULL no DB)
            om_qs: "", 
            ug_qs: "", 
            nr_ref_int: 0, 
            valor_qs: 0, 
            valor_qr: 0,
            complemento_qs: 0, etapa_qs: 0, total_qs: 0, complemento_qr: 0, etapa_qr: 0, total_qr: 0, total_geral: 0,
            memoria_calculo_qs_customizada: null, // Limpar QS/QR customizado para Ração Op
            memoria_calculo_qr_customizada: null, // Limpar QS/QR customizado para Ração Op
            memoria_calculo_op_customizada: memoriaOpCustomizada, // CORRIGIDO: Usar o valor existente
            id: r.id, // ID será usado para UPDATE se existir, ou undefined para INSERT
        });
    }
    
    try {
        // 3. Perform INSERT or UPDATE based on the presence of ID
        for (const record of recordsToSave) {
            const { id, ...dataToSave } = record; // Destructure ID and get the rest of the data

            if (id) {
                // UPDATE existing record
                const { error: updateError } = await supabase
                    .from("classe_i_registros")
                    .update(dataToSave) // Update using data without the ID field
                    .eq("id", id);
                if (updateError) throw updateError;
            } else {
                // INSERT new record (ID is omitted, so DB default is used)
                const { error: insertError } = await supabase
                    .from("classe_i_registros")
                    .insert([dataToSave]); // Insert using data without the ID field
                if (insertError) throw insertError;
            }
        }
        
        toast.success(`Registro de Classe I para ${organizacao} salvo com sucesso!`);
        await updatePTrabStatusIfAberto(ptrabId);
        resetFormFields();
        loadRegistros(ptrabId);
        
    } catch (error) {
        console.error("Erro ao salvar registros de Classe I:", error);
        toast.error(sanitizeError(error));
    } finally {
        setLoading(false);
    }
  };

  const handleRemover = async (id: string) => {
    const registro = registros.find(r => r.id === id);
    if (!registro) return;
    
    const categoriaLabel = registro.categoria === 'RACAO_QUENTE' ? 'Ração Quente (QS/QR)' : 'Ração Operacional (R2/R3)';
    
    if (!confirm(`Tem certeza que deseja remover o registro de ${categoriaLabel} para a OM ${registro.organizacao}?`)) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from("classe_i_registros")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setRegistros(registros.filter((r) => r.id !== id));
      toast.success("Registro removido com sucesso!");
      
      // Se o registro removido era o que estava sendo editado, reseta o formulário
      if (editingRegistroId === id) {
          resetFormFields();
      }
      
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleEditRegistro = async (registro: ClasseIRegistro) => {
    setLoading(true);
    
    // 1. Buscar o ID da OM de destino imediatamente
    let omId: string | undefined = undefined;
    try {
      const { data: omData, error: omError } = await supabase
        .from('organizacoes_militares')
        .select('id')
        .eq('nome_om', registro.organizacao)
        .eq('codug_om', registro.ug)
        .maybeSingle();
      
      if (omData && !omError) {
        omId = omData.id;
      }
    } catch (error) {
      console.error("Erro ao buscar ID da OM para edição:", error);
    }
    
    // 2. Resetar o formulário
    resetFormFields();
    
    // 3. Setar o ID da OM e o nome inicial (para exibição imediata)
    setSelectedOmId(omId);
    setInitialOmName(registro.organizacao);
    setInitialOmUg(registro.ug);
    
    // 4. Set Global Fields
    setOrganizacao(registro.organizacao);
    setUg(registro.ug);
    setEfetivo(registro.efetivo || 0);
    setDiasOperacao(registro.diasOperacao);
    
    const fasesSalvas = (registro.faseAtividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
    setFasesAtividade(fasesSalvas.filter(f => FASES_PADRAO.includes(f)));
    setCustomFaseAtividade(fasesSalvas.find(f => !FASES_PADRAO.includes(f)) || "");

    // 5. Preencher Ração Quente/Operacional (se for o caso)
    const newConsolidatedData: typeof currentOMConsolidatedData = {};
    
    if (registro.categoria === 'RACAO_QUENTE') {
        setOmQS(registro.omQS || "");
        setUgQS(registro.ugQS || "");
        setNrRefInt(registro.nrRefInt || 1);
        setValorQS(registro.valorQS || valorQS);
        setValorQR(registro.valorQR || valorQR);
        
        const currentValorQS = registro.valorQS || valorQS;
        const currentValorQR = registro.valorQR || valorQR;
        const calc = calculateClasseICalculations(registro.efetivo, registro.diasOperacao, registro.nrRefInt || 1, currentValorQS, currentValorQR);
        
        newConsolidatedData.RACAO_QUENTE = {
            id: registro.id,
            categoria: 'RACAO_QUENTE',
            organizacao: registro.organizacao,
            ug: registro.ug,
            dias_operacao: registro.diasOperacao,
            efetivo: registro.efetivo || 0,
            fase_atividade: registro.faseAtividade || "",
            om_qs: registro.omQS,
            ug_qs: registro.ugQS,
            nr_ref_int: registro.nrRefInt,
            valor_qs: currentValorQS,
            valor_qr: currentValorQR,
            complemento_qs: registro.calculos.complementoQS,
            etapa_qs: registro.calculos.etapaQS,
            total_qs: registro.calculos.totalQS,
            complemento_qr: registro.calculos.complementoQR,
            etapa_qr: registro.calculos.etapaQR,
            total_qr: registro.calculos.totalQR,
            total_geral: registro.calculos.totalQS + registro.calculos.totalQR,
            total_unidades: 0,
        };
        setSelectedTab('RACAO_QUENTE');
    } else if (registro.categoria === 'RACAO_OPERACIONAL') {
        setQuantidadeR2(registro.quantidadeR2 || 0);
        setQuantidadeR3(registro.quantidadeR3 || 0);
        
        newConsolidatedData.RACAO_OPERACIONAL = {
            id: registro.id,
            categoria: 'RACAO_OPERACIONAL',
            organizacao: registro.organizacao,
            ug: registro.ug,
            dias_operacao: registro.diasOperacao,
            efetivo: registro.efetivo || 0,
            fase_atividade: registro.faseAtividade || "",
            quantidade_r2: registro.quantidadeR2,
            quantidade_r3: registro.quantidadeR3,
            total_geral: 0,
            total_unidades: (registro.quantidadeR2 || 0) + (registro.quantidadeR3 || 0),
        };
        setSelectedTab('RACAO_OPERACIONAL');
    }
    
    setCurrentOMConsolidatedData(newConsolidatedData);

    // 6. Setando o ID do registro que está sendo editado (para o botão Salvar)
    setEditingRegistroId(registro.id);

    setLoading(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleIniciarEdicaoMemoria = (registro: ClasseIRegistro) => {
    setEditingMemoriaId(registro.id);
    
    if (registro.categoria === 'RACAO_QUENTE') {
        const { qs, qr } = generateRacaoQuenteMemoriaCalculo(registro);
        setMemoriaQSEdit(registro.memoriaQSCustomizada || qs);
        setMemoriaQREdit(registro.memoriaQRCustomizada || qr);
        setMemoriaOpEdit(""); // Limpa estado de Ração Operacional
    } else if (registro.categoria === 'RACAO_OPERACIONAL') {
        const op = generateRacaoOperacionalMemoriaCalculo(registro);
        // CORRIGIDO: Usar o campo dedicado memoria_calculo_op_customizada
        setMemoriaOpEdit(registro.memoria_calculo_op_customizada || op); 
        setMemoriaQSEdit(""); // Limpa estados de Ração Quente
        setMemoriaQREdit("");
    } else {
        toast.warning("Categoria de registro desconhecida.");
        return;
    }
  };

  const handleCancelarEdicaoMemoria = () => {
    setEditingMemoriaId(null);
    setMemoriaQSEdit("");
    setMemoriaQREdit("");
    setMemoriaOpEdit(""); // Limpa estado de Ração Operacional
  };

  const handleSalvarMemoriaCustomizada = async (registroId: string) => {
    try {
      setLoading(true);
      
      const registro = registros.find(r => r.id === registroId);
      if (!registro) throw new Error("Registro não encontrado.");
      
      let updateData: Partial<TablesInsert<'classe_i_registros'>>;
      
      if (registro.categoria === 'RACAO_QUENTE') {
          updateData = {
              memoria_calculo_qs_customizada: memoriaQSEdit,
              memoria_calculo_qr_customizada: memoriaQREdit,
          };
      } else if (registro.categoria === 'RACAO_OPERACIONAL') {
          // CORRIGIDO: Salvar no campo dedicado memoria_calculo_op_customizada
          updateData = {
              memoria_calculo_op_customizada: memoriaOpEdit,
              memoria_calculo_qs_customizada: null, // Garantir que QS fique nulo
              memoria_calculo_qr_customizada: null, // Garantir que QR fique nulo
          };
      } else {
          throw new Error("Categoria desconhecida.");
      }
      
      const { error } = await supabase
        .from("classe_i_registros")
        .update(updateData)
        .eq("id", registroId);

      if (error) throw error;

      toast.success("Memória de cálculo atualizada com sucesso!");
      handleCancelarEdicaoMemoria();
      await loadRegistros(ptrabId!);
    } catch (error: any) {
      console.error("Erro ao salvar memória customizada:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRestaurarMemoriaAutomatica = async (registroId: string) => {
    if (!confirm("Deseja restaurar a memória de cálculo automática? O texto customizado será perdido.")) {
      return;
    }
    
    try {
      setLoading(true);
      
      const registro = registros.find(r => r.id === registroId);
      if (!registro) throw new Error("Registro não encontrado.");
      
      let updateData: Partial<TablesInsert<'classe_i_registros'>>;
      
      if (registro.categoria === 'RACAO_QUENTE') {
          updateData = {
              memoria_calculo_qs_customizada: null,
              memoria_calculo_qr_customizada: null,
          };
      } else if (registro.categoria === 'RACAO_OPERACIONAL') {
          // CORRIGIDO: Limpar o campo dedicado memoria_calculo_op_customizada
          updateData = {
              memoria_calculo_op_customizada: null,
          };
      } else {
          throw new Error("Categoria desconhecida.");
      }
      
      const { error } = await supabase
        .from("classe_i_registros")
        .update(updateData)
        .eq("id", registroId);

      if (error) throw error;

      toast.success("Memória de cálculo restaurada!");
      handleCancelarEdicaoMemoria();
      await loadRegistros(ptrabId!);
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const totalGeralQS = registros.filter(r => r.categoria === 'RACAO_QUENTE').reduce((sum, r) => sum + r.calculos.totalQS, 0);
  const totalGeralQR = registros.filter(r => r.categoria === 'RACAO_QUENTE').reduce((sum, r) => sum + r.calculos.totalQR, 0);
  const totalGeral = totalGeralQS + totalGeralQR;
  
  const totalRacoesOperacionaisGeral = registros.filter(r => r.categoria === 'RACAO_OPERACIONAL').reduce((sum, r) => sum + (r.quantidadeR2 || 0) + (r.quantidadeR3 || 0), 0);

  const displayFases = [...fasesAtividade, customFaseAtividade.trim()].filter(f => f).join(', ');
  
  // isConfigReady agora depende apenas se currentOMConsolidatedData foi preenchido (pelo save ou edit)
  const isConfigReady = currentOMConsolidatedData && (currentOMConsolidatedData.RACAO_QUENTE || currentOMConsolidatedData.RACAO_OPERACIONAL);
  const totalMonetarioConsolidado = (currentOMConsolidatedData?.RACAO_QUENTE?.total_geral || 0);
  const totalUnidadesConsolidado = (currentOMConsolidatedData?.RACAO_OPERACIONAL?.total_unidades || 0);

  // Dados necessários para formatar a fórmula no card de consolidação
  const RACAO_QUENTE_DATA = currentOMConsolidatedData?.RACAO_QUENTE;
  // Use the calculated value for display if RACAO_QUENTE_DATA is present, otherwise use the preview calculation
  const diasEtapaSolicitada = RACAO_QUENTE_DATA 
    ? calculateClasseICalculations(RACAO_QUENTE_DATA.efetivo, RACAO_QUENTE_DATA.dias_operacao, RACAO_QUENTE_DATA.nr_ref_int || 1, RACAO_QUENTE_DATA.valor_qs || valorQS, RACAO_QUENTE_DATA.valor_qr || valorQR).diasEtapaSolicitada
    : calculosRacaoQuente?.diasEtapaSolicitada || 0;


  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-2">
        <Button
          variant="ghost"
          onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}
          className="mb-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <Card className="p-6 backdrop-blur-sm bg-card/95 border-primary/10 max-w-6xl mx-auto">
          <div className="mb-4">
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Classe I - Subsistência
            </h1>
            <p className="text-muted-foreground">
              Configure a sua necessidade de alimentação (Ração Quente e Ração Operacional) por OM.
            </p>
          </div>

          {/* Removido o tag <form> principal */}
          <div className="space-y-6">
            
            {/* 1. Dados da Organização */}
            <div className="space-y-3 border-b pb-4">
              <h3 className="text-lg font-semibold">1. Dados da Organização</h3>
              
              <div className="space-y-6 p-4 bg-muted/30 rounded-lg">
                
                {/* Linha 1: OM Destino (QR / Ração Operacional) e UG Destino */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="om">OM de Destino (QR / Ração Operacional) *</Label>
                    <OmSelector
                      selectedOmId={selectedOmId}
                      onChange={handleOMChange}
                      placeholder="Selecione uma OM de Destino..."
                      initialOmName={initialOmName} // PASSANDO O NOME INICIAL
                      initialOmUg={initialOmUg} // PASSANDO A UG INICIAL
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ug">UG de Destino</Label>
                    <Input
                      id="ug"
                      value={formatCodug(ug)} // APLICANDO FORMATO
                      readOnly
                      disabled={true}
                      className="disabled:opacity-60"
                    />
                  </div>
                </div>
                
                {/* Linha 2: Efetivo, Dias de Atividade, Fase da Atividade */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="efetivo">Efetivo de Militares *</Label>
                    <Input
                      id="efetivo"
                      type="number"
                      min="1"
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={efetivo === 0 ? "" : efetivo.toString()}
                      onChange={(e) => setEfetivo(Number(e.target.value))}
                      placeholder="Ex: 246"
                      onKeyDown={handleNumberInputKeyDown}
                      disabled={!organizacao}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="diasOperacao">Dias de Atividade *</Label>
                    <Input
                      id="diasOperacao"
                      type="number"
                      min="1"
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={diasOperacao === 0 ? "" : diasOperacao.toString()}
                      onChange={(e) => setDiasOperacao(Number(e.target.value))}
                      placeholder="Ex: 30"
                      onKeyDown={handleNumberInputKeyDown}
                      disabled={!organizacao}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="faseAtividade">Fase da Atividade *</Label>
                    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          type="button"
                          className="w-full justify-between"
                          disabled={!organizacao}
                        >
                          <span className="truncate">
                            {displayFases || "Selecione a(s) fase(s)..."}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0" align="start">
                        <Command>
                          <CommandGroup>
                            {FASES_PADRAO.map((fase) => (
                              <CommandItem
                                key={fase}
                                value={fase}
                                onSelect={() => handleFaseChange(fase, !fasesAtividade.includes(fase))}
                                className="flex items-center justify-between cursor-pointer"
                              >
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    checked={fasesAtividade.includes(fase)}
                                    onCheckedChange={(checked) => handleFaseChange(fase, !!checked)}
                                  />
                                  <Label>{fase}</Label>
                                </div>
                                {fasesAtividade.includes(fase) && <Check className="ml-auto h-4 w-4" />}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                          <div className="p-2 border-t">
                            <Label className="text-xs text-muted-foreground mb-1 block">Outra Atividade (Opcional)</Label>
                            <Input
                              value={customFaseAtividade}
                              onChange={(e) => setCustomFaseAtividade(e.target.value)}
                              placeholder="Ex: Patrulhamento"
                              onKeyDown={handleEnterToNextField}
                            />
                          </div>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Configurar Itens por Categoria */}
            {organizacao && diasOperacao > 0 && efetivo > 0 && (
              <>
                <div className="space-y-4 border-b pb-4">
                  <h3 className="text-lg font-semibold">2. Configurar Itens por Categoria</h3>
                  
                  <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as CategoriaClasseI)}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="RACAO_QUENTE">Ração Quente (R1)</TabsTrigger>
                      <TabsTrigger value="RACAO_OPERACIONAL">Ração Operacional (R2/R3)</TabsTrigger>
                    </TabsList>
                    
                    {/* Ração Quente (R1) - QS/QR */}
                    <TabsContent value="RACAO_QUENTE" className="mt-4">
                      <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                        <h4 className="font-semibold text-base">Configuração de QS/QR</h4>
                        
                        {/* Linha de Configuração (3 Colunas) */}
                        <div className="grid md:grid-cols-3 gap-6 pt-2">
                          
                          {/* Coluna 1: Nº Refeições Intermediárias */}
                          <div className="space-y-2">
                            <Label htmlFor="nrRefInt">Nº Refeições Intermediárias</Label>
                            <Select
                              value={nrRefInt.toString()}
                              onValueChange={(value) => setNrRefInt(Number(value))}
                            >
                              <SelectTrigger id="nrRefInt">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent className="bg-background">
                                <SelectItem value="1">1 refeição</SelectItem>
                                <SelectItem value="2">2 refeições</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {/* Coluna 2: OM de Destino (QS) */}
                          <div className="space-y-2">
                            <Label htmlFor="omQS">OM de Destino (QS) *</Label>
                            <RmSelector
                              value={omQS}
                              onChange={handleRMQSChange}
                              placeholder="Selecione a RM de destino do QS..."
                              disabled={!organizacao}
                            />
                          </div>

                          {/* Coluna 3: UG de Destino (QS) */}
                          <div className="space-y-2">
                            <Label htmlFor="ugQS">UG de Destino</Label>
                            <Input
                              id="ugQS"
                              value={formatCodug(ugQS)} // APLICANDO FORMATO
                              readOnly
                              disabled={true}
                              className="disabled:opacity-60"
                            />
                          </div>
                        </div>
                        
                        {/* Valores da Diretriz (Apenas exibição) */}
                        <div className="grid md:grid-cols-2 gap-4 pt-4">
                            <div className="space-y-2">
                                <Label>Valor QS (Diretriz {diretrizAno || 'Atual'})</Label>
                                <Input
                                    value={formatCurrency(valorQS)}
                                    readOnly
                                    disabled
                                    className="font-semibold text-blue-600 disabled:opacity-100"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Valor QR (Diretriz {diretrizAno || 'Atual'})</Label>
                                <Input
                                    value={formatCurrency(valorQR)}
                                    readOnly
                                    disabled
                                    className="font-semibold text-green-600 disabled:opacity-100"
                                />
                            </div>
                        </div>
                        
                        {/* Preview dos Cálculos Ração Quente */}
                        {calculosRacaoQuente && (
                          <div className="space-y-1 mt-6 p-4 bg-background rounded-lg border">
                            <h5 className="font-semibold text-sm">Previsão de Custo (Ração Quente)</h5>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">Total QS (Quantitativo de Subsistência)</span>
                              <span className="font-semibold text-blue-600">{formatCurrency(calculosRacaoQuente.totalQS)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">Total QR (Quantitativo de Reforço)</span>
                              <span className="font-semibold text-green-600">{formatCurrency(calculosRacaoQuente.totalQR)}</span>
                            </div>
                            <div className="h-px bg-border my-2" />
                            <div className="flex justify-between items-center text-lg pt-1">
                              <span className="font-bold">Total Ração Quente</span>
                              <span className="font-bold text-primary">{formatCurrency(calculosRacaoQuente.totalQS + calculosRacaoQuente.totalQR)}</span>
                            </div>
                          </div>
                        )}
                        
                        {/* Botão Salvar Configuração da Categoria - MOVIDO AQUI */}
                        <div className="flex justify-end gap-2 pt-4">
                          <Button
                            type="button"
                            onClick={handleSaveCategoryConfig}
                            className="gap-2"
                            disabled={loading || !organizacao || diasOperacao <= 0 || efetivo <= 0 || (!displayFases)}
                          >
                            <Check className="h-4 w-4" />
                            {editingRegistroId ? "Atualizar Item da Categoria" : "Salvar Item da Categoria"}
                          </Button>
                        </div>
                      </div>
                    </TabsContent>
                    
                    {/* Ração Operacional (R2/R3) - UPDATED STRUCTURE */}
                    <TabsContent value="RACAO_OPERACIONAL" className="mt-4">
                      <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                        <h4 className="font-semibold text-base mb-2">Quantitativo de Ração Operacional</h4>
                        <p className="text-sm text-muted-foreground">
                          Informe a quantidade total de rações operacionais necessárias para o efetivo e dias de atividade.
                        </p>
                        
                        <div className="max-h-[400px] overflow-y-auto rounded-md border">
                          <Table className="w-full">
                            <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                              <TableRow>
                                <TableHead className="w-[70%]">Item</TableHead>
                                <TableHead className="w-[30%] text-center">Quantidade</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {/* Ração R2 */}
                              <TableRow className="h-12">
                                <TableCell className="font-medium text-sm py-1">
                                  Ração Operacional R2 (24h)
                                </TableCell>
                                <TableCell className="py-1">
                                  <Input
                                    id="quantidadeR2"
                                    type="number"
                                    min="0"
                                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none h-8 text-center"
                                    value={quantidadeR2 === 0 ? "" : quantidadeR2.toString()}
                                    onChange={(e) => setQuantidadeR2(Number(e.target.value))}
                                    placeholder="0"
                                    onKeyDown={handleNumberInputKeyDown}
                                  />
                                </TableCell>
                              </TableRow>
                              {/* Ração R3 */}
                              <TableRow className="h-12">
                                <TableCell className="font-medium text-sm py-1">
                                  Ração Operacional R3 (12h)
                                </TableCell>
                                <TableCell className="py-1">
                                  <Input
                                    id="quantidadeR3"
                                    type="number"
                                    min="0"
                                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none h-8 text-center"
                                    value={quantidadeR3 === 0 ? "" : quantidadeR3.toString()}
                                    onChange={(e) => setQuantidadeR3(Number(e.target.value))}
                                    placeholder="0"
                                    onKeyDown={handleNumberInputKeyDown}
                                  />
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>

                        {/* Total line, similar to Classe II form */}
                        <div className="flex justify-between items-center p-3 bg-background rounded-lg border">
                          <span className="font-bold text-sm">TOTAL DE RAÇÕES OPERACIONAIS</span>
                          <span className="font-extrabold text-lg text-secondary">
                            {formatNumber(totalRacoesOperacionais)} un.
                          </span>
                        </div>
                        
                        <p className="text-xs text-muted-foreground mt-2">
                          * Nota: O valor monetário desta solicitação é considerado R$ 0,00 para fins de cálculo logístico interno.
                        </p>
                        
                        {/* Botão Salvar Configuração da Categoria */}
                        <div className="flex justify-end gap-2 pt-4">
                          <Button
                            type="button"
                            onClick={handleSaveCategoryConfig}
                            className="gap-2"
                            disabled={loading || !organizacao || diasOperacao <= 0 || efetivo <= 0 || (!displayFases)}
                          >
                            <Check className="h-4 w-4" />
                            {editingRegistroId ? "Atualizar Item da Categoria" : "Salvar Item da Categoria"}
                          </Button>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </>
            )}
            
            {/* 3. Itens Adicionados e Consolidação */}
            {isConfigReady && (
              <div className="space-y-4 border-b pb-4 pt-4">
                <h3 className="text-lg font-semibold">3. Itens Adicionados</h3>
                
                {/* Alerta de Validação Final */}
                {isConsolidationOutdated && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="font-medium">
                            Atenção: A configuração da OM foi alterada. Clique em "Salvar Item da Categoria" na(s) aba(s) ativa(s) para atualizar os cálculos antes de salvar os registros.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="space-y-4">
                    {/* Card Ração Quente */}
                    {RACAO_QUENTE_DATA && (
                        <Card className="p-4 bg-secondary/10 border-secondary">
                            <div className="flex items-center justify-between mb-3 border-b pb-2">
                                <h4 className="font-bold text-base text-primary flex items-center gap-2">
                                    Ração Quente (QS/QR)
                                </h4>
                                <span className="font-extrabold text-lg text-primary">
                                    {formatCurrency(RACAO_QUENTE_DATA.total_geral)}
                                </span>
                            </div>
                            
                            <div className="space-y-1 text-sm">
                                {/* Detalhes do Cálculo */}
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                    <div className="font-medium text-muted-foreground">Efetivo / Dias / Ref. Int.</div>
                                    <div className="font-semibold text-foreground text-right">
                                        {formatNumber(RACAO_QUENTE_DATA.efetivo)} mil. / {RACAO_QUENTE_DATA.dias_operacao} dias / {RACAO_QUENTE_DATA.nr_ref_int} ref.
                                    </div>
                                    
                                    <div className="font-medium text-muted-foreground">Fase da Atividade</div>
                                    <div className="font-semibold text-foreground text-right">
                                        {formatFasesParaTexto(RACAO_QUENTE_DATA.fase_atividade)}
                                    </div>
                                </div>
                                
                                <div className="h-px bg-border my-2" />
                                
                                {/* Detalhamento do Cálculo QS */}
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                    <div className="font-bold text-blue-600">QS (Subsistência)</div>
                                    <div className="font-bold text-blue-600 text-right">Total: {formatCurrency(RACAO_QUENTE_DATA.total_qs || 0)}</div>
                                    
                                    {/* Complemento de Etapa (QS) */}
                                    <div className="col-span-2 flex justify-between items-center">
                                        <span className="text-muted-foreground pl-2">Complemento de Etapa</span>
                                        <span className="text-[10px] text-muted-foreground/80">
                                            {formatFormula(RACAO_QUENTE_DATA.efetivo, RACAO_QUENTE_DATA.dias_operacao, RACAO_QUENTE_DATA.nr_ref_int || 0, RACAO_QUENTE_DATA.valor_qs || 0, 0, 'complemento', RACAO_QUENTE_DATA.complemento_qs || 0)}
                                        </span>
                                    </div>
                                    
                                    {/* Etapa a Solicitar (QS) */}
                                    <div className="col-span-2 flex justify-between items-center">
                                        <span className="text-muted-foreground pl-2">Etapa a Solicitar</span>
                                        <span className="text-[10px] text-muted-foreground/80">
                                            {formatFormula(RACAO_QUENTE_DATA.efetivo, RACAO_QUENTE_DATA.dias_operacao, RACAO_QUENTE_DATA.nr_ref_int || 0, RACAO_QUENTE_DATA.valor_qs || 0, diasEtapaSolicitada, 'etapa', RACAO_QUENTE_DATA.etapa_qs || 0)}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="h-px bg-border my-2" />
                                
                                {/* Detalhamento do Cálculo QR */}
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                    <div className="font-bold text-green-600">QR (Reforço)</div>
                                    <div className="font-bold text-green-600 text-right">Total: {formatCurrency(RACAO_QUENTE_DATA.total_qr || 0)}</div>
                                    
                                    {/* Complemento de Etapa (QR) */}
                                    <div className="col-span-2 flex justify-between items-center">
                                        <span className="text-muted-foreground pl-2">Complemento de Etapa</span>
                                        <span className="text-[10px] text-muted-foreground/80">
                                            {formatFormula(RACAO_QUENTE_DATA.efetivo, RACAO_QUENTE_DATA.dias_operacao, RACAO_QUENTE_DATA.nr_ref_int || 0, RACAO_QUENTE_DATA.valor_qr || 0, 0, 'complemento', RACAO_QUENTE_DATA.complemento_qr || 0)}
                                        </span>
                                    </div>
                                    
                                    {/* Etapa a Solicitar (QR) */}
                                    <div className="col-span-2 flex justify-between items-center">
                                        <span className="text-muted-foreground pl-2">Etapa a Solicitar</span>
                                        <span className="text-[10px] text-muted-foreground/80">
                                            {formatFormula(RACAO_QUENTE_DATA.efetivo, RACAO_QUENTE_DATA.dias_operacao, RACAO_QUENTE_DATA.nr_ref_int || 0, RACAO_QUENTE_DATA.valor_qr || 0, diasEtapaSolicitada, 'etapa', RACAO_QUENTE_DATA.etapa_qr || 0)}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="h-px bg-border my-2" />
                                
                                {/* Linha de Destinos e ND (Invertida para QS/QR) */}
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 text-xs">
                                    {/* Linha 1: Destinos */}
                                    <div className="font-medium text-muted-foreground">OM Destino Recurso</div>
                                    <div className="flex justify-between">
                                        <span className="font-medium text-blue-600">QS: {RACAO_QUENTE_DATA.om_qs} ({formatCodug(RACAO_QUENTE_DATA.ug_qs)})</span>
                                        <span className="font-medium text-green-600">QR: {organizacao} ({formatCodug(ug)})</span>
                                    </div>
                                    
                                    {/* Linha 2: ND e Valores */}
                                    <div className="font-medium text-muted-foreground">ND 33.90.30 (Material)</div>
                                    <div className="flex justify-between">
                                        <span className="font-medium text-blue-600">QS: {formatCurrency(RACAO_QUENTE_DATA.total_qs || 0)}</span>
                                        <span className="font-medium text-green-600">QR: {formatCurrency(RACAO_QUENTE_DATA.total_qr || 0)}</span>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}
                    
                    {/* Card Ração Operacional */}
                    {currentOMConsolidatedData?.RACAO_OPERACIONAL && (
                        <Card className="p-4 bg-secondary/10 border-secondary">
                            <div className="flex items-center justify-between mb-3 border-b pb-2">
                                <h4 className="font-bold text-base text-primary flex items-center gap-2">
                                    Ração Operacional (R2/R3)
                                </h4>
                                <span className="font-extrabold text-lg text-secondary">
                                    {formatNumber(currentOMConsolidatedData.RACAO_OPERACIONAL.total_unidades)} un.
                                </span>
                            </div>
                            
                            <div className="space-y-1 text-sm">
                                {/* Detalhes Globais */}
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                    <div className="font-medium text-muted-foreground">Efetivo / Dias</div>
                                    <div className="font-semibold text-foreground text-right">
                                        {formatNumber(currentOMConsolidatedData.RACAO_OPERACIONAL.efetivo)} mil. / {currentOMConsolidatedData.RACAO_OPERACIONAL.dias_operacao} dias
                                    </div>
                                    
                                    <div className="font-medium text-muted-foreground">Fase da Atividade</div>
                                    <div className="font-semibold text-foreground text-right">
                                        {formatFasesParaTexto(currentOMConsolidatedData.RACAO_OPERACIONAL.fase_atividade)}
                                    </div>
                                </div>
                                
                                <div className="h-px bg-border my-2" />
                                
                                {/* Quantidades R2/R3 */}
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 text-xs">
                                    <div className="font-medium text-muted-foreground">Ração Operacional R2 (24h)</div>
                                    <div className="font-semibold text-secondary text-right">
                                        {formatNumber(currentOMConsolidatedData.RACAO_OPERACIONAL.quantidade_r2 || 0)} un.
                                    </div>
                                    
                                    <div className="font-medium text-muted-foreground">Ração Operacional R3 (12h)</div>
                                    <div className="font-semibold text-secondary text-right">
                                        {formatNumber(currentOMConsolidatedData.RACAO_OPERACIONAL.quantidade_r3 || 0)} un.
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}
                </div>
                
                <div className="flex flex-col p-3 bg-primary/10 rounded-lg border border-primary/20 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-base text-primary">VALOR TOTAL DA OM</span>
                    <span className="font-extrabold text-xl text-primary">
                      {formatCurrency(totalMonetarioConsolidado)}
                    </span>
                  </div>
                  {totalUnidadesConsolidado > 0 && (
                    <div className="flex justify-between items-center text-xs pt-1">
                      <span className="text-muted-foreground">Total de Rações Operacionais</span>
                      <span className="font-semibold text-secondary">
                        {formatNumber(totalUnidadesConsolidado)} un.
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetFormFields}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Limpar Formulário
                  </Button>
                  <Button 
                    type="button" 
                    onClick={handleFinalSave} 
                    disabled={loading || !isConfigReady || isConsolidationOutdated}
                  >
                    {loading ? "Aguarde..." : (editingRegistroId ? "Atualizar Registro" : "Salvar Novo Registro")}
                  </Button>
                </div>
              </div>
            )}


            {/* 4. OMs Cadastradas */}
            {registros.length > 0 && (
              <div className="space-y-4 mt-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-accent" />
                    Registros Cadastrados
                  </h2>
                </div>

                <div className="space-y-4">
                    {Object.entries(registrosAgrupadosPorOM).map(([omKey, omRegistros]) => {
                        const totalMonetarioOM = omRegistros
                            .filter(r => r.categoria === 'RACAO_QUENTE')
                            .reduce((sum, r) => sum + r.calculos.totalQS + r.calculos.totalQR, 0);
                        const totalUnidadesOM = omRegistros
                            .filter(r => r.categoria === 'RACAO_OPERACIONAL')
                            .reduce((sum, r) => sum + (r.quantidadeR2 || 0) + (r.quantidadeR3 || 0), 0);
                            
                        const omName = omKey.split(' (')[0];
                        const ugFormatted = omKey.split(' (')[1].replace(')', ''); // Já está formatado pelo useMemo
                        
                        return (
                            <Card key={omKey} className="p-4 bg-primary/5 border-primary/20">
                                <div className="flex items-center justify-between mb-3 border-b pb-2">
                                    <h3 className="font-bold text-lg text-primary">
                                        {omName} (UG: {ugFormatted})
                                    </h3>
                                    <div className="flex flex-col items-end">
                                        {totalMonetarioOM > 0 && (
                                            <span className="font-extrabold text-xl text-primary">
                                                {formatCurrency(totalMonetarioOM)}
                                            </span>
                                        )}
                                        {totalUnidadesOM > 0 && (
                                            <span className="font-extrabold text-sm text-secondary">
                                                {formatNumber(totalUnidadesOM)} un. (R2/R3)
                                            </span>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="space-y-3">
                                    {omRegistros.map((registro) => {
                                        const isRacaoQuente = registro.categoria === 'RACAO_QUENTE';
                                        const totalGeralRegistro = isRacaoQuente 
                                            ? (registro.calculos.totalQS + registro.calculos.totalQR) 
                                            : ((registro.quantidadeR2 || 0) + (registro.quantidadeR3 || 0));
                                        const fases = formatFasesParaTexto(registro.faseAtividade);
                                        
                                        return (
                                            <Card key={registro.id} className="p-3 bg-background border">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-semibold text-base text-foreground">
                                                                {isRacaoQuente ? 'Ração Quente (R1)' : 'Ração Operacional (R2/R3)'}
                                                            </h4>
                                                            <Badge variant="outline" className="text-xs">
                                                                {fases}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            Efetivo: {registro.efetivo} | Dias: {registro.diasOperacao}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-lg text-primary/80 whitespace-nowrap">
                                                            {isRacaoQuente ? formatCurrency(totalGeralRegistro) : `${formatNumber(totalGeralRegistro)} un.`}
                                                        </span>
                                                        <div className="flex gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={() => handleEditRegistro(registro)}
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleRemover(registro.id)}
                                                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Detalhes da Alocação (QS/QR ou R2/R3) */}
                                                {isRacaoQuente ? (
                                                    <div className="pt-2 border-t mt-2 space-y-1 text-xs">
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">QS ({registro.omQS}):</span>
                                                            <span className="font-medium text-blue-600">{formatCurrency(registro.calculos.totalQS)}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">QR ({registro.organizacao}):</span>
                                                            <span className="font-medium text-green-600">{formatCurrency(registro.calculos.totalQR)}</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="pt-2 border-t mt-2 space-y-1 text-xs">
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">R2 (24h):</span>
                                                            <span className="font-medium text-secondary">{formatNumber(registro.quantidadeR2 || 0)} un.</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">R3 (12h):</span>
                                                            <span className="font-medium text-secondary">{formatNumber(registro.quantidadeR3 || 0)} un.</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </Card>
                                        );
                                    })}
                                </div>
                            </Card>
                        );
                    })}
                </div>
              </div>
            )}


            {/* 5. Memórias de Cálculos Detalhadas */}
            {registros.length > 0 && (
              <div className="space-y-4 mt-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  📋 Memórias de Cálculo Detalhadas
                </h3>
                  
                  {registros.map((registro) => {
                    const isRacaoQuente = registro.categoria === 'RACAO_QUENTE';
                    const isEditing = editingMemoriaId === registro.id;
                    
                    const hasCustomMemoria = isRacaoQuente 
                        ? !!(registro.memoriaQSCustomizada || registro.memoriaQRCustomizada)
                        // CORRIGIDO: Verificar o campo dedicado para Ração Op
                        : !!registro.memoria_calculo_op_customizada; 
                    
                    let memoriaQSFinal = "";
                    let memoriaQRFinal = "";
                    let memoriaOpFinal = "";
                    
                    if (isRacaoQuente) {
                        const { qs, qr } = generateRacaoQuenteMemoriaCalculo(registro);
                        memoriaQSFinal = isEditing ? memoriaQSEdit : (registro.memoriaQSCustomizada || qs);
                        memoriaQRFinal = isEditing ? memoriaQREdit : (registro.memoriaQRCustomizada || qr);
                    } else {
                        const op = generateRacaoOperacionalMemoriaCalculo(registro);
                        // CORRIGIDO: Usar o campo dedicado para carregar o valor
                        memoriaOpFinal = isEditing ? memoriaOpEdit : (registro.memoria_calculo_op_customizada || op);
                    }
                    
                    return (
                      <Card key={registro.id} className="p-6 bg-muted/30">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <h4 className="text-lg font-semibold text-foreground">
                              {registro.organizacao} (UG: {formatCodug(registro.ug)})
                            </h4>
                            <Badge variant="default" className={cn(
                                isRacaoQuente ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                            )}>
                                {isRacaoQuente ? 'Ração Quente (R1)' : 'Ração Operacional (R2/R3)'}
                            </Badge>
                            {hasCustomMemoria && !isEditing && (
                              <Badge variant="outline" className="text-xs">
                                Editada manualmente
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-end gap-2">
                            {!isEditing ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleIniciarEdicaoMemoria(registro)}
                                  disabled={loading}
                                  className="gap-2"
                                >
                                  <Pencil className="h-4 w-4" />
                                  Editar Memória
                                </Button>
                                
                                {hasCustomMemoria && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRestaurarMemoriaAutomatica(registro.id)}
                                    disabled={loading}
                                    className="gap-2 text-muted-foreground"
                                  >
                                    <XCircle className="h-4 w-4" />
                                    Restaurar Automática
                                  </Button>
                                )}
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleSalvarMemoriaCustomizada(registro.id)}
                                  disabled={loading}
                                  className="gap-2"
                                >
                                  <Check className="h-4 w-4" />
                                  Salvar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleCancelarEdicaoMemoria}
                                  disabled={loading}
                                  className="gap-2"
                                >
                                  <XCircle className="h-4 w-4" />
                                  Cancelar
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="h-px bg-border my-4" /> 
                        
                        {isRacaoQuente ? (
                            <>
                                {/* Bloco QS */}
                                <div className="space-y-2 mb-6">
                                  <h5 className="font-bold text-sm text-blue-600">QS - Quantitativo de Subsistência (RM: {registro.omQS})</h5>
                                  <Card className="p-4 bg-background rounded-lg border">
                                    <Textarea
                                      value={memoriaQSFinal}
                                      onChange={(e) => isEditing && setMemoriaQSEdit(e.target.value)}
                                      readOnly={!isEditing}
                                      rows={10}
                                      className={cn(
                                        "font-mono text-xs whitespace-pre-wrap text-foreground",
                                        isEditing && "border-blue-500 focus:ring-2 focus:ring-blue-500"
                                      )}
                                    />
                                  </Card>
                                </div>

                                {/* Bloco QR */}
                                <div className="space-y-2">
                                  <h5 className="font-bold text-sm text-green-600">QR - Quantitativo de Reforço (OM: {registro.organizacao})</h5>
                                  <Card className="p-4 bg-background rounded-lg border">
                                    <Textarea
                                      value={memoriaQRFinal}
                                      onChange={(e) => isEditing && setMemoriaQREdit(e.target.value)}
                                      readOnly={!isEditing}
                                      rows={10}
                                      className={cn(
                                        "font-mono text-xs whitespace-pre-wrap text-foreground",
                                        isEditing && "border-green-500 focus:ring-2 focus:ring-green-500"
                                      )}
                                    />
                                  </Card>
                                </div>
                            </>
                        ) : (
                            /* Bloco Ração Operacional */
                            <div className="space-y-2">
                              <h5 className="font-bold text-sm text-secondary">Ração Operacional (R2/R3)</h5>
                              <Card className="p-4 bg-background rounded-lg border">
                                <Textarea
                                  value={memoriaOpFinal}
                                  onChange={(e) => isEditing && setMemoriaOpEdit(e.target.value)}
                                  readOnly={!isEditing}
                                  rows={8}
                                  className={cn(
                                    "font-mono text-xs whitespace-pre-wrap text-foreground",
                                    isEditing && "border-secondary focus:ring-2 focus:ring-secondary"
                                  )}
                                />
                              </Card>
                            </div>
                        )}
                      </Card>
                    );
                  })}
              </div>
            )}
          
          </div>
        </Card>
      </div>
    </div>
  );
}