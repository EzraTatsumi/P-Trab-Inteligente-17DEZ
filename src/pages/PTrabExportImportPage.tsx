import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Adicionado Label
import { ArrowLeft, Download, Upload, Lock, AlertCircle, Check, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { ExportPasswordDialog } from "@/components/ExportPasswordDialog";
import { encryptData, decryptData } from "@/lib/cryptoUtils"; // Importar utilitários de criptografia
import { ImportPTrabOptionsDialog } from "@/components/ImportPTrabOptionsDialog"; // Importar novo diálogo
import { OMData } from "@/lib/omUtils"; // Importar OMData
import { ImportConflictDialog } from "@/components/ImportConflictDialog"; // NOVO IMPORT
import { generateUniqueMinutaNumber, isPTrabNumberDuplicate } from "@/lib/ptrabNumberUtils"; // Importar utilitários de numeração
import { formatDateDDMMMAA } from "@/lib/formatUtils"; // Importar utilitário de formatação de data

// Define the structure of the exported data
interface ExportData {
  version: string;
  timestamp: string;
  userId: string;
  type: 'full_backup' | 'single_ptrab';
  data: {
    p_trab: Tables<'p_trab'>[] | Tables<'p_trab'>; // Array for full, single object for single
    classe_i_registros: Tables<'classe_i_registros'>[];
    classe_ii_registros: Tables<'classe_ii_registros'>[]; // Adicionado Classe II
    classe_iii_registros: Tables<'classe_iii_registros'>[];
    p_trab_ref_lpc: Tables<'p_trab_ref_lpc'> | null;
    // Global tables only included in full backup
    organizacoes_militares?: Tables<'organizacoes_militares'>[];
    diretrizes_custeio?: Tables<'diretrizes_custeio'>[];
    diretrizes_equipamentos_classe_iii?: Tables<'diretrizes_equipamentos_classe_iii'>[];
  };
}

interface SimplePTrab {
  id: string;
  numero_ptrab: string;
  nome_operacao: string;
}

interface ImportSummary {
    type: 'full_backup' | 'single_ptrab';
    details: string;
    omSigla?: string;
    ptrabNumber?: string;
    operationName?: string;
}

// NOVO: Função para gerar o nome do arquivo de exportação
const generateExportFileName = (pTrabData: Tables<'p_trab'>): string => {
    const dataAtz = formatDateDDMMMAA(pTrabData.updated_at);
    // Substitui barras por hífens para segurança no nome do arquivo
    const numeroPTrab = pTrabData.numero_ptrab.replace(/\//g, '-'); 
    
    // Verifica se o P Trab está aprovado (numerado oficialmente)
    const isApproved = pTrabData.status === 'aprovado' && !pTrabData.numero_ptrab.startsWith('Minuta');
    
    let nomeBase = `P Trab Nr ${numeroPTrab} - ${pTrabData.nome_operacao}`;
    
    // Se NÃO estiver aprovado, inclui a sigla da OM
    if (!isApproved) {
        nomeBase += ` - ${pTrabData.nome_om}`;
    }
    
    nomeBase += ` - Atz ${dataAtz}`;
    
    return `${nomeBase}.json`;
};


const PTrabExportImportPage = () => {
  const navigate = useNavigate();
  const { handleEnterToNextField } = useFormNavigation();
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDataPreview, setImportDataPreview] = useState<ExportData | null>(null);
  
  // Ref para a seção de resumo da importação
  const importSummaryRef = useRef<HTMLDivElement>(null);

  // Estados para exportação de P Trab único
  const [pTrabsList, setPTrabsList] = useState<SimplePTrab[]>([]);
  const [existingPTrabNumbers, setExistingPTrabNumbers] = useState<string[]>([]); // Lista de números existentes
  const [isSelectPTrabDialogOpen, setIsSelectPTrabDialogOpen] = useState(false);
  const [selectedPTrabId, setSelectedPTrabId] = useState<string | null>(null);

  // Estados para o diálogo de senha de exportação
  const [isExportPasswordDialogOpen, setIsExportPasswordDialogOpen] = useState(false);
  const [exportActionType, setExportActionType] = useState<'single' | null>(null); // Removido 'full'

  // Estados para o diálogo de senha de importação
  const [isImportPasswordDialogOpen, setIsImportPasswordDialogOpen] = useState(false);
  const [encryptedContent, setEncryptedContent] = useState<string | null>(null);
  
  // Estados para o diálogo de opções de importação (OM/Numeração)
  const [isImportOptionsDialogOpen, setIsImportOptionsDialogOpen] = useState(false);
  
  // NOVO ESTADO: Diálogo de Conflito
  const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);
  const [ptrabToOverwriteId, setPtrabToOverwriteId] = useState<string | null>(null); // ID do PTrab existente a ser sobrescrito
  
  // Novo estado para a lista de OMs do usuário
  const [userOms, setUserOms] = useState<OMData[]>([]);
  const [loadingOms, setLoadingOms] = useState(true); // NOVO: Estado de carregamento das OMs


  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado para acessar esta página.");
        navigate("/login");
        return;
      }
      setUserId(user.id);
      loadPTrabsList(user.id);
      loadExistingPTrabNumbers(user.id);
      loadUserOms(user.id);
    };
    fetchUser();
  }, [navigate]);

  const loadPTrabsList = async (currentUserId: string) => {
    try {
      const { data, error } = await supabase
        .from('p_trab')
        .select('id, numero_ptrab, nome_operacao')
        .eq('user_id', currentUserId)
        .order('numero_ptrab', { ascending: false });

      if (error) throw error;
      setPTrabsList(data || []);
    } catch (error) {
      console.error("Erro ao carregar lista de P Trabs:", error);
      toast.error("Erro ao carregar lista de P Trabs.");
    }
  };

  const loadExistingPTrabNumbers = async (currentUserId: string) => {
    try {
      const { data, error } = await supabase
        .from('p_trab')
        .select('numero_ptrab')
        .eq('user_id', currentUserId);
      
      if (error) throw error;
      setExistingPTrabNumbers((data || []).map(p => p.numero_ptrab));
    } catch (error) {
      console.error("Erro ao carregar números existentes:", error);
    }
  };

  const loadUserOms = async (currentUserId: string) => {
    setLoadingOms(true); // Inicia o carregamento
    try {
      const { data, error } = await supabase
        .from('organizacoes_militares')
        .select('*')
        .eq('user_id', currentUserId)
        .eq('ativo', true)
        .order('nome_om');
      
      if (error) throw error;
      setUserOms((data || []) as OMData[]);
    } catch (error) {
      console.error("Erro ao carregar OMs do usuário:", error);
      toast.error("Erro ao carregar OMs do usuário.");
    } finally {
      setLoadingOms(false); // Finaliza o carregamento
    }
  };

  // Função que inicia o processo de exportação única (abre o diálogo de senha)
  const handleInitiateExportSingle = () => {
    if (!selectedPTrabId) {
      toast.error("Selecione um P Trab para exportar.");
      return;
    }
    setExportActionType('single');
    setIsExportPasswordDialogOpen(true);
  };

  // Função principal de exportação (chamada após a senha ser confirmada)
  const performExport = async (password: string) => {
    if (!userId) {
      toast.error("Usuário não autenticado.");
      return;
    }
    
    setIsExportPasswordDialogOpen(false);
    setLoading(true);

    try {
      if (exportActionType === 'single' && selectedPTrabId) {
        await exportSinglePTrab(selectedPTrabId, password);
      }
    } catch (error: any) {
      console.error("Erro na exportação:", error);
      toast.error(error.message || "Erro desconhecido durante a exportação.");
    } finally {
      setLoading(false);
      setExportActionType(null);
    }
  };

  const exportSinglePTrab = async (ptrabId: string, password: string) => {
    // 1. Fetch PTrab principal
    const { data: pTrabData, error: pTrabError } = await supabase
      .from('p_trab')
      .select('*, updated_at') // Seleciona explicitamente updated_at
      .eq('id', ptrabId)
      .eq('user_id', userId!)
      .single();

    if (pTrabError || !pTrabData) throw new Error("P Trab não encontrado ou acesso negado.");

    // 2. Fetch related records
    const [
      { data: classeIData, error: classeIError },
      { data: classeIIData, error: classeIIError }, // Fetch Classe II
      { data: classeIIIData, error: classeIIIError },
      { data: refLPCData, error: refLPCError },
    ] = await Promise.all([
      supabase.from('classe_i_registros').select('*').eq('p_trab_id', ptrabId),
      supabase.from('classe_ii_registros').select('*, itens_equipamentos').eq('p_trab_id', ptrabId), // Select itens_equipamentos
      supabase.from('classe_iii_registros').select('*, itens_equipamentos').eq('p_trab_id', ptrabId),
      supabase.from('p_trab_ref_lpc').select('*').eq('p_trab_id', ptrabId).maybeSingle(),
    ]);

    if (classeIError) console.error("Erro ao buscar Classe I:", classeIError);
    if (classeIIError) console.error("Erro ao buscar Classe II:", classeIIError);
    if (classeIIIError) console.error("Erro ao buscar Classe III:", classeIIIError);
    if (refLPCError) console.error("Erro ao buscar Ref LPC:", refLPCError);

    const exportObject: ExportData = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      userId: userId!,
      type: 'single_ptrab',
      data: {
        p_trab: pTrabData,
        classe_i_registros: classeIData || [],
        classe_ii_registros: classeIIData || [], // Incluir Classe II
        classe_iii_registros: classeIIIData || [],
        p_trab_ref_lpc: refLPCData || null,
      },
    };

    // Criptografar o objeto de exportação
    const encryptedString = encryptData(exportObject, password);

    const blob = new Blob([encryptedString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    // USAR A NOVA FUNÇÃO DE GERAÇÃO DE NOME
    link.download = generateExportFileName(pTrabData);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`P Trab ${pTrabData.numero_ptrab} exportado com sucesso!`);
    setIsSelectPTrabDialogOpen(false);
    setSelectedPTrabId(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportDataPreview(null);
      setEncryptedContent(null);
    }
  };

  const handlePreviewImport = () => {
    if (!importFile) {
      toast.error("Selecione um arquivo para importar.");
      return;
    }

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        
        // Armazena o conteúdo criptografado e abre o diálogo de senha
        setEncryptedContent(content);
        setIsImportPasswordDialogOpen(true);
        
      } catch (error: any) {
        console.error("Erro ao ler arquivo:", error);
        toast.error("Erro ao ler o arquivo. Certifique-se de que é um JSON válido.");
        setImportFile(null);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(importFile);
  };

  const performDecryptionAndPreview = (password: string) => {
    if (!encryptedContent || !userId) {
      toast.error("Conteúdo ou usuário não encontrado.");
      return;
    }

    setIsImportPasswordDialogOpen(false);
    setLoading(true);

    try {
      const decryptedData = decryptData(encryptedContent, password);
      
      if (!decryptedData) {
        throw new Error("Senha incorreta ou arquivo corrompido.");
      }

      const data = decryptedData as ExportData;
      
      if (!data.version || !data.data || !data.userId || !data.type) {
        throw new Error("Formato de arquivo inválido após descriptografia. Faltam campos essenciais.");
      }
      
      if (data.userId !== userId) {
          toast.warning("Aviso: O arquivo foi exportado por outro usuário. A importação pode falhar ou sobrescrever dados.");
      }

      setImportDataPreview(data);
      toast.success("Arquivo analisado e descriptografado. Revise os dados antes de confirmar a importação.");
      
      // Rolar para a seção de resumo após o sucesso
      setTimeout(() => {
        importSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

    } catch (error: any) {
      console.error("Erro ao analisar/descriptografar arquivo:", error);
      toast.error(error.message || "Erro ao descriptografar o arquivo. Verifique a senha.");
      setImportFile(null);
    } finally {
      setLoading(false);
      setEncryptedContent(null);
    }
  };

  // Função chamada quando a análise está pronta
  const handleAnalysisReady = () => {
    if (!importDataPreview || importDataPreview.type === 'full_backup') {
        // Block full backup import
        toast.error("Importação de Backup Completo não é mais suportada. Importe um P Trab individual.");
        setImportDataPreview(null);
        setImportFile(null);
        return;
    }
    
    // Verifica se o usuário tem OMs cadastradas antes de prosseguir
    if (loadingOms) {
        toast.info("Aguarde o carregamento das Organizações Militares...");
        return;
    }
    
    if (userOms.length === 0) {
        toast.error("Nenhuma OM cadastrada para o usuário. Cadastre uma OM antes de importar.");
        return;
    }
    
    const importedPTrab = importDataPreview.data.p_trab as Tables<'p_trab'>;
    const importedNumber = importedPTrab.numero_ptrab;
    
    const isMinuta = importedNumber && importedNumber.startsWith("Minuta");
    const isOfficialNumber = importedNumber && !isMinuta;
    const existingPTrab = pTrabsList.find(p => p.numero_ptrab === importedNumber);

    if (isOfficialNumber && existingPTrab) {
        // Conflito detectado para um número oficial
        setPtrabToOverwriteId(existingPTrab.id);
        setIsConflictDialogOpen(true);
    } else {
        // Se for Minuta OU número oficial sem conflito, abre o diálogo de opções
        // para que o usuário selecione a OM de destino e confirme a numeração.
        setIsImportOptionsDialogOpen(true);
    }
  };
  
  // Handlers para resolução de conflito
  const handleOverwrite = () => {
    setIsConflictDialogOpen(false);
    if (ptrabToOverwriteId) {
        performOverwriteImport(ptrabToOverwriteId);
    } else {
        toast.error("Erro interno: ID do P Trab a ser sobrescrito não encontrado.");
    }
  };

  // NOVO HANDLER: Cria um novo número de Minuta e importa diretamente (Chamado pelo ImportConflictDialog)
  const handleCreateNewNumberAndImport = () => {
    if (!importDataPreview || importDataPreview.type !== 'single_ptrab' || !userId) {
        toast.error("Erro: Dados de importação inválidos.");
        return;
    }
    
    setIsConflictDialogOpen(false);
    setLoading(true);
    
    try {
        const importedPTrab = importDataPreview.data.p_trab as Tables<'p_trab'>;
        
        // 1. Gerar novo número de Minuta
        const newMinutaNumber = generateUniqueMinutaNumber(existingPTrabNumbers);
        
        // 2. Usar a primeira OM do usuário como OM de destino (se houver)
        const defaultOm = userOms[0];
        if (!defaultOm) {
            throw new Error("Nenhuma OM cadastrada para o usuário. Cadastre uma OM antes de importar.");
        }
        
        // 3. Preparar os dados finais para importação (Minuta, status aberto, OM do usuário)
        const finalPTrabData: Tables<'p_trab'> = {
            ...importedPTrab,
            numero_ptrab: newMinutaNumber,
            nome_om: defaultOm.nome_om, // Usar o nome da OM selecionada
            codug_om: defaultOm.codug_om,
            rm_vinculacao: defaultOm.rm_vinculacao,
            codug_rm_vinculacao: defaultOm.codug_rm_vinculacao,
            comando_militar_area: defaultOm.rm_vinculacao, // Usar a RM como CMA (simplificação)
            status: 'aberto', // Forçar status aberto
        };

        // 4. Chamar a função de importação final
        handleConfirmSinglePTrabImport(finalPTrabData);
        
    } catch (error: any) {
        console.error("Erro ao criar novo número e importar:", error);
        toast.error(error.message || "Erro ao importar como Minuta.");
        setLoading(false);
    }
  };

  // Função para realizar a sobrescrita (Update)
  const performOverwriteImport = async (existingPTrabId: string) => {
    if (!importDataPreview || !userId) return;

    setLoading(true);

    try {
        const data = importDataPreview.data;
        const importedPTrab = data.p_trab as Tables<'p_trab'>;
        
        // 1. Update existing PTrab header
        const { id, created_at, updated_at, ...restOfPTrab } = importedPTrab;
        const updatePTrabData = {
            ...restOfPTrab,
            user_id: userId,
            status: 'aprovado', // Assume que se está sobrescrevendo um número oficial, o status é 'aprovado'
            origem: 'importado',
            updated_at: new Date().toISOString(),
        };
        
        const { error: updatePTrabError } = await supabase
            .from("p_trab")
            .update(updatePTrabData as TablesUpdate<'p_trab'>)
            .eq("id", existingPTrabId);

        if (updatePTrabError) throw new Error(`Erro ao atualizar P Trab: ${updatePTrabError.message}`);
        
        // 2. Delete all existing dependent records for the existing PTrab
        const dependentTables: (keyof ExportData['data'])[] = [
            'p_trab_ref_lpc',
            'classe_i_registros',
            'classe_ii_registros',
            'classe_iii_registros',
        ];
        
        for (const table of dependentTables) {
            const { error } = await supabase.from(table).delete().eq('p_trab_id', existingPTrabId);
            if (error) console.error(`Erro ao deletar registros antigos de ${table}:`, error);
        }
        
        // 3. Insert new dependent records from the imported data
        for (const table of dependentTables) {
            const records = data[table];
            if (records) {
                const recordsArray = Array.isArray(records) ? records : [records].filter(Boolean);
                
                if (recordsArray.length > 0) {
                    const recordsToInsert = recordsArray.map(record => {
                        const newRecord = { ...record };
                        delete (newRecord as any).id;
                        delete (newRecord as any).created_at;
                        delete (newRecord as any).updated_at;
                        (newRecord as any).p_trab_id = existingPTrabId; // Use the existing ID
                        return newRecord;
                    });
                    
                    const { error } = await supabase.from(table).insert(recordsToInsert);
                    if (error) console.error(`Erro ao inserir registros de ${table}:`, error);
                }
            }
        }
        
        toast.success(`P Trab ${importedPTrab.numero_ptrab} sobrescrito e atualizado com sucesso!`);
        
        setImportDataPreview(null);
        setImportFile(null);
        navigate("/ptrab"); // Redireciona para recarregar os dados
    } catch (error: any) {
        console.error("Erro na sobrescrita de P Trab:", error);
        toast.error(error.message || "Erro desconhecido durante a sobrescrita.");
    } finally {
        setLoading(false);
    }
  };


  // Função chamada pelo ImportPTrabOptionsDialog para iniciar a importação final (INSERT)
  const handleConfirmSinglePTrabImport = async (finalPTrabData: Tables<'p_trab'>) => {
    if (!importDataPreview || !userId) return;

    setIsImportOptionsDialogOpen(false);
    setLoading(true);

    try {
        const data = importDataPreview.data;
        
        // 1. Inserir novo P Trab (usando os dados modificados pelo diálogo)
        const { id, created_at, updated_at, ...restOfPTrab } = finalPTrabData;
        
        // Determine status: if the number is official, set to 'aprovado', otherwise 'aberto' (Minuta)
        const isOfficialNumber = finalPTrabData.numero_ptrab && !finalPTrabData.numero_ptrab.startsWith("Minuta");
        
        const newPTrabData = {
            ...restOfPTrab,
            user_id: userId,
            status: isOfficialNumber ? 'aprovado' : 'aberto', // Set status based on final number
            origem: 'importado', // MARCAR COMO IMPORTADO
        };
        
        const { data: newPTrab, error: insertPTrabError } = await supabase
            .from("p_trab")
            .insert([newPTrabData])
            .select()
            .single();

        if (insertPTrabError || !newPTrab) throw new Error(`Erro ao criar novo P Trab: ${insertPTrabError?.message}`);
        const newPTrabId = newPTrab.id;
        
        // 2. Mapear e inserir registros dependentes
        const dependentTables: (keyof ExportData['data'])[] = [
            'p_trab_ref_lpc',
            'classe_i_registros',
            'classe_ii_registros',
            'classe_iii_registros',
        ];
        
        for (const table of dependentTables) {
            const records = data[table];
            if (records) {
                const recordsArray = Array.isArray(records) ? records : [records].filter(Boolean);
                
                if (recordsArray.length > 0) {
                    const recordsToInsert = recordsArray.map(record => {
                        const newRecord = { ...record };
                        delete (newRecord as any).id;
                        delete (newRecord as any).created_at;
                        delete (newRecord as any).updated_at;
                        (newRecord as any).p_trab_id = newPTrabId;
                        return newRecord;
                    });
                    
                    const { error } = await supabase.from(table).insert(recordsToInsert);
                    if (error) console.error(`Erro ao importar registros de ${table}:`, error);
                }
            }
        }
        
        toast.success(`P Trab ${newPTrab.numero_ptrab} importado e criado com sucesso!`);
        
        setImportDataPreview(null);
        setImportFile(null);
        navigate("/ptrab"); // Redireciona para recarregar os dados
    } catch (error: any) {
        console.error("Erro na importação de P Trab único:", error);
        toast.error(error.message || "Erro desconhecido durante a importação. Verifique o console.");
    } finally {
        setLoading(false);
    }
  };

  const getImportSummary = (data: ExportData): ImportSummary => {
    const isFull = data.type === 'full_backup';
    
    if (isFull) {
        const summary = Object.entries(data.data).map(([key, records]) => {
            const count = Array.isArray(records) ? records.length : (records ? 1 : 0);
            return `${key}: ${count} registros`;
        }).join(', ');
        return {
            type: 'full_backup',
            details: `Versão: ${data.version}. Exportado em: ${new Date(data.timestamp).toLocaleDateString()}. Dados: ${summary}`
        };
    } else {
        const pTrab = data.data.p_trab as Tables<'p_trab'>;
        // FIX: Use (array || []).length to safely access length
        const classeICount = (data.data.classe_i_registros || []).length;
        const classeIICount = (data.data.classe_ii_registros || []).length;
        const classeIIICount = (data.data.classe_iii_registros || []).length;
        const refLPCExists = !!data.data.p_trab_ref_lpc;
        
        return {
            type: 'single_ptrab',
            omSigla: pTrab.nome_om,
            ptrabNumber: pTrab.numero_ptrab,
            operationName: pTrab.nome_operacao,
            details: `Registros: ${classeICount} Classe I, ${classeIICount} Classe II, ${classeIIICount} Classe III, Ref LPC: ${refLPCExists ? 'Sim' : 'Não'}.`
        };
    }
  };

  const summary = importDataPreview ? getImportSummary(importDataPreview) : null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate("/ptrab")} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Exportar / Importar Dados do P Trab</CardTitle>
            <CardDescription>
              Gerencie o backup e a restauração de seus Planos de Trabalho.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Seção de Exportação (Download) */}
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Upload className="h-5 w-5 text-destructive" /> {/* Ícone de Upload (vermelho) */}
                Exportar Dados
              </h3>
              <p className="text-sm text-muted-foreground">
                Exporte um Plano de Trabalho individual. O arquivo será criptografado com a senha fornecida.
              </p>
              
              <div className="flex justify-center">
                <Dialog open={isSelectPTrabDialogOpen} onOpenChange={setIsSelectPTrabDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="default"
                      disabled={loading || pTrabsList.length === 0}
                      className="max-w-xs w-full bg-green-600 hover:bg-green-700"
                      onClick={() => setSelectedPTrabId(null)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Exportar P Trab
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Selecione o P Trab</DialogTitle>
                      <DialogDescription>
                        Escolha qual Plano de Trabalho deseja exportar individualmente.
                      </DialogDescription>
                    </DialogHeader>
                    <Command>
                      <CommandInput placeholder="Buscar P Trab..." />
                      <CommandList className="max-h-[300px]">
                        <CommandEmpty>Nenhum P Trab encontrado.</CommandEmpty>
                        <CommandGroup>
                          {pTrabsList.map((ptrab) => (
                            <CommandItem
                              key={ptrab.id}
                              value={ptrab.numero_ptrab}
                              onSelect={() => setSelectedPTrabId(ptrab.id)}
                              className={cn(
                                "cursor-pointer",
                                selectedPTrabId === ptrab.id && "bg-accent text-accent-foreground"
                              )}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedPTrabId === ptrab.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{ptrab.numero_ptrab}</span>
                                <span className="text-xs text-muted-foreground">{ptrab.nome_operacao}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                    <DialogFooter>
                      <Button 
                        onClick={handleInitiateExportSingle} 
                        disabled={!selectedPTrabId || loading}
                      >
                        Exportar P Trab
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Seção de Importação (Upload) */}
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Download className="h-5 w-5 text-green-600" /> {/* Ícone de Download (verde) */}
                Importar Dados
              </h3>
              <p className="text-sm text-muted-foreground">
                Carregue um arquivo JSON criptografado exportado anteriormente.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <Input
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  disabled={loading}
                  // Removendo h-10 e py-2 do input principal e ajustando o file selector
                  className="file:text-primary file:bg-muted file:border-border file:border file:rounded-md file:px-3 file:py-1 file:text-sm file:font-medium file:cursor-pointer hover:file:bg-muted/80"
                />
                <Button 
                    onClick={handlePreviewImport} 
                    disabled={loading || !importFile || importDataPreview !== null}
                    variant="secondary"
                >
                    {loading ? "Analisando..." : "Analisar Arquivo"}
                </Button>
              </div>

              {summary && (
                <div className="space-y-3 p-3 border border-primary/30 rounded-md bg-primary/5" ref={importSummaryRef}>
                    <div className="flex items-center gap-2 text-sm font-medium text-primary">
                        <Check className="h-4 w-4" />
                        <span>Análise Concluída</span>
                    </div>
                    
                    {summary.type === 'single_ptrab' && summary.ptrabNumber && (
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-foreground">
                                P Trab: {summary.ptrabNumber}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                OM: {summary.omSigla} | Operação: {summary.operationName}
                            </p>
                        </div>
                    )}
                    
                    {summary.type === 'full_backup' && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                Importação de Backup Completo não é mais suportada. Por favor, importe um P Trab individual.
                            </AlertDescription>
                        </Alert>
                    )}

                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                        {summary.details}
                    </p>
                    <Button 
                        onClick={handleAnalysisReady} 
                        disabled={loading || summary.type === 'full_backup' || loadingOms} // Desabilita se estiver carregando OMs
                        className="w-full bg-destructive hover:bg-destructive/90"
                    >
                        {loadingOms ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando OMs...</>
                        ) : (
                            loading ? "Preparando Importação..." : "Continuar Importação (Opções)"
                        )}
                    </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Diálogo de Senha de Exportação */}
      <ExportPasswordDialog
        open={isExportPasswordDialogOpen}
        onOpenChange={setIsExportPasswordDialogOpen}
        onConfirm={performExport}
        title={"Senha de Criptografia (P Trab Único)"}
        description="Esta senha será usada para 'criptografar' o arquivo exportado. Você precisará dela para importar o arquivo futuramente."
      />

      {/* Diálogo de Senha de Importação */}
      <ExportPasswordDialog
        open={isImportPasswordDialogOpen}
        onOpenChange={setIsImportPasswordDialogOpen}
        onConfirm={performDecryptionAndPreview}
        title="Senha de Descriptografia"
        description="Digite a senha usada para criptografar o arquivo para descriptografar o conteúdo."
        confirmButtonText="Confirmar Descriptografia" // Ajustado o texto do botão
      />
      
      {/* NOVO: Diálogo de Conflito */}
      {importDataPreview && importDataPreview.type === 'single_ptrab' && (
        <ImportConflictDialog
          open={isConflictDialogOpen}
          onOpenChange={setIsConflictDialogOpen}
          ptrabNumber={(importDataPreview.data.p_trab as Tables<'p_trab'>).numero_ptrab}
          onOverwrite={handleOverwrite}
          onCreateNew={() => {
            // Ao criar novo número, abrimos o diálogo de opções para que o usuário selecione a OM
            setIsConflictDialogOpen(false);
            setIsImportOptionsDialogOpen(true);
          }}
        />
      )}

      {/* Diálogo de Opções de Importação (OM/Numeração) */}
      {importDataPreview && importDataPreview.type === 'single_ptrab' && (
        <ImportPTrabOptionsDialog
          open={isImportOptionsDialogOpen}
          onOpenChange={setIsImportOptionsDialogOpen}
          importedPTrab={importDataPreview.data.p_trab as Tables<'p_trab'>}
          existingPTrabNumbers={existingPTrabNumbers}
          userOms={userOms} // Passar a lista de OMs
          onConfirmImport={handleConfirmSinglePTrabImport}
        />
      )}
    </div>
  );
};

export default PTrabExportImportPage;